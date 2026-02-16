"""
FastAPI server for the LinkedIn Post Planner.
Binds to 127.0.0.1 ONLY — never accessible from outside localhost.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.db import get_conn
from backend.models import (
    DraftGenerateRequest,
    CalendarEntryCreate,
    CalendarEntryUpdate,
    CompetitorCreate,
    CompetitorUpdate,
    DraftCreate,
    DraftUpdate,
    GoalCreate,
    GoalUpdate,
    HashtagSetCreate,
    HashtagSetUpdate,
    HookCreate,
    HookUpdate,
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


def _row_to_dict(row) -> dict:
    if row is None:
        return {}
    return dict(row)


def _rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]


# ── Health ───────────────────────────────────────────────────────

@app.get("/health")
async def health():
    checks = {"server": "ok", "provider": config.LLM_PROVIDER}
    try:
        get_conn()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    all_ok = all(v == "ok" for k, v in checks.items() if k not in ("provider",))
    return checks if all_ok else checks


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
        SELECT ms.* FROM metrics_snapshots ms
        INNER JOIN (
            SELECT post_id, MAX(snapshot_at) as max_at
            FROM metrics_snapshots
            WHERE post_id IN ({placeholders})
            GROUP BY post_id
        ) latest ON ms.post_id = latest.post_id AND ms.snapshot_at = latest.max_at
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

    updates["updated_at"] = datetime.utcnow().isoformat()

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
    engagement_score = None
    if req.impressions > 0:
        engagement_score = interaction_score / req.impressions

    # Auto-calculate snapshot_type from posted_at
    snapshot_type = None
    if post["posted_at"]:
        try:
            posted_dt = datetime.fromisoformat(post["posted_at"].replace("Z", "+00:00"))
            now = datetime.utcnow()
            if posted_dt.tzinfo:
                from datetime import timezone
                now = now.replace(tzinfo=timezone.utc)
            delta_hours = (now - posted_dt).total_seconds() / 3600
            if delta_hours < 18:
                snapshot_type = "12h"
            elif delta_hours < 36:
                snapshot_type = "24h"
            elif delta_hours < 72:
                snapshot_type = "48h"
            elif delta_hours < 240:
                snapshot_type = "1w"
            else:
                snapshot_type = "later"
        except (ValueError, TypeError):
            snapshot_type = None

    cur = conn.execute(
        """INSERT INTO metrics_snapshots
           (post_id, impressions, members_reached, profile_viewers, followers_gained,
            likes, comments, reposts, saves, sends, engagement_score, interaction_score, snapshot_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (post_id, req.impressions, req.members_reached, req.profile_viewers,
         req.followers_gained, req.likes, req.comments, req.reposts,
         req.saves, req.sends, engagement_score, interaction_score, snapshot_type),
    )
    conn.commit()
    snapshot = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE id = ?", (cur.lastrowid,)
    ).fetchone()

    # Auto-analyze post after metrics are added
    analysis_result = None
    try:
        from backend.analyzer import analyze_post as _analyze
        analysis_result = await _analyze(post_id)
        logger.info("Auto-analysis complete for post %d: %s", post_id, analysis_result.get("classification"))
    except Exception as e:
        logger.warning("Auto-analysis failed for post %d: %s", post_id, e)

    result = {"snapshot": _row_to_dict(snapshot)}
    if analysis_result:
        result["analysis"] = analysis_result
    return result


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
    updates["updated_at"] = datetime.utcnow().isoformat()
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
        rows = conn.execute("SELECT * FROM hooks WHERE style = ? ORDER BY avg_engagement_score DESC NULLS LAST", (style,)).fetchall()
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
    """Generate AI draft variants for a topic."""
    from backend.drafter import generate_drafts
    try:
        drafts = await generate_drafts(
            topic=req.topic,
            pillar_id=req.pillar_id,
            style=req.style,
            num_variants=req.num_variants,
        )
        return {"drafts": drafts}
    except Exception as e:
        logger.exception("Draft generation failed")
        raise HTTPException(500, f"Draft generation failed: {e}")


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
    updates["updated_at"] = datetime.utcnow().isoformat()
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
        (post_id, datetime.utcnow().isoformat(), draft_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    return {"draft": _row_to_dict(row)}


@app.post("/drafts/{draft_id}/publish")
async def publish_draft(draft_id: int, post_url: str | None = None, post_type: str = "text", posted_at: str | None = None):
    """Create a post directly from a draft and mark the draft as posted."""
    conn = get_conn()
    draft = conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
    if not draft:
        raise HTTPException(404, f"Draft {draft_id} not found")

    word_count = len(draft["content"].split())
    cur = conn.execute(
        """INSERT INTO posts (author, content, post_url, post_type, topic_tags,
           hook_line, cta_type, word_count, posted_at, pillar_id)
           VALUES (?, ?, ?, ?, '[]', NULL, 'none', ?, ?, ?)""",
        ("me", draft["content"], post_url, post_type, word_count,
         posted_at or datetime.utcnow().isoformat(), draft["pillar_id"]),
    )
    post_id = cur.lastrowid

    conn.execute(
        "UPDATE drafts SET status = 'posted', posted_post_id = ?, updated_at = ? WHERE id = ?",
        (post_id, datetime.utcnow().isoformat(), draft_id),
    )
    conn.commit()

    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return {"post": _row_to_dict(post), "draft_id": draft_id}


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

@app.get("/calendar/suggestions")
async def calendar_suggestions():
    """AI suggests next week's content plan."""
    from backend import prompts as _prompts

    conn = get_conn()

    pillars = conn.execute("SELECT id, name, description FROM content_pillars ORDER BY sort_order").fetchall()
    pillars_text = "\n".join(f"- {r['name']}: {r['description'] or 'no description'}" for r in pillars) or "No pillars defined"

    series = conn.execute("SELECT name, frequency, preferred_day, preferred_time FROM content_series WHERE is_active = 1").fetchall()
    series_text = "\n".join(
        f"- {r['name']} ({r['frequency']}, {r['preferred_day'] or 'any day'} {r['preferred_time'] or ''})"
        for r in series
    ) or "No active series"

    post_count = conn.execute("SELECT COUNT(*) as c FROM posts WHERE author = 'me' AND posted_at >= date('now', '-30 days')").fetchone()["c"]
    posting_freq = round(post_count / 4.3, 1) if post_count else 0

    pillar_balance = conn.execute("""
        SELECT cp.name, COUNT(p.id) as count
        FROM content_pillars cp LEFT JOIN posts p ON p.pillar_id = cp.id AND p.author = 'me' AND p.posted_at >= date('now', '-30 days')
        GROUP BY cp.id
    """).fetchall()
    balance_text = "\n".join(f"- {r['name']}: {r['count']} posts" for r in pillar_balance) or "No data"

    heatmap = conn.execute("""
        SELECT strftime('%w', posted_at) as dow, strftime('%H', posted_at) as hour, AVG(ms.engagement_score) as avg_eng
        FROM posts p JOIN metrics_snapshots ms ON ms.post_id = p.id
        WHERE p.author = 'me' AND p.posted_at IS NOT NULL
        GROUP BY dow, hour ORDER BY avg_eng DESC LIMIT 5
    """).fetchall()
    days_list = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    best_times = "\n".join(
        f"- {days_list[int(r['dow'])]} {r['hour']}:00 (avg engagement: {r['avg_eng']:.4f})" for r in heatmap
    ) or "Not enough data"

    from backend.llm import generate
    prompt_text = _prompts.CALENDAR_SUGGESTIONS.format(
        pillars=pillars_text, series=series_text,
        posting_frequency=posting_freq, pillar_balance=balance_text,
        best_times=best_times,
    )
    result = await generate(prompt_text, system=_prompts.SYSTEM_DRAFTER)

    try:
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        suggestions = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        suggestions = [{"raw": result}]

    return {"suggestions": suggestions}


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
        SELECT AVG(ms.engagement_score) as avg_score
        FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id
        WHERE p.author = 'me'
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
        SELECT SUM(ms.impressions) as total
        FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id
        WHERE p.author = 'me'
    """).fetchone()["total"]

    avg_likes = conn.execute("""
        SELECT AVG(ms.likes) as avg_likes
        FROM metrics_snapshots ms
        JOIN posts p ON p.id = ms.post_id
        WHERE p.author = 'me'
    """).fetchone()["avg_likes"]

    return {
        "total_posts": total_posts,
        "total_drafts": total_drafts,
        "avg_engagement_score": avg_engagement or 0,
        "total_impressions": total_impressions or 0,
        "avg_likes": avg_likes or 0,
        "recent_posts": _rows_to_list(recent_posts),
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

    bottom_posts = conn.execute("""
        SELECT p.id, p.content, p.post_type, p.word_count, p.posted_at,
               ms.engagement_score, ms.impressions, ms.likes, ms.comments
        FROM posts p
        JOIN (
            SELECT post_id, engagement_score, impressions, likes, comments,
                   ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY snapshot_at DESC) as rn
            FROM metrics_snapshots
        ) ms ON ms.post_id = p.id AND ms.rn = 1
        WHERE p.author = 'me'
        ORDER BY ms.engagement_score ASC
        LIMIT 5
    """).fetchall()

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
async def analyze_batch(post_ids: list[int] = Body(...)):
    """Batch AI analysis on multiple posts — fewer LLM calls than analyzing individually."""
    from backend.analyzer import analyze_batch as _analyze_batch

    if not post_ids:
        raise HTTPException(400, "post_ids list is required")

    try:
        result = await _analyze_batch(post_ids)
        return result
    except Exception as e:
        logger.exception("Batch analysis failed")
        raise HTTPException(500, f"Batch analysis failed: {e}")


@app.post("/analyze/{post_id}")
async def analyze_post(post_id: int):
    """Run AI analysis on a post after metrics entry."""
    from backend.analyzer import analyze_post as _analyze
    try:
        result = await _analyze(post_id)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.exception("Analysis failed for post %d", post_id)
        raise HTTPException(500, f"Analysis failed: {e}")


@app.post("/playbook/regenerate")
async def regenerate_playbook():
    """Force regenerate playbook from all learnings."""
    from backend.analyzer import check_and_regenerate_playbook
    updated = check_and_regenerate_playbook(force=True)
    return {"regenerated": updated}


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
