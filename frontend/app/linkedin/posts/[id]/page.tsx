"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Send,
  Users,
  Clock,
  BarChart3,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Lightbulb,
  Tag,
  FileText,
  Link as LinkIcon,
  User,
  Hash,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import MetricsForm from "../../components/MetricsForm";
import LinkedInPreview from "../../components/LinkedInPreview";

/* ── Types ────────────────────────────────────────────────────── */

interface Post {
  id: number;
  author: string;
  content: string;
  post_url: string | null;
  post_type: string;
  hook_line: string | null;
  cta_type: string;
  word_count: number;
  posted_at: string | null;
  pillar_id: number | null;
  series_id: number | null;
  topic_tags: string;
  created_at: string;
  updated_at: string;
}

interface MetricSnapshot {
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

interface Pillar {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface Learning {
  id: number;
  post_id: number | null;
  insight: string;
  category: string;
  impact: string;
  confidence: number;
  times_confirmed: number;
  created_at: string;
}

/* ── Constants ────────────────────────────────────────────────── */

const SNAPSHOT_LABELS: Record<string, string> = {
  "12h": "12 hours",
  "24h": "24 hours",
  "48h": "48 hours",
  "1w": "1 week",
  later: "1 week+",
};

const TYPE_COLORS: Record<string, string> = {
  text: "bg-gray-100 text-gray-600",
  carousel: "bg-orange-100 text-orange-700",
  poll: "bg-cyan-100 text-cyan-700",
  video: "bg-red-100 text-red-700",
  article: "bg-blue-100 text-blue-700",
};

const IMPACT_STYLES: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-600",
};

/* ── Page Component ───────────────────────────────────────────── */

export default function PostDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/linkedin/posts/${id}`);
      if (!res.ok) throw new Error("Post not found");
      const data = await res.json();
      setPost(data.post);
      setMetrics(data.metrics || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load post");
    }
  }, [id]);

  const fetchPillars = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/pillars");
      const data = await res.json();
      setPillars(data.pillars || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/learnings");
      const data = await res.json();
      const all: Learning[] = data.learnings || [];
      setLearnings(all.filter((l) => l.post_id === Number(id)));
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPost(), fetchPillars(), fetchLearnings()]).finally(() =>
      setLoading(false)
    );
  }, [fetchPost, fetchPillars, fetchLearnings]);

  /* ── Handlers ───────────────────────────────────────────────── */

  const handleAddMetrics = async (
    postId: number,
    data: Record<string, number>
  ) => {
    await fetch(`/api/linkedin/posts/${postId}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowMetricsForm(false);
    fetchPost();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/linkedin/analyze/${id}`, {
        method: "POST",
      });
      const data = await res.json();
      alert(
        `Analysis complete!\nClassification: ${data.classification}\nLearnings extracted: ${data.learnings_extracted}`
      );
      fetchLearnings();
    } catch {
      alert("Analysis failed. Make sure the post has metrics.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = async () => {
    if (!post) return;
    await navigator.clipboard.writeText(post.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Derived data ───────────────────────────────────────────── */

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));
  const pillar = post?.pillar_id ? pillarMap[post.pillar_id] : null;

  const tags: string[] = (() => {
    try {
      return JSON.parse(post?.topic_tags || "[]");
    } catch {
      return [];
    }
  })();

  // Build chart data from metrics (chronological order)
  const chartData = [...metrics]
    .reverse()
    .map((m) => ({
      date: m.snapshot_type
        ? SNAPSHOT_LABELS[m.snapshot_type] || m.snapshot_type
        : new Date(m.snapshot_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
      engagement: +(m.engagement_score * 100).toFixed(2),
      impressions: m.impressions,
    }));

  /* ── Loading & Error states ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          href="/linkedin/posts"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Posts
        </Link>
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {error || "Post not found"}
          </p>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/linkedin/posts"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Posts
      </Link>

      {/* ── Post Detail Card ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {pillar?.color && (
          <div className="h-1.5" style={{ backgroundColor: pillar.color }} />
        )}

        <div className="p-6 space-y-5">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                post.author === "me"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <User className="w-3 h-3 inline mr-1 -mt-0.5" />
              {post.author === "me" ? "My post" : post.author}
            </span>

            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                TYPE_COLORS[post.post_type] || "bg-gray-100 text-gray-600"
              }`}
            >
              {post.post_type}
            </span>

            {pillar && (
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: `${pillar.color}15`,
                  color: pillar.color,
                }}
              >
                {pillar.name}
              </span>
            )}

            {post.cta_type !== "none" && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-100 text-amber-700">
                CTA: {post.cta_type}
              </span>
            )}

            {post.posted_at && (
              <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(post.posted_at).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* Hook line */}
          {post.hook_line && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                Hook Line
              </p>
              <p className="text-sm font-medium text-gray-800 italic leading-relaxed">
                &ldquo;{post.hook_line}&rdquo;
              </p>
            </div>
          )}

          {/* Full content */}
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {post.word_count} words
            </span>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                View on LinkedIn
              </a>
            )}
            <span className="ml-auto">
              Post #{post.id}
            </span>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowMetricsForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <BarChart3 className="w-4 h-4" />
          {showMetricsForm ? "Hide Metrics Form" : "Add Metrics"}
        </button>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </button>

        {post.post_url && (
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open on LinkedIn
          </a>
        )}

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "Copied!" : "Copy Content"}
        </button>
      </div>

      {/* ── Inline Metrics Form ───────────────────────────────── */}
      {showMetricsForm && (
        <MetricsForm
          postId={post.id}
          author={post.author}
          onSubmit={handleAddMetrics}
          onCancel={() => setShowMetricsForm(false)}
        />
      )}

      {/* ── LinkedIn Preview Panel ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-gray-400" />
          LinkedIn Preview
        </h2>
        <LinkedInPreview
          authorName={post.author === "me" ? "You" : post.author}
          authorInitials={post.author === "me" ? "ME" : post.author.substring(0, 2).toUpperCase()}
          content={post.content}
          timestamp={post.posted_at ? new Date(post.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Draft"}
        />
      </div>

      {/* ── Metrics Timeline ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          Metrics Timeline
          {metrics.length > 0 && (
            <span className="text-xs font-normal text-gray-400 ml-2">
              {metrics.length} snapshot{metrics.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>

        {metrics.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            No metrics recorded yet. Click &ldquo;Add Metrics&rdquo; to add a
            snapshot.
          </div>
        ) : (
          <>
            {/* Chart */}
            {chartData.length > 1 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#3949AB"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      stroke="#3949AB"
                      unit="%"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      stroke="#3949AB"
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                      formatter={(value: number | undefined, name?: string) => {
                        const v = value ?? 0;
                        if (name === "engagement")
                          return [`${v}%`, "Engagement"];
                        return [v.toLocaleString(), "Impressions"];
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="engagement"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#6366f1" }}
                      name="engagement"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="impressions"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: "#8b5cf6" }}
                      name="impressions"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-indigo-500 rounded inline-block" />
                    Engagement %
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-purple-500 rounded inline-block border-dashed" />
                    Impressions
                  </span>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      Snapshot
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Eye className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Impr.
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Users className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Reach
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Heart className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      React
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <MessageCircle className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Comm
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Repeat2 className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Reps
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Bookmark className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Saves
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      <Send className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Sends
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-2">
                      Eng %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        {m.snapshot_type ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">
                            {SNAPSHOT_LABELS[m.snapshot_type] ||
                              m.snapshot_type}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-gray-500">
                        {new Date(m.snapshot_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs font-medium text-gray-700">
                        {m.impressions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.members_reached.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.likes.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.comments.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.reposts.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.saves.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-600">
                        {m.sends.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="text-xs font-bold text-indigo-600">
                          {(m.engagement_score * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Learnings Section ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-gray-400" />
          Learnings
          {learnings.length > 0 && (
            <span className="text-xs font-normal text-gray-400 ml-2">
              {learnings.length} insight{learnings.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>

        {learnings.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            No learnings yet. Click &ldquo;Analyze with AI&rdquo; to extract
            insights from this post.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {learnings.map((learning) => (
              <div
                key={learning.id}
                className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3"
              >
                <p className="text-sm text-gray-800 leading-relaxed">
                  {learning.insight}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">
                    {learning.category}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      IMPACT_STYLES[learning.impact] ||
                      "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {learning.impact}
                  </span>
                  {learning.times_confirmed > 1 && (
                    <span className="text-xs text-gray-400">
                      Confirmed {learning.times_confirmed}x
                    </span>
                  )}
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0 w-16">
                    Confidence
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{
                        width: `${Math.min(100, learning.confidence * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 shrink-0">
                    {(learning.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyzing overlay */}
      {analyzing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
            <span className="text-sm text-gray-700">
              Analyzing post with AI...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
