"""
AI draft generation — gathers context and produces post variants.

Flow:
  1. gather_context(pillar_id) → playbook + top posts + hooks + hashtags
  2. generate_draft(topic, context, style) → 2-3 variants
"""

from __future__ import annotations

import json
import logging

from backend import prompts
from backend.db import get_conn
from backend.llm import generate, get_model_name

logger = logging.getLogger(__name__)


def gather_context(pillar_id: int | None = None) -> dict:
    """Gather all relevant context for draft generation."""
    conn = get_conn()

    playbook_row = conn.execute(
        "SELECT content FROM playbook ORDER BY generated_at DESC LIMIT 1"
    ).fetchone()
    playbook = playbook_row["content"] if playbook_row else "No playbook generated yet."

    top_posts = conn.execute("""
        SELECT p.content, ms.engagement_score
        FROM posts p
        JOIN metrics_snapshots ms ON ms.post_id = p.id
        WHERE p.author = 'me'
        ORDER BY ms.engagement_score DESC
        LIMIT 5
    """).fetchall()
    voice_reference = "\n---\n".join(
        f"[Score: {r['engagement_score']:.4f}]\n{r['content'][:300]}" for r in top_posts
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
        "playbook": playbook,
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
) -> list[dict]:
    """Generate draft variants for a given topic."""
    context = gather_context(pillar_id)

    prompt_text = prompts.GENERATE_DRAFT.format(
        topic=topic,
        pillar_name=context["pillar_name"],
        pillar_description=context["pillar_description"],
        style=style or "professional, engaging",
        playbook=context["playbook"][:1500],
        voice_reference=context["voice_reference"][:1500],
        hooks=context["hooks"],
        hashtags=context["hashtags"],
        num_variants=num_variants,
    )

    result = await generate(prompt_text, system=prompts.SYSTEM_DRAFTER)

    try:
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        variants = json.loads(text)
        if not isinstance(variants, list):
            variants = [variants]
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse draft variants: %s", result[:200])
        variants = [{"hook_variant": "default", "content": result, "suggested_hashtags": []}]

    conn = get_conn()
    model = get_model_name()
    saved_drafts = []
    for variant in variants:
        cur = conn.execute(
            """INSERT INTO drafts (topic, content, hook_variant, pillar_id, ai_model, status)
               VALUES (?, ?, ?, ?, ?, 'draft')""",
            (topic, variant.get("content", ""), variant.get("hook_variant", ""),
             pillar_id, model),
        )
        row = conn.execute("SELECT * FROM drafts WHERE id = ?", (cur.lastrowid,)).fetchone()
        saved_drafts.append(dict(row))

    conn.commit()
    return saved_drafts


async def extract_hook_from_post(content: str) -> dict:
    """Extract and classify the hook from a post."""
    prompt_text = prompts.EXTRACT_HOOK.format(content=content[:500])
    result = await generate(prompt_text)

    try:
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        first_line = content.split("\n")[0].strip()
        return {"hook_text": first_line, "style": "statement"}
