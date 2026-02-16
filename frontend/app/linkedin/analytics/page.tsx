"use client";

import { memo, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Type,
  Anchor,
  FileText,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  BarChart,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

/* ── Types ────────────────────────────────────────────────────── */

interface PillarPerformance {
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

interface HookPerformance {
  style: string;
  count: number;
  avg_engagement: number;
  total_uses: number;
}

interface TypePerformance {
  post_type: string;
  count: number;
  avg_engagement: number;
  avg_impressions: number;
}

interface WordEngagement {
  word_count: number;
  engagement_score: number;
  impressions: number;
}

interface MonthlyTrend {
  month: string;
  post_count: number;
  avg_engagement: number;
  total_impressions: number;
  total_followers: number;
}

interface PostEntry {
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

interface AnalyticsData {
  pillar_performance: PillarPerformance[];
  hook_performance: HookPerformance[];
  type_performance: TypePerformance[];
  word_engagement: WordEngagement[];
  monthly_trend: MonthlyTrend[];
  top_posts: PostEntry[];
  bottom_posts: PostEntry[];
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function formatMonth(raw: string | null | undefined): string {
  if (!raw) return "N/A";
  // "2024-01" -> "Jan '24"
  const [year, month] = raw.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  const short = date.toLocaleDateString("en-US", { month: "short" });
  return `${short} '${year.slice(-2)}`;
}

const TYPE_COLORS: Record<string, string> = {
  text: "#6366f1",
  carousel: "#f59e0b",
  poll: "#10b981",
  video: "#ef4444",
  article: "#8b5cf6",
};

const HOOK_STYLE_COLORS: Record<string, string> = {
  question: "#3b82f6",
  contrarian: "#ef4444",
  story: "#a855f7",
  stat: "#10b981",
  cliffhanger: "#f59e0b",
  list: "#06b6d4",
  statement: "#6b7280",
};

/* ── Tooltip styles ───────────────────────────────────────────── */

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  backgroundColor: "#fff",
};

/* ── Main Component ───────────────────────────────────────────── */

const AnalyticsPage = memo(function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/dashboard/analytics");
      const json = await res.json();
      setData(json);
    } catch {
      // backend may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Analytics
        </h1>
        <div className="mt-8 text-center py-16 bg-white rounded-xl border border-gray-200">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">
            No analytics data available
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Add posts with metrics to start seeing insights
          </p>
        </div>
      </div>
    );
  }

  /* Prepare monthly trend data for the composed chart */
  const trendData = (data.monthly_trend || [])
    .filter((m) => m.month != null)
    .map((m) => ({
      ...m,
      label: formatMonth(m.month),
      engagementPct: +(m.avg_engagement * 100).toFixed(2),
    }));

  /* Pillar data sorted by avg_engagement desc */
  const pillarData = [...(data.pillar_performance || [])].sort(
    (a, b) => b.avg_engagement - a.avg_engagement
  );

  /* Post type data */
  const typeData = (data.type_performance || []).map((t) => ({
    ...t,
    engagementPct: +(t.avg_engagement * 100).toFixed(2),
    label: t.post_type.charAt(0).toUpperCase() + t.post_type.slice(1),
  }));

  /* Hook performance data */
  const hookData = (data.hook_performance || []).map((h) => ({
    ...h,
    engagementPct: +(h.avg_engagement * 100).toFixed(2),
    label: h.style.charAt(0).toUpperCase() + h.style.slice(1),
    fullMark: 10,
  }));

  /* Word count scatter data */
  const wordData = (data.word_engagement || []).map((w) => ({
    ...w,
    engagementPct: +(w.engagement_score * 100).toFixed(2),
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── 1. Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Comprehensive performance breakdown across all your content
        </p>
      </div>

      {/* ── 2. Monthly Trend (full width) ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          Monthly Trend
        </h2>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trendData}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#111827" }}
                stroke="#3949AB"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#111827" }}
                stroke="#3949AB"
                label={{
                  value: "Posts",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#111827" },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#111827" }}
                stroke="#3949AB"
                unit="%"
                label={{
                  value: "Engagement",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 11, fill: "#111827" },
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number | undefined, name?: string) => {
                  const v = value ?? 0;
                  if (name === "engagementPct") return [`${v}%`, "Avg Engagement"];
                  if (name === "post_count") return [v, "Posts"];
                  return [v, name ?? ""];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => {
                  if (value === "post_count") return "Posts";
                  if (value === "engagementPct") return "Avg Engagement";
                  return value;
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="post_count"
                fill="url(#barGrad)"
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="engagementPct"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: "#f59e0b" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Post regularly to see monthly trends" />
        )}
      </div>

      {/* ── Row: Pillar + Post Type ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Pillar Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Pillar Performance
          </h2>
          {pillarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, pillarData.length * 48)}>
              <BarChart data={pillarData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#111827" }}
                  stroke="#3949AB"
                  tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#111827" }}
                  stroke="#3949AB"
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number | undefined) => [pct(value ?? 0), "Avg Engagement"]}
                  labelFormatter={(label: React.ReactNode) => label}
                />
                <Bar dataKey="avg_engagement" radius={[0, 4, 4, 0]} barSize={24}>
                  {pillarData.map((p) => (
                    <Cell key={p.id} fill={p.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Create pillars and tag posts to compare performance" />
          )}
          {pillarData.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {pillarData.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="ml-auto text-gray-400">{p.post_count} posts</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Post Type Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Type className="w-4 h-4 text-gray-400" />
            Post Type Performance
          </h2>
          {typeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={typeData} margin={{ bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#111827" }}
                    stroke="#3949AB"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#111827" }}
                    stroke="#3949AB"
                    unit="%"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#111827" }}
                    stroke="#3949AB"
                    tickFormatter={(v) => formatNumber(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined, name?: string) => {
                      const v = value ?? 0;
                      if (name === "engagementPct") return [`${v}%`, "Avg Engagement"];
                      if (name === "avg_impressions") return [formatNumber(v), "Avg Impressions"];
                      return [v, name ?? ""];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => {
                      if (value === "engagementPct") return "Avg Engagement";
                      if (value === "avg_impressions") return "Avg Impressions";
                      return value;
                    }}
                  />
                  <Bar yAxisId="left" dataKey="engagementPct" radius={[4, 4, 0, 0]} barSize={24}>
                    {typeData.map((t) => (
                      <Cell key={t.post_type} fill={TYPE_COLORS[t.post_type] || "#6366f1"} />
                    ))}
                  </Bar>
                  <Bar
                    yAxisId="right"
                    dataKey="avg_impressions"
                    fill="#93c5fd"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2">
                {typeData.map((t) => (
                  <span
                    key={t.post_type}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: TYPE_COLORS[t.post_type] || "#6366f1" }}
                    />
                    {t.label}
                    <span className="text-gray-400 ml-1">{t.count} posts</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Add posts of different types to compare performance" />
          )}
        </div>
      </div>

      {/* ── Row: Hook Style + Content Length ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5. Hook Style Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Anchor className="w-4 h-4 text-gray-400" />
            Hook Style Analysis
          </h2>
          {hookData.length > 0 ? (
            <>
              {hookData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={hookData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#111827" }}
                    />
                    <PolarRadiusAxis
                      tick={{ fontSize: 10, fill: "#111827" }}
                      stroke="#3949AB"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Radar
                      name="Avg Engagement"
                      dataKey="engagementPct"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number | undefined) => [`${value ?? 0}%`, "Avg Engagement"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={hookData} margin={{ bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#111827" }} stroke="#3949AB" />
                    <YAxis tick={{ fontSize: 11, fill: "#111827" }} stroke="#3949AB" unit="%" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number | undefined) => [`${value ?? 0}%`, "Avg Engagement"]}
                    />
                    <Bar dataKey="engagementPct" radius={[4, 4, 0, 0]} barSize={32}>
                      {hookData.map((h) => (
                        <Cell
                          key={h.style}
                          fill={HOOK_STYLE_COLORS[h.style] || "#6366f1"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {hookData.map((h) => (
                  <span
                    key={h.style}
                    className="inline-flex items-center gap-1.5 text-xs bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: HOOK_STYLE_COLORS[h.style] || "#6366f1" }}
                    />
                    <span className="text-gray-700 font-medium capitalize">{h.style}</span>
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                      {h.count}x
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Tag hooks on your posts to analyze style performance" />
          )}
        </div>

        {/* 6. Content Length Sweet Spot */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-gray-400" />
            Content Length Sweet Spot
          </h2>
          {wordData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    type="number"
                    dataKey="word_count"
                    name="Word Count"
                    tick={{ fontSize: 11, fill: "#111827" }}
                    stroke="#3949AB"
                    label={{
                      value: "Word Count",
                      position: "insideBottom",
                      offset: -2,
                      style: { fontSize: 11, fill: "#111827" },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="engagementPct"
                    name="Engagement"
                    tick={{ fontSize: 11, fill: "#111827" }}
                    stroke="#3949AB"
                    unit="%"
                    label={{
                      value: "Engagement",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11, fill: "#111827" },
                    }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined, name?: string) => {
                      const v = value ?? 0;
                      if (name === "Engagement") return [`${v}`, name];
                      if (name === "Word Count") return [v, name];
                      return [v, name ?? ""];
                    }}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Scatter name="Posts" data={wordData} fill="#6366f1">
                    {wordData.map((_, index) => (
                      <Cell
                        key={index}
                        fill="#6366f1"
                        fillOpacity={0.6}
                        stroke="#4f46e5"
                        strokeWidth={1}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Each dot represents a post. Find your optimal word count range.
              </p>
            </>
          ) : (
            <EmptyState message="Add posts with word counts and metrics to see the sweet spot" />
          )}
        </div>
      </div>

      {/* ── Row: Top Performers + Underperformers ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7. Top Performers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-green-500" />
            Top Performers
          </h2>
          {data.top_posts?.length > 0 ? (
            <div className="space-y-3">
              {data.top_posts.slice(0, 5).map((post, idx) => (
                <PostRow key={post.id} post={post} rank={idx + 1} variant="top" />
              ))}
            </div>
          ) : (
            <EmptyState message="No top-performing posts found yet" />
          )}
        </div>

        {/* 8. Underperformers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ThumbsDown className="w-4 h-4 text-amber-500" />
            Underperformers
          </h2>
          {data.bottom_posts?.length > 0 ? (
            <div className="space-y-3">
              {data.bottom_posts.slice(0, 5).map((post, idx) => (
                <PostRow key={post.id} post={post} rank={idx + 1} variant="bottom" />
              ))}
            </div>
          ) : (
            <EmptyState message="No underperforming posts identified yet" />
          )}
        </div>
      </div>
    </div>
  );
});

AnalyticsPage.displayName = "AnalyticsPage";
export default AnalyticsPage;

/* ── Sub-components ───────────────────────────────────────────── */

function PostRow({
  post,
  rank,
  variant,
}: {
  post: PostEntry;
  rank: number;
  variant: "top" | "bottom";
}) {
  const suggestions: Record<string, string> = {
    text: "Try adding a carousel or image to boost visibility",
    carousel: "Consider a stronger hook or more actionable CTA",
    poll: "Engage in comments early to boost algorithm reach",
    video: "Try shorter, punchier videos under 90 seconds",
    article: "Break into a multi-part series for better engagement",
  };

  return (
    <Link
      href={`/linkedin/posts/${post.id}`}
      className="block p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all group"
    >
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            variant === "top"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed group-hover:text-gray-900">
            {post.content}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatNumber(post.impressions)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {post.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {post.comments}
            </span>
            <span
              className={`ml-auto font-semibold ${
                variant === "top" ? "text-green-600" : "text-amber-600"
              }`}
            >
              {pct(post.engagement_score)} eng
            </span>
          </div>
          {variant === "bottom" && (
            <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-md px-2 py-1 border border-amber-100">
              <Lightbulb className="w-3 h-3 inline mr-1 -mt-0.5" />
              {suggestions[post.post_type] ||
                "Experiment with different hooks and post formats"}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  );
}
