"""
Entry point for the LinkedIn Post Planner backend.

Usage:
  python -m backend.main          # Start the FastAPI server (auto-restarts on crash)
"""

from __future__ import annotations

import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_RESTARTS = 50
RESTART_COOLDOWN = 3


def main():
    restarts = 0
    while restarts < MAX_RESTARTS:
        try:
            logger.info("Starting server (attempt %d)...", restarts + 1)
            from backend.server import start
            start()
            break
        except KeyboardInterrupt:
            logger.info("Server stopped by user (Ctrl+C)")
            break
        except SystemExit:
            logger.info("Server exited")
            break
        except Exception as e:
            restarts += 1
            logger.error("Server crashed: %s", e, exc_info=True)
            if restarts < MAX_RESTARTS:
                logger.info("Restarting in %ds... (%d/%d)", RESTART_COOLDOWN, restarts, MAX_RESTARTS)
                time.sleep(RESTART_COOLDOWN)
            else:
                logger.error("Max restarts reached (%d). Giving up.", MAX_RESTARTS)
                sys.exit(1)


if __name__ == "__main__":
    main()
