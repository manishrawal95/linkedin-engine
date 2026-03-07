"use client";

import { useCallback } from "react";
import {
  Brain,
  Mic,
  Dna,
  Users,
  TrendingUp,
  RefreshCw,
  Fingerprint,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorCard } from "@/components/ui/error-card";
import { ScoreRing } from "@/components/ui/score-ring";
import { useApi } from "@/hooks/use-api";
import { useBackgroundTask } from "@/hooks/use-background-task";
import type { CreatorMemory } from "@/types/linkedin";

import VoiceProfileCard from "./voice-profile-card";
import ContentDNACard from "./content-dna-card";
import AudienceCard from "./audience-card";
import TrajectoryCard from "./trajectory-card";

export default function MemoryPage() {
  const { data: memory, loading, error, refetch } = useApi<CreatorMemory>("/api/linkedin/memory");

  const { running: building, launch: launchBuild } = useBackgroundTask({
    key: "memory_build",
    onDone: () => refetch(),
    successMessage: "Creator memory built successfully",
  });

  const handleBuild = useCallback(() => {
    launchBuild(
      "/api/linkedin/memory",
      { method: "POST" },
      "Building memory — you can navigate away safely"
    );
  }, [launchBuild]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Creator Memory</h1>
        <ErrorCard message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!memory || !memory.id) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Creator Memory</h1>
        <div className="bg-white rounded-2xl border border-stone-200/60 p-8">
          <EmptyState
            icon={Brain}
            title="No memory built yet"
            description="Build your creator memory to unlock AI-powered ideation and voice-matched drafts. Requires at least 10 posts with metrics."
            action={{
              label: building ? "Building memory..." : "Build Creator Memory",
              onClick: handleBuild,
              loading: building,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Creator Memory</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            v{memory.version} &middot; Built from {memory.post_count_at_build} posts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing value={memory.confidence_overall} size={44} label="Confidence" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleBuild}
            disabled={building}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${building ? "animate-spin" : ""}`} />
            {building ? "Rebuilding..." : "Rebuild"}
          </Button>
        </div>
      </div>

      {/* Summary banner */}
      {memory.voice_profile?.summary && (
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-stone-200/60 shrink-0">
              <Fingerprint className="w-4 h-4 text-stone-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900 mb-1">Voice Summary</p>
              <p className="text-sm text-stone-600 leading-relaxed">{memory.voice_profile.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4-panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VoiceProfileCard voice={memory.voice_profile} />
        <ContentDNACard dna={memory.content_dna} />
        <AudienceCard audience={memory.audience_model} />
        <TrajectoryCard trajectory={memory.growth_trajectory} />
      </div>

      {/* Memory metadata */}
      <div className="flex items-center gap-4 text-xs text-stone-400 px-1">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Last updated {new Date(memory.updated_at).toLocaleDateString()}
        </span>
        <span>Version {memory.version}</span>
        <span>{memory.post_count_at_build} posts analyzed</span>
      </div>
    </div>
  );
}
