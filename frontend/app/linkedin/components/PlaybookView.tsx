"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { BookOpen, RefreshCw } from "lucide-react";

const PlaybookView = memo(function PlaybookView() {
  const [playbook, setPlaybook] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const fetchPlaybook = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/playbook");
      const data = await res.json();
      setPlaybook(data.playbook?.content || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaybook();
  }, [fetchPlaybook]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetch("/api/linkedin/playbook", { method: "POST" });
      await fetchPlaybook();
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-3 bg-gray-200 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-400" />
          Playbook
        </h2>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`}
          />
          Regenerate
        </button>
      </div>

      {playbook ? (
        <div className="prose prose-sm max-w-none text-gray-700">
          {playbook.split("\n").map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h3 key={i} className="text-base font-semibold mt-4 mb-2">
                  {line.replace("## ", "")}
                </h3>
              );
            }
            if (line.startsWith("# ")) {
              return (
                <h2 key={i} className="text-lg font-bold mt-4 mb-2">
                  {line.replace("# ", "")}
                </h2>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <p key={i} className="ml-4 text-sm">
                  {line}
                </p>
              );
            }
            if (line.trim()) {
              return (
                <p key={i} className="text-sm">
                  {line}
                </p>
              );
            }
            return <br key={i} />;
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No playbook generated yet. Add posts with metrics and the playbook
          will auto-generate from your learnings.
        </p>
      )}
    </div>
  );
});

PlaybookView.displayName = "PlaybookView";
export default PlaybookView;
