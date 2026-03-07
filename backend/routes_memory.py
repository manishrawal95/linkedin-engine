"""
FastAPI routes for Creator Memory, Ideas, and Creator Profile.
Mounted on the main app via app.include_router().
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from backend.db import get_conn
from backend.tasks import create_task

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Creator Memory ───────────────────────────────────────────────

@router.get("/memory")
async def get_memory_endpoint():
    """Get current creator memory."""
    from backend.memory import get_memory

    memory = get_memory()
    if not memory:
        return {"id": None, "message": "No memory built yet"}
    return memory


@router.post("/memory/build")
async def build_memory_endpoint():
    """Start a background memory build. Returns task_id immediately."""
    from backend.memory import build_memory

    # Pre-validate post count before starting background task
    conn = get_conn()
    post_count = conn.execute(
        "SELECT COUNT(*) as c FROM posts WHERE author = 'me'"
    ).fetchone()["c"]
    if post_count < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 10 posts to build memory (have {post_count})",
        )

    task_id = create_task("memory_build", build_memory())
    return {"task_id": task_id, "status": "running"}


@router.get("/memory/dna")
async def get_content_dna():
    """Get computed content DNA (no LLM required)."""
    from backend.memory import compute_content_dna

    return compute_content_dna()


# ── Ideas ────────────────────────────────────────────────────────

@router.get("/ideas")
async def list_ideas(status: str | None = None):
    """Get ideas, optionally filtered by status."""
    from backend.ideator import get_ideas

    return {"ideas": get_ideas(status=status)}


@router.post("/ideas/generate")
async def generate_ideas_endpoint(
    count: int = 5,
    topic_hint: str = "",
):
    """Generate new batch of scored ideas — runs in background."""
    from backend.ideator import generate_ideas

    async def _run():
        ideas = await generate_ideas(count=count, topic_hint=topic_hint)
        return {"ideas": ideas}

    task_id = create_task("ideas_generate", _run())
    return {"task_id": task_id, "status": "running"}


@router.post("/ideas/{idea_id}/approve")
async def approve_idea_endpoint(idea_id: int, background_tasks: BackgroundTasks):
    """Approve an idea and auto-generate 2 draft variations in background."""
    from backend.ideator import approve_idea
    from backend.drafter import generate_drafts

    try:
        idea = approve_idea(idea_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    idea_dict = dict(idea) if not isinstance(idea, dict) else idea

    async def _auto_draft():
        try:
            drafts = await generate_drafts(
                topic=idea_dict["topic"],
                pillar_id=idea_dict.get("pillar_id"),
                style=idea_dict.get("hook_style"),
                num_variants=2,
            )
            draft_ids = [d["id"] for d in drafts if "id" in d]
            if draft_ids:
                conn = get_conn()
                conn.execute(
                    "UPDATE ideas SET status = 'drafted', draft_id = ? WHERE id = ?",
                    (draft_ids[0], idea_id),
                )
                conn.commit()
        except Exception as e:
            logger.error("Auto-draft from idea %d failed: %s", idea_id, e, exc_info=True)

    background_tasks.add_task(_auto_draft)
    return {**idea_dict, "drafting": True}


@router.post("/ideas/{idea_id}/reject")
async def reject_idea_endpoint(idea_id: int):
    """Reject an idea."""
    from backend.ideator import reject_idea

    reject_idea(idea_id)
    return {"status": "rejected"}


@router.post("/ideas/{idea_id}/draft")
async def draft_from_idea(idea_id: int, auto_schedule: bool = False):
    """Generate a draft from an approved idea — runs in background."""
    from backend.drafter import generate_drafts

    conn = get_conn()
    idea = conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()
    if not idea:
        raise HTTPException(status_code=404, detail=f"Idea {idea_id} not found")

    idea_dict = dict(idea)
    if idea_dict["status"] not in ("approved", "pending"):
        raise HTTPException(status_code=400, detail="Idea must be approved or pending to draft")

    async def _run():
        drafts = await generate_drafts(
            topic=idea_dict["topic"],
            pillar_id=idea_dict.get("pillar_id"),
            style=idea_dict.get("hook_style"),
            num_variants=2,
        )

        draft_ids = [d["id"] for d in drafts if "id" in d]
        if draft_ids:
            c = get_conn()
            c.execute(
                "UPDATE ideas SET status = 'drafted', draft_id = ? WHERE id = ?",
                (draft_ids[0], idea_id),
            )
            c.commit()

        scheduled_entry = None
        if auto_schedule and draft_ids:
            from backend.scheduler import auto_schedule_draft
            try:
                scheduled_entry = auto_schedule_draft(draft_ids[0])
            except ValueError as e:
                logger.warning("Auto-schedule for draft %d skipped: %s", draft_ids[0], e)

        result: dict = {"draft_ids": draft_ids, "drafts": drafts}
        if scheduled_entry is not None:
            result["scheduled"] = scheduled_entry
        return result

    task_id = create_task(f"draft_idea_{idea_id}", _run())
    return {"task_id": task_id, "status": "running"}


# ── Creator Profile ──────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    about_me: str = ""
    writing_skill: str = ""


@router.get("/profile")
async def get_profile_endpoint():
    """Get creator profile."""
    from backend.profile import get_profile

    profile = get_profile()
    if not profile:
        return {"id": None, "about_me": "", "writing_skill": "", "condensed_context": ""}
    return profile


@router.put("/profile")
async def update_profile_endpoint(body: ProfileUpdate):
    """Save creator profile and regenerate condensed context."""
    from backend.profile import save_profile

    try:
        profile = await save_profile(body.about_me, body.writing_skill)
        return profile
    except Exception as e:
        logger.error("Profile save failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Profile save failed: {e}")


# ── Analytics Data ───────────────────────────────────────────────

@router.get("/analytics/summary")
async def get_analytics_summary():
    """Get imported analytics summary (discovery + followers)."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM analytics_summary WHERE id = 1").fetchone()
    return dict(row) if row else {}


@router.get("/analytics/demographics")
async def get_demographics():
    """Get audience demographics from last import."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT category, value, percentage FROM audience_demographics ORDER BY category, percentage DESC"
    ).fetchall()
    result: dict[str, list[dict]] = {}
    for r in rows:
        cat = r["category"]
        if cat not in result:
            result[cat] = []
        result[cat].append({"value": r["value"], "percentage": r["percentage"]})
    return result


@router.get("/analytics/engagement-daily")
async def get_daily_engagement():
    """Get daily engagement data from last import."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT date, impressions, engagements FROM daily_engagement ORDER BY date"
    ).fetchall()
    return {"days": [dict(r) for r in rows]}


@router.get("/analytics/followers-daily")
async def get_daily_followers():
    """Get daily follower data from last import."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT date, new_followers FROM follower_daily ORDER BY date"
    ).fetchall()
    return {"days": [dict(r) for r in rows]}
