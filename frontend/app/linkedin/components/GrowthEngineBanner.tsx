"use client";

import { memo } from "react";
import Link from "next/link";
import { User, Brain, Lightbulb, PenTool, CheckCircle2 } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import type { CreatorProfile, CreatorMemory, Idea } from "@/types/linkedin";

interface IdeasResponse {
  ideas: Idea[];
  total: number;
}

interface DraftsCountResponse {
  total_drafts: number;
}

const GrowthEngineBanner = memo(function GrowthEngineBanner() {
  const { data: profile, loading: profileLoading } = useApi<CreatorProfile>("/api/linkedin/profile");
  const { data: memory, loading: memoryLoading } = useApi<CreatorMemory>("/api/linkedin/memory");
  const { data: ideasData, loading: ideasLoading } = useApi<IdeasResponse>("/api/linkedin/ideas");
  const { data: draftsData, loading: draftsLoading } = useApi<DraftsCountResponse>("/api/linkedin/dashboard/stats");

  const profileFilled = Boolean(profile?.about_me?.trim());
  const memoryConfidence = memory?.confidence_overall ?? 0;
  const pendingIdeas = ideasData?.ideas?.filter((i) => i.status === "pending").length ?? 0;
  const draftsInQueue = draftsData?.total_drafts ?? 0;

  const isLoading = profileLoading || memoryLoading || ideasLoading || draftsLoading;

  if (isLoading) {
    return (
      <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-4">
        <div className="flex items-center gap-6 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 rounded-2xl border border-stone-200/60 px-4 py-3">
      <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto scrollbar-hide">
        {/* Profile completion */}
        <Link
          href="/linkedin/profile"
          className="flex items-center gap-2.5 shrink-0 group min-w-0 py-1"
        >
          <div className={`p-1.5 rounded-lg ${profileFilled ? "bg-emerald-100" : "bg-stone-200/80"}`}>
            {profileFilled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <User className="w-4 h-4 text-stone-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-stone-400 font-medium leading-none">Profile</p>
            <p className={`text-xs font-semibold leading-tight mt-0.5 group-hover:text-stone-900 transition-colors ${profileFilled ? "text-emerald-700" : "text-stone-600"}`}>
              {profileFilled ? "Complete" : "Set up"}
            </p>
          </div>
        </Link>

        <div className="w-px h-8 bg-stone-200/80 shrink-0 hidden sm:block" />

        {/* Memory confidence */}
        <Link
          href="/linkedin/memory"
          className="flex items-center gap-2.5 shrink-0 group py-1"
        >
          {memoryConfidence > 0 ? (
            <ScoreRing value={memoryConfidence} size={32} />
          ) : (
            <div className="p-1.5 rounded-lg bg-stone-200/80">
              <Brain className="w-4 h-4 text-stone-500" />
            </div>
          )}
          <div>
            <p className="text-[11px] text-stone-400 font-medium leading-none">Memory</p>
            <p className="text-xs font-semibold text-stone-700 leading-tight mt-0.5 group-hover:text-stone-900 transition-colors">
              {memoryConfidence > 0 ? `${Math.round(memoryConfidence * 100)}%` : "Not built"}
            </p>
          </div>
        </Link>

        <div className="w-px h-8 bg-stone-200/80 shrink-0 hidden sm:block" />

        {/* Pending ideas */}
        <Link
          href="/linkedin/ideas"
          className="flex items-center gap-2.5 shrink-0 group py-1"
        >
          <div className={`p-1.5 rounded-lg ${pendingIdeas > 0 ? "bg-amber-100" : "bg-stone-200/80"}`}>
            <Lightbulb className={`w-4 h-4 ${pendingIdeas > 0 ? "text-amber-600" : "text-stone-500"}`} />
          </div>
          <div>
            <p className="text-[11px] text-stone-400 font-medium leading-none">Ideas</p>
            <p className={`text-xs font-semibold leading-tight mt-0.5 group-hover:text-stone-900 transition-colors ${pendingIdeas > 0 ? "text-amber-700" : "text-stone-600"}`}>
              {pendingIdeas > 0 ? `${pendingIdeas} pending` : "None"}
            </p>
          </div>
        </Link>

        <div className="w-px h-8 bg-stone-200/80 shrink-0 hidden sm:block" />

        {/* Drafts in queue */}
        <Link
          href="/linkedin/drafts"
          className="flex items-center gap-2.5 shrink-0 group py-1"
        >
          <div className={`p-1.5 rounded-lg ${draftsInQueue > 0 ? "bg-blue-100" : "bg-stone-200/80"}`}>
            <PenTool className={`w-4 h-4 ${draftsInQueue > 0 ? "text-blue-600" : "text-stone-500"}`} />
          </div>
          <div>
            <p className="text-[11px] text-stone-400 font-medium leading-none">Drafts</p>
            <p className={`text-xs font-semibold leading-tight mt-0.5 group-hover:text-stone-900 transition-colors ${draftsInQueue > 0 ? "text-blue-700" : "text-stone-600"}`}>
              {draftsInQueue > 0 ? `${draftsInQueue} queued` : "Empty"}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
});

GrowthEngineBanner.displayName = "GrowthEngineBanner";
export default GrowthEngineBanner;
