"use client";

import {
  Zap,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { PostIdea } from "@/types/linkedin";

interface QuickCaptureBodyProps {
  captureIdea: string;
  setCaptureIdea: (v: string) => void;
  captureError: string | null;
  captureSuccess: boolean;
  capturing: boolean;
  onGenerate: () => void;
  onFetchIdeas: () => void;
  showIdeas: boolean;
  loadingIdeas: boolean;
  ideas: PostIdea[];
  onIdeaClick: (idea: PostIdea) => void;
}

export function QuickCaptureBody({
  captureIdea, setCaptureIdea, captureError, captureSuccess, capturing,
  onGenerate, onFetchIdeas, showIdeas, loadingIdeas, ideas, onIdeaClick,
}: QuickCaptureBodyProps) {
  return (
    <>
      <div className="space-y-3">
        <Textarea
          value={captureIdea}
          onChange={(e) => setCaptureIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
          }}
          rows={3}
          placeholder="Drop a rough idea or note... (Cmd+Enter to generate)"
          className="rounded-xl border-stone-200 bg-white focus-visible:ring-stone-400 resize-none leading-relaxed"
        />
        {captureError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{captureError}</span>
          </div>
        )}
        {captureSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-700">
            <span className="font-medium">Draft created</span>
            <a
              href="/linkedin/drafts"
              className="flex items-center gap-1 underline ml-auto"
            >
              View in Drafts <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={onGenerate}
            disabled={capturing || !captureIdea.trim()}
            className="gap-2 rounded-xl active:scale-[0.98] transition-all"
          >
            <Zap className="w-4 h-4" />
            {capturing ? "Generating..." : "Generate Post"}
          </Button>
          <Button
            variant="outline"
            onClick={onFetchIdeas}
            disabled={loadingIdeas}
            className="gap-2 rounded-xl border-stone-200"
          >
            <Lightbulb className="w-4 h-4" />
            {loadingIdeas
              ? "Loading..."
              : captureIdea.trim()
                ? "See 5 angles"
                : "See 5 ideas"}
            {showIdeas && !loadingIdeas ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
      {showIdeas && (
        <div className="space-y-2 pt-1">
          {loadingIdeas ? (
            <div className="flex items-center gap-2 text-sm text-stone-600 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-400" />
              Generating ideas from your playbook...
            </div>
          ) : ideas.length > 0 ? (
            ideas.map((idea, i) => (
              <button
                key={i}
                onClick={() => onIdeaClick(idea)}
                className="w-full text-left p-3 bg-white border border-stone-200/60 rounded-xl hover:border-stone-300 hover:bg-stone-50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-stone-700 group-hover:text-stone-900 leading-relaxed">
                    {idea.topic}
                  </p>
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-stone-100 text-stone-600 hover:bg-stone-100 text-[10px]"
                  >
                    {idea.hook_style}
                  </Badge>
                </div>
                {idea.pillar && (
                  <p className="text-xs text-stone-400 mt-1">{idea.pillar}</p>
                )}
              </button>
            ))
          ) : (
            <p className="text-sm text-stone-500 py-2">
              No ideas generated. Make sure your playbook and learnings have data.
            </p>
          )}
        </div>
      )}
    </>
  );
}
