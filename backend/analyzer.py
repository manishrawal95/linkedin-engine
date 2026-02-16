"""
Learning engine — classifies post performance, extracts learnings, generates playbook.

Flow:
  1. classify_performance(post, metrics) → "hit"/"average"/"miss"
  2. extract_learnings(post, metrics, classification) → [insights]
  3. update_learnings(new_insights) → merge/insert into DB
  4. check_playbook_staleness() → regenerate if needed
"""

from __future__ import annotations

import hashlib
import json
import logging
import statistics
from datetime import datetime

from backend import prompts
from backend.db import get_conn
from backend.llm import generate, get_model_name

logger = logging.getLogger(__name__)


async def analyze_post(post_id: int) -> dict:
    """Full analysis pipeline for a post after metrics are entered."""
    conn = get_conn()

    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise ValueError(f"Post {post_id} not found")

    latest_metrics = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC LIMIT 1",
        (post_id,),
    ).fetchone()
    if not latest_metrics:
        raise ValueError(f"No metrics found for post {post_id}")

    classification = await classify_performance(dict(post), dict(latest_metrics))

    new_learnings = await extract_learnings(dict(post), dict(latest_metrics), classification)

    saved = update_learnings(post_id, new_learnings)

    # Stamp last_analyzed_at
    conn.execute(
        "UPDATE posts SET last_analyzed_at = ? WHERE id = ?",
        (datetime.utcnow().isoformat(), post_id),
    )
    conn.commit()

    playbook_updated = check_and_regenerate_playbook()

    return {
        "post_id": post_id,
        "classification": classification,
        "learnings_extracted": len(new_learnings),
        "learnings_saved": saved,
        "playbook_updated": playbook_updated,
    }


def _resolve_pillar_name(conn, pillar_id) -> str:
    if not pillar_id:
        return "None"
    row = conn.execute("SELECT name FROM content_pillars WHERE id = ?", (pillar_id,)).fetchone()
    return row["name"] if row else "None"


def _format_topic_tags(raw: str | None) -> str:
    if not raw:
        return "None"
    try:
        tags = json.loads(raw)
        return ", ".join(tags) if tags else "None"
    except (json.JSONDecodeError, TypeError):
        return raw or "None"


async def classify_performance(post: dict, metrics: dict) -> str:
    """Classify post as hit/average/miss relative to author's baseline."""
    conn = get_conn()
    author = post.get("author", "me")

    all_scores = conn.execute("""
        SELECT ms.engagement_score
        FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id
        WHERE p.author = ?
        ORDER BY ms.snapshot_at DESC
    """, (author,)).fetchall()

    scores = [r["engagement_score"] for r in all_scores if r["engagement_score"] is not None]

    if len(scores) < 3:
        return "average"

    all_impressions = conn.execute("""
        SELECT ms.impressions
        FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id
        WHERE p.author = ?
    """, (author,)).fetchall()
    impressions_list = sorted([r["impressions"] for r in all_impressions if r["impressions"]])
    median_impressions = statistics.median(impressions_list) if impressions_list else 0

    prompt_text = prompts.CLASSIFY_PERFORMANCE.format(
        content=post.get("content", "")[:500],
        post_type=post.get("post_type", "text"),
        hook_style=post.get("hook_style") or "N/A",
        cta_type=post.get("cta_type", "none"),
        word_count=post.get("word_count", 0),
        pillar_name=_resolve_pillar_name(conn, post.get("pillar_id")),
        topic_tags=_format_topic_tags(post.get("topic_tags")),
        posted_at=post.get("posted_at") or "N/A",
        impressions=metrics.get("impressions", 0),
        likes=metrics.get("likes", 0),
        comments=metrics.get("comments", 0),
        reposts=metrics.get("reposts", 0),
        saves=metrics.get("saves", 0),
        sends=metrics.get("sends", 0),
        engagement_score=metrics.get("engagement_score") or 0,
        interaction_score=metrics.get("interaction_score") or 0,
        avg_engagement=statistics.mean(scores),
        median_impressions=median_impressions,
    )

    result = await generate(prompt_text, system=prompts.SYSTEM_ANALYST)
    result = result.strip().lower().strip('"')

    if result in ("hit", "average", "miss"):
        return result

    current_score = metrics.get("engagement_score") or metrics.get("interaction_score", 0) or 0
    avg = statistics.mean(scores) if scores else 0
    if avg > 0 and current_score > avg * 1.5:
        return "hit"
    elif avg > 0 and current_score < avg * 0.5:
        return "miss"
    return "average"


async def extract_learnings(post: dict, metrics: dict, classification: str) -> list[dict]:
    """Use LLM to extract specific learnings from a post's performance."""
    conn = get_conn()

    existing = conn.execute(
        "SELECT insight, category, impact FROM learnings ORDER BY confidence DESC LIMIT 20"
    ).fetchall()
    existing_text = "\n".join(
        f"- [{r['category']}] {r['insight']} ({r['impact']})" for r in existing
    ) or "None yet"

    prompt_text = prompts.EXTRACT_LEARNINGS.format(
        content=post.get("content", "")[:1000],
        post_type=post.get("post_type", "text"),
        hook_style=post.get("hook_style") or "N/A",
        hook_line=post.get("hook_line", "N/A"),
        cta_type=post.get("cta_type", "none"),
        word_count=post.get("word_count", 0),
        pillar_name=_resolve_pillar_name(conn, post.get("pillar_id")),
        topic_tags=_format_topic_tags(post.get("topic_tags")),
        posted_at=post.get("posted_at") or "N/A",
        impressions=metrics.get("impressions", 0),
        likes=metrics.get("likes", 0),
        comments=metrics.get("comments", 0),
        reposts=metrics.get("reposts", 0),
        saves=metrics.get("saves", 0),
        sends=metrics.get("sends", 0),
        engagement_score=metrics.get("engagement_score") or 0,
        interaction_score=metrics.get("interaction_score") or 0,
        classification=classification,
        existing_learnings=existing_text,
    )

    result = await generate(prompt_text, system=prompts.SYSTEM_ANALYST)

    try:
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        learnings = json.loads(text)
        if not isinstance(learnings, list):
            learnings = [learnings]
        return learnings
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse LLM learnings response: %s", result[:200])
        return []


async def analyze_batch(post_ids: list[int]) -> dict:
    """Batch analysis: classify + extract learnings for multiple posts in fewer LLM calls."""
    conn = get_conn()

    # Gather posts and their latest metrics, skip already-analyzed
    posts_with_metrics = []
    skipped = []
    for pid in post_ids:
        post = conn.execute("SELECT * FROM posts WHERE id = ?", (pid,)).fetchone()
        if not post:
            skipped.append({"post_id": pid, "reason": "Post not found"})
            continue
        metrics = conn.execute(
            "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC LIMIT 1",
            (pid,),
        ).fetchone()
        if not metrics:
            skipped.append({"post_id": pid, "reason": "No metrics"})
            continue
        # Skip if already analyzed and no new metrics since
        last_analyzed = post["last_analyzed_at"]
        snapshot_at = metrics["snapshot_at"]
        if last_analyzed and snapshot_at and last_analyzed >= snapshot_at:
            skipped.append({"post_id": pid, "reason": "Already analyzed (no new metrics)"})
            continue
        posts_with_metrics.append({"post": dict(post), "metrics": dict(metrics)})

    if not posts_with_metrics:
        return {"results": [], "skipped": skipped, "playbook_updated": False}

    # Get baseline stats (shared across all posts for same author)
    author = posts_with_metrics[0]["post"].get("author", "me")
    all_scores = conn.execute("""
        SELECT ms.engagement_score FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id WHERE p.author = ?
        ORDER BY ms.snapshot_at DESC
    """, (author,)).fetchall()
    scores = [r["engagement_score"] for r in all_scores if r["engagement_score"] is not None]

    all_impressions = conn.execute("""
        SELECT ms.impressions FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id WHERE p.author = ?
    """, (author,)).fetchall()
    impressions_list = sorted([r["impressions"] for r in all_impressions if r["impressions"]])
    median_impressions = statistics.median(impressions_list) if impressions_list else 0
    avg_engagement = statistics.mean(scores) if len(scores) >= 3 else 0

    # --- BATCH CLASSIFICATION (1 LLM call) ---
    if len(scores) < 3:
        classifications = {pm["post"]["id"]: "average" for pm in posts_with_metrics}
    else:
        post_blocks = []
        for i, pm in enumerate(posts_with_metrics):
            p, m = pm["post"], pm["metrics"]
            post_blocks.append(
                f"POST_{i+1} (id={p['id']}):\n"
                f"Content: {p.get('content', '')[:300]}\n"
                f"Type: {p.get('post_type', 'text')} | Hook: {p.get('hook_style') or 'N/A'} | "
                f"CTA: {p.get('cta_type', 'none')} | Words: {p.get('word_count', 0)}\n"
                f"Pillar: {_resolve_pillar_name(conn, p.get('pillar_id'))} | "
                f"Tags: {_format_topic_tags(p.get('topic_tags'))} | Posted: {p.get('posted_at') or 'N/A'}\n"
                f"Impressions: {m.get('impressions', 0)}, Likes: {m.get('likes', 0)}, "
                f"Comments: {m.get('comments', 0)}, Reposts: {m.get('reposts', 0)}, "
                f"Saves: {m.get('saves', 0)}, Sends: {m.get('sends', 0)}, "
                f"Engagement: {m.get('engagement_score') or 0:.4f}, Interaction: {m.get('interaction_score') or 0:.0f}"
            )

        batch_classify_prompt = prompts.BATCH_CLASSIFY_PERFORMANCE.format(
            avg_engagement=avg_engagement,
            median_impressions=median_impressions,
            post_blocks="\n\n".join(post_blocks),
        )

        raw = await generate(batch_classify_prompt, system=prompts.SYSTEM_ANALYST)
        classifications = _parse_batch_classifications(raw, posts_with_metrics, scores)

    # --- BATCH LEARNINGS EXTRACTION (1 LLM call) ---
    existing = conn.execute(
        "SELECT insight, category, impact FROM learnings ORDER BY confidence DESC LIMIT 20"
    ).fetchall()
    existing_text = "\n".join(
        f"- [{r['category']}] {r['insight']} ({r['impact']})" for r in existing
    ) or "None yet"

    post_blocks_learn = []
    for i, pm in enumerate(posts_with_metrics):
        p, m = pm["post"], pm["metrics"]
        pid = p["id"]
        post_blocks_learn.append(
            f"POST_{i+1} (id={pid}, classification={classifications.get(pid, 'average')}):\n"
            f"Content: {p.get('content', '')[:500]}\n"
            f"Type: {p.get('post_type', 'text')} | Hook style: {p.get('hook_style') or 'N/A'} | "
            f"Hook line: {p.get('hook_line', 'N/A')}\n"
            f"CTA: {p.get('cta_type', 'none')} | Words: {p.get('word_count', 0)} | "
            f"Pillar: {_resolve_pillar_name(conn, p.get('pillar_id'))} | "
            f"Tags: {_format_topic_tags(p.get('topic_tags'))} | Posted: {p.get('posted_at') or 'N/A'}\n"
            f"Impressions: {m.get('impressions', 0)}, Likes: {m.get('likes', 0)}, "
            f"Comments: {m.get('comments', 0)}, Reposts: {m.get('reposts', 0)}, "
            f"Saves: {m.get('saves', 0)}, Sends: {m.get('sends', 0)}, "
            f"Engagement: {m.get('engagement_score') or 0:.4f}, Interaction: {m.get('interaction_score') or 0:.0f}"
        )

    batch_learn_prompt = prompts.BATCH_EXTRACT_LEARNINGS.format(
        post_blocks="\n\n".join(post_blocks_learn),
        existing_learnings=existing_text,
    )

    raw_learn = await generate(batch_learn_prompt, system=prompts.SYSTEM_ANALYST)
    batch_learnings = _parse_batch_learnings(raw_learn, posts_with_metrics)

    # --- Save results ---
    now = datetime.utcnow().isoformat()
    results = []
    for pm in posts_with_metrics:
        pid = pm["post"]["id"]
        classification = classifications.get(pid, "average")
        post_learnings = batch_learnings.get(pid, [])
        saved = update_learnings(pid, post_learnings)
        conn.execute("UPDATE posts SET last_analyzed_at = ? WHERE id = ?", (now, pid))
        results.append({
            "post_id": pid,
            "classification": classification,
            "learnings_extracted": len(post_learnings),
            "learnings_saved": saved,
        })

    conn.commit()
    playbook_updated = check_and_regenerate_playbook()

    return {
        "results": results,
        "skipped": skipped,
        "playbook_updated": playbook_updated,
    }


def _parse_batch_classifications(
    raw: str, posts_with_metrics: list[dict], scores: list[float]
) -> dict[int, str]:
    """Parse batch classification JSON, falling back to score-based classification."""
    classifications: dict[int, str] = {}
    avg = statistics.mean(scores) if scores else 0

    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(text)
        for pid_str, cls in parsed.items():
            pid = int(pid_str)
            cls = cls.strip().lower().strip('"')
            if cls in ("hit", "average", "miss"):
                classifications[pid] = cls
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse batch classifications: %s", raw[:200])

    # Fill missing with score-based fallback
    for pm in posts_with_metrics:
        pid = pm["post"]["id"]
        if pid not in classifications:
            score = pm["metrics"].get("engagement_score", 0) or 0
            if avg and score > avg * 1.5:
                classifications[pid] = "hit"
            elif avg and score < avg * 0.5:
                classifications[pid] = "miss"
            else:
                classifications[pid] = "average"

    return classifications


def _parse_batch_learnings(raw: str, posts_with_metrics: list[dict]) -> dict[int, list[dict]]:
    """Parse batch learnings JSON."""
    result: dict[int, list[dict]] = {}
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        parsed = json.loads(text)
        for pid_str, learnings in parsed.items():
            pid = int(pid_str)
            if isinstance(learnings, list):
                result[pid] = learnings
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse batch learnings: %s", raw[:200])

    return result


def update_learnings(post_id: int, new_insights: list[dict]) -> int:
    """Merge new insights into the learnings table."""
    conn = get_conn()
    saved = 0

    for insight_data in new_insights:
        insight_text = insight_data.get("insight", "").strip()
        category = insight_data.get("category", "").strip()
        impact = insight_data.get("impact", "").strip()
        ai_confidence = insight_data.get("confidence")

        # Clamp AI confidence to valid range, default to 0.5 if missing/invalid
        if isinstance(ai_confidence, (int, float)) and 0 < ai_confidence <= 1.0:
            ai_confidence = max(0.3, min(0.95, float(ai_confidence)))
        else:
            ai_confidence = 0.5

        if not insight_text or not category or not impact:
            continue

        existing = conn.execute(
            """SELECT id, times_confirmed, confidence FROM learnings
               WHERE category = ? AND impact = ? AND insight LIKE ?""",
            (category, impact, f"%{insight_text[:50]}%"),
        ).fetchone()

        if existing:
            new_count = existing["times_confirmed"] + 1
            # Boost existing confidence: blend current with new evidence, capped at 0.95
            new_confidence = min(0.95, existing["confidence"] + (1.0 - existing["confidence"]) * 0.2)
            conn.execute(
                """UPDATE learnings SET times_confirmed = ?, confidence = ?,
                   updated_at = ? WHERE id = ?""",
                (new_count, new_confidence, datetime.utcnow().isoformat(), existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO learnings (post_id, insight, category, impact, confidence)
                   VALUES (?, ?, ?, ?, ?)""",
                (post_id, insight_text, category, impact, ai_confidence),
            )
        saved += 1

    conn.commit()
    return saved


def check_and_regenerate_playbook(force: bool = False) -> bool:
    """Check if playbook needs regeneration based on learnings changes."""
    conn = get_conn()

    learnings = conn.execute(
        "SELECT insight, category, impact, confidence FROM learnings ORDER BY confidence DESC"
    ).fetchall()

    if not learnings:
        return False

    current_hash = hashlib.md5(
        json.dumps([(dict(r)) for r in learnings], sort_keys=True).encode()
    ).hexdigest()

    if not force:
        existing_playbook = conn.execute(
            "SELECT learnings_hash FROM playbook ORDER BY generated_at DESC LIMIT 1"
        ).fetchone()

        if existing_playbook and existing_playbook["learnings_hash"] == current_hash:
            return False

    import asyncio
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.create_task(_regenerate_playbook(learnings, current_hash))
    else:
        loop.run_until_complete(_regenerate_playbook(learnings, current_hash))
    return True


async def _regenerate_playbook(learnings, learnings_hash: str) -> None:
    """Regenerate the playbook from confirmed learnings."""
    learnings_text = "\n".join(
        f"- [{dict(r)['category']}] {dict(r)['insight']} ({dict(r)['impact']}, confidence: {dict(r)['confidence']:.1f})"
        for r in learnings
    )

    prompt_text = prompts.REGENERATE_PLAYBOOK.format(learnings=learnings_text)
    content = await generate(prompt_text, system=prompts.SYSTEM_ANALYST)

    conn = get_conn()
    conn.execute(
        "INSERT INTO playbook (content, learnings_hash) VALUES (?, ?)",
        (content, learnings_hash),
    )
    conn.commit()
    logger.info("Playbook regenerated with %d learnings", len(learnings))
