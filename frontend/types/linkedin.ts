/**
 * Consolidated LinkedIn Planner types.
 *
 * Every frontend file imports from this single source of truth.
 * Fields are the SUPERSET of all variants found across the codebase.
 */

// ─── Core Content ────────────────────────────────────────────────────────────

export interface Post {
  id: number;
  author: string;
  content: string;
  post_url: string | null;
  post_type: string;
  hook_line: string | null;
  hook_style: string | null;
  cta_type: string;
  word_count: number;
  posted_at: string | null;
  pillar_id: number | null;
  series_id: number | null;
  topic_tags: string;
  created_at: string;
  updated_at: string;
  classification?: string | null;
}

export interface Draft {
  id: number;
  topic: string;
  content: string;
  hook_variant: string | null;
  pillar_id: number | null;
  status: string;
  ai_model: string | null;
  created_at: string;
}

export interface Pillar {
  id: number;
  name: string;
  color: string;
  description?: string | null;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

/**
 * A single metrics snapshot for a post.
 *
 * `MetricSnapshot` is the full version with `id` and `post_id` (from the DB).
 * Code that only needs the metric values can use `Metrics` (same shape minus
 * `id` and `post_id`).
 */
export interface MetricSnapshot {
  id: number;
  post_id: number;
  impressions: number;
  members_reached: number;
  profile_viewers: number;
  followers_gained: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  engagement_score: number;
  snapshot_type: string | null;
  snapshot_at: string;
}

export type Metrics = Omit<MetricSnapshot, "id" | "post_id">;

/**
 * Alias kept for backward compatibility with PostCard which originally used
 * `ExpandedMetrics`. Identical shape to `Metrics`.
 */
export type ExpandedMetrics = Metrics;

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Goal {
  id: number;
  metric: string;
  target_value: number;
  current_value: number;
  deadline: string | null;
  status: string;
  source: "auto" | "manual";
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export interface Hook {
  id: number;
  text: string;
  style: string;
  times_used: number;
  avg_engagement_score: number | null;
}

// ─── Hashtags ────────────────────────────────────────────────────────────────

export interface HashtagSet {
  id: number;
  name: string;
  hashtags: string; // JSON string from API
  pillar_id: number | null;
  avg_reach: number | null;
  times_used: number;
  created_at: string;
}

// ─── Series ──────────────────────────────────────────────────────────────────

export interface Series {
  id: number;
  name: string;
  description: string | null;
  pillar_id: number | null;
  frequency: string;
  preferred_day: string | null;
  preferred_time: string | null;
  is_active: number;
  created_at: string;
}

// ─── Competitors ─────────────────────────────────────────────────────────────

export interface Competitor {
  id: number;
  name: string;
  linkedin_url: string | null;
  niche: string | null;
  notes: string | null;
  avg_impressions: number | null;
  avg_engagement_score: number | null;
  post_count: number;
  created_at: string;
}

// ─── Mood Board ──────────────────────────────────────────────────────────────

export interface MoodBoardItem {
  id: number;
  pillar_id: number;
  type: string;
  content: string;
  source_url: string | null;
  sort_order: number;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export interface CalendarEntry {
  id: number;
  scheduled_date: string;
  scheduled_time: string | null;
  draft_id: number | null;
  pillar_id: number | null;
  series_id: number | null;
  status: string;
  notes: string | null;
  post_id: number | null;
}

// ─── Learnings ───────────────────────────────────────────────────────────────

export interface Learning {
  id: number;
  post_id: number | null;
  insight: string;
  category: string;
  impact: string;
  confidence: number;
  times_confirmed: number;
  created_at: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_posts: number;
  total_drafts: number;
  avg_engagement_score: number;
  total_impressions: number;
  avg_likes: number;
  posts_this_month: number;
  posts_last_month: number;
  posts_trend_pct: number | null;
  impressions_trend_pct: number | null;
  recent_posts: Array<{
    id: number;
    content: string;
    posted_at: string;
    impressions: number | null;
    likes: number | null;
    comments: number | null;
    saves: number | null;
    engagement_score: number | null;
    snapshot_type: string | null;
    classification: string | null;
  }>;
}

export interface PillarBalance {
  id: number;
  name: string;
  color: string;
  post_count: number;
}

export interface HeatmapEntry {
  day_of_week: string;
  hour: number;
  avg_engagement: number;
  post_count: number;
}

export interface PostIdea {
  topic: string;
  hook_style: string;
  pillar: string | null;
}

// ─── Queue & Actions ─────────────────────────────────────────────────────────

export interface QueueStatus {
  queue_depth: number;
  target_depth: number;
  ready_drafts: Array<{
    id: number;
    topic: string;
    status: string;
    scheduled_date: string | null;
  }>;
  days_since_last_post: number | null;
  next_scheduled: string | null;
}

export interface MetricsDue {
  post_id: number;
  content_preview: string;
  posted_at: string;
  due_label: string;
}

export interface UnanalyzedPost {
  id: number;
  content_preview: string;
}

export interface Actions {
  metrics_due: MetricsDue[];
  unanalyzed_posts: UnanalyzedPost[];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthStatus {
  authenticated: boolean;
  expires_at?: string;
  person_urn?: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface PillarPerformance {
  id: number;
  name: string;
  color: string;
  post_count: number;
  avg_engagement: number;
  avg_impressions: number;
  avg_likes: number;
  avg_comments: number;
  total_impressions: number;
}

export interface HookPerformance {
  style: string;
  count: number;
  avg_engagement: number;
  total_uses: number;
}

export interface TypePerformance {
  post_type: string;
  count: number;
  avg_engagement: number;
  avg_impressions: number;
}

export interface WordEngagement {
  word_count: number;
  engagement_score: number;
  impressions: number;
}

export interface MonthlyTrend {
  month: string;
  post_count: number;
  avg_engagement: number;
  total_impressions: number;
  total_followers: number;
}

export interface PostEntry {
  id: number;
  content: string;
  post_type: string;
  word_count: number;
  posted_at: string;
  engagement_score: number;
  impressions: number;
  likes: number;
  comments: number;
}

export interface AnalyticsData {
  pillar_performance: PillarPerformance[];
  hook_performance: HookPerformance[];
  type_performance: TypePerformance[];
  word_engagement: WordEngagement[];
  monthly_trend: MonthlyTrend[];
  top_posts: PostEntry[];
  bottom_posts: PostEntry[];
}

// ─── Creator Memory ─────────────────────────────────────────────

export interface VoiceProfile {
  tone?: {
    formality?: number;
    warmth?: number;
    confidence?: number;
    humor?: number;
    vulnerability?: number;
  };
  structure?: {
    paragraph_style?: string;
    uses_line_breaks_for_emphasis?: boolean;
    typical_post_structure?: string;
  };
  vocabulary?: {
    signature_phrases?: string[];
    power_words?: string[];
    avoided_words?: string[];
    transition_style?: string;
  };
  anti_patterns?: string[];
  summary?: string;
  error?: string;
}

export interface ContentDNA {
  topic_performance?: Array<{
    id: number;
    name: string;
    color: string;
    post_count: number;
    avg_engagement: number;
    avg_impressions: number;
    avg_saves: number;
  }>;
  format_performance?: Array<{
    format: string;
    post_count: number;
    avg_engagement: number;
    avg_comments: number;
    avg_saves: number;
  }>;
  hook_performance?: Array<{
    style: string;
    count: number;
    avg_engagement: number;
    avg_impressions: number;
  }>;
  cta_performance?: Array<{
    type: string;
    count: number;
    avg_engagement: number;
    avg_comments: number;
    avg_reposts: number;
  }>;
  length_sweet_spot?: {
    optimal_range?: [number, number];
    median?: number;
    avg_engagement_in_range?: number;
  };
  best_timing?: Array<{
    day: string;
    hour: number;
    avg_engagement: number;
    post_count: number;
  }>;
}

export interface AudienceModel {
  inferred_segments?: Array<{
    label: string;
    evidence: string;
    engagement_type: string;
  }>;
  engagement_triggers?: {
    saves?: string;
    comments?: string;
    reposts?: string;
    likes?: string;
  };
  content_gaps?: string[];
  error?: string;
}

export interface GrowthTrajectory {
  phases?: Array<{
    period: string;
    label: string;
    avg_engagement: number;
    key_event: string | null;
  }>;
  current_momentum?: {
    trend: "accelerating" | "stable" | "declining";
    recent_avg_engagement: number;
  };
  inflection_points?: Array<{
    date: string;
    change: string;
    impact: string;
  }>;
  error?: string;
}

export interface CreatorMemory {
  id: number;
  voice_profile: VoiceProfile;
  content_dna: ContentDNA;
  audience_model: AudienceModel;
  growth_trajectory: GrowthTrajectory;
  version: number;
  confidence_overall: number;
  post_count_at_build: number;
  created_at: string;
  updated_at: string;
}

// ─── Ideas ──────────────────────────────────────────────────────

// ─── Creator Profile ─────────────────────────────────────────────

export interface CreatorProfile {
  id: number | null;
  about_me: string;
  writing_skill: string;
  condensed_context: string;
  updated_at?: string;
}

export interface Idea {
  id: number;
  topic: string;
  hook_style: string | null;
  pillar_id: number | null;
  pillar_name?: string | null;
  pillar_color?: string | null;
  source: string;
  score: number;
  fit_reason: string | null;
  status: string;
  draft_id: number | null;
  batch_id: string | null;
  created_at: string;
}

// ─── Strategy Review ─────────────────────────────────────────────

export interface StrategyRecommendation {
  priority: number;
  action: string;
  expected_impact: string;
}

export interface StrategyExperiment {
  name: string;
  hypothesis: string;
  test: string;
  duration: string;
  success_metric: string;
}

export interface PillarVerdict {
  pillar: string;
  score: number;
  verdict: "Invest" | "Maintain" | "Retire";
  reason: string;
}

export interface StrategyReview {
  health_score: number;
  diagnosis: string;
  whats_working: string[];
  whats_not_working: string[];
  hit_formula: string;
  audience_depth_assessment: string;
  recommendations: StrategyRecommendation[];
  experiments: StrategyExperiment[];
  pillar_verdicts: PillarVerdict[];
}

export interface StrategyReviewResponse {
  health_score: number;
  diagnosis: string;
  review: StrategyReview;
  metrics: Record<string, unknown>;
  created_at: string;
}
