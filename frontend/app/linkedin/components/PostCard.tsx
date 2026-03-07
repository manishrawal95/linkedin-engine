"use client";

import { memo } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  BarChart3,
  TrendingUp,
  ExternalLink,
  Trash2,
  Search,
  Pencil,
  Users,
  UserPlus,
  Bookmark,
  Send,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Post, ExpandedMetrics } from "@/types/linkedin";

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

function formatElapsed(snapshotAt: string, postedAt: string | null): string | null {
  if (!postedAt) return null;
  const toUTC = (s: string) => /[Zz]|[+-]\d{2}:\d{2}$/.test(s) ? new Date(s) : new Date(s + "Z");
  const ms = toUTC(snapshotAt).getTime() - toUTC(postedAt).getTime();
  if (isNaN(ms) || ms < 0) return null;
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

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

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden hover:shadow-[var(--shadow-card-hover)] transition-all duration-200">
      {/* Top color bar */}
      {pillarColor && (
        <div className="h-1" style={{ backgroundColor: pillarColor }} />
      )}

      <div className="p-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Header badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {post.classification === "hit" && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-50">
                  Hit
                </Badge>
              )}
              {post.classification === "miss" && (
                <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200/60 hover:bg-red-50">
                  Miss
                </Badge>
              )}
              {post.classification === "average" && (
                <Badge variant="secondary" className="bg-stone-100 text-stone-500 border-stone-200/60 hover:bg-stone-100">
                  Avg
                </Badge>
              )}
              <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-stone-200/60 hover:bg-stone-100">
                {post.post_type}
              </Badge>
              {pillarName && (
                <Badge
                  variant="secondary"
                  className="border-transparent hover:bg-transparent"
                  style={{ backgroundColor: `${pillarColor}18`, color: pillarColor }}
                >
                  {pillarName}
                </Badge>
              )}
              {post.hook_style && (
                <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-stone-200/60 hover:bg-stone-100">
                  {post.hook_style}
                </Badge>
              )}
              {post.cta_type && post.cta_type !== "none" && (
                <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-stone-200/60 hover:bg-stone-100">
                  {post.cta_type}
                </Badge>
              )}
              {post.posted_at && (
                <span className="text-[11px] text-stone-400 ml-auto">
                  {new Date(post.posted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>

            {/* Content preview */}
            <p className="text-sm text-stone-700 leading-relaxed line-clamp-3 mb-3">
              {post.content}
            </p>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded Metrics */}
            {latestMetrics && (
              <div className="mt-3 pt-3 border-t border-stone-100">
                {formatElapsed(latestMetrics.snapshot_at, post.posted_at) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3 h-3 text-stone-400" />
                    <span className="text-xs text-stone-400">
                      Snapshot at {formatElapsed(latestMetrics.snapshot_at, post.posted_at)} after posting
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

                {latestMetrics.engagement_score > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-700 font-medium mt-2">
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold">{(latestMetrics.engagement_score * 100).toFixed(2)}%</span>
                    <span className="text-stone-400 hidden sm:inline">Engagement</span>
                  </div>
                )}
              </div>
            )}

            {/* Word count */}
            <div className="mt-2 text-xs text-stone-400">
              {post.word_count} words
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl"
              onClick={(e) => { e.stopPropagation(); onAddMetrics(post.id); }}
              title="Update metrics"
              aria-label="Update metrics"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl"
              onClick={(e) => { e.stopPropagation(); onAnalyze(post.id); }}
              title="Analyze with AI"
              aria-label="Analyze with AI"
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl"
              onClick={(e) => { e.stopPropagation(); onEdit(post.id); }}
              title="Edit post"
              aria-label="Edit post"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {post.post_url && (
              <a
                href={post.post_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
                title="Open on LinkedIn"
                aria-label="Open on LinkedIn"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
              onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
              title="Delete"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
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
    <div className={`flex items-center gap-1.5 text-xs ${accent ? "text-stone-700 font-medium" : "text-stone-600"}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div>
        <span className="font-semibold">{value.toLocaleString()}</span>
        <span className="text-stone-400 ml-1 hidden sm:inline">{label}</span>
      </div>
    </div>
  );
}

PostCard.displayName = "PostCard";
export default PostCard;
