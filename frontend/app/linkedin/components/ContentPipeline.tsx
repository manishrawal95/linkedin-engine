"use client";

import { memo } from "react";
import Link from "next/link";
import { Lightbulb, PenTool, Calendar, Send, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { useApi } from "@/hooks/use-api";
import type { Idea, DashboardStats } from "@/types/linkedin";

interface IdeasResponse {
  ideas: Idea[];
  total: number;
}

interface CalendarCountResponse {
  entries: Array<{ status: string }>;
}

interface PipelineStage {
  label: string;
  count: number;
  icon: React.ReactNode;
  href: string;
  color: string;
  bgColor: string;
}

const ContentPipeline = memo(function ContentPipeline() {
  const { data: ideasData, loading: ideasLoading, error: ideasError, refetch: refetchIdeas } =
    useApi<IdeasResponse>("/api/linkedin/ideas");
  const { data: statsData, loading: statsLoading, error: statsError, refetch: refetchStats } =
    useApi<DashboardStats>("/api/linkedin/dashboard/stats");
  const { data: calendarData, loading: calendarLoading } =
    useApi<CalendarCountResponse>("/api/linkedin/calendar");

  const isLoading = ideasLoading || statsLoading || calendarLoading;
  const hasError = ideasError ?? statsError;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <Skeleton className="h-12 flex-1 rounded-xl" />
              {i < 3 && <Skeleton className="w-4 h-4 rounded shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
        <ErrorCard
          message={hasError}
          onRetry={() => { refetchIdeas(); refetchStats(); }}
        />
      </div>
    );
  }

  const approvedIdeas = (ideasData?.ideas ?? []).filter(
    (i) => i.status === "pending" || i.status === "approved"
  ).length;
  const totalDrafts = statsData?.total_drafts ?? 0;
  const scheduledCount = (calendarData?.entries ?? []).filter(
    (e) => e.status === "scheduled"
  ).length;
  const totalPosted = statsData?.total_posts ?? 0;

  const stages: PipelineStage[] = [
    {
      label: "Ideas",
      count: approvedIdeas,
      icon: <Lightbulb className="w-4 h-4" />,
      href: "/linkedin/ideas",
      color: "text-amber-700",
      bgColor: "bg-amber-50 border-amber-200/60",
    },
    {
      label: "Drafts",
      count: totalDrafts,
      icon: <PenTool className="w-4 h-4" />,
      href: "/linkedin/drafts",
      color: "text-blue-700",
      bgColor: "bg-blue-50 border-blue-200/60",
    },
    {
      label: "Scheduled",
      count: scheduledCount,
      icon: <Calendar className="w-4 h-4" />,
      href: "/linkedin/calendar",
      color: "text-violet-700",
      bgColor: "bg-violet-50 border-violet-200/60",
    },
    {
      label: "Posted",
      count: totalPosted,
      icon: <Send className="w-4 h-4" />,
      href: "/linkedin/posts",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50 border-emerald-200/60",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
      <h2 className="text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Send className="w-4 h-4 text-stone-400" />
        Content Pipeline
      </h2>

      {/* Desktop: horizontal flow */}
      <div className="hidden sm:flex items-center gap-1">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-1 flex-1 min-w-0">
            <Link
              href={stage.href}
              className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 hover:shadow-sm ${stage.bgColor}`}
            >
              <div className={stage.color}>{stage.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-stone-400 font-medium leading-none">{stage.label}</p>
                <p className={`text-lg font-semibold leading-tight mt-0.5 ${stage.color}`}>
                  {stage.count}
                </p>
              </div>
            </Link>
            {i < stages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        {stages.map((stage) => (
          <Link
            key={stage.label}
            href={stage.href}
            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 ${stage.bgColor}`}
          >
            <div className={stage.color}>{stage.icon}</div>
            <div>
              <p className="text-[11px] text-stone-400 font-medium leading-none">{stage.label}</p>
              <p className={`text-lg font-semibold leading-tight mt-0.5 ${stage.color}`}>
                {stage.count}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

ContentPipeline.displayName = "ContentPipeline";
export default ContentPipeline;
