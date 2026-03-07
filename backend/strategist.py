"""
Auto Strategy Review — runs after each metrics import.

Computes data-driven insights (mostly SQL), then one LLM call to synthesize.
Results stored in strategy_reviews table, surfaced on dashboard.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from backend.db import get_conn
from backend.llm import generate as call_llm
from backend.utils import parse_llm_json

logger = logging.getLogger(__name__)


def compute_strategy_metrics() -> dict:
    """Pure SQL computation of all strategy metrics. No LLM needed."""
    conn = get_conn()

    metrics: dict = {}

    # 1. Overall account stats
    summary = conn.execute("SELECT * FROM analytics_summary WHERE id = 1").fetchone()
    if summary:
        metrics["account"] = {
            "total_impressions": summary["total_impressions"] or 0,
            "total_members_reached": summary["total_members_reached"] or 0,
            "total_followers": summary["total_followers"] or 0,
            "period_start": summary["period_start"],
            "period_end": summary["period_end"],
        }

    # 2. Post performance breakdown
    posts = conn.execute("""
        SELECT p.id, p.content, p.hook_style, p.cta_type, p.post_type,
               p.word_count, p.classification, p.posted_at, p.pillar_id,
               cp.name as pillar_name,
               lm.impressions, lm.likes, lm.comments, lm.reposts,
               lm.saves, lm.engagement_score
        FROM posts p
        LEFT JOIN content_pillars cp ON p.pillar_id = cp.id
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me' AND p.content != ''
        ORDER BY p.posted_at DESC
    """).fetchall()

    total_posts = len(posts)
    metrics["total_posts"] = total_posts

    if total_posts == 0:
        return metrics

    # 3. Classification distribution
    hits = [p for p in posts if p["classification"] == "hit"]
    misses = [p for p in posts if p["classification"] == "miss"]
    avg_posts = [p for p in posts if p["classification"] == "average"]
    metrics["classification"] = {
        "hits": len(hits),
        "misses": len(misses),
        "average": len(avg_posts),
        "hit_rate": round(len(hits) / total_posts * 100, 1) if total_posts else 0,
    }

    # 4. Pillar performance
    pillar_stats = conn.execute("""
        SELECT cp.name, cp.color, COUNT(p.id) as post_count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.impressions) as avg_impressions,
               SUM(COALESCE(lm.saves, 0)) as total_saves,
               SUM(COALESCE(lm.comments, 0)) as total_comments
        FROM posts p
        JOIN content_pillars cp ON p.pillar_id = cp.id
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        GROUP BY cp.id
        ORDER BY avg_engagement DESC
    """).fetchall()
    metrics["pillar_performance"] = [dict(r) for r in pillar_stats]

    # 5. Hook style performance
    hook_stats = conn.execute("""
        SELECT p.hook_style, COUNT(*) as count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.impressions) as avg_impressions,
               SUM(CASE WHEN p.classification = 'hit' THEN 1 ELSE 0 END) as hits
        FROM posts p
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me' AND p.hook_style IS NOT NULL
        GROUP BY p.hook_style
        ORDER BY avg_engagement DESC
    """).fetchall()
    metrics["hook_performance"] = [dict(r) for r in hook_stats]

    # 6. CTA performance
    cta_stats = conn.execute("""
        SELECT p.cta_type, COUNT(*) as count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.comments) as avg_comments
        FROM posts p
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
        GROUP BY p.cta_type
        ORDER BY avg_engagement DESC
    """).fetchall()
    metrics["cta_performance"] = [dict(r) for r in cta_stats]

    # 7. Audience depth score
    # (saves * 3 + comments * 2 + reposts * 4 + likes) / impressions * 1000
    depth_data = conn.execute("""
        SELECT SUM(COALESCE(lm.saves, 0)) as total_saves,
               SUM(COALESCE(lm.comments, 0)) as total_comments,
               SUM(COALESCE(lm.reposts, 0)) as total_reposts,
               SUM(COALESCE(lm.likes, 0)) as total_likes,
               SUM(COALESCE(lm.impressions, 0)) as total_impressions
        FROM posts p
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author = 'me'
    """).fetchone()

    if depth_data and depth_data["total_impressions"] and depth_data["total_impressions"] > 0:
        depth_score = (
            (depth_data["total_saves"] or 0) * 3
            + (depth_data["total_comments"] or 0) * 2
            + (depth_data["total_reposts"] or 0) * 4
            + (depth_data["total_likes"] or 0)
        ) / depth_data["total_impressions"] * 1000
        metrics["audience_depth"] = {
            "score": round(depth_score, 2),
            "total_saves": depth_data["total_saves"] or 0,
            "total_comments": depth_data["total_comments"] or 0,
            "total_reposts": depth_data["total_reposts"] or 0,
            "total_likes": depth_data["total_likes"] or 0,
            "level": (
                "Advocates" if depth_score > 20
                else "Commenters" if depth_score > 10
                else "Savers" if depth_score > 5
                else "Likers" if depth_score > 2
                else "Lurkers"
            ),
        }

    # 8. Follower growth
    follower_data = conn.execute("""
        SELECT SUM(new_followers) as total, COUNT(*) as days,
               AVG(new_followers) as avg_daily
        FROM follower_daily
    """).fetchone()
    if follower_data and follower_data["days"]:
        metrics["follower_growth"] = {
            "total_new": follower_data["total"] or 0,
            "days_tracked": follower_data["days"],
            "avg_daily": round(follower_data["avg_daily"] or 0, 1),
        }

    # 9. Posting frequency
    freq = conn.execute("""
        SELECT COUNT(*) as count,
               MIN(posted_at) as first_post,
               MAX(posted_at) as last_post
        FROM posts WHERE author = 'me' AND posted_at IS NOT NULL
    """).fetchone()
    if freq and freq["first_post"] and freq["last_post"] and freq["count"] > 1:
        try:
            first = datetime.fromisoformat(freq["first_post"].replace("Z", "+00:00"))
            last = datetime.fromisoformat(freq["last_post"].replace("Z", "+00:00"))
            days_span = max(1, (last - first).days)
            posts_per_week = freq["count"] / days_span * 7
            metrics["posting_frequency"] = {
                "total_posts": freq["count"],
                "days_span": days_span,
                "posts_per_week": round(posts_per_week, 1),
            }
        except (ValueError, TypeError):
            pass

    # 10. Hit formula — common traits of top performers
    if hits:
        hit_hooks = {}
        hit_ctas = {}
        hit_types = {}
        for h in hits:
            if h["hook_style"]:
                hit_hooks[h["hook_style"]] = hit_hooks.get(h["hook_style"], 0) + 1
            if h["cta_type"]:
                hit_ctas[h["cta_type"]] = hit_ctas.get(h["cta_type"], 0) + 1
            if h["post_type"]:
                hit_types[h["post_type"]] = hit_types.get(h["post_type"], 0) + 1

        hit_words = [h["word_count"] for h in hits if h["word_count"]]
        metrics["hit_formula"] = {
            "dominant_hook": max(hit_hooks, key=hit_hooks.get) if hit_hooks else None,
            "dominant_cta": max(hit_ctas, key=hit_ctas.get) if hit_ctas else None,
            "dominant_format": max(hit_types, key=hit_types.get) if hit_types else None,
            "avg_word_count": round(sum(hit_words) / len(hit_words)) if hit_words else 0,
            "hook_distribution": hit_hooks,
            "cta_distribution": hit_ctas,
        }

    # 11. Competitor benchmarking (if other-author posts exist)
    competitor_data = conn.execute("""
        SELECT p.author,
               COUNT(p.id) as post_count,
               AVG(lm.engagement_score) as avg_engagement,
               AVG(lm.impressions) as avg_impressions,
               SUM(CASE WHEN p.classification = 'hit' THEN 1 ELSE 0 END) as hits
        FROM posts p
        LEFT JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.author != 'me' AND p.content != ''
        GROUP BY p.author
        HAVING post_count >= 3
        ORDER BY avg_engagement DESC
        LIMIT 5
    """).fetchall()
    if competitor_data:
        metrics["competitor_benchmarks"] = [dict(r) for r in competitor_data]

    # 12. Demographics summary (top 2 per category)
    demos = conn.execute("""
        SELECT category, value, percentage
        FROM audience_demographics
        ORDER BY category, percentage DESC
    """).fetchall()
    if demos:
        demo_map: dict[str, list[dict]] = {}
        for d in demos:
            cat = d["category"]
            if cat not in demo_map:
                demo_map[cat] = []
            if len(demo_map[cat]) < 2:
                demo_map[cat].append({"value": d["value"], "pct": round(d["percentage"] * 100, 1)})
        metrics["demographics"] = demo_map

    return metrics


async def generate_strategy_review(metrics: dict) -> dict:
    """Generate a strategy review from computed metrics using one LLM call."""
    prompt = f"""You are a senior LinkedIn content strategist. Analyze these metrics and produce a concise strategy review.

METRICS DATA:
{json.dumps(metrics, indent=2, default=str)}

Produce a JSON response with this exact structure:
{{
  "health_score": <1-10 integer>,
  "diagnosis": "<one sentence overall assessment>",
  "whats_working": ["<specific insight with numbers>", "<insight>"],
  "whats_not_working": ["<specific problem with numbers>", "<problem>"],
  "hit_formula": "<describe the pattern that produces hits>",
  "audience_depth_assessment": "<current level and trend>",
  "recommendations": [
    {{"priority": 1, "action": "<specific actionable recommendation>", "expected_impact": "<what this should improve>"}},
    {{"priority": 2, "action": "<recommendation>", "expected_impact": "<impact>"}},
    {{"priority": 3, "action": "<recommendation>", "expected_impact": "<impact>"}}
  ],
  "experiments": [
    {{"name": "<experiment name>", "hypothesis": "<if X then Y because Z>", "test": "<specific action>", "duration": "<posts or weeks>", "success_metric": "<measurable outcome>"}}
  ],
  "pillar_verdicts": [
    {{"pillar": "<name>", "score": <1-10>, "verdict": "Invest|Maintain|Retire", "reason": "<why>"}}
  ]
}}

Rules:
- Be specific. Cite actual numbers from the data.
- Be honest. If something is failing, say so.
- Every recommendation must be actionable in the next 2 weeks.
- Score health conservatively — 7+ means genuinely strong growth trajectory.
- If data is insufficient (< 10 posts), say so and score lower.
"""

    raw = await call_llm(prompt)
    review = parse_llm_json(raw)

    if not isinstance(review, dict) or "health_score" not in review:
        logger.warning("Strategy review LLM returned unexpected format, using fallback")
        review = {
            "health_score": 5,
            "diagnosis": "Insufficient data for confident assessment.",
            "whats_working": [],
            "whats_not_working": [],
            "recommendations": [],
            "experiments": [],
            "pillar_verdicts": [],
        }

    return review


async def run_strategy_review() -> dict:
    """Full strategy review: compute metrics + LLM synthesis. Returns saved review."""
    conn = get_conn()

    metrics = compute_strategy_metrics()

    if metrics.get("total_posts", 0) < 3:
        logger.info("Skipping strategy review: only %d posts", metrics.get("total_posts", 0))
        return {"skipped": True, "reason": "Need at least 3 posts with metrics"}

    review = await generate_strategy_review(metrics)

    now = datetime.now(timezone.utc).isoformat()

    # Save to DB
    conn.execute("DELETE FROM strategy_reviews WHERE id = 1")
    conn.execute(
        """INSERT INTO strategy_reviews
           (id, health_score, diagnosis, review_data, metrics_snapshot, created_at)
           VALUES (1, ?, ?, ?, ?, ?)""",
        (
            review.get("health_score", 5),
            review.get("diagnosis", ""),
            json.dumps(review),
            json.dumps(metrics),
            now,
        ),
    )
    conn.commit()

    # Auto-generate goals from metrics
    _generate_auto_goals(metrics, conn)

    logger.info("Strategy review complete: health=%d", review.get("health_score", 0))
    return {"review": review, "metrics": metrics, "created_at": now}


def _generate_auto_goals(metrics: dict, conn) -> None:
    """Create or update auto-generated goals based on computed metrics."""
    # Clear old auto goals, replace with fresh ones
    conn.execute("DELETE FROM goals WHERE source = 'auto'")

    goals: list[tuple[str, float, float]] = []  # (metric, target, current)

    # 1. Hit rate goal — aim for 30%+ (or 10% improvement)
    classification = metrics.get("classification", {})
    hit_rate = classification.get("hit_rate", 0)
    total_posts = metrics.get("total_posts", 0)
    if total_posts >= 3:
        target_hit_rate = max(30, hit_rate + 10)
        goals.append(("Hit rate %", target_hit_rate, hit_rate))

    # 2. Posting frequency — aim for 3-5x/week
    freq = metrics.get("posting_frequency", {})
    posts_per_week = freq.get("posts_per_week", 0)
    if posts_per_week > 0:
        target_freq = max(3.0, posts_per_week + 1)
        goals.append(("Posts per week", target_freq, posts_per_week))

    # 3. Avg engagement — aim for 20% improvement
    pillar_perf = metrics.get("pillar_performance", [])
    if pillar_perf:
        avg_engs = [p.get("avg_engagement") or 0 for p in pillar_perf]
        overall_avg = sum(avg_engs) / len(avg_engs) if avg_engs else 0
        if overall_avg > 0:
            target_eng = round(overall_avg * 1.2, 4)
            goals.append(("Avg engagement score", target_eng, round(overall_avg, 4)))

    # 4. Follower growth — aim for 20% more daily
    growth = metrics.get("follower_growth", {})
    avg_daily = growth.get("avg_daily", 0)
    if avg_daily > 0:
        target_daily = round(avg_daily * 1.2, 1)
        goals.append(("Avg daily followers", target_daily, avg_daily))

    # 5. Audience depth — aim for next level
    depth = metrics.get("audience_depth", {})
    depth_score = depth.get("score", 0)
    if depth_score > 0:
        # Levels: Lurkers<2, Likers<5, Savers<10, Commenters<20, Advocates>20
        next_targets = [(2, "Likers"), (5, "Savers"), (10, "Commenters"), (20, "Advocates")]
        target = 25  # Default if already advocate
        for threshold, _ in next_targets:
            if depth_score < threshold:
                target = threshold
                break
        goals.append(("Audience depth score", target, round(depth_score, 2)))

    now = datetime.now(timezone.utc).isoformat()
    for metric, target, current in goals:
        conn.execute(
            """INSERT INTO goals (metric, target_value, current_value, source, created_at)
               VALUES (?, ?, ?, 'auto', ?)""",
            (metric, target, current, now),
        )
    conn.commit()
    logger.info("Auto-generated %d goals from strategy metrics", len(goals))


def refresh_goal_progress() -> None:
    """Update current_value for all active goals from live metrics."""
    conn = get_conn()
    metrics = compute_strategy_metrics()

    goals = conn.execute(
        "SELECT id, metric FROM goals WHERE status = 'active'"
    ).fetchall()

    for goal in goals:
        current = _compute_goal_current(goal["metric"], metrics)
        if current is not None:
            conn.execute(
                "UPDATE goals SET current_value = ? WHERE id = ?",
                (current, goal["id"]),
            )
    conn.commit()


def _compute_goal_current(metric: str, metrics: dict) -> float | None:
    """Compute current value for a known metric name."""
    m = metric.lower()
    if "hit rate" in m:
        return metrics.get("classification", {}).get("hit_rate", 0)
    if "posts per week" in m:
        return metrics.get("posting_frequency", {}).get("posts_per_week", 0)
    if "avg engagement" in m:
        pillars = metrics.get("pillar_performance", [])
        if pillars:
            avgs = [p.get("avg_engagement") or 0 for p in pillars]
            return round(sum(avgs) / len(avgs), 4) if avgs else 0
    if "daily followers" in m or "follower" in m:
        return metrics.get("follower_growth", {}).get("avg_daily", 0)
    if "audience depth" in m or "depth score" in m:
        return metrics.get("audience_depth", {}).get("score", 0)
    return None


def get_latest_review() -> dict | None:
    """Get the most recent strategy review."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM strategy_reviews WHERE id = 1").fetchone()
    if not row:
        return None
    return {
        "health_score": row["health_score"],
        "diagnosis": row["diagnosis"],
        "review": json.loads(row["review_data"]),
        "metrics": json.loads(row["metrics_snapshot"]),
        "created_at": row["created_at"],
    }
