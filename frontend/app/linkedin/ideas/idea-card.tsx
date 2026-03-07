"use client";

import { memo, useState } from "react";
import {
  Check,
  X,
  Palette,
  Loader2,
  Zap,
  BookOpen,
  Repeat,
  Brain,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Idea } from "@/types/linkedin";

const SOURCE_CONFIG: Record<string, { icon: typeof Zap; label: string; color: string }> = {
  series: { icon: BookOpen, label: "Series", color: "bg-blue-50 text-blue-700" },
  mood_board: { icon: Palette, label: "Mood Board", color: "bg-purple-50 text-purple-700" },
  repurpose: { icon: Repeat, label: "Repurpose", color: "bg-amber-50 text-amber-700" },
  ai: { icon: Brain, label: "AI Generated", color: "bg-emerald-50 text-emerald-700" },
  competitor: { icon: Users, label: "Inspiration", color: "bg-indigo-50 text-indigo-700" },
};

interface IdeaCardProps {
  idea: Idea;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
}

const IdeaCard = memo(function IdeaCard({
  idea,
  onApprove,
  onReject,
}: IdeaCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const source = SOURCE_CONFIG[idea.source] ?? {
    icon: Zap,
    label: idea.source,
    color: "bg-stone-50 text-stone-700",
  };
  const SourceIcon = source.icon;

  const handleAction = async (action: string, fn: (id: number) => void | Promise<void>) => {
    setActionLoading(action);
    try {
      await fn(idea.id);
    } finally {
      setActionLoading(null);
    }
  };

  const fitTier =
    idea.score >= 0.7
      ? { label: "Strong fit", color: "text-emerald-700 bg-emerald-50" }
      : idea.score >= 0.4
        ? { label: "Decent fit", color: "text-amber-700 bg-amber-50" }
        : { label: "Weak fit", color: "text-stone-500 bg-stone-100" };

  // Use AI-generated reason if available, otherwise fall back to generic label
  const fitText = idea.fit_reason?.trim() || fitTier.label;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 p-4 sm:p-5 transition-all hover:border-stone-300/80 overflow-hidden">
      {/* Topic */}
      <p className={`text-[15px] sm:text-sm font-medium text-stone-900 leading-relaxed break-words ${expanded ? "" : "line-clamp-2"}`}>
        {idea.topic}
      </p>
      {!expanded && idea.topic.length > 50 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-stone-400 mt-0.5"
        >
          view more
        </button>
      )}

      {/* Actions — always visible right below topic */}
      <div className="flex items-center gap-2 mt-2.5">
        {idea.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("reject", onReject)}
              disabled={actionLoading !== null}
              className="rounded-xl h-11 w-11 sm:h-9 sm:w-9 p-0 text-stone-400 hover:text-red-600 hover:border-red-200"
              aria-label="Reject idea"
            >
              {actionLoading === "reject" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => handleAction("approve", onApprove)}
              disabled={actionLoading !== null}
              className="rounded-xl h-11 sm:h-9 px-4 sm:px-3 gap-1.5 flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-[15px] sm:text-sm"
              aria-label="Approve idea"
            >
              {actionLoading === "approve" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Approve
            </Button>
          </>
        )}

        {idea.status === "approved" && (
          <Badge className="bg-amber-50 text-amber-700 rounded-full gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Drafting...
          </Badge>
        )}

        {idea.status === "drafted" && (
          <Badge className="bg-stone-100 text-stone-600 rounded-full">
            Drafted
          </Badge>
        )}

        {idea.status === "rejected" && (
          <Badge className="bg-red-50 text-red-500 rounded-full">
            Rejected
          </Badge>
        )}

        {/* Fit badge inline with actions */}
        <Badge
          variant="secondary"
          className={`rounded-full text-[11px] font-medium px-2 py-0.5 ml-auto ${fitTier.color}`}
        >
          {fitText}
        </Badge>
      </div>

      {/* Badges — shown on expand */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <Badge
            variant="secondary"
            className={`rounded-full text-[11px] font-medium gap-1 px-2 py-0.5 ${source.color}`}
          >
            <SourceIcon className="w-3 h-3" />
            {source.label}
          </Badge>
          {idea.hook_style && (
            <Badge
              variant="secondary"
              className="rounded-full text-[11px] px-2 py-0.5 bg-stone-100 text-stone-600"
            >
              {idea.hook_style}
            </Badge>
          )}
          {idea.pillar_name && (
            <Badge
              variant="secondary"
              className="rounded-full text-[11px] px-2 py-0.5"
              style={{
                backgroundColor: idea.pillar_color
                  ? `${idea.pillar_color}15`
                  : undefined,
                color: idea.pillar_color ?? undefined,
              }}
            >
              {idea.pillar_name}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
});

IdeaCard.displayName = "IdeaCard";
export default IdeaCard;
