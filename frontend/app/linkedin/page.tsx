"use client";

import { memo, useEffect, useState, useCallback } from "react";
import {
  FileText,
  TrendingUp,
  PenTool,
  Eye,
  Heart,
  Users,
  Zap,
  BarChart3,
  Target,
} from "lucide-react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import PlaybookView from "./components/PlaybookView";
import GoalTracker from "./components/GoalTracker";
import StrategyReviewCard from "./components/StrategyReviewCard";
import QueueWidget from "./components/QueueWidget";
import LinkedInAuthStatus from "./components/LinkedInAuthStatus";
import GrowthEngineBanner from "./components/GrowthEngineBanner";
import PendingIdeasReview from "./components/PendingIdeasReview";
import ContentPipeline from "./components/ContentPipeline";
import { HeatmapGrid } from "./components/HeatmapGrid";
import { QuickCaptureBody } from "./components/QuickCaptureBody";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { chartAxisStyle, chartGridStyle, chartTooltipStyle, CHART_COLORS } from "@/lib/chart-theme";
import type { DashboardStats, PillarBalance, HeatmapEntry, PostIdea } from "@/types/linkedin";

const Dashboard = memo(function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pillarBalance, setPillarBalance] = useState<PillarBalance[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [captureIdea, setCaptureIdea] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [showIdeas, setShowIdeas] = useState(false);
  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, pillarRes, heatmapRes] = await Promise.all([
        fetch("/api/linkedin/dashboard/stats"),
        fetch("/api/linkedin/dashboard/pillar-balance"),
        fetch("/api/linkedin/dashboard/heatmap"),
      ]);
      const [statsData, pillarData, heatmapData] = await Promise.all([
        statsRes.json(), pillarRes.json(), heatmapRes.json(),
      ]);
      setStats(statsData);
      setPillarBalance(pillarData.pillars || []);
      setHeatmap(heatmapData.heatmap || []);
    } catch (err) {
      console.error("Dashboard.fetchAll: dashboard data fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const generateWithTopic = async (topic: string) => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setCapturing(true);
    setCaptureError(null);
    setCaptureSuccess(false);
    try {
      const res = await fetch("/api/linkedin/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, num_variants: 1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Generation failed (${res.status})`);
      }
      setCaptureSuccess(true);
      setCaptureIdea("");
      setTimeout(() => setCaptureSuccess(false), 5000);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  const handleGenerate = () => generateWithTopic(captureIdea);

  const handleFetchIdeas = async () => {
    if (showIdeas && ideas.length > 0) { setShowIdeas(false); return; }
    setShowIdeas(true);
    setLoadingIdeas(true);
    try {
      const body = captureIdea.trim() ? { topic_hint: captureIdea.trim() } : {};
      const res = await fetch("/api/linkedin/dashboard/post-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setIdeas((await res.json()).ideas || []); }
    } catch (err) {
      console.error("Dashboard.handleFetchIdeas: POST /api/linkedin/dashboard/post-ideas failed:", err);
    } finally {
      setLoadingIdeas(false);
    }
  };

  const handleIdeaClick = (idea: PostIdea) => {
    setShowIdeas(false);
    generateWithTopic(idea.topic);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
      </div>
    );
  }

  const engagementTrend = [...(stats?.recent_posts || [])]
    .reverse()
    .filter((post) => post.posted_at)
    .map((post) => ({
      date: new Date(post.posted_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      engagement: post.engagement_score ? +(post.engagement_score * 100).toFixed(2) : 0,
      impressions: post.impressions || 0,
    }));

  const totalPillars = pillarBalance.reduce((sum, p) => sum + p.post_count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">Your LinkedIn content overview</p>
        </div>
        <LinkedInAuthStatus />
      </div>

      {/* Growth Engine Status Banner */}
      <GrowthEngineBanner />

      {/* Quick Capture + Pending Ideas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-stone-400" />
            Quick Capture
          </h2>
          <QuickCaptureBody
            captureIdea={captureIdea}
            setCaptureIdea={(v) => { setCaptureIdea(v); setShowIdeas(false); setIdeas([]); }}
            captureError={captureError}
            captureSuccess={captureSuccess}
            capturing={capturing}
            onGenerate={handleGenerate}
            onFetchIdeas={handleFetchIdeas}
            showIdeas={showIdeas}
            loadingIdeas={loadingIdeas}
            ideas={ideas}
            onIdeaClick={handleIdeaClick}
          />
        </div>
        <PendingIdeasReview />
      </div>

      {/* Content Pipeline */}
      <ContentPipeline />

      {/* Queue + Actions row */}
      <div className="space-y-4">
        <QueueWidget />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<FileText className="w-5 h-5 text-stone-600" />} label="Total Posts" value={stats?.total_posts ?? 0} trendPct={stats?.posts_trend_pct ?? null} trendLabel="vs last month" />
        <StatCard icon={<Eye className="w-5 h-5 text-stone-600" />} label="Total Impressions" value={formatNumber(stats?.total_impressions ?? 0)} trendPct={stats?.impressions_trend_pct ?? null} trendLabel="vs last month" />
        <StatCard icon={<Heart className="w-5 h-5 text-stone-600" />} label="Avg Likes" value={Math.round(stats?.avg_likes ?? 0)} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-stone-600" />} label="Avg Engagement" value={`${((stats?.avg_engagement_score ?? 0) * 100).toFixed(2)}%`} />
        <StatCard icon={<PenTool className="w-5 h-5 text-stone-600" />} label="Active Drafts" value={stats?.total_drafts ?? 0} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Engagement Trend (Recent Posts)" icon={TrendingUp} className="lg:col-span-2">
          {engagementTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={engagementTrend}>
                <CartesianGrid {...chartGridStyle} />
                <defs>
                  <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={chartAxisStyle} stroke={chartGridStyle.stroke} />
                <YAxis tick={chartAxisStyle} stroke={chartGridStyle.stroke} unit="%" />
                <Tooltip {...chartTooltipStyle} formatter={(value) => [`${value}%`, "Engagement"]} />
                <Area type="monotone" dataKey="engagement" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#engGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-stone-400">
              Add at least 2 posts with metrics to see trends
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pillar Balance" icon={Users}>
          {pillarBalance.length > 0 && totalPillars > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pillarBalance} dataKey="post_count" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pillarBalance.map((p) => <Cell key={p.id} fill={p.color} />)}
                  </Pie>
                  <Tooltip {...chartTooltipStyle} formatter={(value, name) => [`${value} posts`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {pillarBalance.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                    <span className="text-stone-400">({Math.round((p.post_count / totalPillars) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-stone-400">
              Create pillars and tag posts to see balance
            </div>
          )}
        </SectionCard>
      </div>

      {/* Heatmap + Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Best Time to Post" icon={BarChart3}>
          {heatmap.length > 0 ? (
            <HeatmapGrid data={heatmap} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-stone-400">
              Post at different times to discover your best slots
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Posts" icon={FileText}>
          {stats?.recent_posts?.length ? (
            <div className="space-y-2">
              {stats.recent_posts.map((post) => (
                <a key={post.id} href={`/linkedin/posts/${post.id}`} className="block p-3 rounded-xl bg-stone-50 border border-stone-200/60 hover:bg-stone-100 hover:border-stone-200 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm text-stone-700 line-clamp-2 leading-relaxed flex-1">{post.content}</p>
                    {post.classification && (
                      <Badge variant="secondary" className={`shrink-0 text-[10px] ${post.classification === "hit" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : post.classification === "miss" ? "bg-red-50 text-red-600 border-red-200/60" : "bg-stone-100 text-stone-600 border-stone-200/60"} hover:bg-transparent`}>
                        {post.classification}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-stone-500 flex-wrap">
                    {post.impressions != null && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.impressions.toLocaleString()}</span>}
                    {post.likes != null && <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likes}</span>}
                    {post.saves != null && post.saves > 0 && <span className="flex items-center gap-1 font-medium text-amber-600">{post.saves} saves</span>}
                    {post.comments != null && post.comments > 0 && <span className="flex items-center gap-1">{post.comments} comments</span>}
                    {post.engagement_score != null && <span className="ml-auto font-semibold text-stone-700">{(post.engagement_score * 100).toFixed(2)}%</span>}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-stone-400">
              No posts yet. Add your first post in the Posts section.
            </div>
          )}
        </SectionCard>
      </div>

      {/* Strategy Review */}
      <StrategyReviewCard />

      {/* Playbook + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaybookView />
        <SectionCard title="Goals" icon={Target}>
          <GoalTracker />
        </SectionCard>
      </div>
    </div>
  );
});

Dashboard.displayName = "Dashboard";
export default Dashboard;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
