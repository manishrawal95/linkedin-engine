"use client";

import { memo } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  BarChart3,
  ExternalLink,
  Trash2,
  Sparkles,
  Pencil,
  Users,
  UserPlus,
  Bookmark,
  Send,
  Clock,
} from "lucide-react";

interface Post {
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
  topic_tags: string;
}

interface ExpandedMetrics {
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
}

interface PostCardProps {
  post: Post;
  pillarName?: string;
  pillarColor?: string;
  latestMetrics?: ExpandedMetrics | null;
  onAddMetrics: (postId: number) => void;
  onAnalyze: (postId: number) => void;
  onEdit: (postId: number) => void;
  onDelete: (postId: number) => void;
}

const SNAPSHOT_LABELS: Record<string, string> = {
  "12h": "12 hours",
  "24h": "24 hours",
  "48h": "48 hours",
  "1w": "1 week",
  later: "1w+",
};

const PostCard = memo(function PostCard({
  post,
  pillarName,
  pillarColor,
  latestMetrics,
  onAddMetrics,
  onAnalyze,
  onEdit,
  onDelete,
}: PostCardProps) {
  const tags = (() => {
    try {
      return JSON.parse(post.topic_tags || "[]");
    } catch {
      return [];
    }
  })();

  const typeColors: Record<string, string> = {
    text: "bg-gray-100 text-gray-600",
    carousel: "bg-orange-100 text-orange-700",
    image: "bg-emerald-100 text-emerald-700",
    poll: "bg-cyan-100 text-cyan-700",
    video: "bg-red-100 text-red-700",
    article: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Top color bar */}
      {pillarColor && (
        <div className="h-1" style={{ backgroundColor: pillarColor }} />
      )}

      <div className="p-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Header badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${post.author === "me" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                {post.author === "me" ? "My post" : post.author}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${typeColors[post.post_type] || "bg-gray-100 text-gray-600"}`}>
                {post.post_type}
              </span>
              {pillarName && (
                <span
                  className="text-xs font-medium px-2 py-1 rounded-md"
                  style={{
                    backgroundColor: `${pillarColor}15`,
                    color: pillarColor,
                  }}
                >
                  {pillarName}
                </span>
              )}
              {post.hook_style && (
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-purple-100 text-purple-700">
                  {post.hook_style}
                </span>
              )}
              {post.cta_type !== "none" && (
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-700">
                  {post.cta_type}
                </span>
              )}
              {post.posted_at && (
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(post.posted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>

            {/* Content preview */}
            <p className="text-sm text-gray-800 leading-relaxed line-clamp-3 mb-3">
              {post.content}
            </p>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded Metrics */}
            {latestMetrics && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {/* Snapshot type badge */}
                {latestMetrics.snapshot_type && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">
                      Snapshot at {SNAPSHOT_LABELS[latestMetrics.snapshot_type] || latestMetrics.snapshot_type}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  <MetricPill icon={Eye} label="Impressions" value={latestMetrics.impressions} />
                  <MetricPill icon={Users} label="Reached" value={latestMetrics.members_reached} />
                  <MetricPill icon={Heart} label="Reactions" value={latestMetrics.likes} />
                  <MetricPill icon={MessageCircle} label="Comments" value={latestMetrics.comments} />
                  <MetricPill icon={Repeat2} label="Reposts" value={latestMetrics.reposts} />
                  <MetricPill icon={Bookmark} label="Saves" value={latestMetrics.saves} />
                  <MetricPill icon={Send} label="Sends" value={latestMetrics.sends} />
                  <MetricPill icon={UserPlus} label="Followers" value={latestMetrics.followers_gained} accent />
                  <MetricPill icon={Users} label="Profile Views" value={latestMetrics.profile_viewers} accent />
                </div>

                {/* Engagement score bar */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 shrink-0 w-28">Engagement</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${Math.min(100, latestMetrics.engagement_score * 100 * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 shrink-0">
                    {(latestMetrics.engagement_score * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Word count */}
            <div className="mt-2 text-xs text-gray-400">
              {post.word_count} words
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddMetrics(post.id); }}
              className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
              title="Update metrics"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(post.id); }}
              className="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
              title="Analyze with AI"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(post.id); }}
              className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
              title="Edit post"
            >
              <Pencil className="w-4 h-4" />
            </button>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="Open on LinkedIn"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

function MetricPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs ${accent ? "text-purple-600" : "text-gray-600"}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div>
        <span className="font-semibold">{value.toLocaleString()}</span>
        <span className="text-gray-400 ml-1 hidden sm:inline">{label}</span>
      </div>
    </div>
  );
}

PostCard.displayName = "PostCard";
export default PostCard;
