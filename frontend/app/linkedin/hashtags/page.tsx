"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Hash, Copy, Check, Filter, TrendingUp, RotateCw } from "lucide-react";

interface Pillar {
  id: number;
  name: string;
  color: string;
}

interface HashtagSet {
  id: number;
  name: string;
  hashtags: string; // JSON string from API
  pillar_id: number | null;
  avg_reach: number | null;
  times_used: number;
  created_at: string;
}

function parseHashtags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const HashtagSetsPage = memo(function HashtagSetsPage() {
  const [hashtagSets, setHashtagSets] = useState<HashtagSet[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterPillar, setFilterPillar] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    hashtags: "",
    pillar_id: "",
  });

  const fetchPillars = useCallback(async () => {
    const res = await fetch("/api/linkedin/pillars");
    const data = await res.json();
    setPillars(data.pillars || []);
  }, []);

  const fetchHashtagSets = useCallback(async () => {
    const params = filterPillar ? `?pillar_id=${filterPillar}` : "";
    const res = await fetch(`/api/linkedin/hashtags${params}`);
    const data = await res.json();
    setHashtagSets(data.hashtag_sets || []);
  }, [filterPillar]);

  useEffect(() => {
    fetchPillars();
  }, [fetchPillars]);

  useEffect(() => {
    fetchHashtagSets();
  }, [fetchHashtagSets]);

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // Parse hashtags from textarea: support one per line or comma-separated
      const raw = form.hashtags
        .split(/[\n,]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      await fetch("/api/linkedin/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          hashtags: raw,
          pillar_id: form.pillar_id ? Number(form.pillar_id) : null,
        }),
      });
      setShowForm(false);
      setForm({ name: "", hashtags: "", pillar_id: "" });
      fetchHashtagSets();
    },
    [form, fetchHashtagSets]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("Delete this hashtag set?")) return;
      await fetch(`/api/linkedin/hashtags/${id}`, { method: "DELETE" });
      fetchHashtagSets();
    },
    [fetchHashtagSets]
  );

  const handleCopyAll = useCallback(
    async (id: number, tags: string[]) => {
      const text = tags.map((t) => `#${t}`).join(" ");
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        // Track usage
        fetch(`/api/linkedin/hashtags/${id}/use`, { method: "POST" }).then(() => fetchHashtagSets());
      } catch {
        // fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        // Track usage
        fetch(`/api/linkedin/hashtags/${id}/use`, { method: "POST" }).then(() => fetchHashtagSets());
      }
    },
    [fetchHashtagSets]
  );

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Hash className="w-6 h-6 text-indigo-600" />
            Hashtag Sets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {hashtagSets.length} set{hashtagSets.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Set
        </button>
      </div>

      {/* Filter by pillar */}
      <div className="flex gap-3 items-center bg-white rounded-xl border border-gray-200 px-4 py-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:bg-white transition-colors"
        >
          <option value="">All pillars</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add hashtag set form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">
            New Hashtag Set
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Set Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              placeholder="e.g., Leadership Hashtags"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hashtags
            </label>
            <textarea
              value={form.hashtags}
              onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
              rows={4}
              className={inputClass}
              placeholder={"One per line or comma-separated:\nleadership\nmanagement, teamwork\ncareergrowth"}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter hashtags one per line or comma-separated. The # symbol is
              optional.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content Pillar
            </label>
            <select
              value={form.pillar_id}
              onChange={(e) => setForm({ ...form, pillar_id: e.target.value })}
              className={inputClass}
            >
              <option value="">No pillar</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Add Set
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Hashtag set cards */}
      <div className="space-y-4">
        {hashtagSets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Hash className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">
              No hashtag sets yet
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Create reusable hashtag groups for your LinkedIn posts
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Set
            </button>
          </div>
        ) : (
          hashtagSets.map((set) => {
            const tags = parseHashtags(set.hashtags);
            const pillar = set.pillar_id
              ? pillarMap[set.pillar_id]
              : undefined;

            return (
              <div
                key={set.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Pillar color bar */}
                {pillar?.color && (
                  <div
                    className="h-1"
                    style={{ backgroundColor: pillar.color }}
                  />
                )}

                <div className="p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Name and pillar badge */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {set.name}
                        </h3>
                        {pillar && (
                          <span
                            className="text-xs font-medium px-2 py-1 rounded-md"
                            style={{
                              backgroundColor: `${pillar.color}15`,
                              color: pillar.color,
                            }}
                          >
                            {pillar.name}
                          </span>
                        )}
                      </div>

                      {/* Hashtag pills */}
                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100 font-medium cursor-default hover:bg-indigo-100 transition-colors"
                          >
                            #{tag}
                          </span>
                        ))}
                        {tags.length === 0 && (
                          <span className="text-xs text-gray-400 italic">
                            No hashtags
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {set.avg_reach != null && set.avg_reach > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span className="font-semibold text-gray-600">
                              {set.avg_reach.toLocaleString()}
                            </span>{" "}
                            avg reach
                          </span>
                        )}
                        {set.times_used > 0 && (
                          <span className="flex items-center gap-1">
                            <RotateCw className="w-3.5 h-3.5" />
                            Used{" "}
                            <span className="font-semibold text-gray-600">
                              {set.times_used}
                            </span>
                            x
                          </span>
                        )}
                        <span>
                          {tags.length} tag{tags.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyAll(set.id, tags)}
                        className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Copy all hashtags"
                      >
                        {copiedId === set.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete set"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

HashtagSetsPage.displayName = "HashtagSetsPage";
export default HashtagSetsPage;
