"""
SQLite database initialization — creates all tables on startup.
"""

from __future__ import annotations

import logging
import sqlite3

from backend import config

logger = logging.getLogger(__name__)

_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(config.SQLITE_DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _init_tables(_conn)
        logger.info("SQLite connected: %s", config.SQLITE_DB_PATH)
    return _conn


def _init_tables(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS content_pillars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS content_series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            pillar_id INTEGER REFERENCES content_pillars(id),
            frequency TEXT DEFAULT 'weekly',
            preferred_day TEXT,
            preferred_time TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL DEFAULT 'me',
            content TEXT NOT NULL,
            post_url TEXT,
            post_type TEXT DEFAULT 'text',
            topic_tags TEXT DEFAULT '[]',
            hook_line TEXT,
            hook_style TEXT,
            cta_type TEXT DEFAULT 'none',
            word_count INTEGER DEFAULT 0,
            posted_at TEXT,
            pillar_id INTEGER REFERENCES content_pillars(id),
            series_id INTEGER REFERENCES content_series(id),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS metrics_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            impressions INTEGER DEFAULT 0,
            members_reached INTEGER DEFAULT 0,
            profile_viewers INTEGER DEFAULT 0,
            followers_gained INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            reposts INTEGER DEFAULT 0,
            saves INTEGER DEFAULT 0,
            sends INTEGER DEFAULT 0,
            engagement_score REAL,
            interaction_score REAL DEFAULT 0,
            snapshot_type TEXT,
            snapshot_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            content TEXT NOT NULL,
            hook_variant TEXT,
            pillar_id INTEGER REFERENCES content_pillars(id),
            inspiration_post_ids TEXT DEFAULT '[]',
            status TEXT DEFAULT 'draft',
            ai_model TEXT,
            posted_post_id INTEGER REFERENCES posts(id),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS learnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER REFERENCES posts(id),
            insight TEXT NOT NULL,
            category TEXT NOT NULL,
            impact TEXT NOT NULL,
            confidence REAL DEFAULT 0.5,
            times_confirmed INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS playbook (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            learnings_hash TEXT,
            generated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS mood_board_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pillar_id INTEGER NOT NULL REFERENCES content_pillars(id) ON DELETE CASCADE,
            type TEXT DEFAULT 'note',
            content TEXT NOT NULL,
            source_post_id INTEGER REFERENCES posts(id),
            source_url TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS hooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            style TEXT DEFAULT 'statement',
            source_post_id INTEGER REFERENCES posts(id),
            times_used INTEGER DEFAULT 0,
            avg_engagement_score REAL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS hashtag_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            hashtags TEXT NOT NULL,
            pillar_id INTEGER REFERENCES content_pillars(id),
            avg_reach REAL,
            times_used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric TEXT NOT NULL,
            target_value REAL NOT NULL,
            current_value REAL DEFAULT 0,
            deadline TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS content_calendar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheduled_date TEXT NOT NULL,
            scheduled_time TEXT,
            draft_id INTEGER REFERENCES drafts(id),
            pillar_id INTEGER REFERENCES content_pillars(id),
            series_id INTEGER REFERENCES content_series(id),
            status TEXT DEFAULT 'planned',
            notes TEXT,
            post_id INTEGER REFERENCES posts(id),
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS competitor_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            linkedin_url TEXT,
            niche TEXT,
            notes TEXT,
            avg_impressions REAL,
            avg_engagement_score REAL,
            post_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()

    # Migrate: add new columns to metrics_snapshots if missing
    cols = {row[1] for row in conn.execute("PRAGMA table_info(metrics_snapshots)").fetchall()}
    migrations = [
        ("members_reached", "INTEGER DEFAULT 0"),
        ("profile_viewers", "INTEGER DEFAULT 0"),
        ("followers_gained", "INTEGER DEFAULT 0"),
        ("saves", "INTEGER DEFAULT 0"),
        ("sends", "INTEGER DEFAULT 0"),
        ("snapshot_type", "TEXT"),
    ]
    for col_name, col_type in migrations:
        if col_name not in cols:
            conn.execute(f"ALTER TABLE metrics_snapshots ADD COLUMN {col_name} {col_type}")
            logger.info("Added column %s to metrics_snapshots", col_name)
    conn.commit()

    # Migrate: add last_analyzed_at to posts if missing
    post_cols = {row[1] for row in conn.execute("PRAGMA table_info(posts)").fetchall()}
    if "last_analyzed_at" not in post_cols:
        conn.execute("ALTER TABLE posts ADD COLUMN last_analyzed_at TEXT")
        logger.info("Added column last_analyzed_at to posts")
    conn.commit()

    # Migrate: add mood_board_item_id to drafts if missing
    draft_cols = {row[1] for row in conn.execute("PRAGMA table_info(drafts)").fetchall()}
    if "mood_board_item_id" not in draft_cols:
        conn.execute("ALTER TABLE drafts ADD COLUMN mood_board_item_id INTEGER REFERENCES mood_board_items(id)")
        logger.info("Added column mood_board_item_id to drafts")
    conn.commit()

    logger.info("All tables initialized")
