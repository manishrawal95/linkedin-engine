"use client";

import { memo, useCallback, useState } from "react";
import Link from "next/link";
import { Lightbulb, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorCard } from "@/components/ui/error-card";
import { useApi, useMutation } from "@/hooks/use-api";
import type { Idea } from "@/types/linkedin";

interface IdeasResponse {
  ideas: Idea[];
  total: number;
}

const PendingIdeasReview = memo(function PendingIdeasReview() {
  const { data, loading, error, refetch } = useApi<IdeasResponse>("/api/linkedin/ideas");
  const [actioning, setActioning] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const { mutate: generateIdeas, loading: generating } = useMutation<void, unknown>(
    "/api/linkedin/ideas/generate",
    "POST"
  );

  const pendingIdeas = (data?.ideas ?? [])
    .filter((i) => i.status === "pending" && !dismissed.has(i.id))
    .slice(0, 3);

  const handleApprove = useCallback(async (id: number) => {
    setActioning((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/linkedin/ideas/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Approve failed (${res.status})`);
      }
      setDismissed((prev) => new Set(prev).add(id));
      toast.success("Idea approved — draft will be generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve idea";
      toast.error(message);
      console.error("PendingIdeasReview.handleApprove:", message);
    } finally {
      setActioning((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleReject = useCallback(async (id: number) => {
    setActioning((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/linkedin/ideas/${id}/reject`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Reject failed (${res.status})`);
      }
      setDismissed((prev) => new Set(prev).add(id));
      toast.success("Idea dismissed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject idea";
      toast.error(message);
      console.error("PendingIdeasReview.handleReject:", message);
    } finally {
      setActioning((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    const result = await generateIdeas();
    if (result !== null) {
      toast.success("Ideas generated");
      refetch();
    } else {
      toast.error("Failed to generate ideas. Check your profile and playbook.");
    }
  }, [generateIdeas, refetch]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
        <ErrorCard message={error} onRetry={refetch} />
      </div>
    );
  }

  const totalPending = (data?.ideas ?? []).filter((i) => i.status === "pending").length;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-stone-400" />
          Pending Ideas
        </h2>
        {totalPending > 3 && (
          <Link
            href="/linkedin/ideas"
            className="text-xs text-stone-500 hover:text-stone-700 font-medium transition-colors flex items-center gap-1"
          >
            View all ({totalPending}) <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {pendingIdeas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No pending ideas"
          description="Generate fresh ideas based on your profile, playbook, and past performance."
          action={{
            label: "Generate Ideas",
            onClick: handleGenerate,
            loading: generating,
          }}
        />
      ) : (
        <div className="space-y-2">
          {pendingIdeas.map((idea) => {
            const busy = actioning.has(idea.id);
            return (
              <div
                key={idea.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/60 transition-all duration-200 hover:border-stone-300"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 leading-relaxed line-clamp-2">
                    {idea.topic}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {idea.hook_style && (
                      <Badge variant="secondary" className="text-[10px] bg-stone-100 text-stone-600 hover:bg-stone-100">
                        {idea.hook_style}
                      </Badge>
                    )}
                    {idea.pillar_name && (
                      <span className="flex items-center gap-1 text-[11px] text-stone-400">
                        {idea.pillar_color && (
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: idea.pillar_color }}
                          />
                        )}
                        {idea.pillar_name}
                      </span>
                    )}
                    {idea.score > 0 && (
                      <span className="text-[11px] text-stone-400 font-medium">
                        Score: {idea.score}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleApprove(idea.id)}
                    disabled={busy}
                    className="p-2 rounded-lg hover:bg-emerald-50 text-stone-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    aria-label="Approve idea"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReject(idea.id)}
                    disabled={busy}
                    className="p-2 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    aria-label="Reject idea"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {totalPending > 3 && (
            <Link
              href="/linkedin/ideas"
              className="block text-center text-xs text-stone-500 hover:text-stone-700 font-medium py-2 transition-colors"
            >
              +{totalPending - 3} more pending ideas
            </Link>
          )}
        </div>
      )}
    </div>
  );
});

PendingIdeasReview.displayName = "PendingIdeasReview";
export default PendingIdeasReview;
