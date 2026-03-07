"""
Unified context builder — single source of truth for LLM prompt context.

All pipelines (ideation, drafting, analysis) call build_creator_context() instead
of independently fetching, formatting, and truncating the same data.

Format: compact key-value encoding (lossless, 60-70% fewer tokens than JSON).
"""

from __future__ import annotations

import json
import logging

from backend.db import get_conn

logger = logging.getLogger(__name__)


def build_creator_context() -> str:
    """Build the full creator context in compact format. No truncation — all data preserved."""
    parts: list[str] = []

    parts.append(_format_profile())
    parts.append(_format_strategy())
    parts.append(_format_goals())
    parts.append(_format_voice())
    parts.append(_format_dna())
    parts.append(_format_playbook())
    parts.append(_format_learnings())

    return "\n\n".join(p for p in parts if p)


def _format_profile() -> str:
    """Creator profile in compact format."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM creator_profile WHERE id = 1").fetchone()
    if not row or not row["condensed_context"]:
        return ""
    return f"CREATOR PROFILE:\n{row['condensed_context']}"


def _format_strategy() -> str:
    """Strategy review in compact directive format."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM strategy_reviews WHERE id = 1").fetchone()
    if not row:
        return "STRATEGY: No strategy review yet."

    try:
        review = json.loads(row["review_data"]) if isinstance(row["review_data"], str) else row["review_data"]
    except (json.JSONDecodeError, TypeError):
        return "STRATEGY: No strategy review yet."

    lines = [f"STRATEGY (health {row['health_score']}/10):"]
    lines.append(f"Diagnosis: {row['diagnosis']}")

    if review.get("hit_formula"):
        lines.append(f"Hit formula: {review['hit_formula']}")

    if review.get("pillar_verdicts"):
        verdicts = " | ".join(
            f"{pv['pillar']}: {pv['verdict']} ({pv['score']}/10)"
            for pv in review["pillar_verdicts"]
        )
        lines.append(f"Pillars: {verdicts}")

    if review.get("whats_working"):
        lines.append("Working: " + "; ".join(review["whats_working"][:3]))

    if review.get("whats_not_working"):
        lines.append("Not working: " + "; ".join(review["whats_not_working"][:3]))

    if review.get("recommendations"):
        recs = " | ".join(r["action"] for r in review["recommendations"][:3])
        lines.append(f"Recommendations: {recs}")

    if review.get("experiments"):
        exps = " | ".join(
            f"{e['name']}: {e['hypothesis']}" for e in review["experiments"][:2]
        )
        lines.append(f"Experiments: {exps}")

    return "\n".join(lines)


def _format_goals() -> str:
    """Active goals in compact format."""
    conn = get_conn()
    goals = conn.execute(
        "SELECT metric, target_value, current_value, source FROM goals WHERE status = 'active' ORDER BY source, id"
    ).fetchall()
    if not goals:
        return "GOALS: No active goals."

    lines = ["ACTIVE GOALS:"]
    for g in goals:
        tag = " (auto)" if g["source"] == "auto" else ""
        lines.append(f"- {g['metric']}: {g['current_value']} → {g['target_value']}{tag}")
    return "\n".join(lines)


def _format_voice() -> str:
    """Voice profile in compact key-value format instead of raw JSON."""
    conn = get_conn()
    row = conn.execute("SELECT voice_profile FROM creator_memory WHERE id = 1").fetchone()
    if not row:
        return ""

    try:
        voice = json.loads(row["voice_profile"]) if isinstance(row["voice_profile"], str) else row["voice_profile"]
    except (json.JSONDecodeError, TypeError):
        return ""

    if not voice or voice.get("error"):
        return ""

    lines = ["VOICE PROFILE:"]

    # Tone dimensions
    tone = voice.get("tone", {})
    if tone:
        tone_parts = ", ".join(f"{k}={v}" for k, v in tone.items() if isinstance(v, (int, float)))
        if tone_parts:
            lines.append(f"Tone: {tone_parts}")

    # Structure
    structure = voice.get("structure", {})
    if structure:
        struct_parts = ", ".join(f"{k}={v}" for k, v in structure.items())
        if struct_parts:
            lines.append(f"Structure: {struct_parts}")

    # Patterns (list of strings)
    patterns = voice.get("patterns", [])
    if patterns and isinstance(patterns, list):
        lines.append("Patterns: " + "; ".join(str(p) for p in patterns[:8]))

    # Vocabulary
    vocab = voice.get("vocabulary", {})
    if vocab:
        if isinstance(vocab, dict):
            for k, v in vocab.items():
                if isinstance(v, list):
                    lines.append(f"Vocab ({k}): {', '.join(str(x) for x in v[:6])}")
                elif isinstance(v, str):
                    lines.append(f"Vocab ({k}): {v}")
        elif isinstance(vocab, list):
            lines.append(f"Vocab: {', '.join(str(x) for x in vocab[:8])}")

    # Summary if present
    summary = voice.get("summary", "")
    if summary:
        lines.append(f"Summary: {summary}")

    # Catch-all: any other top-level keys we didn't handle
    handled = {"tone", "structure", "patterns", "vocabulary", "summary", "error", "raw"}
    for k, v in voice.items():
        if k not in handled:
            if isinstance(v, str):
                lines.append(f"{k}: {v}")
            elif isinstance(v, list):
                lines.append(f"{k}: {'; '.join(str(x) for x in v[:5])}")
            elif isinstance(v, dict):
                flat = ", ".join(f"{sk}={sv}" for sk, sv in v.items() if not isinstance(sv, (dict, list)))
                if flat:
                    lines.append(f"{k}: {flat}")

    return "\n".join(lines)


def _format_dna() -> str:
    """Content DNA in tabular format instead of raw JSON."""
    conn = get_conn()
    row = conn.execute("SELECT content_dna FROM creator_memory WHERE id = 1").fetchone()
    if not row:
        return ""

    try:
        dna = json.loads(row["content_dna"]) if isinstance(row["content_dna"], str) else row["content_dna"]
    except (json.JSONDecodeError, TypeError):
        return ""

    if not dna:
        return ""

    lines = ["CONTENT DNA:"]

    # Topic performance
    topics = dna.get("topic_performance", [])
    if topics:
        topic_parts = []
        for t in topics:
            name = t.get("name", "unknown")
            count = t.get("post_count", 0)
            eng = (t.get("avg_engagement") or 0) * 100
            imp = int(t.get("avg_impressions") or 0)
            topic_parts.append(f"{name}: {count} posts, {eng:.2f}% eng, {imp} imp")
        lines.append("Topics: " + " | ".join(topic_parts))

    # Format performance
    formats = dna.get("format_performance", [])
    if formats:
        fmt_parts = []
        for f in formats:
            name = f.get("format", "unknown")
            eng = (f.get("avg_engagement") or 0) * 100
            fmt_parts.append(f"{name}: {eng:.2f}% eng, {f.get('post_count', 0)} posts")
        lines.append("Formats: " + " | ".join(fmt_parts))

    # Hook performance
    hooks = dna.get("hook_performance", [])
    if hooks:
        hook_parts = []
        for h in hooks:
            style = h.get("style", "unknown")
            eng = (h.get("avg_engagement") or 0) * 100
            hook_parts.append(f"{style}: {eng:.2f}% eng, {h.get('count', 0)} posts")
        lines.append("Hooks: " + " | ".join(hook_parts))

    # CTA performance
    ctas = dna.get("cta_performance", [])
    if ctas:
        cta_parts = []
        for c in ctas:
            ctype = c.get("type", "unknown")
            eng = (c.get("avg_engagement") or 0) * 100
            cta_parts.append(f"{ctype}: {eng:.2f}% eng, {c.get('count', 0)} posts")
        lines.append("CTAs: " + " | ".join(cta_parts))

    # Length sweet spot
    length = dna.get("length_sweet_spot", {})
    if length.get("optimal_range"):
        lines.append(
            f"Length: sweet spot {length['optimal_range'][0]}-{length['optimal_range'][1]} words "
            f"(median {length.get('median', '?')})"
        )

    # Timing
    timing = dna.get("best_timing", [])
    if timing:
        time_parts = [f"{t.get('day', '?')} {t.get('hour', '?')}:00" for t in timing[:3]]
        lines.append("Best timing: " + ", ".join(time_parts))

    return "\n".join(lines)


def _format_playbook() -> str:
    """Latest playbook content."""
    conn = get_conn()
    row = conn.execute(
        "SELECT content FROM playbook ORDER BY generated_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        return "PLAYBOOK: No playbook generated yet."
    return f"PLAYBOOK:\n{row['content']}"


def _format_learnings() -> str:
    """Top confirmed learnings in compact format."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT insight, category, impact, confidence, times_confirmed
        FROM learnings
        WHERE confidence >= 0.6 OR times_confirmed > 1
        ORDER BY (times_confirmed * confidence) DESC
        LIMIT 15
    """).fetchall()
    if not rows:
        return "LEARNINGS: No confirmed learnings yet."

    lines = ["TOP LEARNINGS:"]
    for r in rows:
        conf = f"{r['confidence']:.0%}"
        lines.append(
            f"- [{r['category']}] {r['insight']} ({r['impact']}, {conf}, {r['times_confirmed']}x confirmed)"
        )
    return "\n".join(lines)


def format_audience() -> str:
    """Audience model + demographics in compact format."""
    conn = get_conn()
    parts: list[str] = []

    # Memory-based audience model
    row = conn.execute("SELECT audience_model FROM creator_memory WHERE id = 1").fetchone()
    if row:
        try:
            audience = json.loads(row["audience_model"]) if isinstance(row["audience_model"], str) else row["audience_model"]
            if audience and not audience.get("error"):
                lines = ["AUDIENCE MODEL:"]
                segments = audience.get("inferred_segments", [])
                for seg in segments[:4]:
                    lines.append(f"- {seg.get('label', '?')}: {seg.get('evidence', '')}")
                triggers = audience.get("engagement_triggers", {})
                if triggers:
                    trig_parts = [f"{k}: {v}" for k, v in triggers.items() if v]
                    if trig_parts:
                        lines.append("Triggers: " + " | ".join(trig_parts[:4]))
                parts.append("\n".join(lines))
        except (json.JSONDecodeError, TypeError):
            pass

    # Imported demographics
    demos = conn.execute(
        "SELECT category, value, percentage FROM audience_demographics ORDER BY category, percentage DESC"
    ).fetchall()
    if demos:
        demo_groups: dict[str, list[str]] = {}
        for d in demos:
            cat = d["category"]
            if cat not in demo_groups:
                demo_groups[cat] = []
            if len(demo_groups[cat]) < 3:
                demo_groups[cat].append(f"{d['value']} ({d['percentage']}%)")
        demo_lines = ["DEMOGRAPHICS:"]
        for cat, vals in demo_groups.items():
            demo_lines.append(f"- {cat}: {', '.join(vals)}")
        parts.append("\n".join(demo_lines))

    # Account stats
    summary = conn.execute("SELECT * FROM analytics_summary WHERE id = 1").fetchone()
    if summary and summary["total_impressions"]:
        parts.append(
            f"ACCOUNT: {summary['total_impressions']:,} impressions, "
            f"{summary['total_members_reached']:,} reached, "
            f"{summary['total_followers']:,} followers"
        )

    # Follower growth
    follower = conn.execute(
        "SELECT SUM(new_followers) as total, COUNT(*) as days FROM follower_daily"
    ).fetchone()
    if follower and follower["days"] and follower["days"] > 0:
        avg = follower["total"] / follower["days"]
        parts.append(f"GROWTH: ~{avg:.1f} followers/day ({follower['days']} days tracked)")

    return "\n\n".join(parts) if parts else ""
