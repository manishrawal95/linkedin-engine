"""
LinkedIn Post Planner configuration — env-driven settings.

LLM providers:
  LINKEDIN_LLM_PROVIDER=gemini  (default, free tier)
  LINKEDIN_LLM_PROVIDER=claude  (higher quality, paid)
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parent

load_dotenv(PROJECT_DIR / ".env", override=True)

# ── LLM Provider ──────────────────────────────────────────────────
LLM_PROVIDER: str = os.getenv("LINKEDIN_LLM_PROVIDER", "gemini")

# Gemini
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL: str = os.getenv("LINKEDIN_GEMINI_MODEL", "gemini-2.5-pro")

# Claude
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL: str = os.getenv("LINKEDIN_CLAUDE_MODEL", "claude-sonnet-4-5-20250929")

LLM_TEMPERATURE: float = float(os.getenv("LINKEDIN_LLM_TEMPERATURE", "0.7"))

# ── Storage ──────────────────────────────────────────────────────
SQLITE_DB_PATH: str = os.getenv(
    "LINKEDIN_SQLITE_PATH", str(PROJECT_DIR / "linkedin_data.db")
)

# ── Server ───────────────────────────────────────────────────────
HOST: str = os.getenv("LINKEDIN_HOST", "127.0.0.1")
PORT: int = int(os.getenv("LINKEDIN_PORT", "8200"))
