"""
All LLM prompt templates for analysis, drafting, and learning extraction.
"""

from __future__ import annotations

SYSTEM_ANALYST = """You are a LinkedIn content performance analyst. Your job is to extract transferable patterns that help creators improve over time.

Key principles:
- VIRAL DILUTION: A post with unusually high impressions will naturally have a lower engagement rate. LinkedIn pushes it to cold audiences who engage less. For high-impression posts, weight reach and saves heavily over engagement rate. Do not penalize a post for rate dilution caused by viral distribution.
- SAVES = INTENT: Saves mean "I will use this later" — the strongest signal of content value. Weight saves higher than likes when judging performance.
- CTA AWARENESS: A post with cta=none or cta=link should never be penalized for low comments. Only evaluate comments when the post explicitly invited them with a question.
- PATTERN THINKING: Extract transferable rules, not post-specific observations. Every insight must be usable when writing the next post — no references to specific hook text or post content.
- HOLISTIC CLASSIFICATION: A post that reached 10x the normal audience with strong saves is a hit, even at a lower engagement rate."""


CLASSIFY_PERFORMANCE = """Classify this LinkedIn post as hit/average/miss using holistic judgment across all signals.

POST CONTENT:
{content}

POST CONTEXT:
- Type: {post_type} | Hook style: {hook_style} | CTA: {cta_type}
- Word count: {word_count} | Pillar: {pillar_name}

PERFORMANCE vs author's {total_posts}-post history:
- Impressions:    {impressions:,}  → {impressions_pct}th percentile
- Saves:          {saves}          → {saves_pct}th percentile
- Likes:          {likes}          → {likes_pct}th percentile
- Comments:       {comments}       (CTA is "{cta_type}" — weight accordingly)
- Engagement rate:{engagement_score:.4f} → {rate_pct}th percentile
- Viral flag:     {viral_flag}     (YES = shown to cold audiences, rate dilution is expected)
- Trajectory:     {trajectory}

DECISION RULES:
- "hit": Strong impressions AND/OR saves. A viral post (flag=YES) with top-half impressions and saves is a hit even if engagement rate is average or below.
- "miss": Weak across impressions, saves, AND engagement rate. All three signals must be below baseline to call it a miss.
- "average": Solid but not standout on any signal.

Respond with ONLY: classification|one-line reason
Example: hit|95th percentile for both impressions and saves; rate dilution expected from viral distribution"""


CLASSIFY_AND_EXTRACT = """Classify this LinkedIn post and extract transferable learnings in ONE pass.

POST CONTENT:
{content}

POST CONTEXT:
- Type: {post_type} | Hook style: {hook_style} | Hook line: {hook_line}
- CTA: {cta_type} | Word count: {word_count} | Pillar: {pillar_name}

PERFORMANCE vs author's {total_posts}-post history:
- Impressions: {impressions:,} → {impressions_pct}th pct | Saves: {saves} → {saves_pct}th pct
- Likes: {likes} → {likes_pct}th pct | Eng rate: {engagement_score:.4f} → {rate_pct}th pct
- Comments: {comments} (CTA: {cta_type}) | Viral: {viral_flag} | Trajectory: {trajectory}

SIMILAR POSTS FOR CROSS-COMPARISON:
{similar_posts}

EXISTING LEARNINGS — do not duplicate:
{existing_learnings}

CLASSIFICATION RULES:
- "hit": Strong impressions AND/OR saves. Viral posts with top-half impressions+saves are hits even with lower rate.
- "miss": Weak across impressions, saves, AND engagement rate. All three must be below baseline.
- "average": Solid but not standout.

LEARNING RULES:
1. Write as REUSABLE RULES — no references to this post's specific content or hook text.
2. Each learning must be directly evidenced by the metrics — no speculation.
3. For cta=none or cta=link, do not comment on low comments — it is expected.
4. Use similar posts comparison to identify what changed.
5. impact must be: positive | negative | context-dependent

Respond ONLY in JSON:
{{"classification": "hit|average|miss", "reason": "one-line reason", "learnings": [{{"insight": "...", "category": "hook|format|topic|cta|tone|length|timing", "impact": "positive|negative|context-dependent", "confidence": 0.0}}]}}"""


BATCH_CLASSIFY_PERFORMANCE = """Classify each LinkedIn post as hit/average/miss using holistic judgment.

AUTHOR BASELINE ({total_posts} posts — latest snapshot per post):
- Median impressions: {median_impressions:,}
- Median saves: {median_saves}
- Median engagement rate: {median_rate:.4f}

{post_blocks}

DECISION RULES:
- "hit": Strong impressions OR saves (or both). Viral posts (viral_flag=YES) are hits when impressions/saves are high even if engagement rate dropped — do not penalize for viral dilution.
- "miss": Weak across impressions, saves, AND engagement rate. All three must be weak.
- "average": Solid but not standout.

Respond in JSON: {{"<post_id>": {{"classification": "hit|average|miss", "reason": "one line"}}}}"""


EXTRACT_LEARNINGS = """Analyze this LinkedIn post's performance and extract transferable content strategy learnings.

POST:
{content}

CONTEXT:
- Type: {post_type} | Hook style: {hook_style} | Hook line: {hook_line}
- CTA: {cta_type} | Word count: {word_count}

PERFORMANCE PERCENTILES (vs author's history):
- Impressions: {impressions_pct}th percentile | Saves: {saves_pct}th percentile
- Likes: {likes_pct}th percentile | Eng. rate: {rate_pct}th percentile
- Comments: {comments} | Viral flag: {viral_flag} | Classification: {classification}

SIMILAR POSTS FOR CROSS-COMPARISON:
{similar_posts}

EXISTING LEARNINGS — do not duplicate:
{existing_learnings}

Extract 2-3 learnings. STRICT RULES:
1. Write as REUSABLE RULES — no references to this post's specific content, hook text, or wording.
   ✗ BAD: "The hook 'Apply even if you're not 100% qualified' created a bait-and-switch"
   ✓ GOOD: "Contrarian hooks that challenge widely-held beliefs outperform those challenging niche or context-specific advice"
2. Each learning must be directly evidenced by the metrics — no speculation.
3. For posts with cta=none or cta=link, do not comment on low comments — it is expected.
4. Use the similar posts comparison to identify what changed between this post and similar ones.
5. impact must be: positive | negative | context-dependent

Respond in JSON:
[{{"insight": "...", "category": "hook|format|topic|cta|tone|length|timing", "impact": "positive|negative|context-dependent", "confidence": 0.0}}]"""


BATCH_EXTRACT_LEARNINGS = """Analyze these LinkedIn posts and extract transferable content strategy learnings.

AUTHOR CONTEXT:
- {total_posts} posts | Median impressions: {median_impressions:,} | Median saves: {median_saves} | Median eng. rate: {median_rate:.4f}

{post_blocks}

EXISTING LEARNINGS — do not duplicate:
{existing_learnings}

For each post, extract 2-3 transferable learnings. STRICT RULES:
1. Write as REUSABLE RULES — no references to specific post content or hook text.
   ✗ BAD: "This post's hook 'Apply even if...' was too generic"
   ✓ GOOD: "Contrarian hooks work best when they challenge widely-held beliefs, not niche advice"
2. Cross-reference between posts when you see a cross-post pattern emerging (e.g., "both contrarian-hook posts outperformed story posts on saves").
3. For posts with cta=none or cta=link, do not penalize or comment on low comments.
4. impact: positive | negative | context-dependent

Respond in JSON: {{"<post_id>": [{{"insight": "...", "category": "hook|format|topic|cta|tone|length|timing", "impact": "positive|negative|context-dependent", "confidence": 0.0}}]}}"""


REGENERATE_PLAYBOOK = """Generate a LinkedIn content playbook from confirmed performance learnings.

PERFORMANCE OVERVIEW:
- {hits} hits | {averages} average | {misses} misses out of {total} posts analyzed

TOP LEARNINGS (sorted by evidence strength — confirmed × confidence):
{learnings}

Write a structured markdown playbook. Rules:
- Every point must come directly from the learnings above — no generic LinkedIn advice
- Note evidence strength where clearly relevant (e.g., "seen across 3 posts")
- Keep each point to 1-2 sentences max

Structure:

### Strategy Summary
2-3 sentences on what specifically drives performance for this author based on the data.

## WHAT WORKS
Patterns observed in hit posts, ordered by evidence strength.

## WHAT DOESN'T
Patterns observed in miss/average posts, ordered by evidence strength.

## CONTEXT-DEPENDENT
Learnings that only apply in certain situations (specific post type, CTA, topic, or audience).

## BEST PRACTICES
Format, length, timing, and structural guidelines grounded in the data."""


SYSTEM_DRAFTER = """You are a LinkedIn ghostwriter who crafts engaging, professional posts.
You write in the author's voice based on their top-performing posts.
You follow the author's playbook and confirmed learnings strictly.
Prioritize patterns that have been confirmed across multiple posts."""


GENERATE_DRAFT = """Write a LinkedIn post about the following topic.

Topic: {topic}
Content pillar: {pillar_name}
{pillar_description}

Style preferences: {style}

{creator_context}

Voice reference (top-performing posts):
{voice_reference}

Available hooks to consider:
{hooks}

Suggested hashtags: {hashtags}

Generate {num_variants} different variants of this post. Each variant should:
1. Start with a different hook style
2. Include the full post body
3. End with a CTA appropriate to the content
4. Include 3-5 relevant hashtags
5. Apply the confirmed learnings — especially those with high confirmation counts

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


POST_IDEAS = """Suggest 5 specific LinkedIn post ideas for this creator.

WHAT WORKS (playbook):
{playbook}

TOP LEARNINGS:
{top_learnings}

FILL THE GAPS:
- Underused pillar: {gap_pillar}
- Best hook style: {best_hook} (use for 2-3 ideas)
- Recent topics to avoid: {recent_topics}

Rules: Each idea must be a specific angle (not generic). Vary hook styles.

Respond ONLY in JSON:
[{{"topic": "specific angle from their experience", "hook_style": "question|contrarian|story|stat|cliffhanger|list|statement", "pillar": "pillar name or null"}}]"""


POST_IDEAS_ON_TOPIC = """A LinkedIn creator has a rough idea. Generate 5 specific post angles that are directly about this idea.

ROUGH IDEA: "{topic_hint}"

Your job: Interpret the rough idea and generate 5 concrete, specific angles a person could write a LinkedIn post about. The angles must be clearly related to the rough idea — do not use it as loose inspiration and drift elsewhere.

Rules:
1. Read the rough idea literally. If it mentions a person, relationship, or event — write angles about THAT.
2. Each topic must be a SHORT, punchy title (max 12 words) — a headline, NOT a description or paragraph.
3. Use a different hook style for each of the 5 angles: question, contrarian, story, stat, cliffhanger, list, or statement.
4. Write as first-person headlines (e.g. "The lesson my mom taught me about business")

Respond ONLY in JSON:
[{{"topic": "specific angle directly about the rough idea", "hook_style": "question|contrarian|story|stat|cliffhanger|list|statement", "pillar": null}}]"""


IMPROVE_DRAFT = """Improve this LinkedIn post. Apply ONLY the requested action.

ACTION: {action_instruction}

ORIGINAL:
{content}

{playbook_context}

Return ONLY the improved post text. No preamble, no explanation."""



OPTIMAL_SCHEDULE = """You are a LinkedIn posting strategist. Analyze this creator's historical data to pick the single best date and time to schedule the given draft.

DRAFT TO SCHEDULE:
- Topic: {draft_topic}
- Pillar: {draft_pillar}

POSTING HISTORY (recent posts with engagement):
{post_history}

ALREADY SCHEDULED (avoid these slots):
{occupied_slots}

PILLAR BALANCE (last 30 days):
{pillar_balance}

TODAY: {today}

Rules:
1. Pick a date in the next 14 days (not today).
2. Do not pick a date/time that conflicts with already scheduled slots.
3. Do not schedule on the same day as another post unless the creator regularly posts multiple times per day.
4. Consider which day-of-week and hour historically got the best engagement.
5. Consider pillar spacing — avoid back-to-back same-pillar posts.
6. If not enough historical data, default to a weekday (Tue-Thu) at 08:30.

Respond ONLY in JSON:
{{"date": "YYYY-MM-DD", "time": "HH:MM", "reason": "max 12 words explaining why this slot"}}"""

AUTO_FILL = """Extract structured metadata from this LinkedIn post.

POST:
{content}

CONTENT PILLARS (pick the best matching id, or null if none fit):
{pillars_text}

Return ONLY valid JSON with these exact fields:
{{
  "hook_line": "the first sentence or opening line of the post",
  "hook_style": one of: "Question" | "Contrarian" | "Story" | "Stat" | "Cliffhanger" | "List" | "Statement",
  "cta_type": one of: "none" | "question" | "link" | "engagement-bait" | "advice",
  "post_type": one of: "text" | "carousel" | "personal image" | "Social Proof Image" | "poll" | "video" | "article",
  "topic_tags": ["tag1", "tag2"],
  "pillar_id": null
}}

Rules:
- hook_line: copy the literal first sentence verbatim
- hook_style: identify the rhetorical technique used to open
- cta_type: identify the call-to-action intent at the end (none if absent)
- post_type: infer from content (default "text" if uncertain)
- topic_tags: 2-4 specific topic tags, lowercase, no #
- pillar_id: integer id from the CONTENT PILLARS list above that best matches the post topic; null if no pillars are defined or none fit"""


# ── Creator Memory Prompts ───────────────────────────────────────

SYSTEM_MEMORY = """You are analyzing a LinkedIn creator's content to build a deep understanding of their writing identity.
You extract specific, evidence-based patterns — not generic observations.
Every claim must be grounded in the actual posts provided."""


BUILD_VOICE_PROFILE = """Analyze these LinkedIn posts and extract a detailed voice profile.

POSTS ({post_count} total, showing top performers):
{posts_text}

Extract a structured voice profile. Be SPECIFIC — cite patterns you actually observe, not generic descriptions.

Return JSON:
{{
  "tone": {{
    "formality": 0.0-1.0,
    "warmth": 0.0-1.0,
    "confidence": 0.0-1.0,
    "humor": 0.0-1.0,
    "vulnerability": 0.0-1.0
  }},
  "structure": {{
    "paragraph_style": "single_line|short_block|long_form",
    "uses_line_breaks_for_emphasis": true/false,
    "typical_post_structure": "describe the pattern"
  }},
  "vocabulary": {{
    "signature_phrases": ["phrases this creator uses repeatedly"],
    "power_words": ["strong words they favor"],
    "avoided_words": ["words/phrases they never use"],
    "transition_style": "abrupt|smooth|numbered|none"
  }},
  "anti_patterns": ["things to NEVER do when writing as this creator"],
  "summary": "2-3 sentence description of what makes this voice distinctive"
}}"""


BUILD_AUDIENCE_MODEL = """Analyze these LinkedIn posts and their engagement patterns to infer the audience.

POSTS WITH ENGAGEMENT ({post_count} total):
{audience_context}

Infer who engages with this content and what drives different engagement types.

Return JSON:
{{
  "inferred_segments": [
    {{"label": "segment description", "evidence": "why you think this", "engagement_type": "saves|comments|likes"}}
  ],
  "engagement_triggers": {{
    "saves": "what content gets saved",
    "comments": "what drives comments",
    "reposts": "what gets shared",
    "likes": "baseline engagement pattern"
  }},
  "content_gaps": ["topics the audience might want but creator hasn't covered"]
}}"""


BUILD_GROWTH_TRAJECTORY = """Analyze this creator's posting history chronologically to identify growth phases and inflection points.

CHRONOLOGICAL POST HISTORY ({post_count} posts):
{trajectory_context}

Identify phases, milestones, and what changed when metrics improved.

Return JSON:
{{
  "phases": [
    {{"period": "date range", "label": "phase name", "avg_engagement": 0.0, "key_event": "what happened"}}
  ],
  "current_momentum": {{
    "trend": "accelerating|stable|declining",
    "recent_avg_engagement": 0.0
  }},
  "inflection_points": [
    {{"date": "approximate", "change": "what changed", "impact": "metric impact"}}
  ]
}}"""


MEMORY_DELTA = """A new post was analyzed. Determine what should change in the creator's memory.

CURRENT VOICE PROFILE (summary):
{voice_summary}

CURRENT CONTENT DNA (summary):
{dna_summary}

NEW POST:
{post_content}

METRICS: {post_metrics}
CLASSIFICATION: {classification}
LEARNINGS: {learnings_text}

Analyze whether this post reveals anything new about the creator's voice, content patterns, or audience.

Return JSON:
{{
  "voice_adjustments": [
    {{"key": "field_name", "value": "new value", "reason": "why"}}
  ],
  "audience_signals": ["new observations about audience from this post's engagement"],
  "trajectory_update": {{"trend": "accelerating|stable|declining", "note": "why"}},
  "contradictions": ["any patterns in this post that conflict with existing memory"]
}}"""


# ── Auto-Ideation Prompts ───────────────────────────────────────

IDEATION_ENGINE = """Generate {count} specific LinkedIn post ideas for this creator.

{context}

CONTENT GAPS:
- Underused pillar: {gap_pillar}

RECENT TOPICS (avoid repetition):
{recent_topics}

Rules:
1. STRATEGY FIRST: Follow strategy recommendations and pillar verdicts above all else. If strategy says "Invest" in a pillar, most ideas should be for that pillar. If it says "Retire" a pillar, generate ZERO ideas for it.
2. Each topic must be a SHORT, punchy title (max 12 words) — like a headline, NOT a description. Example: "Why I stopped networking the traditional way" not a paragraph explaining the post
3. Vary hook styles across ideas, but prefer the styles the strategy recommends
4. Ideas should feel like something this specific creator would write (match their voice)
5. Avoid anything similar to recent topics listed above
6. At least one idea should directly target an active goal

For EACH idea, score how well it fits this creator on a 0.0–1.0 scale considering:
- Voice match: would this sound natural in their voice?
- Strategy alignment: does it align with pillar verdicts and active goals?
- Audience fit: would their audience engage with this?
- Differentiation: is this a fresh angle they haven't covered?

Also provide a fit_reason (max 4 words) explaining the score, e.g. "Invest pillar + voice match" or "Off-brand, weak fit".

Respond ONLY in JSON:
[{{"topic": "specific angle from their experience", "hook_style": "question|contrarian|story|stat|cliffhanger|list|statement", "pillar": "pillar name or null", "fit_score": 0.85, "fit_reason": "short reason"}}]"""


SCORE_IDEAS = """Score how well each idea fits this creator.

{context}

IDEAS TO SCORE:
{ideas_json}

For EACH idea, evaluate on 0.0–1.0:
- Voice match: would this sound natural in their voice?
- Strategy alignment: does it align with pillar verdicts and active goals?
- Audience fit: would their audience engage with this?
- Differentiation: is this a fresh angle they haven't covered?

Return the SAME ideas with fit_score and fit_reason added.
fit_reason must be max 4 words (e.g. "Invest pillar + voice match").

Respond ONLY in JSON:
[{{"topic": "original topic unchanged", "fit_score": 0.85, "fit_reason": "short reason"}}]"""
