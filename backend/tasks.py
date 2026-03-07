"""
Background task manager for long-running operations.

Single-user app, so a simple in-memory dict is sufficient.
Tasks survive page navigation because they run on the backend event loop.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# In-memory task store: task_id -> task info
_tasks: dict[str, dict] = {}


def create_task(name: str, coro) -> str:
    """Launch a coroutine as a background task. Returns task ID immediately."""
    task_id = uuid.uuid4().hex[:12]
    now = datetime.now(timezone.utc).isoformat()

    _tasks[task_id] = {
        "id": task_id,
        "name": name,
        "status": "running",
        "result": None,
        "error": None,
        "created_at": now,
        "completed_at": None,
    }

    async def _wrapper() -> None:
        try:
            result = await coro
            _tasks[task_id]["status"] = "done"
            _tasks[task_id]["result"] = result
            logger.info("Task %s (%s) completed", task_id, name)
        except Exception as e:
            _tasks[task_id]["status"] = "error"
            _tasks[task_id]["error"] = str(e)
            logger.error("Task %s (%s) failed: %s", task_id, name, e, exc_info=True)
        finally:
            _tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    asyncio.ensure_future(_wrapper())
    logger.info("Task %s (%s) started", task_id, name)
    return task_id


def get_task(task_id: str) -> dict | None:
    """Get task status and result."""
    return _tasks.get(task_id)


def cleanup_old_tasks(max_age_hours: int = 1) -> int:
    """Remove completed tasks older than max_age_hours."""
    now = datetime.now(timezone.utc)
    to_remove = []
    for tid, task in _tasks.items():
        if task["status"] in ("done", "error") and task["completed_at"]:
            completed = datetime.fromisoformat(task["completed_at"])
            if (now - completed).total_seconds() > max_age_hours * 3600:
                to_remove.append(tid)
    for tid in to_remove:
        del _tasks[tid]
    return len(to_remove)
