"""
Creator Profile — stores 'about me' and 'writing skill' with condensed context.

The condensed context is a ~200-token summary auto-generated when the profile
is saved, so most LLM prompts only pay for the short version.
"""

from __future__ import annotations

import logging

from backend.db import get_conn
from backend.llm import generate

logger = logging.getLogger(__name__)

CONDENSE_PROMPT = """Condense the following creator profile into a tight reference card (max 200 words).
Include: role, expertise, audience, goals, voice rules, structure preferences, do's and don'ts.
Skip generic statements. Keep only what's actionable for writing LinkedIn posts.

ABOUT THE CREATOR:
{about_me}

WRITING SKILL / RULES:
{writing_skill}

Return ONLY the condensed reference card, no preamble."""


def get_profile() -> dict | None:
    """Read the creator profile from DB."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM creator_profile WHERE id = 1").fetchone()
    if not row:
        return None
    return dict(row)


async def save_profile(about_me: str, writing_skill: str) -> dict:
    """Save profile and regenerate condensed context."""
    condensed = await _generate_condensed(about_me, writing_skill)

    conn = get_conn()
    existing = conn.execute("SELECT id FROM creator_profile WHERE id = 1").fetchone()
    if existing:
        conn.execute(
            """UPDATE creator_profile
               SET about_me = ?, writing_skill = ?, condensed_context = ?,
                   updated_at = datetime('now')
               WHERE id = 1""",
            (about_me, writing_skill, condensed),
        )
    else:
        conn.execute(
            """INSERT INTO creator_profile (id, about_me, writing_skill, condensed_context)
               VALUES (1, ?, ?, ?)""",
            (about_me, writing_skill, condensed),
        )
    conn.commit()

    return dict(
        conn.execute("SELECT * FROM creator_profile WHERE id = 1").fetchone()
    )


async def _generate_condensed(about_me: str, writing_skill: str) -> str:
    """Generate condensed context card via LLM."""
    if not about_me.strip() and not writing_skill.strip():
        return ""

    prompt = CONDENSE_PROMPT.format(
        about_me=about_me.strip() or "(not provided)",
        writing_skill=writing_skill.strip() or "(not provided)",
    )
    try:
        result = await generate(prompt)
        return result.strip()
    except Exception as e:
        logger.error("Failed to condense profile: %s", e, exc_info=True)
        # Fallback: truncate raw text
        raw = f"{about_me}\n{writing_skill}".strip()
        return raw[:500]
