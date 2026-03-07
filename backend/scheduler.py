"""
Auto-scheduler: uses LLM to pick the optimal posting slot for a draft.

Gathers posting history, occupied calendar slots, and pillar balance,
then asks the LLM to choose the best date+time with a reason.
Falls back to next available weekday at 08:30 if LLM fails.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone

from backend.db import get_conn
from backend.llm import generate
from backend import prompts
from backend.utils import parse_llm_json

logger = logging.getLogger(__name__)

_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _get_post_history(conn, limit: int = 30) -> str:
    """Return recent posts with engagement data as text for the LLM."""
    rows = conn.execute("""
        SELECT p.posted_at, p.pillar_id, cp.name AS pillar_name,
               p.post_type, p.hook_style,
               ms.likes, ms.comments, ms.reposts, ms.impressions, ms.engagement_score,
               p.classification
        FROM posts p
        LEFT JOIN metrics_snapshots ms ON ms.post_id = p.id
        LEFT JOIN content_pillars cp ON cp.id = p.pillar_id
        WHERE p.author = 'me' AND p.posted_at IS NOT NULL AND p.posted_at != ''
        ORDER BY p.posted_at DESC
        LIMIT ?
    """, (limit,)).fetchall()

    if not rows:
        return "No posting history available."

    lines = []
    for r in rows:
        day_name = ""
        try:
            dt = datetime.fromisoformat(r["posted_at"])
            day_name = _DAYS[dt.weekday()]
        except (ValueError, TypeError):
            pass

        eng = f", engagement: {r['engagement_score']:.4f}" if r["engagement_score"] else ""
        classification = f", {r['classification']}" if r["classification"] else ""
        likes = r["likes"] or 0
        comments = r["comments"] or 0
        impressions = r["impressions"] or 0

        lines.append(
            f"- {r['posted_at']} ({day_name}): pillar={r['pillar_name'] or 'none'}, "
            f"likes={likes}, comments={comments}, impressions={impressions}"
            f"{eng}{classification}"
        )

    return "\n".join(lines)


def _get_occupied_slots(conn) -> str:
    """Return already-scheduled calendar slots as text."""
    rows = conn.execute(
        """SELECT scheduled_date, scheduled_time, notes
           FROM content_calendar
           WHERE status != 'skipped'
             AND scheduled_date >= date('now')
           ORDER BY scheduled_date, scheduled_time"""
    ).fetchall()

    if not rows:
        return "No upcoming scheduled posts."

    return "\n".join(
        f"- {r['scheduled_date']} {r['scheduled_time'] or '(no time)'}: {r['notes'] or '(no notes)'}"
        for r in rows
    )


def _get_pillar_balance(conn) -> str:
    """Return pillar posting balance for last 30 days."""
    rows = conn.execute("""
        SELECT cp.name, COUNT(p.id) AS count
        FROM content_pillars cp
        LEFT JOIN posts p ON p.pillar_id = cp.id
            AND p.author = 'me'
            AND p.posted_at >= date('now', '-30 days')
        GROUP BY cp.id
        ORDER BY count DESC
    """).fetchall()

    if not rows:
        return "No pillar data."

    return "\n".join(f"- {r['name']}: {r['count']} posts" for r in rows)


def _fallback_slot(conn) -> dict:
    """Pick the next available weekday at 08:30 when LLM fails."""
    occupied = set()
    rows = conn.execute(
        "SELECT scheduled_date FROM content_calendar WHERE status != 'skipped'"
    ).fetchall()
    for r in rows:
        occupied.add(r["scheduled_date"])

    candidate = date.today() + timedelta(days=1)
    for _ in range(30):
        # Weekday (Mon=0 .. Fri=4)
        if candidate.weekday() < 5 and candidate.isoformat() not in occupied:
            return {
                "date": candidate.isoformat(),
                "time": "08:30",
                "reason": "Default weekday morning slot",
            }
        candidate += timedelta(days=1)

    return {
        "date": (date.today() + timedelta(days=1)).isoformat(),
        "time": "08:30",
        "reason": "Fallback — no open slots found",
    }


async def find_optimal_slot(draft_id: int) -> dict:
    """Use LLM to find the best schedule slot for a draft.

    Returns {"date": str, "time": str, "reason": str}.
    """
    conn = get_conn()

    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    draft_dict = dict(draft)
    pillar_name = "none"
    if draft_dict.get("pillar_id"):
        pillar_row = conn.execute(
            "SELECT name FROM content_pillars WHERE id = ?", (draft_dict["pillar_id"],)
        ).fetchone()
        if pillar_row:
            pillar_name = pillar_row["name"]

    post_history = _get_post_history(conn)
    occupied_slots = _get_occupied_slots(conn)
    pillar_balance = _get_pillar_balance(conn)

    prompt_text = prompts.OPTIMAL_SCHEDULE.format(
        draft_topic=draft_dict.get("topic", "untitled"),
        draft_pillar=pillar_name,
        post_history=post_history,
        occupied_slots=occupied_slots,
        pillar_balance=pillar_balance,
        today=date.today().isoformat(),
    )

    try:
        raw = await generate(prompt_text, system=prompts.SYSTEM_DRAFTER)
        result = parse_llm_json(raw)

        if isinstance(result, dict) and "date" in result and "time" in result:
            # Validate the date is in the future
            chosen_date = date.fromisoformat(result["date"])
            if chosen_date <= date.today():
                logger.warning("LLM chose past/today date %s, using fallback", result["date"])
                return _fallback_slot(conn)

            return {
                "date": result["date"],
                "time": result.get("time", "08:30"),
                "reason": str(result.get("reason", "AI-optimized slot"))[:80],
            }

        logger.warning("LLM returned unexpected format: %s", raw[:200])
        return _fallback_slot(conn)

    except Exception:
        logger.error("LLM scheduling failed, using fallback", exc_info=True)
        return _fallback_slot(conn)


async def auto_schedule_draft(draft_id: int) -> dict:
    """Find optimal slot via LLM and create a calendar entry for the draft.

    Returns the calendar entry dict with a 'reason' field.
    Raises ValueError if draft not found or already scheduled.
    """
    conn = get_conn()

    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise ValueError(f"Draft {draft_id} not found")

    existing = conn.execute(
        "SELECT id FROM content_calendar WHERE draft_id = ? AND status != 'skipped'",
        (draft_id,),
    ).fetchone()
    if existing:
        raise ValueError(f"Draft {draft_id} is already scheduled")

    slot = await find_optimal_slot(draft_id)
    now_str = datetime.now(timezone.utc).isoformat()
    draft_dict = dict(draft)

    cursor = conn.execute(
        """INSERT INTO content_calendar
           (scheduled_date, scheduled_time, draft_id, pillar_id, status, notes, created_at)
           VALUES (?, ?, ?, ?, 'planned', ?, ?)""",
        (
            slot["date"],
            slot["time"],
            draft_id,
            draft_dict.get("pillar_id"),
            draft_dict.get("topic", ""),
            now_str,
        ),
    )

    # Mark draft as scheduled
    conn.execute(
        "UPDATE drafts SET status = 'scheduled', updated_at = ? WHERE id = ?",
        (now_str, draft_id),
    )
    conn.commit()

    entry = conn.execute(
        "SELECT * FROM content_calendar WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()

    logger.info("Auto-scheduled draft %d to %s %s — %s", draft_id, slot["date"], slot["time"], slot["reason"])

    result = dict(entry)
    result["reason"] = slot["reason"]
    return result
