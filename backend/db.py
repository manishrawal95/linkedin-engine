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
            source TEXT DEFAULT 'manual',
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

        -- Performance indexes
        CREATE INDEX IF NOT EXISTS idx_metrics_post_id ON metrics_snapshots(post_id);
        CREATE INDEX IF NOT EXISTS idx_metrics_post_snapshot ON metrics_snapshots(post_id, snapshot_at);
        CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
        CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at);
        CREATE INDEX IF NOT EXISTS idx_posts_pillar_id ON posts(pillar_id);
        CREATE INDEX IF NOT EXISTS idx_posts_series_id ON posts(series_id);
        CREATE INDEX IF NOT EXISTS idx_learnings_post_id ON learnings(post_id);
        CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
        CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
        CREATE INDEX IF NOT EXISTS idx_calendar_scheduled_date ON content_calendar(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_hooks_source_post_id ON hooks(source_post_id);
        CREATE INDEX IF NOT EXISTS idx_hashtags_pillar_id ON hashtag_sets(pillar_id);
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

    # Migrate: add last_analyzed_at and classification to posts if missing
    post_cols = {row[1] for row in conn.execute("PRAGMA table_info(posts)").fetchall()}
    if "last_analyzed_at" not in post_cols:
        conn.execute("ALTER TABLE posts ADD COLUMN last_analyzed_at TEXT")
        logger.info("Added column last_analyzed_at to posts")
    if "classification" not in post_cols:
        conn.execute("ALTER TABLE posts ADD COLUMN classification TEXT")
        logger.info("Added column classification to posts")
    conn.commit()

    # Migrate: add mood_board_item_id to drafts if missing
    draft_cols = {row[1] for row in conn.execute("PRAGMA table_info(drafts)").fetchall()}
    if "mood_board_item_id" not in draft_cols:
        conn.execute("ALTER TABLE drafts ADD COLUMN mood_board_item_id INTEGER REFERENCES mood_board_items(id)")
        logger.info("Added column mood_board_item_id to drafts")
    conn.commit()

    # Migrate: create linkedin_auth table if missing
    conn.execute("""
        CREATE TABLE IF NOT EXISTS linkedin_auth (
            id INTEGER PRIMARY KEY,
            access_token TEXT NOT NULL,
            person_urn TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()

    # Migrate: create creator_memory tables
    conn.execute("""
        CREATE TABLE IF NOT EXISTS creator_memory (
            id INTEGER PRIMARY KEY,
            voice_profile TEXT NOT NULL DEFAULT '{}',
            content_dna TEXT NOT NULL DEFAULT '{}',
            audience_model TEXT NOT NULL DEFAULT '{}',
            growth_trajectory TEXT NOT NULL DEFAULT '{}',
            version INTEGER NOT NULL DEFAULT 1,
            confidence_overall REAL NOT NULL DEFAULT 0.3,
            post_count_at_build INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS memory_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_id INTEGER NOT NULL REFERENCES creator_memory(id),
            post_id INTEGER REFERENCES posts(id),
            update_type TEXT NOT NULL,
            delta TEXT NOT NULL DEFAULT '{}',
            contradictions TEXT,
            confidence_before REAL,
            confidence_after REAL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_updates_post ON memory_updates(post_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memory_updates_type ON memory_updates(update_type)")

    # Migrate: create ideas table for auto-ideation
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            hook_style TEXT,
            pillar_id INTEGER REFERENCES content_pillars(id),
            source TEXT NOT NULL DEFAULT 'ai',
            score REAL DEFAULT 0.5,
            status TEXT NOT NULL DEFAULT 'pending',
            draft_id INTEGER REFERENCES drafts(id),
            batch_id TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ideas_batch ON ideas(batch_id)")

    # Migrate: add fit_reason to ideas if missing
    idea_cols = {r["name"] for r in conn.execute("PRAGMA table_info(ideas)").fetchall()}
    if "fit_reason" not in idea_cols:
        conn.execute("ALTER TABLE ideas ADD COLUMN fit_reason TEXT")

    # Migrate: add linkedin_urn to posts if missing
    post_cols_urn = {row[1] for row in conn.execute("PRAGMA table_info(posts)").fetchall()}
    if "linkedin_urn" not in post_cols_urn:
        conn.execute("ALTER TABLE posts ADD COLUMN linkedin_urn TEXT")
        logger.info("Added column linkedin_urn to posts")

    # Migrate: add confidence to drafts if missing
    draft_cols_conf = {row[1] for row in conn.execute("PRAGMA table_info(drafts)").fetchall()}
    if "confidence" not in draft_cols_conf:
        conn.execute("ALTER TABLE drafts ADD COLUMN confidence REAL DEFAULT 0.7")
        logger.info("Added column confidence to drafts")

    # Migrate: create creator_profile table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS creator_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            about_me TEXT NOT NULL DEFAULT '',
            writing_skill TEXT NOT NULL DEFAULT '',
            condensed_context TEXT NOT NULL DEFAULT '',
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Migrate: tables for LinkedIn analytics import
    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_engagement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            impressions INTEGER NOT NULL DEFAULT 0,
            engagements INTEGER NOT NULL DEFAULT 0,
            import_batch TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS follower_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            new_followers INTEGER NOT NULL DEFAULT 0,
            import_batch TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audience_demographics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            value TEXT NOT NULL,
            percentage REAL NOT NULL DEFAULT 0,
            import_batch TEXT,
            imported_at TEXT DEFAULT (datetime('now')),
            UNIQUE(category, value)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS analytics_summary (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_impressions INTEGER DEFAULT 0,
            total_members_reached INTEGER DEFAULT 0,
            total_followers INTEGER DEFAULT 0,
            period_start TEXT,
            period_end TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Strategy reviews table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS strategy_reviews (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            health_score INTEGER NOT NULL DEFAULT 5,
            diagnosis TEXT NOT NULL DEFAULT '',
            review_data TEXT NOT NULL DEFAULT '{}',
            metrics_snapshot TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # View: latest metrics per post (used by 12+ queries across the codebase)
    conn.execute("""
        CREATE VIEW IF NOT EXISTS latest_metrics AS
        SELECT ms.*
        FROM metrics_snapshots ms
        INNER JOIN (
            SELECT post_id, MAX(snapshot_at) AS max_at
            FROM metrics_snapshots
            GROUP BY post_id
        ) latest ON ms.post_id = latest.post_id AND ms.snapshot_at = latest.max_at
    """)

    conn.commit()

    logger.info("All tables initialized")
