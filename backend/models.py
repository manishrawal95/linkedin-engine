"""
Pydantic request/response schemas for all API endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel


# ── Posts ─────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    author: str = "me"
    content: str
    post_url: str | None = None
    post_type: str = "text"
    topic_tags: list[str] = []
    hook_line: str | None = None
    hook_style: str | None = None
    cta_type: str = "none"
    posted_at: str | None = None
    pillar_id: int | None = None
    series_id: int | None = None


class PostUpdate(BaseModel):
    author: str | None = None
    content: str | None = None
    post_url: str | None = None
    post_type: str | None = None
    topic_tags: list[str] | None = None
    hook_line: str | None = None
    hook_style: str | None = None
    cta_type: str | None = None
    posted_at: str | None = None
    pillar_id: int | None = None
    series_id: int | None = None


# ── Metrics ──────────────────────────────────────────────────────

class MetricsCreate(BaseModel):
    impressions: int = 0
    members_reached: int = 0
    profile_viewers: int = 0
    followers_gained: int = 0
    likes: int = 0
    comments: int = 0
    reposts: int = 0
    saves: int = 0
    sends: int = 0


# ── Drafts ───────────────────────────────────────────────────────

class DraftCreate(BaseModel):
    topic: str
    content: str
    hook_variant: str | None = None
    pillar_id: int | None = None
    inspiration_post_ids: list[int] = []
    ai_model: str | None = None
    mood_board_item_id: int | None = None


class DraftUpdate(BaseModel):
    topic: str | None = None
    content: str | None = None
    hook_variant: str | None = None
    pillar_id: int | None = None
    status: str | None = None


class DraftGenerateRequest(BaseModel):
    topic: str
    pillar_id: int | None = None
    style: str | None = None
    num_variants: int = 3


# ── Content Pillars ──────────────────────────────────────────────

class PillarCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    description: str | None = None
    sort_order: int = 0


class PillarUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    description: str | None = None
    sort_order: int | None = None


# ── Mood Board ───────────────────────────────────────────────────

class MoodBoardItemCreate(BaseModel):
    pillar_id: int
    type: str = "note"
    content: str
    source_post_id: int | None = None
    source_url: str | None = None
    sort_order: int = 0


class MoodBoardItemUpdate(BaseModel):
    pillar_id: int | None = None
    type: str | None = None
    content: str | None = None
    source_url: str | None = None
    sort_order: int | None = None


class MoodBoardReorder(BaseModel):
    item_ids: list[int]


# ── Hooks ────────────────────────────────────────────────────────

class HookCreate(BaseModel):
    text: str
    style: str = "statement"
    source_post_id: int | None = None


class HookUpdate(BaseModel):
    text: str | None = None
    style: str | None = None


# ── Hashtag Sets ─────────────────────────────────────────────────

class HashtagSetCreate(BaseModel):
    name: str
    hashtags: list[str]
    pillar_id: int | None = None


class HashtagSetUpdate(BaseModel):
    name: str | None = None
    hashtags: list[str] | None = None
    pillar_id: int | None = None


# ── Goals ────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    metric: str
    target_value: float
    current_value: float = 0
    deadline: str | None = None


class GoalUpdate(BaseModel):
    metric: str | None = None
    target_value: float | None = None
    current_value: float | None = None
    deadline: str | None = None
    status: str | None = None


# ── Content Calendar ─────────────────────────────────────────────

class CalendarEntryCreate(BaseModel):
    scheduled_date: str
    scheduled_time: str | None = None
    draft_id: int | None = None
    pillar_id: int | None = None
    series_id: int | None = None
    status: str = "planned"
    notes: str | None = None


class CalendarEntryUpdate(BaseModel):
    scheduled_date: str | None = None
    scheduled_time: str | None = None
    draft_id: int | None = None
    pillar_id: int | None = None
    series_id: int | None = None
    status: str | None = None
    notes: str | None = None
    post_id: int | None = None


# ── Content Series ───────────────────────────────────────────────

class SeriesCreate(BaseModel):
    name: str
    description: str | None = None
    pillar_id: int | None = None
    frequency: str = "weekly"
    preferred_day: str | None = None
    preferred_time: str | None = None


class SeriesUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pillar_id: int | None = None
    frequency: str | None = None
    preferred_day: str | None = None
    preferred_time: str | None = None
    is_active: int | None = None


# ── Competitors ──────────────────────────────────────────────────

class CompetitorCreate(BaseModel):
    name: str
    linkedin_url: str | None = None
    niche: str | None = None
    notes: str | None = None


class CompetitorUpdate(BaseModel):
    name: str | None = None
    linkedin_url: str | None = None
    niche: str | None = None
    notes: str | None = None
    avg_impressions: float | None = None
    avg_engagement_score: float | None = None
