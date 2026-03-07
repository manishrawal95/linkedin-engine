"""
Auto-Ideation Engine — generates, scores, and ranks LinkedIn post ideas.

Sources: pillar rotation, series schedule, mood board, hit repurposing, AI generation.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from backend import prompts
from backend.context import build_creator_context
from backend.db import get_conn
from backend.llm import generate
from backend.utils import parse_llm_json

logger = logging.getLogger(__name__)


def get_recent_topics(days: int = 30) -> list[str]:
    """Get recent post topics AND scheduled draft topics to avoid repetition."""
    conn = get_conn()

    # Published posts
    rows = conn.execute(
        """SELECT content FROM posts
           WHERE author = 'me' AND posted_at >= date('now', ? || ' days')
           ORDER BY posted_at DESC LIMIT 20""",
        (f"-{days}",),
    ).fetchall()
    topics = [r["content"][:150] for r in rows]

    # Scheduled but not yet posted drafts (from content_calendar)
    scheduled = conn.execute(
        """SELECT d.topic, d.content FROM content_calendar cc
           JOIN drafts d ON cc.draft_id = d.id
           WHERE cc.status IN ('planned', 'ready')
             AND cc.scheduled_date >= date('now')""",
    ).fetchall()
    for s in scheduled:
        topics.append(s["topic"] or (s["content"] or "")[:150])

    # Pending/approved ideas not yet drafted
    pending_ideas = conn.execute(
        """SELECT topic FROM ideas
           WHERE status IN ('pending', 'approved')
           ORDER BY created_at DESC LIMIT 10""",
    ).fetchall()
    for i in pending_ideas:
        topics.append(i["topic"][:150])

    return topics


def get_pillar_gaps() -> list[dict]:
    """Get pillars sorted by how underrepresented they are (most neglected first)."""
    conn = get_conn()
    return [dict(r) for r in conn.execute("""
        SELECT cp.id, cp.name, cp.color, cp.description,
               COUNT(p.id) as recent_posts,
               MAX(p.posted_at) as last_posted
        FROM content_pillars cp
        LEFT JOIN posts p ON p.pillar_id = cp.id
            AND p.author = 'me'
            AND p.posted_at >= date('now', '-30 days')
        GROUP BY cp.id
        ORDER BY recent_posts ASC, last_posted ASC
    """).fetchall()]


def get_due_series() -> list[dict]:
    """Get series that are due for a new post based on frequency."""
    conn = get_conn()
    return [dict(r) for r in conn.execute("""
        SELECT cs.*,
               cp.name as pillar_name,
               MAX(p.posted_at) as last_posted,
               COUNT(p.id) as total_posts
        FROM content_series cs
        LEFT JOIN content_pillars cp ON cs.pillar_id = cp.id
        LEFT JOIN posts p ON p.series_id = cs.id AND p.author = 'me'
        WHERE cs.is_active = 1
        GROUP BY cs.id
        ORDER BY last_posted ASC NULLS FIRST
    """).fetchall()]


async def _ai_score_ideas(ideas: list[dict], creator_context: str) -> list[dict]:
    """Use AI to score all ideas for fit with the creator's voice, strategy, and audience."""
    if not ideas:
        return ideas

    # Prepare ideas for scoring (strip internal fields)
    ideas_for_scoring = [
        {"topic": i["topic"], "source": i.get("source", "ai"), "pillar": i.get("_pillar_name")}
        for i in ideas
    ]

    try:
        raw = await generate(
            prompts.SCORE_IDEAS.format(
                context=creator_context,
                ideas_json=json.dumps(ideas_for_scoring, indent=2),
            ),
            system=prompts.SYSTEM_DRAFTER,
        )
        scored = parse_llm_json(raw)
        if isinstance(scored, list) and len(scored) == len(ideas):
            for idea, score_data in zip(ideas, scored):
                if isinstance(score_data, dict):
                    idea["score"] = max(0.0, min(1.0, float(score_data.get("fit_score", 0.5))))
                    idea["fit_reason"] = str(score_data.get("fit_reason", ""))[:100]
            return ideas
    except Exception as e:
        logger.warning("AI scoring failed, using fallback: %s", e)

    # Fallback: basic heuristic if AI scoring fails
    for idea in ideas:
        idea["score"] = 0.5
        idea["fit_reason"] = ""
    return ideas


async def generate_ideas(count: int = 5, topic_hint: str = "") -> list[dict]:
    """Generate scored, ranked post ideas from multiple sources."""
    conn = get_conn()
    batch_id = str(uuid.uuid4())[:8]
    ideas: list[dict] = []

    recent_topics = get_recent_topics()
    pillar_gaps = get_pillar_gaps()

    # Recent pillar IDs (last 7 days)
    recent_pillar_rows = conn.execute("""
        SELECT DISTINCT pillar_id FROM posts
        WHERE author = 'me' AND pillar_id IS NOT NULL
        AND posted_at >= date('now', '-7 days')
    """).fetchall()
    recent_pillars = {r["pillar_id"] for r in recent_pillar_rows}

    # Source 1: Due series
    if not topic_hint:
        due_series = get_due_series()
        for s in due_series[:2]:
            ideas.append({
                "topic": f"[{s['name']}] New episode for {s.get('pillar_name', 'general')} series",
                "hook_style": None,
                "pillar_id": s.get("pillar_id"),
                "source": "series",
            })

    # Source 2: Mood board items not yet used
    if not topic_hint:
        unused_mood = conn.execute("""
            SELECT mb.*, cp.name as pillar_name
            FROM mood_board_items mb
            JOIN content_pillars cp ON mb.pillar_id = cp.id
            WHERE mb.id NOT IN (
                SELECT COALESCE(mood_board_item_id, 0) FROM drafts WHERE mood_board_item_id IS NOT NULL
            )
            ORDER BY mb.created_at DESC LIMIT 2
        """).fetchall()
        for m in unused_mood:
            row = dict(m)
            ideas.append({
                "topic": f"Post inspired by: {row['content'][:200]}",
                "hook_style": None,
                "pillar_id": row["pillar_id"],
                "source": "mood_board",
            })

    # Source 3: Repurpose hits
    if not topic_hint:
        hits = conn.execute("""
            SELECT p.content, p.pillar_id, p.hook_style
            FROM posts p
            WHERE p.author = 'me' AND p.classification = 'hit'
            ORDER BY p.posted_at DESC LIMIT 3
        """).fetchall()
        for h in hits[:1]:
            row = dict(h)
            ideas.append({
                "topic": f"New angle on hit post: {row['content'][:150]}",
                "hook_style": row.get("hook_style"),
                "pillar_id": row.get("pillar_id"),
                "source": "repurpose",
            })

    # Source 4: Competitor/inspiration hits — learn from others' wins
    if not topic_hint:
        competitor_hits = conn.execute("""
            SELECT p.content, p.author, p.pillar_id, p.hook_style,
                   lm.engagement_score, lm.impressions
            FROM posts p
            LEFT JOIN latest_metrics lm ON p.id = lm.post_id
            WHERE p.author != 'me' AND p.classification = 'hit'
            ORDER BY lm.engagement_score DESC NULLS LAST
            LIMIT 3
        """).fetchall()
        for ch in competitor_hits[:2]:
            row = dict(ch)
            ideas.append({
                "topic": f"Your take on [{row['author']}]'s hit: {row['content'][:120]}",
                "hook_style": row.get("hook_style"),
                "pillar_id": row.get("pillar_id"),
                "source": "competitor",
            })

    # Resolve pillar names for non-AI ideas (needed for AI scoring)
    for idea in ideas:
        if idea.get("pillar_id") and "_pillar_name" not in idea:
            prow = conn.execute(
                "SELECT name FROM content_pillars WHERE id = ?", (idea["pillar_id"],)
            ).fetchone()
            idea["_pillar_name"] = prow["name"] if prow else None

    # Source 5: AI-generated ideas (fill remaining slots)
    remaining = max(1, count - len(ideas))
    gap_pillar = pillar_gaps[0]["name"] if pillar_gaps else "general"
    recent_summaries = "\n".join(f"- {t}" for t in recent_topics[:10])

    # Build creator context (used for AI generation + scoring)
    creator_context = build_creator_context() if not topic_hint else ""

    # Choose prompt based on whether we have a topic hint
    if topic_hint:
        prompt_text = prompts.POST_IDEAS_ON_TOPIC.format(topic_hint=topic_hint)
    else:
        prompt_text = prompts.IDEATION_ENGINE.format(
            context=creator_context,
            gap_pillar=gap_pillar,
            recent_topics=recent_summaries or "No recent posts.",
            count=remaining,
        )

    try:
        raw = await generate(prompt_text, system=prompts.SYSTEM_DRAFTER)
        ai_ideas = parse_llm_json(raw)
        if isinstance(ai_ideas, list):
            for ai in ai_ideas[:remaining]:
                pillar_id = None
                pillar_name = ai.get("pillar")
                if pillar_name:
                    match = conn.execute(
                        "SELECT id, name FROM content_pillars WHERE LOWER(name) = LOWER(?)",
                        (pillar_name,),
                    ).fetchone()
                    if match:
                        pillar_id = match["id"]
                        pillar_name = match["name"]

                ideas.append({
                    "topic": ai.get("topic", ""),
                    "hook_style": ai.get("hook_style"),
                    "pillar_id": pillar_id,
                    "_pillar_name": pillar_name,
                    "source": "ai",
                    # AI-generated ideas already have scores from the prompt
                    "score": max(0.0, min(1.0, float(ai.get("fit_score", 0.5)))),
                    "fit_reason": str(ai.get("fit_reason", ""))[:100],
                })
    except Exception as e:
        logger.error("Ideation LLM call failed: %s", e, exc_info=True)

    # AI-score non-AI ideas (series, mood board, repurpose, competitor)
    non_ai_ideas = [i for i in ideas if i.get("source") != "ai"]
    if non_ai_ideas and creator_context:
        await _ai_score_ideas(non_ai_ideas, creator_context)
    elif non_ai_ideas:
        # No context available (topic_hint mode), use neutral score
        for idea in non_ai_ideas:
            idea.setdefault("score", 0.5)
            idea.setdefault("fit_reason", "")

    # Sort by score descending
    ideas.sort(key=lambda x: x.get("score", 0), reverse=True)

    # Save to DB
    now = datetime.now(timezone.utc).isoformat()
    for idea in ideas[:count]:
        conn.execute(
            """INSERT INTO ideas (topic, hook_style, pillar_id, source, score, fit_reason, status, batch_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (idea["topic"], idea.get("hook_style"), idea.get("pillar_id"),
             idea.get("source", "ai"), idea.get("score", 0.5),
             idea.get("fit_reason", ""), batch_id, now),
        )
    conn.commit()

    return ideas[:count]


def get_pending_ideas() -> list[dict]:
    """Get all pending ideas (not yet approved or rejected)."""
    return get_ideas(status="pending")


def get_ideas(status: str | None = None) -> list[dict]:
    """Get ideas, optionally filtered by status."""
    conn = get_conn()
    query = """
        SELECT i.*, cp.name as pillar_name, cp.color as pillar_color
        FROM ideas i
        LEFT JOIN content_pillars cp ON i.pillar_id = cp.id
    """
    params: list[str] = []
    if status:
        query += " WHERE i.status = ?"
        params.append(status)
    query += " ORDER BY i.score DESC, i.created_at DESC"
    return [dict(r) for r in conn.execute(query, params).fetchall()]


def approve_idea(idea_id: int) -> dict:
    """Approve an idea (marks as approved, ready for drafting)."""
    conn = get_conn()
    conn.execute(
        "UPDATE ideas SET status = 'approved' WHERE id = ?", (idea_id,)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()
    if not row:
        raise ValueError(f"Idea {idea_id} not found")
    return dict(row)


def reject_idea(idea_id: int) -> None:
    """Reject an idea."""
    conn = get_conn()
    conn.execute(
        "UPDATE ideas SET status = 'rejected' WHERE id = ?", (idea_id,)
    )
    conn.commit()


def dismiss_batch(batch_id: str) -> None:
    """Dismiss all pending ideas in a batch."""
    conn = get_conn()
    conn.execute(
        "UPDATE ideas SET status = 'dismissed' WHERE batch_id = ? AND status = 'pending'",
        (batch_id,),
    )
    conn.commit()
