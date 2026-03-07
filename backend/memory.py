"""
Creator Memory — builds and maintains a deep understanding of the creator's
voice, content patterns, audience, and growth trajectory.

Memory vs Playbook:
  Playbook = tactical rules ("use question hooks on Tuesdays")
  Memory = identity ("you write in short declarative sentences with dry wit")
"""

from __future__ import annotations

import json
import logging
import statistics
from datetime import datetime, timezone

from backend import prompts
from backend.db import get_conn
from backend.llm import generate
from backend.utils import parse_llm_json

logger = logging.getLogger(__name__)


def get_memory() -> dict | None:
    """Read current creator memory from DB. Returns None if not built yet."""
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM creator_memory ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return None
    mem = dict(row)
    for field in ("voice_profile", "content_dna", "audience_model", "growth_trajectory"):
        try:
            mem[field] = json.loads(mem[field]) if isinstance(mem[field], str) else mem[field]
        except (json.JSONDecodeError, TypeError):
            mem[field] = {}
    return mem


def compute_content_dna() -> dict:
    """Compute content DNA from metrics data — pure SQL, no LLM."""
    conn = get_conn()

    # Topic performance by pillar
    topic_perf = [dict(r) for r in conn.execute("""
        SELECT cp.id, cp.name, cp.color,
               COUNT(p.id) as post_count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.impressions) as avg_impressions,
               AVG(lm.saves) as avg_saves
        FROM posts p
        JOIN content_pillars cp ON p.pillar_id = cp.id
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        GROUP BY cp.id
        ORDER BY avg_engagement DESC
    """).fetchall()]

    # Format performance by post_type
    format_perf = [dict(r) for r in conn.execute("""
        SELECT p.post_type as format,
               COUNT(p.id) as post_count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.comments) as avg_comments,
               AVG(lm.saves) as avg_saves
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        GROUP BY p.post_type
        HAVING post_count >= 2
        ORDER BY avg_engagement DESC
    """).fetchall()]

    # Hook performance
    hook_perf = [dict(r) for r in conn.execute("""
        SELECT p.hook_style as style,
               COUNT(p.id) as count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.impressions) as avg_impressions
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me' AND p.hook_style IS NOT NULL
        GROUP BY p.hook_style
        HAVING count >= 2
        ORDER BY avg_engagement DESC
    """).fetchall()]

    # CTA performance
    cta_perf = [dict(r) for r in conn.execute("""
        SELECT p.cta_type as type,
               COUNT(p.id) as count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.comments) as avg_comments,
               AVG(lm.reposts) as avg_reposts
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        GROUP BY p.cta_type
        HAVING count >= 2
        ORDER BY avg_engagement DESC
    """).fetchall()]

    # Length sweet spot
    word_data = conn.execute("""
        SELECT p.word_count, lm.engagement_score
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me' AND p.word_count > 0
        ORDER BY p.word_count
    """).fetchall()

    length_data: dict = {}
    if len(word_data) >= 5:
        words = [r["word_count"] for r in word_data]
        scores = [r["engagement_score"] or 0 for r in word_data]
        median_wc = int(statistics.median(words))
        q1 = int(statistics.quantiles(words, n=4)[0]) if len(words) >= 4 else median_wc - 50
        q3 = int(statistics.quantiles(words, n=4)[2]) if len(words) >= 4 else median_wc + 50
        length_data = {
            "optimal_range": [max(50, q1), q3],
            "median": median_wc,
            "avg_engagement_in_range": statistics.mean(
                s for w, s in zip(words, scores) if q1 <= w <= q3
            ) if any(q1 <= w <= q3 for w in words) else 0,
        }

    # Timing patterns
    timing = [dict(r) for r in conn.execute("""
        SELECT
            CASE CAST(strftime('%w', p.posted_at) AS INTEGER)
                WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
                WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday'
                WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday'
            END as day,
            CAST(strftime('%H', p.posted_at) AS INTEGER) as hour,
            AVG(lm.engagement_score) as avg_engagement,
            COUNT(*) as post_count
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me' AND p.posted_at IS NOT NULL
        GROUP BY day, hour
        HAVING post_count >= 2
        ORDER BY avg_engagement DESC
        LIMIT 5
    """).fetchall()]

    return {
        "topic_performance": topic_perf,
        "format_performance": format_perf,
        "hook_performance": hook_perf,
        "cta_performance": cta_perf,
        "length_sweet_spot": length_data,
        "best_timing": timing,
    }


async def build_memory() -> dict:
    """Build initial creator memory from all existing posts. Requires >= 10 posts."""
    conn = get_conn()

    post_count = conn.execute(
        "SELECT COUNT(*) as c FROM posts WHERE author = 'me'"
    ).fetchone()["c"]
    if post_count < 10:
        raise ValueError(f"Need at least 10 posts to build memory (have {post_count})")

    # Gather all posts for voice analysis
    posts = [dict(r) for r in conn.execute("""
        SELECT p.*, lm.engagement_score, lm.impressions, lm.saves, lm.likes, lm.comments
        FROM posts p
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        ORDER BY COALESCE(lm.engagement_score, 0) DESC
    """).fetchall()]

    # Step 1: Build voice profile (LLM)
    top_posts_text = "\n\n---POST---\n\n".join(
        p["content"][:600] for p in posts[:20]
    )
    voice_raw = await generate(
        prompts.BUILD_VOICE_PROFILE.format(posts_text=top_posts_text, post_count=post_count),
        system=prompts.SYSTEM_MEMORY
    )
    try:
        voice_profile = parse_llm_json(voice_raw)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse voice profile, using defaults")
        voice_profile = {"error": "Failed to parse", "raw": voice_raw[:500]}

    # Step 2: Compute content DNA (SQL)
    content_dna = compute_content_dna()

    # Step 3: Build audience model (LLM)
    audience_context = "\n".join(
        f"- [{p.get('classification', 'unclassified')}] saves={p.get('saves', 0)} comments={p.get('comments', 0)} | {p['content'][:200]}"
        for p in posts[:15]
    )
    audience_raw = await generate(
        prompts.BUILD_AUDIENCE_MODEL.format(
            audience_context=audience_context,
            post_count=post_count,
        ),
        system=prompts.SYSTEM_MEMORY
    )
    try:
        audience_model = parse_llm_json(audience_raw)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse audience model, using defaults")
        audience_model = {"error": "Failed to parse", "raw": audience_raw[:500]}

    # Step 4: Build growth trajectory (LLM + computed)
    trajectory_context = "\n".join(
        f"- {p.get('posted_at', 'unknown')} | eng={p.get('engagement_score', 0):.4f} | imp={p.get('impressions', 0)} | {p['content'][:100]}"
        for p in sorted(posts, key=lambda x: x.get("posted_at") or "")
        if p.get("posted_at")
    )
    trajectory_raw = await generate(
        prompts.BUILD_GROWTH_TRAJECTORY.format(
            trajectory_context=trajectory_context,
            post_count=post_count,
        ),
        system=prompts.SYSTEM_MEMORY
    )
    try:
        growth_trajectory = parse_llm_json(trajectory_raw)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse trajectory, using defaults")
        growth_trajectory = {"error": "Failed to parse", "raw": trajectory_raw[:500]}

    # Calculate confidence
    confidence = min(0.95, 0.3 + (post_count / 100) * 0.65)

    now = datetime.now(timezone.utc).isoformat()

    # Save to DB (delete child rows first to satisfy FK constraint)
    conn.execute("DELETE FROM memory_updates WHERE memory_id = 1")
    conn.execute("DELETE FROM creator_memory WHERE id = 1")
    conn.execute(
        """INSERT INTO creator_memory
           (id, voice_profile, content_dna, audience_model, growth_trajectory,
            version, confidence_overall, post_count_at_build, created_at, updated_at)
           VALUES (1, ?, ?, ?, ?, 1, ?, ?, ?, ?)""",
        (
            json.dumps(voice_profile),
            json.dumps(content_dna),
            json.dumps(audience_model),
            json.dumps(growth_trajectory),
            confidence,
            post_count,
            now, now,
        ),
    )
    # Log the build
    conn.execute(
        """INSERT INTO memory_updates (memory_id, update_type, delta, confidence_after, created_at)
           VALUES (1, 'initial_build', ?, ?, ?)""",
        (json.dumps({"action": "full_build", "post_count": post_count}), confidence, now),
    )
    conn.commit()

    return get_memory() or {}


async def update_memory_after_analysis(post_id: int) -> dict | None:
    """Incremental memory update after a post is analyzed. Returns updated memory or None."""
    memory = get_memory()
    if not memory:
        return None

    conn = get_conn()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        return None

    metrics = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC LIMIT 1",
        (post_id,),
    ).fetchone()

    learnings = [dict(r) for r in conn.execute(
        "SELECT insight, category, impact, confidence FROM learnings WHERE post_id = ?",
        (post_id,),
    ).fetchall()]

    # Run memory delta prompt
    delta_raw = await generate(
        prompts.MEMORY_DELTA.format(
            voice_summary=json.dumps(memory.get("voice_profile", {}), indent=2)[:1500],
            dna_summary=json.dumps(memory.get("content_dna", {}), indent=2)[:1500],
            post_content=post["content"][:800],
            post_metrics=json.dumps(dict(metrics) if metrics else {}, default=str)[:500],
            learnings_text=json.dumps(learnings)[:500],
            classification=post.get("classification", "unclassified"),
        ),
        system=prompts.SYSTEM_MEMORY
    )

    try:
        delta = parse_llm_json(delta_raw)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Failed to parse memory delta for post %d", post_id)
        return memory

    # Refresh content DNA (computed, not LLM)
    content_dna = compute_content_dna()

    now = datetime.now(timezone.utc).isoformat()
    old_confidence = memory.get("confidence_overall", 0.3)
    new_post_count = conn.execute(
        "SELECT COUNT(*) as c FROM posts WHERE author = 'me'"
    ).fetchone()["c"]
    new_confidence = min(0.95, 0.3 + (new_post_count / 100) * 0.65)

    # Apply voice adjustments from delta
    voice = memory.get("voice_profile", {})
    if isinstance(delta, dict) and delta.get("voice_adjustments"):
        for adj in delta["voice_adjustments"]:
            if isinstance(adj, dict) and "key" in adj and "value" in adj:
                voice[adj["key"]] = adj["value"]

    conn.execute(
        """UPDATE creator_memory SET
           voice_profile = ?, content_dna = ?, confidence_overall = ?,
           version = version + 1, updated_at = ?
           WHERE id = 1""",
        (json.dumps(voice), json.dumps(content_dna), new_confidence, now),
    )
    conn.execute(
        """INSERT INTO memory_updates
           (memory_id, post_id, update_type, delta, contradictions,
            confidence_before, confidence_after, created_at)
           VALUES (1, ?, 'post_analysis', ?, ?, ?, ?, ?)""",
        (
            post_id,
            json.dumps(delta, default=str),
            json.dumps(delta.get("contradictions", []) if isinstance(delta, dict) else [], default=str),
            old_confidence,
            new_confidence,
            now,
        ),
    )
    conn.commit()

    return get_memory()


