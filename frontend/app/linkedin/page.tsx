"use client";

import { memo, useEffect, useState, useCallback } from "react";
import {
  FileText,
  TrendingUp,
  PenTool,
  Target,
  BarChart3,
  Eye,
  Heart,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import PlaybookView from "./components/PlaybookView";
import GoalTracker from "./components/GoalTracker";

interface DashboardStats {
  total_posts: number;
  total_drafts: number;
  avg_engagement_score: number;
  total_impressions: number;
  avg_likes: number;
  recent_posts: Array<{
    id: number;
    content: string;
    posted_at: string;
    impressions: number | null;
    members_reached: number | null;
    likes: number | null;
    comments: number | null;
    reposts: number | null;
    saves: number | null;
    engagement_score: number | null;
    snapshot_type: string | null;
  }>;
}

interface PillarBalance {
  id: number;
  name: string;
  color: string;
  post_count: number;
}

interface HeatmapEntry {
  day_of_week: string;
  hour: number;
  avg_engagement: number;
  post_count: number;
}

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Dashboard = memo(function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pillarBalance, setPillarBalance] = useState<PillarBalance[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, pillarRes, heatmapRes] = await Promise.all([
        fetch("/api/linkedin/dashboard/stats"),
        fetch("/api/linkedin/dashboard/pillar-balance"),
        fetch("/api/linkedin/dashboard/heatmap"),
      ]);
      const [statsData, pillarData, heatmapData] = await Promise.all([
        statsRes.json(),
        pillarRes.json(),
        heatmapRes.json(),
      ]);
      setStats(statsData);
      setPillarBalance(pillarData.pillars || []);
      setHeatmap(heatmapData.heatmap || []);
    } catch {
      // backend may not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Build engagement trend data from recent posts (reversed for chronological order)
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
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          label="Total Posts"
          value={stats?.total_posts ?? 0}
          bg="bg-blue-50"
          border="border-blue-100"
        />
        <StatCard
          icon={<Eye className="w-5 h-5 text-cyan-600" />}
          label="Total Impressions"
          value={formatNumber(stats?.total_impressions ?? 0)}
          bg="bg-cyan-50"
          border="border-cyan-100"
        />
        <StatCard
          icon={<Heart className="w-5 h-5 text-pink-600" />}
          label="Avg Reactions"
          value={Math.round(stats?.avg_likes ?? 0)}
          bg="bg-pink-50"
          border="border-pink-100"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          label="Avg Engagement"
          value={`${((stats?.avg_engagement_score ?? 0) * 100).toFixed(2)}%`}
          bg="bg-green-50"
          border="border-green-100"
        />
        <StatCard
          icon={<PenTool className="w-5 h-5 text-amber-600" />}
          label="Active Drafts"
          value={stats?.total_drafts ?? 0}
          bg="bg-amber-50"
          border="border-amber-100"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engagement trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            Engagement Trend (Recent Posts)
          </h2>
          {engagementTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={engagementTrend}>
                <defs>
                  <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#111827" }} stroke="#3949AB" />
                <YAxis tick={{ fontSize: 11, fill: "#111827" }} stroke="#3949AB" unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(value) => [`${value}%`, "Engagement"]}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#engGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              Add at least 2 posts with metrics to see trends
            </div>
          )}
        </div>

        {/* Pillar balance donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Pillar Balance
          </h2>
          {pillarBalance.length > 0 && totalPillars > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pillarBalance}
                    dataKey="post_count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {pillarBalance.map((p) => (
                      <Cell key={p.id} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(value, name) => [`${value} posts`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {pillarBalance.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                    <span className="text-gray-400">
                      ({totalPillars > 0 ? Math.round((p.post_count / totalPillars) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
              Create pillars and tag posts to see balance
            </div>
          )}
        </div>
      </div>

      {/* Heatmap + Recent Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posting heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            Best Time to Post
          </h2>
          {heatmap.length > 0 ? (
            <HeatmapGrid data={heatmap} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
              Post at different times to discover your best slots
            </div>
          )}
        </div>

        {/* Recent posts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Recent Posts
          </h2>
          {stats?.recent_posts?.length ? (
            <div className="space-y-3">
              {stats.recent_posts.map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                    {post.content}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                    {post.impressions != null && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {post.impressions.toLocaleString()}
                      </span>
                    )}
                    {post.likes != null && (
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {post.likes}
                      </span>
                    )}
                    {post.comments != null && (
                      <span className="flex items-center gap-1 font-medium text-indigo-600">
                        {post.comments} comments
                      </span>
                    )}
                    {post.engagement_score != null && (
                      <span className="ml-auto font-semibold text-indigo-600">
                        {(post.engagement_score * 100).toFixed(2)}% eng
                      </span>
                    )}
                    {post.snapshot_type && (
                      <span className="text-gray-400">@{post.snapshot_type}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
              No posts yet. Add your first post in the Posts section.
            </div>
          )}
        </div>
      </div>

      {/* Playbook + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaybookView />
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            Goals
          </h2>
          <GoalTracker />
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = "Dashboard";
export default Dashboard;

/* ── Helper Components ─────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  bg,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
  border: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${border} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function HeatmapGrid({ data }: { data: HeatmapEntry[] }) {
  // Build a map: day -> hour -> engagement
  const map = new Map<string, Map<number, number>>();
  let maxEng = 0;
  for (const entry of data) {
    if (!map.has(entry.day_of_week)) map.set(entry.day_of_week, new Map());
    map.get(entry.day_of_week)!.set(entry.hour, entry.avg_engagement);
    if (entry.avg_engagement > maxEng) maxEng = entry.avg_engagement;
  }

  // Show hours 6-22
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[400px]">
        {/* Hour labels */}
        <div className="flex gap-0.5 mb-1 ml-10">
          {hours.map((h, i) => (
            <div key={h} className="text-[10px] text-gray-400 w-5 text-center">
              {i % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {DAYS_ORDER.map((day, di) => {
          const dayMap = map.get(day) || new Map();
          return (
            <div key={day} className="flex items-center gap-0.5 mb-0.5">
              <span className="text-[10px] text-gray-500 w-10 text-right pr-2">{DAYS_SHORT[di]}</span>
              {hours.map((h) => {
                const eng = dayMap.get(h) || 0;
                const intensity = maxEng > 0 ? eng / maxEng : 0;
                return (
                  <div
                    key={h}
                    className="w-5 h-5 rounded-sm"
                    style={{
                      backgroundColor: intensity > 0
                        ? `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`
                        : "#f3f4f6",
                    }}
                    title={`${DAYS_SHORT[di]} ${h}:00 — ${eng > 0 ? (eng * 100).toFixed(2) + "% eng" : "no data"}`}
                  />
                );
              })}
            </div>
          );
        })}
        <div className="flex items-center gap-2 mt-2 ml-10">
          <span className="text-[10px] text-gray-400">Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div
              key={v}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: v > 0 ? `rgba(99, 102, 241, ${0.15 + v * 0.85})` : "#f3f4f6" }}
            />
          ))}
          <span className="text-[10px] text-gray-400">More</span>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
