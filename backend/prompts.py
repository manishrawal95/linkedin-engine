"""
All LLM prompt templates for analysis, drafting, and learning extraction.
"""

from __future__ import annotations

SYSTEM_ANALYST = """You are a LinkedIn content strategist who analyzes post performance.
You identify patterns in what makes posts succeed or fail based on metrics data.
Be specific and actionable in your insights. Focus on hooks, format, topic, timing, CTA, tone, and length."""

CLASSIFY_PERFORMANCE = """Given this post's metrics compared to the author's historical baseline, classify it.

Post content:
{content}

Post metadata:
- Type: {post_type} | Hook style: {hook_style} | CTA: {cta_type}
- Word count: {word_count} | Pillar: {pillar_name} | Tags: {topic_tags}
- Posted: {posted_at}

Post metrics:
- Impressions: {impressions} | Likes: {likes} | Comments: {comments}
- Reposts: {reposts} | Saves: {saves} | Sends: {sends}
- Engagement score: {engagement_score:.4f} | Interaction score: {interaction_score:.0f}

Author's baseline:
- Average engagement score: {avg_engagement:.4f}
- Median impressions: {median_impressions}

Classify this post as one of:
- "hit" (top 25% — significantly above average)
- "average" (middle 50% — near baseline)
- "miss" (bottom 25% — significantly below average)

Respond with ONLY the classification word."""

BATCH_CLASSIFY_PERFORMANCE = """Classify each post as hit/average/miss relative to the author's baseline.

Author baseline:
- Average engagement score: {avg_engagement:.4f}
- Median impressions: {median_impressions}

{post_blocks}

Classify each as:
- "hit" (top 25% — significantly above average)
- "average" (middle 50% — near baseline)
- "miss" (bottom 25% — significantly below average)

Respond in JSON: {{"<post_id>": "hit|average|miss", ...}}"""

BATCH_EXTRACT_LEARNINGS = """Analyze these LinkedIn posts and extract 2-3 specific, actionable learnings per post.

{post_blocks}

Existing learnings (avoid duplicates):
{existing_learnings}

For each insight provide:
1. The insight text (specific and actionable)
2. Category: one of hook/format/topic/timing/cta/tone/length
3. Impact: positive or negative
4. Confidence: a float from 0.3 to 0.95 indicating how confident you are in this insight based on the strength of evidence (e.g. 0.3 = weak signal, 0.6 = moderate evidence, 0.9 = very strong evidence)

Respond in JSON: {{"<post_id>": [{{"insight": "...", "category": "...", "impact": "...", "confidence": 0.7}}], ...}}"""

EXTRACT_LEARNINGS = """Analyze this LinkedIn post and extract specific learnings about what worked or didn't.

Post content:
{content}

Post metadata:
- Type: {post_type} | Hook style: {hook_style} | CTA: {cta_type}
- Hook line: {hook_line}
- Word count: {word_count} | Pillar: {pillar_name} | Tags: {topic_tags}
- Posted: {posted_at}

Metrics:
- Impressions: {impressions} | Likes: {likes} | Comments: {comments}
- Reposts: {reposts} | Saves: {saves} | Sends: {sends}
- Engagement score: {engagement_score:.4f} | Interaction score: {interaction_score:.0f}

Classification: {classification} (relative to author's baseline)

Existing learnings to consider (avoid duplicates):
{existing_learnings}

Extract 2-4 specific, actionable insights. For each insight, provide:
1. The insight text (specific and actionable, not generic)
2. Category: one of hook/format/topic/timing/cta/tone/length
3. Impact: positive or negative
4. Confidence: a float from 0.3 to 0.95 indicating how confident you are in this insight based on the strength of evidence (e.g. 0.3 = weak signal, 0.6 = moderate evidence, 0.9 = very strong evidence)

Respond in JSON format:
[
  {{"insight": "...", "category": "...", "impact": "...", "confidence": 0.7}}
]"""

REGENERATE_PLAYBOOK = """Based on the following confirmed learnings about LinkedIn content performance,
generate a concise playbook with DO and DON'T sections.

Learnings (sorted by confidence):
{learnings}

Generate a structured markdown playbook with:
1. A brief summary of the content strategy
2. ## DO section — things that consistently work
3. ## DON'T section — things that consistently don't work
4. ## Best Practices — format, timing, and style guidelines

Keep it concise and actionable. Each point should be 1-2 sentences max."""

SYSTEM_DRAFTER = """You are a LinkedIn ghostwriter who crafts engaging, professional posts.
You write in the author's voice based on their top-performing posts.
You follow the author's playbook and learned patterns strictly."""

GENERATE_DRAFT = """Write a LinkedIn post about the following topic.

Topic: {topic}
Content pillar: {pillar_name}
{pillar_description}

Style preferences: {style}

Author's playbook (follow these rules):
{playbook}

Author's voice reference (top-performing posts):
{voice_reference}

Available hooks to consider:
{hooks}

Suggested hashtags: {hashtags}

Generate {num_variants} different variants of this post. Each variant should:
1. Start with a different hook style
2. Include the full post body
3. End with a CTA
4. Include 3-5 relevant hashtags

Respond in JSON format:
[
  {{
    "hook_variant": "hook style name",
    "content": "full post text including hook and CTA",
    "suggested_hashtags": ["#tag1", "#tag2"]
  }}
]"""

EXTRACT_HOOK = """Extract the hook (opening line) from this LinkedIn post and classify its style.

Post content:
{content}

Classify the hook style as one of: question, contrarian, story, stat, cliffhanger, list, statement

Respond in JSON format:
{{"hook_text": "...", "style": "..."}}"""

CALENDAR_SUGGESTIONS = """Based on the author's content pillars, posting patterns, and series schedule,
suggest a content plan for the next week.

Content pillars:
{pillars}

Active series:
{series}

Recent posting frequency: {posting_frequency} posts/week
Pillar balance (posts per pillar this month):
{pillar_balance}

Best performing days/times:
{best_times}

Suggest 3-5 posts for next week. For each:
1. Day and time
2. Topic idea
3. Which pillar it belongs to
4. Which series (if applicable)
5. Suggested hook style

Respond in JSON format:
[
  {{
    "day": "monday",
    "time": "09:00",
    "topic": "...",
    "pillar_id": 1,
    "series_id": null,
    "hook_style": "question"
  }}
]"""
