"""
Learning engine — classifies post performance, extracts learnings, generates playbook.

Flow:
  1. classify_and_extract(post, metrics) → (classification, [insights])
  2. update_learnings(new_insights) → merge/insert into DB
  3. check_playbook_staleness() → regenerate if needed
"""

from __future__ import annotations

import hashlib
import json
import logging
import statistics
from datetime import datetime, timezone

from backend import prompts
from backend.db import get_conn
from backend.llm import generate

logger = logging.getLogger(__name__)

VALID_IMPACTS = {"positive", "negative", "context-dependent"}


async def analyze_post(post_id: int) -> dict:
    """Full analysis pipeline — single LLM call for classify + extract."""
    conn = get_conn()

    post = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise ValueError(f"Post {post_id} not found")

    latest_metrics = conn.execute(
        "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC LIMIT 1",
        (post_id,),
    ).fetchone()
    if not latest_metrics:
        raise ValueError(f"No metrics found for post {post_id}")

    post_dict, metrics_dict = dict(post), dict(latest_metrics)
    classification, new_learnings = await classify_and_extract(post_dict, metrics_dict)

    # Only delete previous learnings AFTER new ones are successfully extracted
    if new_learnings:
        conn.execute("DELETE FROM learnings WHERE post_id = ?", (post_id,))
        conn.commit()

    saved = update_learnings(post_id, new_learnings)

    conn.execute(
        "UPDATE posts SET last_analyzed_at = ?, classification = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), classification, post_id),
    )
    conn.commit()

    playbook_updated = check_and_regenerate_playbook()

    return {
        "post_id": post_id,
        "classification": classification,
        "learnings_extracted": len(new_learnings),
        "learnings_saved": saved,
        "playbook_updated": playbook_updated,
    }


def _resolve_pillar_name(conn, pillar_id) -> str:
    if not pillar_id:
        return "None"
    row = conn.execute("SELECT name FROM content_pillars WHERE id = ?", (pillar_id,)).fetchone()
    return row["name"] if row else "None"


def _format_topic_tags(raw: str | None) -> str:
    if not raw:
        return "None"
    try:
        tags = json.loads(raw)
        return ", ".join(tags) if tags else "None"
    except (json.JSONDecodeError, TypeError):
        return raw or "None"


def _percentile(value: float, sorted_data: list[float]) -> int:
    """Return percentile rank (0–100) of value in sorted_data."""
    if not sorted_data:
        return 50
    n = len(sorted_data)
    count = sum(1 for x in sorted_data if x <= value)
    return round(count / n * 100)


def _compute_baseline(author: str, conn) -> dict:
    """Compute author's baseline using the latest snapshot per post only."""
    rows = conn.execute("""
        SELECT lm.impressions, lm.saves, lm.likes, lm.engagement_score
        FROM latest_metrics lm
        JOIN posts p ON p.id = lm.post_id
        WHERE p.author = ?
    """, (author,)).fetchall()

    impressions_list = sorted([r["impressions"] for r in rows if r["impressions"] is not None])
    saves_list = sorted([r["saves"] for r in rows if r["saves"] is not None])
    likes_list = sorted([r["likes"] for r in rows if r["likes"] is not None])
    rates_list = sorted([r["engagement_score"] for r in rows if r["engagement_score"] is not None])

    return {
        "total_posts": len(rows),
        "impressions_list": impressions_list,
        "saves_list": saves_list,
        "likes_list": likes_list,
        "rates_list": rates_list,
        "median_impressions": statistics.median(impressions_list) if impressions_list else 0,
        "median_saves": statistics.median(saves_list) if saves_list else 0,
        "median_rate": statistics.median(rates_list) if rates_list else 0,
    }


def _compute_trajectory(post_id: int, conn) -> str:
    """Compare a post's first vs latest snapshot to determine trend."""
    snapshots = conn.execute(
        "SELECT impressions FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at ASC",
        (post_id,),
    ).fetchall()
    if len(snapshots) < 2:
        return "single snapshot"
    first = snapshots[0]["impressions"] or 0
    last = snapshots[-1]["impressions"] or 0
    if first == 0:
        return "rising" if last > 0 else "stable"
    ratio = last / first
    if ratio > 1.2:
        return "rising"
    elif ratio < 0.8:
        return "declining"
    return "stable"


async def classify_and_extract(post: dict, metrics: dict) -> tuple[str, list[dict]]:
    """Single LLM call: classify + extract learnings. Returns (classification, learnings)."""
    conn = get_conn()
    author = post.get("author", "me")
    baseline = _compute_baseline(author, conn)

    if baseline["total_posts"] < 3:
        return "average", []

    impressions = metrics.get("impressions", 0) or 0
    saves = metrics.get("saves", 0) or 0
    likes = metrics.get("likes", 0) or 0
    rate = metrics.get("engagement_score", 0) or 0

    impressions_pct = _percentile(impressions, baseline["impressions_list"])
    saves_pct = _percentile(saves, baseline["saves_list"])
    likes_pct = _percentile(likes, baseline["likes_list"])
    rate_pct = _percentile(rate, baseline["rates_list"])

    viral_flag = (
        "YES"
        if baseline["median_impressions"] > 0 and impressions > baseline["median_impressions"] * 3
        else "NO"
    )
    trajectory = _compute_trajectory(post.get("id", 0), conn)
    similar_posts = _find_similar_posts(post, conn)

    existing = conn.execute(
        "SELECT insight, category, impact FROM learnings ORDER BY times_confirmed DESC, confidence DESC"
    ).fetchall()
    existing_text = "\n".join(
        f"- [{r['category']}] {r['insight']} ({r['impact']})" for r in existing
    ) or "None yet"

    prompt_text = prompts.CLASSIFY_AND_EXTRACT.format(
        content=post.get("content", "")[:1000],
        post_type=post.get("post_type", "text"),
        hook_style=post.get("hook_style") or "N/A",
        hook_line=post.get("hook_line") or "N/A",
        cta_type=post.get("cta_type", "none"),
        word_count=post.get("word_count", 0),
        pillar_name=_resolve_pillar_name(conn, post.get("pillar_id")),
        total_posts=baseline["total_posts"],
        impressions=impressions,
        impressions_pct=impressions_pct,
        saves=saves,
        saves_pct=saves_pct,
        likes=likes,
        likes_pct=likes_pct,
        comments=metrics.get("comments", 0) or 0,
        engagement_score=rate,
        rate_pct=rate_pct,
        viral_flag=viral_flag,
        trajectory=trajectory,
        similar_posts=similar_posts,
        existing_learnings=existing_text,
    )

    result = await generate(prompt_text, system=prompts.SYSTEM_ANALYST)

    # Parse combined response
    try:
        from backend.utils import parse_llm_json
        parsed = parse_llm_json(result)
        classification = parsed.get("classification", "").strip().lower()
        if classification not in ("hit", "average", "miss"):
            classification = _fallback_classification(rate_pct, impressions_pct, saves_pct)
        learnings = parsed.get("learnings", [])
        if not isinstance(learnings, list):
            learnings = [learnings]
        return classification, learnings
    except (json.JSONDecodeError, IndexError, ValueError, AttributeError):
        logger.warning("Failed to parse combined classify+extract: %s", result[:200])
        classification = _fallback_classification(rate_pct, impressions_pct, saves_pct)
        return classification, []


def _fallback_classification(rate_pct: int, impressions_pct: int, saves_pct: int) -> str:
    """Percentile-based fallback when LLM parsing fails."""
    if rate_pct >= 70 or (impressions_pct >= 70 and saves_pct >= 60):
        return "hit"
    elif rate_pct <= 30 and impressions_pct <= 30 and saves_pct <= 30:
        return "miss"
    return "average"


def _sync_competitor_stats(conn) -> None:
    """Update competitor_profiles aggregate stats from their posts."""
    try:
        competitors = conn.execute("SELECT id, name FROM competitor_profiles").fetchall()
        for comp in competitors:
            stats = conn.execute("""
                SELECT COUNT(p.id) as post_count,
                       AVG(lm.impressions) as avg_impressions,
                       AVG(lm.engagement_score) as avg_engagement_score
                FROM posts p
                LEFT JOIN latest_metrics lm ON p.id = lm.post_id
                WHERE LOWER(p.author) = LOWER(?)
            """, (comp["name"],)).fetchone()
            if stats and stats["post_count"]:
                conn.execute(
                    """UPDATE competitor_profiles
                       SET post_count = ?, avg_impressions = ?, avg_engagement_score = ?
                       WHERE id = ?""",
                    (stats["post_count"],
                     stats["avg_impressions"] or 0,
                     stats["avg_engagement_score"] or 0,
                     comp["id"]),
                )
    except Exception as e:
        logger.warning("Failed to sync competitor stats: %s", e)


def _find_similar_posts(post: dict, conn, limit: int = 3) -> str:
    """Find posts with the same pillar or hook style for cross-comparison context."""
    post_id = post.get("id")
    pillar_id = post.get("pillar_id")
    hook_style = post.get("hook_style")

    rows = conn.execute("""
        SELECT p.id, p.content, p.hook_style, p.post_type, p.classification,
               lm.impressions, lm.saves, lm.engagement_score
        FROM posts p
        JOIN latest_metrics lm ON p.id = lm.post_id
        WHERE p.id != ? AND p.author = ?
          AND (p.pillar_id = ? OR p.hook_style = ?)
        ORDER BY lm.saves DESC, lm.impressions DESC
        LIMIT ?
    """, (post_id, post.get("author", "me"), pillar_id, hook_style, limit)).fetchall()

    if not rows:
        return "No similar posts found."

    blocks = []
    for r in rows:
        cls = r["classification"] or "unclassified"
        rate = r["engagement_score"] or 0.0
        blocks.append(
            f"- Post {r['id']} ({r['hook_style'] or 'N/A'} hook, {cls}): "
            f"{r['impressions']:,} impressions, {r['saves']} saves, "
            f"{rate:.4f} rate | "
            f"{r['content'][:150]}..."
        )
    return "\n".join(blocks)




async def analyze_batch(post_ids: list[int], force: bool = False) -> dict:
    """Batch analysis: classify + extract learnings for multiple posts in fewer LLM calls."""
    conn = get_conn()

    posts_with_metrics = []
    skipped = []
    for pid in post_ids:
        post = conn.execute("SELECT * FROM posts WHERE id = ?", (pid,)).fetchone()
        if not post:
            skipped.append({"post_id": pid, "reason": "Post not found"})
            continue
        metrics = conn.execute(
            "SELECT * FROM metrics_snapshots WHERE post_id = ? ORDER BY snapshot_at DESC LIMIT 1",
            (pid,),
        ).fetchone()
        if not metrics:
            skipped.append({"post_id": pid, "reason": "No metrics"})
            continue
        if not force:
            last_analyzed = post["last_analyzed_at"]
            snapshot_at = metrics["snapshot_at"]
            if last_analyzed and snapshot_at and last_analyzed >= snapshot_at:
                skipped.append({"post_id": pid, "reason": "Already analyzed (no new metrics)"})
                continue
        posts_with_metrics.append({"post": dict(post), "metrics": dict(metrics)})

    if not posts_with_metrics:
        return {"results": [], "skipped": skipped, "playbook_updated": False}

    # Compute a baseline per unique author so competitor posts aren't measured against "me"
    baselines: dict[str, dict] = {}
    for pm in posts_with_metrics:
        a = pm["post"].get("author", "me")
        if a not in baselines:
            baselines[a] = _compute_baseline(a, conn)

    # Use "me" baseline for the batch prompt header (primary reference)
    me_baseline = baselines.get("me") or _compute_baseline("me", conn)

    def _post_baseline(post: dict) -> dict:
        return baselines[post.get("author", "me")]

    # --- BATCH CLASSIFICATION (1 LLM call) ---
    # Skip posts whose author has < 3 baseline posts — default to "average"
    classifications: dict[int, str] = {}
    posts_to_classify = []
    for pm in posts_with_metrics:
        bl = _post_baseline(pm["post"])
        if bl["total_posts"] < 3:
            classifications[pm["post"]["id"]] = "average"
        else:
            posts_to_classify.append(pm)

    if posts_to_classify:
        post_blocks = []
        for pm in posts_to_classify:
            p, m = pm["post"], pm["metrics"]
            bl = _post_baseline(p)
            impressions = m.get("impressions", 0) or 0
            saves = m.get("saves", 0) or 0
            likes = m.get("likes", 0) or 0
            rate = m.get("engagement_score", 0) or 0

            impressions_pct = _percentile(impressions, bl["impressions_list"])
            saves_pct = _percentile(saves, bl["saves_list"])
            likes_pct = _percentile(likes, bl["likes_list"])
            rate_pct = _percentile(rate, bl["rates_list"])
            viral_flag = (
                "YES"
                if bl["median_impressions"] > 0 and impressions > bl["median_impressions"] * 3
                else "NO"
            )
            trajectory = _compute_trajectory(p["id"], conn)

            post_blocks.append(
                f"POST id={p['id']} (author={p.get('author', 'me')}, {bl['total_posts']} post history):\n"
                f"Type: {p.get('post_type', 'text')} | Hook: {p.get('hook_style') or 'N/A'} | CTA: {p.get('cta_type', 'none')}\n"
                f"Impressions: {impressions:,} → {impressions_pct}th pct | Saves: {saves} → {saves_pct}th pct\n"
                f"Likes: {likes} → {likes_pct}th pct | Eng rate: {rate:.4f} → {rate_pct}th pct\n"
                f"Viral: {viral_flag} | Trajectory: {trajectory} | Comments: {m.get('comments', 0) or 0} (CTA: {p.get('cta_type', 'none')})"
            )

        batch_classify_prompt = prompts.BATCH_CLASSIFY_PERFORMANCE.format(
            total_posts=me_baseline["total_posts"],
            median_impressions=int(me_baseline["median_impressions"]),
            median_saves=int(me_baseline["median_saves"]),
            median_rate=me_baseline["median_rate"],
            post_blocks="\n\n".join(post_blocks),
        )

        raw = await generate(batch_classify_prompt, system=prompts.SYSTEM_ANALYST)
        llm_cls = _parse_batch_classifications(raw, posts_to_classify, me_baseline)
        classifications.update(llm_cls)

    # --- BATCH LEARNINGS EXTRACTION (1 LLM call) ---
    from backend.context import _format_learnings
    existing_text = _format_learnings() or "None yet"

    post_blocks_learn = []
    for pm in posts_with_metrics:
        p, m = pm["post"], pm["metrics"]
        pid = p["id"]
        bl = _post_baseline(p)
        impressions = m.get("impressions", 0) or 0
        saves = m.get("saves", 0) or 0
        likes = m.get("likes", 0) or 0
        rate = m.get("engagement_score", 0) or 0

        impressions_pct = _percentile(impressions, bl["impressions_list"])
        saves_pct = _percentile(saves, bl["saves_list"])
        likes_pct = _percentile(likes, bl["likes_list"])
        rate_pct = _percentile(rate, bl["rates_list"])
        viral_flag = (
            "YES"
            if bl["median_impressions"] > 0 and impressions > bl["median_impressions"] * 3
            else "NO"
        )

        post_blocks_learn.append(
            f"POST id={pid} (author={p.get('author', 'me')}, classification={classifications.get(pid, 'average')}):\n"
            f"Type: {p.get('post_type', 'text')} | Hook style: {p.get('hook_style') or 'N/A'} | "
            f"Hook line: {p.get('hook_line') or 'N/A'} | CTA: {p.get('cta_type', 'none')}\n"
            f"Impressions: {impressions:,} → {impressions_pct}th pct | Saves: {saves} → {saves_pct}th pct\n"
            f"Likes: {likes} → {likes_pct}th pct | Eng rate: {rate:.4f} → {rate_pct}th pct\n"
            f"Viral: {viral_flag} | Comments: {m.get('comments', 0) or 0} (CTA: {p.get('cta_type', 'none')})\n"
            f"Content: {p.get('content', '')[:400]}"
        )

    batch_learn_prompt = prompts.BATCH_EXTRACT_LEARNINGS.format(
        total_posts=me_baseline["total_posts"],
        median_impressions=int(me_baseline["median_impressions"]),
        median_saves=int(me_baseline["median_saves"]),
        median_rate=me_baseline["median_rate"],
        post_blocks="\n\n".join(post_blocks_learn),
        existing_learnings=existing_text,
    )

    raw_learn = await generate(batch_learn_prompt, system=prompts.SYSTEM_ANALYST)
    batch_learnings = _parse_batch_learnings(raw_learn, posts_with_metrics)

    # Force mode: clear all learnings NOW — after LLM calls succeed, so a mid-analysis
    # failure doesn't permanently wipe data before we have replacements ready
    if force:
        conn.execute("DELETE FROM learnings")
        conn.commit()
        logger.info("Force mode: cleared all learnings for fresh analysis")

    # Intra-batch deduplication: remove insights that are too similar to ones
    # already seen earlier in the same batch (cross-post dedup)
    seen_in_batch: list[dict] = []
    for pid in list(batch_learnings.keys()):
        unique = []
        for insight in batch_learnings[pid]:
            cat = insight.get("category", "")
            text = insight.get("insight", "")
            is_dup = any(
                s["category"] == cat and _jaccard_similarity(s["insight"], text) >= 0.35
                for s in seen_in_batch
            )
            if not is_dup:
                unique.append(insight)
                seen_in_batch.append({"category": cat, "insight": text})
        batch_learnings[pid] = unique

    # --- Save results ---
    now = datetime.now(timezone.utc).isoformat()
    results = []
    for pm in posts_with_metrics:
        pid = pm["post"]["id"]
        classification = classifications.get(pid, "average")
        post_learnings = batch_learnings.get(pid, [])
        saved = update_learnings(pid, post_learnings)
        conn.execute(
            "UPDATE posts SET last_analyzed_at = ?, classification = ? WHERE id = ?",
            (now, classification, pid),
        )
        results.append({
            "post_id": pid,
            "classification": classification,
            "learnings_extracted": len(post_learnings),
            "learnings_saved": saved,
        })

    # Sync competitor_profiles stats from analyzed posts
    _sync_competitor_stats(conn)

    conn.commit()
    playbook_updated = check_and_regenerate_playbook()

    return {
        "results": results,
        "skipped": skipped,
        "playbook_updated": playbook_updated,
    }


def _parse_batch_classifications(
    raw: str, posts_with_metrics: list[dict], baseline: dict
) -> dict[int, str]:
    """Parse batch classification JSON, falling back to percentile-based classification."""
    classifications: dict[int, str] = {}

    try:
        from backend.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        for pid_str, val in parsed.items():
            pid = int(pid_str)
            # Handle {"classification": "hit", "reason": "..."} or bare string
            if isinstance(val, dict):
                cls = val.get("classification", "").strip().lower()
            else:
                cls = str(val).strip().lower().strip('"')
            if cls in ("hit", "average", "miss"):
                classifications[pid] = cls
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse batch classifications: %s", raw[:200])

    # Percentile-based fallback for any missing
    for pm in posts_with_metrics:
        pid = pm["post"]["id"]
        if pid not in classifications:
            m = pm["metrics"]
            impressions = m.get("impressions", 0) or 0
            saves = m.get("saves", 0) or 0
            rate = m.get("engagement_score", 0) or 0
            impressions_pct = _percentile(impressions, baseline["impressions_list"])
            saves_pct = _percentile(saves, baseline["saves_list"])
            rate_pct = _percentile(rate, baseline["rates_list"])
            if rate_pct >= 70 or (impressions_pct >= 70 and saves_pct >= 60):
                classifications[pid] = "hit"
            elif rate_pct <= 30 and impressions_pct <= 30 and saves_pct <= 30:
                classifications[pid] = "miss"
            else:
                classifications[pid] = "average"

    return classifications


def _parse_batch_learnings(raw: str, posts_with_metrics: list[dict], max_per_post: int = 3) -> dict[int, list[dict]]:
    """Parse batch learnings JSON, capping to max_per_post per post."""
    result: dict[int, list[dict]] = {}
    try:
        from backend.utils import parse_llm_json
        parsed = parse_llm_json(raw)
        for pid_str, learnings in parsed.items():
            pid = int(pid_str)
            if isinstance(learnings, list):
                result[pid] = learnings[:max_per_post]
    except (json.JSONDecodeError, IndexError, ValueError):
        logger.warning("Failed to parse batch learnings: %s", raw[:200])

    return result


def _jaccard_similarity(text1: str, text2: str) -> float:
    """Word-level Jaccard similarity between two strings (0–1)."""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 and not words2:
        return 1.0
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    return intersection / union if union > 0 else 0.0


def update_learnings(post_id: int, new_insights: list[dict]) -> int:
    """Merge new insights into the learnings table with Jaccard-based deduplication."""
    conn = get_conn()
    saved = 0

    for insight_data in new_insights:
        insight_text = insight_data.get("insight", "").strip()
        category = insight_data.get("category", "").strip()
        impact = insight_data.get("impact", "").strip().lower()
        ai_confidence = insight_data.get("confidence")

        # Normalize impact to valid values
        if impact not in VALID_IMPACTS:
            impact = "context-dependent"

        # Clamp AI confidence, default to 0.5
        if isinstance(ai_confidence, (int, float)) and 0 < ai_confidence <= 1.0:
            ai_confidence = max(0.3, min(0.95, float(ai_confidence)))
        else:
            ai_confidence = 0.5

        if not insight_text or not category:
            continue

        # Deduplicate: find existing learning in same category with ≥45% word overlap
        all_existing = conn.execute(
            "SELECT id, insight, times_confirmed, confidence FROM learnings WHERE category = ?",
            (category,),
        ).fetchall()

        matched = None
        best_sim = 0.0
        for row in all_existing:
            sim = _jaccard_similarity(row["insight"], insight_text)
            if sim >= 0.35 and sim > best_sim:
                best_sim = sim
                matched = row

        if matched:
            new_count = matched["times_confirmed"] + 1
            new_confidence = min(0.95, matched["confidence"] + (1.0 - matched["confidence"]) * 0.2)
            conn.execute(
                "UPDATE learnings SET times_confirmed = ?, confidence = ?, updated_at = ? WHERE id = ?",
                (new_count, new_confidence, datetime.now(timezone.utc).isoformat(), matched["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO learnings (post_id, insight, category, impact, confidence) VALUES (?, ?, ?, ?, ?)",
                (post_id, insight_text, category, impact, ai_confidence),
            )
        saved += 1

    conn.commit()
    return saved


def check_and_regenerate_playbook(force: bool = False) -> bool:
    """Check if playbook needs regeneration based on meaningful learnings changes."""
    conn = get_conn()

    # Only use confirmed or high-confidence learnings
    learnings = conn.execute("""
        SELECT insight, category, impact, confidence, times_confirmed
        FROM learnings
        WHERE confidence >= 0.6 OR times_confirmed > 1
        ORDER BY (times_confirmed * confidence) DESC
    """).fetchall()

    if not learnings:
        return False

    # Hash on key fields to avoid noise from minor wording changes
    hash_data = [
        {
            "cat": r["category"],
            "imp": r["impact"],
            "conf": round(r["confidence"], 1),
            "tc": r["times_confirmed"],
            "key": " ".join(r["insight"].lower().split()[:15]),
        }
        for r in learnings
    ]
    current_hash = hashlib.md5(
        json.dumps(hash_data, sort_keys=True).encode()
    ).hexdigest()

    if not force:
        existing_playbook = conn.execute(
            "SELECT learnings_hash FROM playbook ORDER BY generated_at DESC LIMIT 1"
        ).fetchone()
        if existing_playbook and existing_playbook["learnings_hash"] == current_hash:
            return False

    from backend.tasks import create_task
    create_task("playbook_regen", _regenerate_playbook(learnings, current_hash))
    return True


async def _regenerate_playbook(learnings, learnings_hash: str) -> None:
    """Regenerate the playbook from confirmed learnings."""
    conn = get_conn()

    # Get classification distribution
    cls_rows = conn.execute(
        "SELECT classification, COUNT(*) as cnt FROM posts WHERE classification IS NOT NULL GROUP BY classification"
    ).fetchall()
    cls_counts = {r["classification"]: r["cnt"] for r in cls_rows}
    hits = cls_counts.get("hit", 0)
    averages = cls_counts.get("average", 0)
    misses = cls_counts.get("miss", 0)
    total = hits + averages + misses

    # Sort learnings by evidence strength: times_confirmed × confidence
    sorted_learnings = sorted(
        learnings, key=lambda r: r["times_confirmed"] * r["confidence"], reverse=True
    )
    learnings_text = "\n".join(
        f"- [{r['category']}] {r['insight']} | impact: {r['impact']} | "
        f"confidence: {r['confidence']:.2f} | confirmed: {r['times_confirmed']}x"
        for r in sorted_learnings
    )

    prompt_text = prompts.REGENERATE_PLAYBOOK.format(
        hits=hits,
        averages=averages,
        misses=misses,
        total=total,
        learnings=learnings_text,
    )

    content = await generate(prompt_text, system=prompts.SYSTEM_ANALYST)

    conn.execute(
        "INSERT INTO playbook (content, learnings_hash) VALUES (?, ?)",
        (content, learnings_hash),
    )
    conn.commit()
    logger.info("Playbook regenerated with %d learnings", len(learnings))
