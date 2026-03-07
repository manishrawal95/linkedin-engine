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
  Search as SearchIcon,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CHART_COLORS,
  chartAxisStyle,
  chartGridStyle,
  chartTooltipStyle,
} from "@/lib/chart-theme";
import type { Post, MetricSnapshot, Pillar, Learning } from "@/types/linkedin";

/* ── Constants ────────────────────────────────────────────────── */

function formatElapsed(snapshotAt: string, postedAt: string | null): string | null {
  if (!postedAt) return null;
  // Treat both timestamps as UTC — append "Z" only if no timezone info present
  const toUTC = (s: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? new Date(s) : new Date(s + "Z");
  const ms = toUTC(snapshotAt).getTime() - toUTC(postedAt).getTime();
  if (ms < 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

const TYPE_COLORS: Record<string, string> = {
  text: "bg-stone-100 text-stone-600",
  carousel: "bg-orange-100 text-orange-700",
  "personal image": "bg-emerald-100 text-emerald-700",
  "social proof image": "bg-teal-100 text-teal-700",
  image: "bg-emerald-100 text-emerald-700",
  poll: "bg-cyan-100 text-cyan-700",
  video: "bg-red-100 text-red-700",
  article: "bg-blue-100 text-blue-700",
};

const IMPACT_STYLES: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-stone-100 text-stone-600",
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
  const [analyzeResult, setAnalyzeResult] = useState<{ classification: string; learnings_extracted: number } | null>(null);
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
    } catch (err) {
      console.error("PostDetailPage.fetchPillars: GET /api/linkedin/pillars failed:", err);
    }
  }, []);

  const fetchLearnings = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/learnings");
      const data = await res.json();
      const all: Learning[] = data.learnings || [];
      setLearnings(all.filter((l) => l.post_id === Number(id)));
    } catch (err) {
      console.error("PostDetailPage.fetchLearnings: GET /api/linkedin/learnings failed:", err);
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
    const res = await fetch(`/api/linkedin/posts/${postId}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return; // keep form open on error
    setShowMetricsForm(false);
    fetchPost();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch(`/api/linkedin/analyze/${id}`, {
        method: "POST",
      });
      const data = await res.json();
      setAnalyzeResult({ classification: data.classification, learnings_extracted: data.learnings_extracted });
      fetchLearnings();
      fetchPost();
    } catch (err) {
      console.error(`PostDetailPage.handleAnalyze: POST /api/linkedin/analyze/${id} failed:`, err);
      setAnalyzeResult(null);
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
      date: formatElapsed(m.snapshot_at, post?.posted_at ?? null) ??
        new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(m.snapshot_at) ? m.snapshot_at : m.snapshot_at + "Z").toLocaleDateString("en-US", {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href="/linkedin/posts"
          className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Posts
        </Link>
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/60">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-stone-400" />
          </div>
          <p className="text-sm font-medium text-stone-600">
            {error || "Post not found"}
          </p>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        href="/linkedin/posts"
        className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Posts
      </Link>

      {/* ── Post Detail Card ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        {pillar?.color && (
          <div className="h-1.5" style={{ backgroundColor: pillar.color }} />
        )}

        <div className="p-6 space-y-5">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="ghost"
              className={
                post.author === "me"
                  ? "bg-stone-100 text-stone-700"
                  : "bg-stone-100 text-stone-600"
              }
            >
              <User className="w-3 h-3 mr-1 -mt-0.5" />
              {post.author === "me" ? "My post" : post.author}
            </Badge>

            <Badge
              variant="ghost"
              className={TYPE_COLORS[post.post_type] || "bg-stone-100 text-stone-600"}
            >
              {post.post_type}
            </Badge>

            {pillar && (
              <Badge
                variant="ghost"
                className="rounded-full"
                style={{
                  backgroundColor: `${pillar.color}15`,
                  color: pillar.color,
                }}
              >
                {pillar.name}
              </Badge>
            )}

            {post.cta_type !== "none" && (
              <Badge variant="ghost" className="bg-amber-100 text-amber-700">
                CTA: {post.cta_type}
              </Badge>
            )}

            {post.classification === "hit" && (
              <Badge variant="ghost" className="bg-emerald-50 text-emerald-700">
                Hit
              </Badge>
            )}
            {post.classification === "average" && (
              <Badge variant="ghost" className="bg-stone-100 text-stone-500">
                Avg
              </Badge>
            )}
            {post.classification === "miss" && (
              <Badge variant="ghost" className="bg-red-50 text-red-600">
                Miss
              </Badge>
            )}

            {post.posted_at && (
              <span className="text-xs text-stone-400 ml-auto flex items-center gap-1">
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
            <div className="bg-gradient-to-r from-stone-50 to-stone-100/60 border border-stone-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">
                Hook Line
              </p>
              <p className="text-sm font-medium text-stone-800 italic leading-relaxed">
                &ldquo;{post.hook_line}&rdquo;
              </p>
            </div>
          )}

          {/* Full content */}
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
              {post.content}
            </p>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-stone-400 pt-2 border-t border-stone-200/60">
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {post.word_count} words
            </span>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-stone-600 hover:text-stone-700 transition-colors"
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
        <Button
          onClick={() => setShowMetricsForm((v) => !v)}
          className="rounded-xl active:scale-[0.98] transition-all"
        >
          <BarChart3 className="w-4 h-4" />
          {showMetricsForm ? "Hide Metrics Form" : "Add Metrics"}
        </Button>

        <Button
          onClick={handleAnalyze}
          disabled={analyzing}
          variant="secondary"
          className="rounded-xl active:scale-[0.98] transition-all"
        >
          <SearchIcon className="w-4 h-4" />
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </Button>

        {post.post_url && (
          <Button
            variant="outline"
            className="rounded-xl active:scale-[0.98] transition-all"
            asChild
          >
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4" />
              Open on LinkedIn
            </a>
          </Button>
        )}

        <Button
          onClick={handleCopy}
          variant="outline"
          className="rounded-xl active:scale-[0.98] transition-all"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "Copied!" : "Copy Content"}
        </Button>
      </div>

      {/* ── Analyze Result Card ───────────────────────────────── */}
      {analyzeResult && (
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
          analyzeResult.classification === "hit"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : analyzeResult.classification === "miss"
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          <span className="text-lg">
            {analyzeResult.classification === "hit" ? "🔥" : analyzeResult.classification === "miss" ? "❌" : "📊"}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold capitalize">{analyzeResult.classification}</p>
            <p className="text-xs opacity-80">{analyzeResult.learnings_extracted} learnings extracted</p>
          </div>
          <button onClick={() => setAnalyzeResult(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

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
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
        <h2 className="text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Eye className="w-4 h-4 text-stone-400" />
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
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-stone-400" />
          Metrics Timeline
          {metrics.length > 0 && (
            <span className="text-xs font-normal text-stone-400 ml-2">
              {metrics.length} snapshot{metrics.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>

        {metrics.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-sm text-stone-400">
              No metrics recorded yet. Click &ldquo;Add Metrics&rdquo; to add a
              snapshot.
            </p>
          </div>
        ) : (
          <>
            {/* Chart */}
            {chartData.length > 1 && (
              <div className="bg-stone-50 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid {...chartGridStyle} />
                    <XAxis
                      dataKey="date"
                      tick={chartAxisStyle}
                      stroke={CHART_COLORS.secondary}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={chartAxisStyle}
                      stroke={CHART_COLORS.secondary}
                      unit="%"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={chartAxisStyle}
                      stroke={CHART_COLORS.secondary}
                    />
                    <Tooltip
                      {...chartTooltipStyle}
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
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      dot={{ r: 4, fill: CHART_COLORS.primary }}
                      name="engagement"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="impressions"
                      stroke={CHART_COLORS.accent}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: CHART_COLORS.accent }}
                      name="impressions"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: CHART_COLORS.primary }} />
                    Engagement %
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded inline-block border-dashed" style={{ backgroundColor: CHART_COLORS.accent }} />
                    Impressions
                  </span>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      Snapshot
                    </th>
                    <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Eye className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Impr.
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Users className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Reach
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Heart className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      React
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <MessageCircle className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Comm
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Repeat2 className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Reps
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Bookmark className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Saves
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      <Send className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                      Sends
                    </th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider py-2 px-2">
                      Eng %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-stone-100 hover:bg-stone-50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        {formatElapsed(m.snapshot_at, post.posted_at) ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            {formatElapsed(m.snapshot_at, post.posted_at)}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-stone-500">
                        {new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(m.snapshot_at) ? m.snapshot_at : m.snapshot_at + "Z").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs font-medium text-stone-700">
                        {m.impressions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.members_reached.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.likes.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.comments.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.reposts.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.saves.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-stone-600">
                        {m.sends.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="text-xs font-semibold text-stone-700">
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
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-stone-400" />
          Learnings
          {learnings.length > 0 && (
            <span className="text-xs font-normal text-stone-400 ml-2">
              {learnings.length} insight{learnings.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>

        {learnings.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-8 h-8 text-stone-400" />
            </div>
            <p className="text-sm text-stone-400">
              No learnings yet. Click &ldquo;Analyze with AI&rdquo; to extract
              insights from this post.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {learnings.map((learning) => (
              <div
                key={learning.id}
                className="p-4 rounded-xl bg-stone-50 border border-stone-200/60 space-y-3"
              >
                <p className="text-sm text-stone-800 leading-relaxed">
                  {learning.insight}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="ghost" className="bg-blue-100 text-blue-700 rounded-md">
                    {learning.category}
                  </Badge>
                  <Badge
                    variant="ghost"
                    className={`rounded-md ${
                      IMPACT_STYLES[learning.impact] ||
                      "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {learning.impact}
                  </Badge>
                  {learning.times_confirmed > 1 && (
                    <span className="text-xs text-stone-400">
                      Confirmed {learning.times_confirmed}x
                    </span>
                  )}
                </div>

                <span className="text-xs text-stone-800">
                  {(learning.confidence * 100).toFixed(0)}% Confidence
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analyzing overlay */}
      {analyzing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-xl">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-stone-600" />
            <span className="text-sm text-stone-700">
              Analyzing post with AI...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
