"""
FastAPI server for the LinkedIn Post Planner.
Binds to 127.0.0.1 ONLY — never accessible from outside localhost.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import Body, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.db import get_conn
from backend.tasks import create_task, get_task
from backend.models import (
    DraftGenerateRequest,
    CalendarEntryCreate,
    CalendarEntryUpdate,
    CompetitorCreate,
    CompetitorUpdate,
    DraftCreate,
    DraftUpdate,
    ExtractHookRequest,
    GoalCreate,
    GoalUpdate,
    HashtagSetCreate,
    HashtagSetUpdate,
    HookCreate,
    HookUpdate,
    ImproveDraftRequest,
    PostIdeasRequest,
    PostToLinkedInRequest,
    MetricsCreate,
    MoodBoardItemCreate,
    MoodBoardItemUpdate,
    MoodBoardReorder,
    PillarCreate,
    PillarUpdate,
    PostCreate,
    PostUpdate,
    SeriesCreate,
    SeriesUpdate,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LinkedIn Post Planner",
    description="Local AI-powered LinkedIn content planning system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount sub-routers
from backend.routes_memory import router as memory_router
app.include_router(memory_router)


def _row_to_dict(row) -> dict:
    if row is None:
        return {}
    return dict(row)


def _rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]


# ── Background Tasks ─────────────────────────────────────────────

@app.get("/tasks/{task_id}")
async def task_status(task_id: str):
    """Check status of a background task."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(404, f"Task {task_id} not found")
    return task


# ── Health ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    from fastapi.responses import JSONResponse

    checks = {"server": "ok", "provider": config.LLM_PROVIDER}
    try:
        get_conn()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    all_ok = all(v == "ok" for k, v in checks.items() if k not in ("provider",))
    status_code = 200 if all_ok else 503
    return JSONResponse(content=checks, status_code=status_code)


# ── Posts ────────────────────────────────────────────────────────

@app.get("/posts")
async def list_posts(
    author: str | None = None,
    pillar_id: int | None = None,
    post_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    conn = get_conn()
    query = "SELECT * FROM posts WHERE 1=1"
    params: list = []
    if author:
        query += " AND author = ?"
        params.append(author)
    if pillar_id:
        query += " AND pillar_id = ?"
        params.append(pillar_id)
    if post_type:
        query += " AND post_type = ?"
        params.append(post_type)
    if date_from:
        query += " AND posted_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND posted_at <= ?"
        params.append(date_to)
    query += " ORDER BY posted_at DESC, created_at DESC"
    rows = conn.execute(query, params).fetchall()
    return {"posts": _rows_to_list(rows)}


@app.get("/posts/batch-metrics")
async def batch_metrics(post_ids: str = ""):
    """Get latest metrics for multiple posts at once."""
    conn = get_conn()
    if not post_ids:
        return {"metrics": {}}
    ids = [int(x) for x in post_ids.split(",") if x.strip().isdigit()]
    if not ids:
        return {"metrics": {}}
    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(f"""
        SELECT * FROM latest_metrics
        WHERE post_id IN ({placeholders})
    """, ids).fetchall()
    result = {}
    for row in rows:
        result[str(row["post_id"])] = dict(row)
    return {"metrics": result}


def _sync_hook_from_post(conn, post_id: int, hook_line: str | None, hook_style: str | None):
    """Sync a post's hook_line/hook_style into the hooks table."""
    if not hook_line or not hook_line.strip():
        # No hook line — remove any linked hook
        conn.execute("DELETE FROM hooks WHERE source_post_id = ?", (post_id,))
        return
    style = hook_style or "statement"
    existing = conn.execute(
        "SELECT id FROM hooks WHERE source_post_id = ?", (post_id,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE hooks SET text = ?, style = ? WHERE id = ?",
            (hook_line.strip(), style, existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO hooks (text, style, source_post_id) VALUES (?, ?, ?)",
            (hook_line.strip(), style, post_id),
        )


@app.post("/posts")
async def create_post(req: PostCreate):
    conn = get_conn()
    word_count = len(req.content.split())
    cur = conn.execute(
        """INSERT INTO posts (author, content, post_url, post_type, topic_tags,
           hook_line, hook_style, cta_type, word_count, posted_at, pillar_id, series_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            req.author, req.content, req.post_url, req.post_type,
            json.dumps(req.topic_tags), req.hook_line, req.hook_style, req.cta_type,
            word_count, req.posted_at, req.pillar_id, req.series_id,
        ),
    )
    _sync_hook_from_post(conn, cur.lastrowid, req.hook_line, req.hook_style)
    conn.commit()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"post": _row_to_dict(post)}


@app.get("/posts/{post_id}")
async def get_post(post_id: int):
    conn = get_conn()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise HTTPException(404, f"Post {post_id} not found")
    metrics = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC",
        (post_id,),
    ).fetchall()
    return {"post": _row_to_dict(post), "metrics": _rows_to_list(metrics)}


@app.put("/posts/{post_id}")
async def update_post(post_id: int, req: PostUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Post {post_id} not found")

    updates = {}
    for field, value in req.model_dump(exclude_unset=True).items():
        if field == "topic_tags" and value is not None:
            updates[field] = json.dumps(value)
        else:
            updates[field] = value

    if "content" in updates and updates["content"]:
        updates["word_count"] = len(updates["content"].split())

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE posts SET {set_clause} WHERE id = ?",
            (*updates.values(), post_id),
        )

    # Sync hook if hook_line or hook_style changed
    if "hook_line" in updates or "hook_style" in updates:
        post_row = conn.execute("SELECT hook_line, hook_style FROM posts WHERE id = ?", (post_id,)).fetchone()
        _sync_hook_from_post(conn, post_id, post_row["hook_line"], post_row["hook_style"])

    conn.commit()

    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return {"post": _row_to_dict(post)}


@app.delete("/posts/{post_id}")
async def delete_post(post_id: int):
    conn = get_conn()
    try:
        # Clean up related records that don't have ON DELETE CASCADE
        conn.execute("DELETE FROM learnings WHERE post_id = ?", (post_id,))
        conn.execute("DELETE FROM metrics_snapshots WHERE post_id = ?", (post_id,))
        conn.execute("UPDATE hooks SET source_post_id = NULL WHERE source_post_id = ?", (post_id,))
        conn.execute("UPDATE mood_board_items SET source_post_id = NULL WHERE source_post_id = ?", (post_id,))
        conn.execute("UPDATE content_calendar SET post_id = NULL WHERE post_id = ?", (post_id,))
        conn.execute("UPDATE drafts SET posted_post_id = NULL WHERE posted_post_id = ?", (post_id,))
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return {"deleted": post_id}


# ── Metrics ──────────────────────────────────────────────────────

@app.post("/posts/{post_id}/metrics")
async def add_metrics(post_id: int, req: MetricsCreate):
    conn = get_conn()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise HTTPException(404, f"Post {post_id} not found")

    interaction_score = req.comments * 3 + req.reposts * 2 + req.saves * 2 + req.sends * 1.5 + req.likes
    engagement_score = (interaction_score / req.impressions) if req.impressions > 0 else 0.0

    snapshot_type = None
    now = datetime.now(timezone.utc).isoformat()

    cur = conn.execute(
        """INSERT INTO metrics_snapshots
           (post_id, impressions, members_reached, profile_viewers, followers_gained,
            likes, comments, reposts, saves, sends, engagement_score, interaction_score,
            snapshot_type, snapshot_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (post_id, req.impressions, req.members_reached, req.profile_viewers,
         req.followers_gained, req.likes, req.comments, req.reposts,
         req.saves, req.sends, engagement_score, interaction_score, snapshot_type, now),
    )
    conn.commit()
    snapshot = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE id = ?", (cur.lastrowid,)
    ).fetchone()

    # Auto-analyze post in background (non-blocking)
    import asyncio
    from backend.analyzer import analyze_post as _analyze

    async def _run_analysis():
        try:
            result = await _analyze(post_id)
            logger.info("Auto-analysis complete for post %d: %s", post_id, result.get("classification"))
        except Exception as e:
            logger.warning("Auto-analysis failed for post %d: %s", post_id, e)

    asyncio.create_task(_run_analysis())

    return {"snapshot": _row_to_dict(snapshot)}


@app.get("/posts/{post_id}/metrics")
async def get_metrics(post_id: int):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC",
        (post_id,),
    ).fetchall()
    return {"metrics": _rows_to_list(rows)}


# ── Content Pillars ──────────────────────────────────────────────

@app.get("/pillars")
async def list_pillars():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM content_pillars ORDER BY sort_order, id").fetchall()
    return {"pillars": _rows_to_list(rows)}


@app.post("/pillars")
async def create_pillar(req: PillarCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO content_pillars (name, color, description, sort_order) VALUES (?, ?, ?, ?)",
        (req.name, req.color, req.description, req.sort_order),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM content_pillars WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"pillar": _row_to_dict(row)}


@app.put("/pillars/{pillar_id}")
async def update_pillar(pillar_id: int, req: PillarUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM content_pillars WHERE id = ?", (pillar_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Pillar {pillar_id} not found")

    updates = req.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE content_pillars SET {set_clause} WHERE id = ?", (*updates.values(), pillar_id))
    conn.commit()
    row = conn.execute("SELECT * FROM content_pillars WHERE id = ?", (pillar_id,)).fetchone()
    return {"pillar": _row_to_dict(row)}


@app.delete("/pillars/{pillar_id}")
async def delete_pillar(pillar_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM content_pillars WHERE id = ?", (pillar_id,))
    conn.commit()
    return {"deleted": pillar_id}


# ── Mood Board ───────────────────────────────────────────────────

@app.put("/mood-board/reorder")
async def reorder_mood_board(req: MoodBoardReorder):
    conn = get_conn()
    for idx, item_id in enumerate(req.item_ids):
        conn.execute("UPDATE mood_board_items SET sort_order = ? WHERE id = ?", (idx, item_id))
    conn.commit()
    return {"reordered": len(req.item_ids)}


@app.get("/mood-board")
async def list_mood_board(pillar_id: int | None = None):
    conn = get_conn()
    if pillar_id:
        rows = conn.execute(
            "SELECT * FROM mood_board_items WHERE pillar_id = ? ORDER BY sort_order",
            (pillar_id,),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM mood_board_items ORDER BY pillar_id, sort_order").fetchall()

    # Find which mood board items have drafts
    drafted_ids = set()
    draft_rows = conn.execute("SELECT DISTINCT mood_board_item_id FROM drafts WHERE mood_board_item_id IS NOT NULL").fetchall()
    for r in draft_rows:
        drafted_ids.add(r["mood_board_item_id"])

    return {"items": _rows_to_list(rows), "drafted_item_ids": list(drafted_ids)}


@app.post("/mood-board")
async def create_mood_board_item(req: MoodBoardItemCreate):
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO mood_board_items (pillar_id, type, content, source_post_id, source_url, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (req.pillar_id, req.type, req.content, req.source_post_id, req.source_url, req.sort_order),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM mood_board_items WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"item": _row_to_dict(row)}


@app.put("/mood-board/{item_id}")
async def update_mood_board_item(item_id: int, req: MoodBoardItemUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM mood_board_items WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Mood board item {item_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE mood_board_items SET {set_clause} WHERE id = ?", (*updates.values(), item_id))
        conn.commit()
    row = conn.execute("SELECT * FROM mood_board_items WHERE id = ?", (item_id,)).fetchone()
    return {"item": _row_to_dict(row)}


@app.delete("/mood-board/{item_id}")
async def delete_mood_board_item(item_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM mood_board_items WHERE id = ?", (item_id,))
    conn.commit()
    return {"deleted": item_id}


# ── Hooks ────────────────────────────────────────────────────────

@app.post("/hooks/extract/{post_id}")
async def extract_hook(post_id: int):
    """Extract and save a hook from an existing post."""
    from backend.drafter import extract_hook_from_post

    conn = get_conn()
    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise HTTPException(404, f"Post {post_id} not found")

    hook_data = await extract_hook_from_post(post["content"])

    cur = conn.execute(
        "INSERT INTO hooks (text, style, source_post_id) VALUES (?, ?, ?)",
        (hook_data.get("hook_text", ""), hook_data.get("style", "statement"), post_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM hooks WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"hook": dict(row)}


@app.get("/hooks")
async def list_hooks(style: str | None = None):
    conn = get_conn()
    if style:
        rows = conn.execute("SELECT * FROM hooks WHERE LOWER(style) = LOWER(?) ORDER BY avg_engagement_score DESC NULLS LAST", (style,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM hooks ORDER BY avg_engagement_score DESC NULLS LAST").fetchall()
    return {"hooks": _rows_to_list(rows)}


@app.post("/hooks")
async def create_hook(req: HookCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO hooks (text, style, source_post_id) VALUES (?, ?, ?)",
        (req.text, req.style, req.source_post_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM hooks WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"hook": _row_to_dict(row)}


@app.put("/hooks/{hook_id}")
async def update_hook(hook_id: int, req: HookUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM hooks WHERE id = ?", (hook_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Hook {hook_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE hooks SET {set_clause} WHERE id = ?", (*updates.values(), hook_id))
        conn.commit()
    row = conn.execute("SELECT * FROM hooks WHERE id = ?", (hook_id,)).fetchone()
    return {"hook": _row_to_dict(row)}


@app.delete("/hooks/{hook_id}")
async def delete_hook(hook_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM hooks WHERE id = ?", (hook_id,))
    conn.commit()
    return {"deleted": hook_id}


@app.post("/hooks/{hook_id}/use")
async def use_hook(hook_id: int):
    conn = get_conn()
    conn.execute("UPDATE hooks SET times_used = times_used + 1 WHERE id = ?", (hook_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM hooks WHERE id = ?", (hook_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Hook {hook_id} not found")
    return {"hook": _row_to_dict(row)}


# ── Hashtag Sets ─────────────────────────────────────────────────

@app.get("/hashtags")
async def list_hashtags(pillar_id: int | None = None):
    conn = get_conn()
    if pillar_id:
        rows = conn.execute("SELECT * FROM hashtag_sets WHERE pillar_id = ? ORDER BY name", (pillar_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM hashtag_sets ORDER BY name").fetchall()
    return {"hashtag_sets": _rows_to_list(rows)}


@app.post("/hashtags")
async def create_hashtag_set(req: HashtagSetCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO hashtag_sets (name, hashtags, pillar_id) VALUES (?, ?, ?)",
        (req.name, json.dumps(req.hashtags), req.pillar_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM hashtag_sets WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"hashtag_set": _row_to_dict(row)}


@app.put("/hashtags/{set_id}")
async def update_hashtag_set(set_id: int, req: HashtagSetUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM hashtag_sets WHERE id = ?", (set_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Hashtag set {set_id} not found")

    updates = {}
    for field, value in req.model_dump(exclude_unset=True).items():
        if field == "hashtags" and value is not None:
            updates[field] = json.dumps(value)
        else:
            updates[field] = value

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE hashtag_sets SET {set_clause} WHERE id = ?", (*updates.values(), set_id))
        conn.commit()
    row = conn.execute("SELECT * FROM hashtag_sets WHERE id = ?", (set_id,)).fetchone()
    return {"hashtag_set": _row_to_dict(row)}


@app.delete("/hashtags/{set_id}")
async def delete_hashtag_set(set_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM hashtag_sets WHERE id = ?", (set_id,))
    conn.commit()
    return {"deleted": set_id}


@app.post("/hashtags/{set_id}/use")
async def use_hashtag_set(set_id: int):
    conn = get_conn()
    conn.execute("UPDATE hashtag_sets SET times_used = times_used + 1 WHERE id = ?", (set_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM hashtag_sets WHERE id = ?", (set_id,)).fetchone()
    if not row:
        raise HTTPException(404, f"Hashtag set {set_id} not found")
    return {"hashtag_set": _row_to_dict(row)}


# ── Drafts ───────────────────────────────────────────────────────

@app.post("/drafts/generate")
async def generate_draft(req: DraftGenerateRequest):
    """Generate AI draft variants — runs in background, returns task_id."""
    from backend.drafter import generate_drafts

    async def _run():
        drafts = await generate_drafts(
            topic=req.topic,
            pillar_id=req.pillar_id,
            style=req.style,
            num_variants=req.num_variants,
        )
        return {"drafts": drafts}

    task_id = create_task("draft_generate", _run())
    return {"task_id": task_id, "status": "running"}


@app.get("/drafts")
async def list_drafts(status: str | None = None):
    conn = get_conn()
    if status:
        rows = conn.execute("SELECT * FROM drafts WHERE status = ? ORDER BY updated_at DESC", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM drafts ORDER BY updated_at DESC").fetchall()
    return {"drafts": _rows_to_list(rows)}


@app.post("/drafts")
async def create_draft(req: DraftCreate):
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO drafts (topic, content, hook_variant, pillar_id, inspiration_post_ids, ai_model, mood_board_item_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (req.topic, req.content, req.hook_variant, req.pillar_id,
         json.dumps(req.inspiration_post_ids), req.ai_model, req.mood_board_item_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM drafts WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"draft": _row_to_dict(row)}


@app.put("/drafts/{draft_id}")
async def update_draft(draft_id: int, req: DraftUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Draft {draft_id} not found")

    updates = req.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE drafts SET {set_clause} WHERE id = ?", (*updates.values(), draft_id))
    conn.commit()
    row = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    return {"draft": _row_to_dict(row)}


@app.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM drafts WHERE id = ?", (draft_id,))
    conn.commit()
    return {"deleted": draft_id}


@app.post("/drafts/{draft_id}/mark-posted")
async def mark_draft_posted(draft_id: int, post_id: int):
    conn = get_conn()
    conn.execute(
        "UPDATE drafts SET status = 'posted', posted_post_id = ?, updated_at = ? WHERE id = ?",
        (post_id, datetime.now(timezone.utc).isoformat(), draft_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    return {"draft": _row_to_dict(row)}


@app.post("/drafts/{draft_id}/auto-schedule")
async def auto_schedule_draft_endpoint(draft_id: int):
    """Auto-schedule a draft to the next optimal calendar slot using LLM."""
    from backend.scheduler import auto_schedule_draft

    try:
        entry = await auto_schedule_draft(draft_id)
    except ValueError as e:
        detail = str(e)
        if "not found" in detail:
            raise HTTPException(status_code=404, detail=detail)
        if "already scheduled" in detail:
            raise HTTPException(status_code=409, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    except Exception as e:
        logger.error("Auto-schedule failed for draft %d", draft_id, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scheduling failed: {e}")

    return {"calendar_entry": entry}


def _nyc_now() -> str:
    """Current time in America/New_York as ISO string."""
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo("America/New_York")).isoformat()


async def _auto_fill_from_draft(content: str, conn=None) -> dict:
    """Run LLM auto-fill on draft content including pillar detection. Returns defaults on failure."""
    import json as _json
    from backend import prompts as _prompts
    from backend.llm import generate

    # Build pillars context for the LLM
    pillars_text = "None defined"
    if conn is not None:
        pillars = conn.execute("SELECT id, name FROM content_pillars ORDER BY sort_order").fetchall()
        if pillars:
            pillars_text = "\n".join(f"- id={p['id']}: {p['name']}" for p in pillars)

    try:
        from backend.utils import parse_llm_json
        raw = await generate(_prompts.AUTO_FILL.format(content=content, pillars_text=pillars_text))
        result = parse_llm_json(raw)
        return {
            "hook_line": result.get("hook_line", ""),
            "hook_style": result.get("hook_style", ""),
            "cta_type": result.get("cta_type", "none"),
            "post_type": result.get("post_type", "text"),
            "topic_tags": _json.dumps(result.get("topic_tags", [])),
            "pillar_id": result.get("pillar_id"),
        }
    except Exception as e:
        logger.warning("Auto-fill failed: %s — using defaults", e)
        return {"hook_line": "", "hook_style": "", "cta_type": "none", "post_type": "text", "topic_tags": "[]", "pillar_id": None}


@app.post("/drafts/{draft_id}/publish")
async def publish_draft(draft_id: int, post_url: str | None = None, post_type: str | None = None, posted_at: str | None = None):
    """Create a post from a draft with AI-auto-filled metadata. Marks draft as posted."""
    conn = get_conn()
    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise HTTPException(404, f"Draft {draft_id} not found")

    # Auto-fill all metadata from content — user doesn't need to fill manually
    meta = await _auto_fill_from_draft(draft["content"], conn=conn)

    now_iso = _nyc_now()
    word_count = len(draft["content"].split())
    pillar_id = meta.get("pillar_id") or draft["pillar_id"]
    cur = conn.execute(
        """INSERT INTO posts (author, content, post_url, post_type, hook_line, hook_style,
           cta_type, topic_tags, word_count, posted_at, pillar_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "me", draft["content"], post_url,
            post_type or meta["post_type"],
            meta["hook_line"], meta["hook_style"], meta["cta_type"], meta["topic_tags"],
            word_count, posted_at or now_iso, pillar_id,
        ),
    )
    post_id = cur.lastrowid

    # Link idea → draft → post if this draft came from an idea
    idea_row = conn.execute(
        "SELECT id FROM ideas WHERE draft_id = ?", (draft_id,)
    ).fetchone()
    if idea_row:
        conn.execute(
            "UPDATE ideas SET status = 'posted' WHERE id = ?", (idea_row["id"],)
        )

    conn.execute(
        "UPDATE drafts SET status = 'posted', posted_post_id = ?, updated_at = ? WHERE id = ?",
        (post_id, now_iso, draft_id),
    )
    conn.commit()

    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()

    logger.info(
        "Draft %d published as post %d — add metrics to trigger analysis",
        draft_id, post_id,
    )

    return {"post": _row_to_dict(post), "draft_id": draft_id, "needs_metrics": True}


# ── Learnings ────────────────────────────────────────────────────

@app.get("/learnings")
async def list_learnings(category: str | None = None, impact: str | None = None):
    conn = get_conn()
    query = "SELECT * FROM learnings WHERE 1=1"
    params: list = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if impact:
        query += " AND impact = ?"
        params.append(impact)
    query += " ORDER BY confidence DESC, times_confirmed DESC"
    rows = conn.execute(query, params).fetchall()
    return {"learnings": _rows_to_list(rows)}


# ── Playbook ─────────────────────────────────────────────────────

@app.get("/playbook")
async def get_playbook():
    conn = get_conn()
    row = conn.execute("SELECT * FROM playbook ORDER BY generated_at DESC LIMIT 1").fetchone()
    if not row:
        return {"playbook": None}
    return {"playbook": _row_to_dict(row)}


# ── Content Calendar ─────────────────────────────────────────────

@app.get("/calendar")
async def list_calendar(date_from: str | None = None, date_to: str | None = None):
    conn = get_conn()
    query = "SELECT * FROM content_calendar WHERE 1=1"
    params: list = []
    if date_from:
        query += " AND scheduled_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND scheduled_date <= ?"
        params.append(date_to)
    query += " ORDER BY scheduled_date, scheduled_time"
    rows = conn.execute(query, params).fetchall()
    return {"entries": _rows_to_list(rows)}


@app.post("/calendar")
async def create_calendar_entry(req: CalendarEntryCreate):
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO content_calendar (scheduled_date, scheduled_time, draft_id,
           pillar_id, series_id, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (req.scheduled_date, req.scheduled_time, req.draft_id,
         req.pillar_id, req.series_id, req.status, req.notes),
    )
    # Mark draft as scheduled
    if req.draft_id:
        conn.execute(
            "UPDATE drafts SET status = 'scheduled', updated_at = ? WHERE id = ? AND status IN ('draft', 'revised')",
            (datetime.now(timezone.utc).isoformat(), req.draft_id),
        )
    conn.commit()
    row = conn.execute("SELECT * FROM content_calendar WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"entry": _row_to_dict(row)}


@app.put("/calendar/{entry_id}")
async def update_calendar_entry(entry_id: int, req: CalendarEntryUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM content_calendar WHERE id = ?", (entry_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Calendar entry {entry_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE content_calendar SET {set_clause} WHERE id = ?", (*updates.values(), entry_id))
        conn.commit()
    row = conn.execute("SELECT * FROM content_calendar WHERE id = ?", (entry_id,)).fetchone()
    return {"entry": _row_to_dict(row)}


@app.delete("/calendar/{entry_id}")
async def delete_calendar_entry(entry_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM content_calendar WHERE id = ?", (entry_id,))
    conn.commit()
    return {"deleted": entry_id}


# ── Content Series ───────────────────────────────────────────────

@app.get("/series")
async def list_series():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM content_series ORDER BY name").fetchall()
    return {"series": _rows_to_list(rows)}


@app.post("/series")
async def create_series(req: SeriesCreate):
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO content_series (name, description, pillar_id, frequency, preferred_day, preferred_time)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (req.name, req.description, req.pillar_id, req.frequency, req.preferred_day, req.preferred_time),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM content_series WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"series_item": _row_to_dict(row)}


@app.put("/series/{series_id}")
async def update_series(series_id: int, req: SeriesUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM content_series WHERE id = ?", (series_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Series {series_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE content_series SET {set_clause} WHERE id = ?", (*updates.values(), series_id))
        conn.commit()
    row = conn.execute("SELECT * FROM content_series WHERE id = ?", (series_id,)).fetchone()
    return {"series_item": _row_to_dict(row)}


@app.delete("/series/{series_id}")
async def delete_series(series_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM content_series WHERE id = ?", (series_id,))
    conn.commit()
    return {"deleted": series_id}


@app.get("/series/{series_id}/stats")
async def series_stats(series_id: int):
    conn = get_conn()
    s = conn.execute("SELECT * FROM content_series WHERE id = ?", (series_id,)).fetchone()
    if not s:
        raise HTTPException(404, f"Series {series_id} not found")

    post_count = conn.execute(
        "SELECT COUNT(*) as c FROM posts WHERE series_id = ? AND author = 'me'", (series_id,)
    ).fetchone()["c"]

    last_post = conn.execute(
        "SELECT posted_at FROM posts WHERE series_id = ? AND author = 'me' AND posted_at IS NOT NULL ORDER BY posted_at DESC LIMIT 1",
        (series_id,)
    ).fetchone()

    return {
        "series_id": series_id,
        "post_count": post_count,
        "last_posted": last_post["posted_at"] if last_post else None,
    }


# ── Goals ────────────────────────────────────────────────────────

@app.get("/goals")
async def list_goals(status: str | None = None):
    # Refresh current values from live metrics before returning
    from backend.strategist import refresh_goal_progress
    try:
        refresh_goal_progress()
    except Exception as e:
        logger.warning("Goal progress refresh failed: %s", e)

    conn = get_conn()
    if status:
        rows = conn.execute("SELECT * FROM goals WHERE status = ? ORDER BY created_at DESC", (status,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM goals ORDER BY created_at DESC").fetchall()
    return {"goals": _rows_to_list(rows)}


@app.post("/goals")
async def create_goal(req: GoalCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO goals (metric, target_value, current_value, deadline) VALUES (?, ?, ?, ?)",
        (req.metric, req.target_value, req.current_value, req.deadline),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM goals WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"goal": _row_to_dict(row)}


@app.put("/goals/{goal_id}")
async def update_goal(goal_id: int, req: GoalUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Goal {goal_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE goals SET {set_clause} WHERE id = ?", (*updates.values(), goal_id))
        conn.commit()
    row = conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    return {"goal": _row_to_dict(row)}


@app.delete("/goals/{goal_id}")
async def delete_goal(goal_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
    conn.commit()
    return {"deleted": goal_id}


# ── Competitors ──────────────────────────────────────────────────

@app.get("/competitors")
async def list_competitors():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM competitor_profiles ORDER BY name").fetchall()
    return {"competitors": _rows_to_list(rows)}


@app.post("/competitors")
async def create_competitor(req: CompetitorCreate):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO competitor_profiles (name, linkedin_url, niche, notes) VALUES (?, ?, ?, ?)",
        (req.name, req.linkedin_url, req.niche, req.notes),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM competitor_profiles WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"competitor": _row_to_dict(row)}


@app.put("/competitors/{comp_id}")
async def update_competitor(comp_id: int, req: CompetitorUpdate):
    conn = get_conn()
    existing = conn.execute("SELECT * FROM competitor_profiles WHERE id = ?", (comp_id,)).fetchone()
    if not existing:
        raise HTTPException(404, f"Competitor {comp_id} not found")

    updates = req.model_dump(exclude_unset=True)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE competitor_profiles SET {set_clause} WHERE id = ?", (*updates.values(), comp_id))
        conn.commit()
    row = conn.execute("SELECT * FROM competitor_profiles WHERE id = ?", (comp_id,)).fetchone()
    return {"competitor": _row_to_dict(row)}


@app.delete("/competitors/{comp_id}")
async def delete_competitor(comp_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM competitor_profiles WHERE id = ?", (comp_id,))
    conn.commit()
    return {"deleted": comp_id}


# ── Dashboard Stats ──────────────────────────────────────────────

@app.get("/dashboard/stats")
async def dashboard_stats():
    conn = get_conn()
    total_posts = conn.execute("SELECT COUNT(*) as c FROM posts WHERE author = 'me'").fetchone()["c"]
    total_drafts = conn.execute("SELECT COUNT(*) as c FROM drafts WHERE status = 'draft'").fetchone()["c"]

    avg_engagement = conn.execute("""
        SELECT AVG(latest.engagement_score) as avg_score
        FROM (
            SELECT ms.engagement_score,
                   ROW_NUMBER() OVER (PARTITION BY ms.post_id ORDER BY ms.snapshot_at DESC) as rn
            FROM metrics_snapshots ms
            JOIN posts p ON p.id = ms.post_id
            WHERE p.author = 'me'
        ) latest WHERE latest.rn = 1
    """).fetchone()["avg_score"]

    recent_posts = conn.execute("""
        SELECT p.*, ms.impressions, ms.members_reached, ms.profile_viewers,
               ms.followers_gained, ms.likes, ms.comments, ms.reposts,
               ms.saves, ms.sends, ms.engagement_score, ms.snapshot_type
        FROM posts p
        LEFT JOIN (
            SELECT post_id, impressions, members_reached, profile_viewers,
                   followers_gained, likes, comments, reposts, saves, sends,
                   engagement_score, snapshot_type,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me'
        ORDER BY p.posted_at DESC
        LIMIT 5
    """).fetchall()

    total_impressions = conn.execute("""
        SELECT SUM(latest.impressions) as total
        FROM (
            SELECT ms.impressions,
                   ROW_NUMBER() OVER (PARTITION BY ms.post_id ORDER BY ms.snapshot_at DESC) as rn
            FROM metrics_snapshots ms
            JOIN posts p ON p.id = ms.post_id
            WHERE p.author = 'me'
        ) latest WHERE latest.rn = 1
    """).fetchone()["total"]

    avg_likes = conn.execute("""
        SELECT AVG(latest.likes) as avg_likes
        FROM (
            SELECT ms.likes,
                   ROW_NUMBER() OVER (PARTITION BY ms.post_id ORDER BY ms.snapshot_at DESC) as rn
            FROM metrics_snapshots ms
            JOIN posts p ON p.id = ms.post_id
            WHERE p.author = 'me'
        ) latest WHERE latest.rn = 1
    """).fetchone()["avg_likes"]

    # Trend: this month vs last month (posts count)
    posts_this_month = conn.execute("""
        SELECT COUNT(*) as c FROM posts WHERE author='me'
        AND strftime('%Y-%m', posted_at) = strftime('%Y-%m', 'now')
    """).fetchone()["c"]
    posts_last_month = conn.execute("""
        SELECT COUNT(*) as c FROM posts WHERE author='me'
        AND strftime('%Y-%m', posted_at) = strftime('%Y-%m', date('now', '-1 month'))
    """).fetchone()["c"]

    imp_this_month = conn.execute("""
        SELECT SUM(latest.impressions) as total
        FROM (
            SELECT ms.impressions,
                   ROW_NUMBER() OVER (PARTITION BY ms.post_id ORDER BY ms.snapshot_at DESC) as rn
            FROM metrics_snapshots ms
            JOIN posts p ON p.id = ms.post_id
            WHERE p.author = 'me' AND strftime('%Y-%m', p.posted_at) = strftime('%Y-%m', 'now')
        ) latest WHERE latest.rn = 1
    """).fetchone()["total"] or 0

    imp_last_month = conn.execute("""
        SELECT SUM(latest.impressions) as total
        FROM (
            SELECT ms.impressions,
                   ROW_NUMBER() OVER (PARTITION BY ms.post_id ORDER BY ms.snapshot_at DESC) as rn
            FROM metrics_snapshots ms
            JOIN posts p ON p.id = ms.post_id
            WHERE p.author = 'me' AND strftime('%Y-%m', p.posted_at) = strftime('%Y-%m', date('now', '-1 month'))
        ) latest WHERE latest.rn = 1
    """).fetchone()["total"] or 0

    def _trend_pct(current, previous):
        if not previous:
            return None
        return round(((current - previous) / previous) * 100, 1)

    return {
        "total_posts": total_posts,
        "total_drafts": total_drafts,
        "avg_engagement_score": avg_engagement or 0,
        "total_impressions": total_impressions or 0,
        "avg_likes": avg_likes or 0,
        "recent_posts": _rows_to_list(recent_posts),
        "posts_this_month": posts_this_month,
        "posts_last_month": posts_last_month,
        "posts_trend_pct": _trend_pct(posts_this_month, posts_last_month),
        "impressions_trend_pct": _trend_pct(imp_this_month, imp_last_month),
    }


@app.get("/dashboard/heatmap")
async def dashboard_heatmap():
    conn = get_conn()
    rows = conn.execute("""
        SELECT
            CASE CAST(strftime('%w', p.posted_at) AS INTEGER)
                WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
                WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
                WHEN 6 THEN 'saturday'
            END as day_of_week,
            CAST(strftime('%H', p.posted_at) AS INTEGER) as hour,
            AVG(ms.engagement_score) as avg_engagement,
            COUNT(*) as post_count
        FROM posts p
        JOIN metrics_snapshots ms ON ms.post_id = p.id
        WHERE p.author = 'me' AND p.posted_at IS NOT NULL AND p.posted_at != ''
        GROUP BY day_of_week, hour
        ORDER BY avg_engagement DESC
    """).fetchall()
    return {"heatmap": _rows_to_list(rows)}


@app.get("/dashboard/pillar-balance")
async def dashboard_pillar_balance():
    conn = get_conn()
    rows = conn.execute("""
        SELECT cp.id, cp.name, cp.color, COUNT(p.id) as post_count
        FROM content_pillars cp
        LEFT JOIN posts p ON p.pillar_id = cp.id AND p.author = 'me'
        GROUP BY cp.id
        ORDER BY post_count DESC
    """).fetchall()
    return {"pillars": _rows_to_list(rows)}


@app.get("/dashboard/analytics")
async def dashboard_analytics():
    """Deep analytics data for the analytics page."""
    conn = get_conn()

    # Pillar performance comparison
    pillar_perf = conn.execute("""
        SELECT cp.id, cp.name, cp.color,
               COUNT(p.id) as post_count,
               AVG(ms.engagement_score) as avg_engagement,
               AVG(ms.impressions) as avg_impressions,
               AVG(ms.likes) as avg_likes,
               AVG(ms.comments) as avg_comments,
               SUM(ms.impressions) as total_impressions
        FROM content_pillars cp
        LEFT JOIN posts p ON p.pillar_id = cp.id AND p.author = 'me'
        LEFT JOIN (
            SELECT post_id, engagement_score, impressions, likes, comments,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        GROUP BY cp.id
        ORDER BY avg_engagement DESC
    """).fetchall()

    # Hook style performance (from posts with hook_style set)
    hook_perf = conn.execute("""
        SELECT p.hook_style as style, COUNT(p.id) as count,
               COALESCE(AVG(ms.engagement_score), 0) as avg_engagement,
               0 as total_uses
        FROM posts p
        LEFT JOIN (
            SELECT post_id, engagement_score,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me' AND p.hook_style IS NOT NULL AND p.hook_style <> ''
        GROUP BY p.hook_style
        ORDER BY avg_engagement DESC
    """).fetchall()

    # Post type performance
    type_perf = conn.execute("""
        SELECT p.post_type, COUNT(p.id) as count,
               AVG(ms.engagement_score) as avg_engagement,
               AVG(ms.impressions) as avg_impressions
        FROM posts p
        LEFT JOIN (
            SELECT post_id, engagement_score, impressions,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me'
        GROUP BY p.post_type
        ORDER BY avg_engagement DESC
    """).fetchall()

    # Word count vs engagement correlation
    word_engagement = conn.execute("""
        SELECT p.word_count, ms.engagement_score, ms.impressions
        FROM posts p
        JOIN (
            SELECT post_id, engagement_score, impressions,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me' AND p.word_count > 0
        ORDER BY p.word_count
    """).fetchall()

    # Monthly performance trend
    monthly_trend = conn.execute("""
        SELECT strftime('%Y-%m', p.posted_at) as month,
               COUNT(p.id) as post_count,
               AVG(ms.engagement_score) as avg_engagement,
               SUM(ms.impressions) as total_impressions,
               SUM(ms.followers_gained) as total_followers
        FROM posts p
        JOIN (
            SELECT post_id, engagement_score, impressions, followers_gained,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me' AND p.posted_at IS NOT NULL AND p.posted_at != '' AND p.posted_at <= datetime('now')
        GROUP BY month
        ORDER BY month
    """).fetchall()

    # Top and bottom performing posts
    top_posts = conn.execute("""
        SELECT p.id, p.content, p.post_type, p.word_count, p.posted_at,
               ms.engagement_score, ms.impressions, ms.likes, ms.comments
        FROM posts p
        JOIN (
            SELECT post_id, engagement_score, impressions, likes, comments,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me'
        ORDER BY ms.engagement_score DESC
        LIMIT 5
    """).fetchall()

    top_post_ids = [r["id"] for r in top_posts]
    exclude = ",".join("?" * len(top_post_ids)) if top_post_ids else "NULL"
    bottom_posts = conn.execute(f"""
        SELECT p.id, p.content, p.post_type, p.word_count, p.posted_at,
               ms.engagement_score, ms.impressions, ms.likes, ms.comments
        FROM posts p
        JOIN (
            SELECT post_id, engagement_score, impressions, likes, comments,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me' AND p.id NOT IN ({exclude})
        ORDER BY ms.engagement_score ASC
        LIMIT 5
    """, top_post_ids).fetchall()

    return {
        "pillar_performance": _rows_to_list(pillar_perf),
        "hook_performance": _rows_to_list(hook_perf),
        "type_performance": _rows_to_list(type_perf),
        "word_engagement": _rows_to_list(word_engagement),
        "monthly_trend": _rows_to_list(monthly_trend),
        "top_posts": _rows_to_list(top_posts),
        "bottom_posts": _rows_to_list(bottom_posts),
    }


# ── AI: Analyze ──────────────────────────────────────────────────

@app.post("/analyze/batch")
async def analyze_batch(post_ids: list[int] = Body(...), force: bool = Query(False)):
    """Batch AI analysis — runs in background, returns task_id."""
    from backend.analyzer import analyze_batch as _analyze_batch

    if not post_ids:
        raise HTTPException(400, "post_ids list is required")

    task_id = create_task("analyze_batch", _analyze_batch(post_ids, force=force))
    return {"task_id": task_id, "status": "running"}


@app.post("/analyze/{post_id}")
async def analyze_post(post_id: int):
    """Run AI analysis on a post — runs in background, returns task_id."""
    from backend.analyzer import analyze_post as _analyze

    # Validate post exists before launching background task
    conn = get_conn()
    post = conn.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise HTTPException(404, f"Post {post_id} not found")

    async def _run():
        result = await _analyze(post_id)
        try:
            from backend.memory import update_memory_after_analysis
            await update_memory_after_analysis(post_id)
            logger.info("Memory updated after analysis of post %d", post_id)
        except Exception as mem_err:
            logger.warning("Memory update skipped for post %d: %s", post_id, mem_err)
        return result

    task_id = create_task(f"analyze_post_{post_id}", _run())
    return {"task_id": task_id, "status": "running"}


@app.post("/playbook/regenerate")
async def regenerate_playbook():
    """Force regenerate playbook from all learnings."""
    from backend.analyzer import check_and_regenerate_playbook
    updated = check_and_regenerate_playbook(force=True)
    return {"regenerated": updated}


# ── Dashboard: Queue Status ───────────────────────────────────────

@app.get("/dashboard/queue-status")
async def dashboard_queue_status():
    conn = get_conn()
    queue_depth = conn.execute(
        "SELECT COUNT(*) as c FROM drafts WHERE status IN ('draft', 'revised')"
    ).fetchone()["c"]

    ready_drafts_rows = conn.execute("""
        SELECT d.id, d.topic, d.status,
               cc.scheduled_date
        FROM drafts d
        LEFT JOIN content_calendar cc ON cc.draft_id = d.id AND cc.status IN ('planned', 'ready')
        WHERE d.status IN ('draft', 'revised')
        ORDER BY cc.scheduled_date ASC NULLS LAST, d.updated_at DESC
        LIMIT 3
    """).fetchall()
    ready_drafts = [
        {
            "id": r["id"],
            "topic": r["topic"],
            "status": r["status"],
            "scheduled_date": r["scheduled_date"],
        }
        for r in ready_drafts_rows
    ]

    last_post_row = conn.execute("""
        SELECT CAST(julianday('now') - julianday(MAX(posted_at)) AS INTEGER) as days
        FROM posts
        WHERE author = 'me' AND posted_at IS NOT NULL AND posted_at != ''
    """).fetchone()
    days_since_last_post = last_post_row["days"] if last_post_row and last_post_row["days"] is not None else None

    next_sched_row = conn.execute("""
        SELECT MIN(scheduled_date) as next_date
        FROM content_calendar
        WHERE status IN ('planned', 'ready') AND scheduled_date >= date('now')
    """).fetchone()
    next_scheduled = next_sched_row["next_date"] if next_sched_row else None

    return {
        "queue_depth": queue_depth,
        "target_depth": 5,
        "ready_drafts": ready_drafts,
        "days_since_last_post": days_since_last_post,
        "next_scheduled": next_scheduled,
    }


# ── Dashboard: Actions ────────────────────────────────────────────

@app.get("/dashboard/actions")
async def dashboard_actions():
    conn = get_conn()

    posts_rows = conn.execute("""
        SELECT id, content, posted_at,
               CAST((julianday('now') - julianday(posted_at)) * 24 AS INTEGER) as elapsed_hours
        FROM posts
        WHERE author = 'me' AND posted_at IS NOT NULL AND posted_at != ''
          AND posted_at >= datetime('now', '-9 days')
        ORDER BY posted_at DESC
    """).fetchall()

    metrics_due = []
    for post in posts_rows:
        pid = post["id"]
        elapsed = post["elapsed_hours"] or 0
        snapshots = conn.execute(
            "SELECT CAST((julianday('now') - julianday(snapshot_at)) * 24 AS INTEGER) as age_hours FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at",
            (pid,),
        ).fetchall()
        snap_ages = [s["age_hours"] for s in snapshots]

        label = None
        if elapsed >= 20 and not any(10 <= a <= 30 for a in snap_ages):
            label = "24h metrics"
        elif elapsed >= 44 and not any(36 <= a <= 60 for a in snap_ages):
            label = "48h metrics"
        elif elapsed >= 6 * 24 and not any(5 * 24 <= a <= 9 * 24 for a in snap_ages):
            label = "1-week metrics"

        if label:
            metrics_due.append({
                "post_id": pid,
                "content_preview": post["content"][:80],
                "posted_at": post["posted_at"],
                "due_label": label,
            })

    unanalyzed_rows = conn.execute("""
        SELECT p.id, p.content
        FROM posts p
        WHERE p.last_analyzed_at IS NULL
          AND p.id IN (SELECT DISTINCT post_id FROM metrics_snapshots)
          AND p.author = 'me'
        ORDER BY p.posted_at DESC
        LIMIT 5
    """).fetchall()
    unanalyzed = [
        {"id": r["id"], "content_preview": r["content"][:80]}
        for r in unanalyzed_rows
    ]

    return {"metrics_due": metrics_due, "unanalyzed_posts": unanalyzed}


# ── Dashboard: Post Ideas ─────────────────────────────────────────

@app.post("/dashboard/post-ideas")
async def dashboard_post_ideas(body: PostIdeasRequest = Body(default=PostIdeasRequest())):
    from backend import prompts as _prompts
    from backend.llm import generate
    topic_hint: str = body.topic_hint.strip()

    conn = get_conn()
    playbook_row = conn.execute(
        "SELECT content FROM playbook ORDER BY generated_at DESC LIMIT 1"
    ).fetchone()
    playbook = (playbook_row["content"][:500] if playbook_row else "No playbook yet.")

    top_learnings_rows = conn.execute("""
        SELECT insight, category FROM learnings
        WHERE confidence >= 0.6
        ORDER BY (times_confirmed * confidence) DESC
        LIMIT 3
    """).fetchall()
    top_learnings = "\n".join(f"- [{r['category']}] {r['insight']}" for r in top_learnings_rows) or "No learnings yet."

    pillar_counts = conn.execute("""
        SELECT cp.name, COUNT(p.id) as cnt
        FROM content_pillars cp
        LEFT JOIN posts p ON p.pillar_id = cp.id AND p.author = 'me'
            AND p.posted_at >= date('now', '-30 days')
        GROUP BY cp.id
        ORDER BY cnt ASC
        LIMIT 1
    """).fetchone()
    gap_pillar = pillar_counts["name"] if pillar_counts else "none"

    best_hook_row = conn.execute("""
        SELECT p.hook_style, COUNT(*) as cnt
        FROM posts p
        JOIN (
            SELECT post_id, ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me' AND p.classification = 'hit' AND p.hook_style IS NOT NULL AND p.hook_style != ''
        GROUP BY p.hook_style
        ORDER BY cnt DESC
        LIMIT 1
    """).fetchone()
    best_hook = best_hook_row["hook_style"] if best_hook_row else "story"

    recent_topics = conn.execute("""
        SELECT topic_tags FROM posts
        WHERE author = 'me' AND posted_at >= date('now', '-14 days')
        ORDER BY posted_at DESC LIMIT 5
    """).fetchall()
    recent_list = []
    for r in recent_topics:
        try:
            tags = json.loads(r["topic_tags"] or "[]")
            recent_list.extend(tags[:2])
        except (json.JSONDecodeError, TypeError):
            pass
    recent_topics_str = ", ".join(recent_list[:8]) or "none"

    if topic_hint:
        # User has a specific idea — generate angles directly ON that topic only
        prompt_text = _prompts.POST_IDEAS_ON_TOPIC.format(topic_hint=topic_hint)
    else:
        prompt_text = _prompts.POST_IDEAS.format(
            playbook=playbook,
            top_learnings=top_learnings,
            gap_pillar=gap_pillar,
            best_hook=best_hook,
            recent_topics=recent_topics_str,
        )
    result = await generate(prompt_text)

    try:
        from backend.utils import parse_llm_json
        ideas = parse_llm_json(result)
        if not isinstance(ideas, list):
            ideas = []
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse post ideas: %s", result[:200],
                        extra={"action": "Check LLM prompt format in prompts.POST_IDEAS."})
        ideas = []

    return {"ideas": ideas}


# ── Drafts: Improve ───────────────────────────────────────────────

IMPROVE_ACTIONS = {
    "punch-hook": "Rewrite ONLY the first sentence: make it bold, specific, and arresting. Keep everything else identical.",
    "shorten": "Cut ~30%. Keep hook and CTA. Remove the weakest sentences.",
    "make-specific": "Replace vague statements with concrete numbers, timeframes, or real examples.",
    "conversational": "First person, shorter sentences, no jargon. Sound human.",
    "apply-playbook": "Apply these rules strictly:\n{playbook_rules}",
}


@app.post("/drafts/{draft_id}/improve")
async def improve_draft(draft_id: int, body: ImproveDraftRequest = Body(...)):
    from backend import prompts as _prompts
    from backend.llm import generate

    conn = get_conn()
    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise HTTPException(404, f"Draft {draft_id} not found")

    action = body.action
    if action not in IMPROVE_ACTIONS:
        raise HTTPException(400, f"Unknown action '{action}'. Valid: {list(IMPROVE_ACTIONS.keys())}")

    playbook_context = ""
    if action == "apply-playbook":
        playbook_row = conn.execute(
            "SELECT content FROM playbook ORDER BY generated_at DESC LIMIT 1"
        ).fetchone()
        rules = playbook_row["content"][:800] if playbook_row else "No playbook yet."
        action_instruction = IMPROVE_ACTIONS["apply-playbook"].format(playbook_rules=rules)
        playbook_context = f"PLAYBOOK:\n{rules}"
    else:
        action_instruction = IMPROVE_ACTIONS[action]

    prompt_text = _prompts.IMPROVE_DRAFT.format(
        action_instruction=action_instruction,
        content=draft["content"],
        playbook_context=playbook_context,
    )
    improved = await generate(prompt_text)
    return {"improved_content": improved.strip()}


# ── Hooks: Extract from content ───────────────────────────────────

@app.post("/hooks/extract")
async def extract_hook_from_content(body: ExtractHookRequest = Body(...)):
    from backend.drafter import extract_hook_from_post

    result = await extract_hook_from_post(body.content)
    return result


# ── Posts: Auto-fill metadata from content ────────────────────────

@app.post("/posts/auto-fill")
async def auto_fill_post_metadata(body: dict = Body(...)):
    content = body.get("content", "")
    if not content.strip():
        raise HTTPException(400, "content is required")

    conn = get_conn()
    meta = await _auto_fill_from_draft(content, conn=conn)
    import json as _json

    return {
        "hook_line": meta["hook_line"],
        "hook_style": (meta["hook_style"] or "").lower(),
        "cta_type": (meta["cta_type"] or "none").lower(),
        "post_type": meta["post_type"],
        "topic_tags": _json.loads(meta["topic_tags"]) if isinstance(meta["topic_tags"], str) else meta.get("topic_tags", []),
        "pillar_id": meta["pillar_id"],
    }


# ── LinkedIn OAuth ────────────────────────────────────────────────

@app.get("/auth/linkedin/status")
async def linkedin_auth_status():
    from backend.db import get_conn as _gc
    conn = _gc()
    row = conn.execute(
        "SELECT person_urn, expires_at FROM linkedin_auth ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        return {"authenticated": False}
    from datetime import datetime as _dt
    try:
        exp = _dt.fromisoformat(row["expires_at"])
        if exp < _dt.utcnow():
            return {"authenticated": False, "reason": "token_expired"}
    except (ValueError, TypeError):
        pass
    return {"authenticated": True, "expires_at": row["expires_at"], "person_urn": row["person_urn"]}


@app.get("/auth/linkedin/start")
async def linkedin_auth_start():
    import secrets
    from fastapi.responses import RedirectResponse

    if not config.LINKEDIN_CLIENT_ID:
        raise HTTPException(400, "LINKEDIN_CLIENT_ID not configured. Add it to backend/.env")

    state = secrets.token_urlsafe(32)
    # Store state in DB for validation in callback
    conn = get_conn()
    conn.execute("CREATE TABLE IF NOT EXISTS oauth_state (state TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))")
    # Clean up states older than 10 minutes
    conn.execute("DELETE FROM oauth_state WHERE created_at < datetime('now', '-10 minutes')")
    conn.execute("INSERT INTO oauth_state (state) VALUES (?)", (state,))
    conn.commit()

    redirect_uri = f"http://{config.HOST}:{config.PORT}/auth/linkedin/callback"
    auth_url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={config.LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid%20profile%20w_member_social"
        f"&state={state}"
    )
    return RedirectResponse(url=auth_url)


@app.get("/auth/linkedin/callback")
async def linkedin_auth_callback(code: str | None = None, error: str | None = None, state: str | None = None):
    import httpx
    from fastapi.responses import RedirectResponse
    from datetime import datetime as _dt, timedelta

    if error or not code:
        return RedirectResponse(url=f"http://localhost:3000/linkedin?auth=error&reason={error or 'no_code'}")

    if not config.LINKEDIN_CLIENT_ID or not config.LINKEDIN_CLIENT_SECRET:
        return RedirectResponse(url="http://localhost:3000/linkedin?auth=error&reason=not_configured")

    # Validate OAuth state to prevent CSRF
    if not state:
        return RedirectResponse(url="http://localhost:3000/linkedin?auth=error&reason=missing_state")
    conn_state = get_conn()
    conn_state.execute("CREATE TABLE IF NOT EXISTS oauth_state (state TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))")
    valid = conn_state.execute("DELETE FROM oauth_state WHERE state = ?", (state,)).rowcount
    conn_state.commit()
    if not valid:
        logger.warning("OAuth callback with invalid state parameter",
                        extra={"action": "Possible CSRF attempt or expired state. User should retry auth."})
        return RedirectResponse(url="http://localhost:3000/linkedin?auth=error&reason=invalid_state")

    redirect_uri = f"http://{config.HOST}:{config.PORT}/auth/linkedin/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": config.LINKEDIN_CLIENT_ID,
                "client_secret": config.LINKEDIN_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_res.status_code != 200:
            logger.error(
                "LinkedIn token exchange failed: status=%d body=%s",
                token_res.status_code, token_res.text[:500],
                extra={"action": "Check client_id/secret in backend/.env and ensure redirect_uri matches app settings."},
            )
            return RedirectResponse(url="http://localhost:3000/linkedin?auth=error&reason=token_exchange_failed")

        token_data = token_res.json()
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 5184000)

        me_res = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if me_res.status_code != 200:
            logger.error(
                "LinkedIn userinfo fetch failed: status=%d body=%s",
                me_res.status_code, me_res.text[:300],
                extra={"action": "Ensure 'Sign In with LinkedIn using OpenID Connect' product is enabled on your app."},
            )
            return RedirectResponse(url="http://localhost:3000/linkedin?auth=error&reason=profile_fetch_failed")

        me_data = me_res.json()
        person_urn = f"urn:li:person:{me_data.get('sub')}"
        expires_at = (_dt.now(tz=timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    conn = get_conn()
    conn.execute("DELETE FROM linkedin_auth")
    conn.execute(
        "INSERT INTO linkedin_auth (access_token, person_urn, expires_at) VALUES (?, ?, ?)",
        (access_token, person_urn, expires_at),
    )
    conn.commit()
    logger.info("LinkedIn auth stored for %s, expires %s", person_urn, expires_at)
    return RedirectResponse(url="http://localhost:3000/linkedin?auth=success")


# ── Drafts: Post to LinkedIn ──────────────────────────────────────

@app.post("/drafts/{draft_id}/post-to-linkedin")
async def post_draft_to_linkedin(draft_id: int, body: PostToLinkedInRequest = Body(default=PostToLinkedInRequest())):
    """Publish a draft directly to LinkedIn. Optionally include image_urn from /upload-image."""
    import httpx

    conn = get_conn()
    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise HTTPException(404, f"Draft {draft_id} not found")

    auth_row = conn.execute(
        "SELECT access_token, person_urn, expires_at FROM linkedin_auth ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if not auth_row:
        raise HTTPException(401, "Not connected to LinkedIn. Visit /auth/linkedin/start to connect.")

    # Check token expiry before making API calls
    try:
        from datetime import datetime as _dt
        if auth_row["expires_at"] and _dt.fromisoformat(auth_row["expires_at"]) < _dt.now(tz=timezone.utc):
            raise HTTPException(401, "LinkedIn token expired. Re-authenticate at /auth/linkedin/start")
    except (ValueError, TypeError):
        pass

    access_token = auth_row["access_token"]
    person_urn = auth_row["person_urn"]
    image_urn: str | None = body.image_urn

    post_body: dict = {
        "author": person_urn,
        "commentary": draft["content"],
        "visibility": "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": [],
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    if image_urn:
        post_body["content"] = {"media": {"id": image_urn}}

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.linkedin.com/rest/posts",
            json=post_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
                "LinkedIn-Version": "202602",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        if res.status_code != 201:
            logger.error(
                "LinkedIn post failed: status=%d body=%s",
                res.status_code, res.text[:500],
            )
            raise HTTPException(502, "Failed to publish to LinkedIn. Check your connection and try again.")

        post_urn = res.headers.get("x-restli-id", "")

    post_url = f"https://www.linkedin.com/feed/update/{post_urn}/" if post_urn else ""

    # Auto-fill metadata from draft content
    meta = await _auto_fill_from_draft(draft["content"], conn=conn)

    now_iso = _nyc_now()
    word_count = len(draft["content"].split())
    pillar_id = meta.get("pillar_id") or draft["pillar_id"]
    # If an image was attached, the LLM can't infer it from text — override post_type
    effective_post_type = "social proof image" if image_urn else meta["post_type"]
    cur = conn.execute(
        """INSERT INTO posts (author, content, post_url, post_type, hook_line, hook_style,
           cta_type, topic_tags, word_count, posted_at, pillar_id)
           VALUES ('me', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            draft["content"], post_url,
            effective_post_type, meta["hook_line"], meta["hook_style"],
            meta["cta_type"], meta["topic_tags"],
            word_count, now_iso, pillar_id,
        ),
    )
    post_id = cur.lastrowid

    conn.execute(
        "UPDATE drafts SET status = 'posted', posted_post_id = ?, updated_at = ? WHERE id = ?",
        (post_id, now_iso, draft_id),
    )
    conn.commit()
    logger.info("Draft %d posted to LinkedIn as post %d (urn: %s)", draft_id, post_id, post_urn)

    return {"post_id": post_id, "post_urn": post_urn, "post_url": post_url, "message": "Posted to LinkedIn"}


@app.post("/drafts/{draft_id}/upload-image")
async def upload_draft_image(draft_id: int, file: UploadFile = File(...)):
    """Upload an image to LinkedIn and return its URN for use in post-to-linkedin."""
    import httpx

    conn = get_conn()
    auth_row = conn.execute(
        "SELECT access_token, person_urn FROM linkedin_auth ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    if not auth_row:
        raise HTTPException(401, "Not connected to LinkedIn. Visit /auth/linkedin/start to connect.")

    access_token = auth_row["access_token"]
    person_urn = auth_row["person_urn"]

    # Validate file type and size
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    MAX_SIZE_MB = 10
    content_type = file.content_type or "image/jpeg"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Invalid file type '{content_type}'. Allowed: {', '.join(ALLOWED_TYPES)}")

    image_data = await file.read()
    if len(image_data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Maximum size is {MAX_SIZE_MB}MB.")

    async with httpx.AsyncClient() as client:
        # Step 1: Initialize upload
        init_res = await client.post(
            "https://api.linkedin.com/rest/images?action=initializeUpload",
            json={"initializeUploadRequest": {"owner": person_urn}},
            headers={
                "Authorization": f"Bearer {access_token}",
                "X-Restli-Protocol-Version": "2.0.0",
                "LinkedIn-Version": "202602",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if init_res.status_code != 200:
            logger.error("LinkedIn image init failed: status=%d body=%s", init_res.status_code, init_res.text[:300],
                         extra={"action": "Check LinkedIn API access and token validity."})
            raise HTTPException(502, "Failed to initialize image upload with LinkedIn.")

        init_data = init_res.json()
        upload_url = init_data["value"]["uploadUrl"]
        image_urn = init_data["value"]["image"]

        # Step 2: PUT binary to upload URL
        put_res = await client.put(
            upload_url,
            content=image_data,
            headers={"Content-Type": content_type},
            timeout=60,
        )
        if put_res.status_code not in (200, 201):
            raise HTTPException(502, f"LinkedIn image upload failed ({put_res.status_code})")

    logger.info("Draft %d image uploaded to LinkedIn as %s", draft_id, image_urn)
    return {"image_urn": image_urn}


# ── Metrics Import ──────────────────────────────────────────────


def _parse_metrics_file(
    file_bytes: bytes, filename: str
) -> list[dict]:
    """Parse a LinkedIn Creator Analytics CSV or XLSX export into row dicts.

    Returns a list of dicts with normalised keys. Raises HTTPException on
    parse failures so the endpoint handler stays thin.
    """
    import csv
    import io

    rows: list[dict] = []

    # Column name mapping: LinkedIn export header -> our internal key
    COLUMN_MAP: dict[str, str] = {
        "post title": "title",
        "title": "title",
        "post link": "post_url",
        "post url": "post_url",
        "url": "post_url",
        "link": "post_url",
        "impressions": "impressions",
        "reactions": "likes",
        "likes": "likes",
        "comments": "comments",
        "reposts": "reposts",
        "shares": "reposts",
        "saves": "saves",
        "engagement rate": "engagement_rate",
        "engagement": "engagement_rate",
        "date posted": "date_posted",
        "date": "date_posted",
        "posted date": "date_posted",
        "post content": "content",
        "content": "content",
    }

    def _normalise_headers(raw_headers: list[str]) -> dict[int, str]:
        """Map column index -> internal key name."""
        mapping: dict[int, str] = {}
        for idx, h in enumerate(raw_headers):
            key = COLUMN_MAP.get(h.strip().lower())
            if key:
                mapping[idx] = key
        return mapping

    def _safe_int(val: str | float | int | None) -> int:
        if val is None or val == "":
            return 0
        try:
            return int(float(str(val).replace(",", "").replace("%", "").strip()))
        except (ValueError, TypeError):
            return 0

    def _safe_float(val: str | float | int | None) -> float:
        if val is None or val == "":
            return 0.0
        try:
            return float(str(val).replace(",", "").replace("%", "").strip())
        except (ValueError, TypeError):
            return 0.0

    lower_name = filename.lower()

    if lower_name.endswith((".xlsx", ".xls")):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(
                400,
                "XLSX support requires the openpyxl package. "
                "Install it with: pip install openpyxl — or export as CSV instead.",
            )
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
            ws = wb.active
            if ws is None:
                raise HTTPException(400, "XLSX file has no active worksheet")

            all_rows = list(ws.iter_rows(values_only=True))
            if len(all_rows) < 2:
                raise HTTPException(400, "XLSX file has no data rows (only header or empty)")

            header_row = [str(c) if c is not None else "" for c in all_rows[0]]
            col_map = _normalise_headers(header_row)
            if not col_map:
                raise HTTPException(
                    400,
                    f"Could not recognise any LinkedIn columns in XLSX headers: {header_row}. "
                    "Expected columns like: Post title, Post link, Impressions, Reactions, Comments, Reposts, Saves.",
                )

            for row_idx, data_row in enumerate(all_rows[1:], start=2):
                record: dict[str, str | int | float] = {}
                for col_idx, key in col_map.items():
                    if col_idx < len(data_row):
                        cell_val = data_row[col_idx]
                        if key in ("impressions", "likes", "comments", "reposts", "saves"):
                            record[key] = _safe_int(cell_val)
                        elif key == "engagement_rate":
                            record[key] = _safe_float(cell_val)
                        else:
                            record[key] = str(cell_val) if cell_val is not None else ""
                record["_source_row"] = row_idx
                rows.append(record)
            wb.close()
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to parse XLSX file %s: %s", filename, exc, exc_info=True)
            raise HTTPException(400, f"Failed to parse XLSX file: {exc}")

    elif lower_name.endswith(".csv"):
        try:
            text = file_bytes.decode("utf-8-sig")  # handles BOM
        except UnicodeDecodeError:
            try:
                text = file_bytes.decode("latin-1")
            except UnicodeDecodeError:
                raise HTTPException(400, "CSV file encoding not recognised. Please re-export as UTF-8.")

        reader = csv.reader(io.StringIO(text))
        try:
            header_row = next(reader)
        except StopIteration:
            raise HTTPException(400, "CSV file is empty")

        col_map = _normalise_headers(header_row)
        if not col_map:
            raise HTTPException(
                400,
                f"Could not recognise any LinkedIn columns in CSV headers: {header_row}. "
                "Expected columns like: Post title, Post link, Impressions, Reactions, Comments, Reposts, Saves.",
            )

        for row_idx, data_row in enumerate(reader, start=2):
            record: dict[str, str | int | float] = {}
            for col_idx, key in col_map.items():
                if col_idx < len(data_row):
                    cell_val = data_row[col_idx]
                    if key in ("impressions", "likes", "comments", "reposts", "saves"):
                        record[key] = _safe_int(cell_val)
                    elif key == "engagement_rate":
                        record[key] = _safe_float(cell_val)
                    else:
                        record[key] = cell_val.strip()
            record["_source_row"] = row_idx
            rows.append(record)
    else:
        raise HTTPException(400, f"Unsupported file type: {filename}. Upload a .csv or .xlsx file.")

    if not rows:
        raise HTTPException(400, "File parsed but contained no data rows")

    return rows


@app.post("/posts/import-metrics")
async def import_metrics(file: UploadFile = File(...)):
    """Import metrics from a LinkedIn Creator Analytics XLSX export.

    Parses all 5 sheets: DISCOVERY, ENGAGEMENT, TOP POSTS, FOLLOWERS, DEMOGRAPHICS.
    Auto-creates posts for URLs not already in DB.
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(400, "Uploaded file is empty")

    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Maximum size is 10 MB.")

    from backend.importer import import_linkedin_xlsx

    lower_name = (file.filename or "").lower()
    if not lower_name.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Please upload a .xlsx file from LinkedIn Creator Analytics export.")

    try:
        result = import_linkedin_xlsx(file_bytes)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Metrics import failed: %s", e, exc_info=True)
        raise HTTPException(500, f"Import failed: {e}")

    logger.info("LinkedIn analytics import complete: %s", result)

    # Auto-trigger strategy review after import (background, non-blocking)
    import asyncio
    from backend.strategist import run_strategy_review

    async def _run_review() -> None:
        try:
            review_result = await run_strategy_review()
            logger.info("Auto strategy review: %s", review_result.get("review", {}).get("health_score", "skipped"))
        except Exception as e:
            logger.warning("Auto strategy review failed (non-blocking): %s", e)

    asyncio.ensure_future(_run_review())

    return result


@app.get("/strategy/review")
async def get_strategy_review():
    """Get the latest strategy review."""
    from backend.strategist import get_latest_review

    review = get_latest_review()
    if not review:
        return {"review": None, "message": "No strategy review yet. Import metrics to trigger one."}
    return review


@app.post("/strategy/review")
async def trigger_strategy_review():
    """Manually trigger a strategy review — runs in background."""
    from backend.strategist import run_strategy_review

    task_id = create_task("strategy_review", run_strategy_review())
    return {"task_id": task_id, "status": "running"}


# ── Entrypoint ───────────────────────────────────────────────────

def start():
    import uvicorn

    logger.info("Starting LinkedIn Post Planner on %s:%d", config.HOST, config.PORT)
    logger.info("LLM Provider: %s", config.LLM_PROVIDER)

    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level="info",
    )


if __name__ == "__main__":
    start()
