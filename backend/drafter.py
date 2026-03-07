"""
AI draft generation — gathers context and produces post variants.

Flow:
  1. gather_context(pillar_id) → playbook + top_learnings + hit posts + hooks + hashtags
  2. generate_drafts(topic, context, style) → 2-3 variants
"""

from __future__ import annotations

import json
import logging

from backend import prompts
from backend.context import build_creator_context
from backend.db import get_conn
from backend.llm import generate, get_model_name

logger = logging.getLogger(__name__)


def gather_context(pillar_id: int | None = None) -> dict:
    """Gather draft-specific context (voice reference, hooks, hashtags, pillar info).

    Playbook, learnings, strategy, goals, and profile are now provided
    by build_creator_context() and injected separately into the prompt.
    """
    conn = get_conn()

    # Voice reference: prefer hit posts, then average, then unclassified
    top_posts = conn.execute("""
        SELECT p.content, lm.engagement_score, lm.saves, p.classification
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        ORDER BY
            CASE WHEN p.classification = 'hit' THEN 0
                 WHEN p.classification = 'average' THEN 1
                 ELSE 2 END,
            lm.saves DESC,
            lm.engagement_score DESC
        LIMIT 5
    """).fetchall()
    voice_reference = "\n---\n".join(
        f"[{r['classification'] or 'unclassified'}, {r['saves']} saves]\n{r['content'][:400]}"
        for r in top_posts
    ) or "No posts with metrics yet."

    hooks_query = "SELECT text, style, avg_engagement_score FROM hooks ORDER BY avg_engagement_score DESC NULLS LAST LIMIT 10"
    hooks = conn.execute(hooks_query).fetchall()
    hooks_text = "\n".join(
        f"- [{r['style']}] {r['text']}" for r in hooks
    ) or "No hooks saved yet."

    hashtags_text = ""
    pillar_name = ""
    pillar_description = ""
    if pillar_id:
        pillar = conn.execute("SELECT * FROM content_pillars WHERE id = ?", (pillar_id,)).fetchone()
        if pillar:
            pillar_name = pillar["name"]
            pillar_description = pillar["description"] or ""

        hs = conn.execute(
            "SELECT hashtags FROM hashtag_sets WHERE pillar_id = ? LIMIT 3", (pillar_id,)
        ).fetchall()
        all_tags = []
        for h in hs:
            all_tags.extend(json.loads(h["hashtags"]))
        hashtags_text = " ".join(all_tags[:10])

    if not hashtags_text:
        hashtags_text = "No hashtags configured yet."

    return {
        "voice_reference": voice_reference,
        "hooks": hooks_text,
        "hashtags": hashtags_text,
        "pillar_name": pillar_name or "General",
        "pillar_description": f"Description: {pillar_description}" if pillar_description else "",
    }


async def generate_drafts(
    topic: str,
    pillar_id: int | None = None,
    style: str | None = None,
    num_variants: int = 3,
    context: dict | None = None,
) -> list[dict]:
    """Generate draft variants for a given topic."""
    if context is None:
        context = gather_context(pillar_id)

    # Build unified creator context (profile, strategy, goals, voice, DNA, playbook, learnings)
    creator_context = build_creator_context()
    voice_ref = context["voice_reference"]

    prompt_text = prompts.GENERATE_DRAFT.format(
        topic=topic,
        pillar_name=context["pillar_name"],
        pillar_description=context["pillar_description"],
        style=style or "professional, engaging",
        creator_context=creator_context,
        voice_reference=voice_ref,
        hooks=context["hooks"],
        hashtags=context["hashtags"],
        num_variants=num_variants,
    )

    result = await generate(prompt_text, system=prompts.SYSTEM_DRAFTER)

    try:
        from backend.utils import parse_llm_json
        variants = parse_llm_json(result)
        if not isinstance(variants, list):
            variants = [variants]
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse draft variants: %s", result[:200],
                        extra={"action": "Check LLM prompt format in prompts.GENERATE_DRAFT."})
        variants = [{"hook_variant": "default", "content": result, "suggested_hashtags": []}]

    conn = get_conn()
    model = get_model_name()
    saved_drafts = []
    for variant in variants:
        content = variant.get("content", "")
        confidence = _score_draft_confidence(content, pillar_id, conn)
        cur = conn.execute(
            """INSERT INTO drafts (topic, content, hook_variant, pillar_id, ai_model, status, confidence)
               VALUES (?, ?, ?, ?, ?, 'draft', ?)""",
            (topic, content, variant.get("hook_variant", ""),
             pillar_id, model, confidence),
        )
        row = conn.execute("SELECT * FROM drafts WHERE id = ?", (cur.lastrowid,)).fetchone()
        saved_drafts.append(dict(row))

    conn.commit()
    return saved_drafts


def _score_draft_confidence(content: str, pillar_id: int | None, conn) -> float:
    """Score draft confidence based on strategy alignment, goal fit, and learnings applied."""
    score = 0.5

    if not content:
        return score

    content_lower = content.lower()
    word_count = len(content.split())

    # 1. Strategy pillar alignment
    try:
        row = conn.execute("SELECT review_data FROM strategy_reviews WHERE id = 1").fetchone()
        if row:
            review = json.loads(row["review_data"]) if isinstance(row["review_data"], str) else row["review_data"]
            verdicts = review.get("pillar_verdicts", [])
            if pillar_id and verdicts:
                pillar_name_row = conn.execute(
                    "SELECT name FROM content_pillars WHERE id = ?", (pillar_id,)
                ).fetchone()
                if pillar_name_row:
                    for pv in verdicts:
                        if pv.get("pillar", "").lower() == pillar_name_row["name"].lower():
                            verdict = pv.get("verdict", "Maintain")
                            if verdict == "Invest":
                                score += 0.15
                            elif verdict == "Retire":
                                score -= 0.2
                            break
    except Exception:
        pass

    # 2. Length in sweet spot
    try:
        dna_row = conn.execute("SELECT content_dna FROM creator_memory WHERE id = 1").fetchone()
        if dna_row:
            dna = json.loads(dna_row["content_dna"]) if isinstance(dna_row["content_dna"], str) else dna_row["content_dna"]
            sweet_spot = dna.get("length_sweet_spot", {}).get("optimal_range")
            if sweet_spot and len(sweet_spot) == 2:
                if sweet_spot[0] <= word_count <= sweet_spot[1]:
                    score += 0.1
                else:
                    score -= 0.05
    except Exception:
        pass

    # 3. Goal keyword alignment
    try:
        goals = conn.execute(
            "SELECT metric FROM goals WHERE status = 'active'"
        ).fetchall()
        if goals:
            goal_keywords = {"engagement", "followers", "impressions", "saves", "comments", "growth"}
            matched = sum(1 for kw in goal_keywords if kw in content_lower)
            if matched:
                score += min(0.1, matched * 0.03)
    except Exception:
        pass

    # 4. Has CTA (learnings usually say CTAs help)
    cta_signals = ["comment below", "share your", "what do you think", "let me know",
                   "follow me", "repost", "agree?", "disagree?", "save this"]
    if any(signal in content_lower for signal in cta_signals):
        score += 0.05

    # 5. Has hook (first line is short and punchy)
    first_line = content.split("\n")[0].strip()
    if len(first_line) < 100 and first_line:
        score += 0.05

    return max(0.0, min(1.0, round(score, 2)))


async def extract_hook_from_post(content: str) -> dict:
    """Extract and classify the hook from a post."""
    prompt_text = prompts.EXTRACT_HOOK.format(content=content[:500])
    result = await generate(prompt_text)

    try:
        from backend.utils import parse_llm_json
        return parse_llm_json(result)
    except (json.JSONDecodeError, IndexError, ValueError):
        first_line = content.split("\n")[0].strip()
        return {"hook_text": first_line, "style": "statement"}
