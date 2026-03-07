"use client";

import { memo, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertCircle, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Actions } from "@/types/linkedin";

interface ActionPanelProps {
  onAnalyze?: (postId: number) => void;
}

const ActionPanel = memo(function ActionPanel({ onAnalyze }: ActionPanelProps) {
  const [data, setData] = useState<Actions | null>(null);
  const [analyzing, setAnalyzing] = useState<number | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/dashboard/actions");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("ActionPanel.fetch_: GET /api/linkedin/dashboard/actions failed:", err);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data) return null;
  const { metrics_due, unanalyzed_posts } = data;
  if (metrics_due.length === 0 && unanalyzed_posts.length === 0) return null;

  const handleAnalyze = async (postId: number) => {
    setAnalyzing(postId);
    try {
      const res = await fetch(`/api/linkedin/analyze/${postId}`, { method: "POST" });
      if (!res.ok) throw new Error(`Analysis returned ${res.status}`);
      onAnalyze?.(postId);
      fetch_();
    } catch (err) {
      console.error(`ActionPanel.handleAnalyze: POST /api/linkedin/analyze/${postId} failed:`, err);
    } finally {
      setAnalyzing(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/60 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500" />
        Action Needed
      </h2>

      {metrics_due.map((item) => (
        <Link
          key={`${item.post_id}-${item.due_label}`}
          href="/linkedin/posts"
          className="flex items-start gap-3 p-3 bg-amber-50/80 border border-amber-100 rounded-xl hover:bg-amber-100/60 transition-colors"
        >
          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700">{item.due_label}</p>
            <p className="text-xs text-stone-600 truncate mt-0.5">{item.content_preview}</p>
          </div>
        </Link>
      ))}

      {unanalyzed_posts.map((post) => (
        <div
          key={post.id}
          className="flex items-start gap-3 p-3 bg-stone-50 border border-stone-200/60 rounded-xl"
        >
          <FileText className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-600 truncate">{post.content_preview}</p>
          </div>
          <Button
            size="sm"
            onClick={() => handleAnalyze(post.id)}
            disabled={analyzing === post.id}
            className="shrink-0 rounded-xl text-xs h-7 active:scale-[0.98] transition-all"
          >
            {analyzing === post.id ? "..." : "Analyze"}
          </Button>
        </div>
      ))}
    </div>
  );
});

ActionPanel.displayName = "ActionPanel";
export default ActionPanel;
