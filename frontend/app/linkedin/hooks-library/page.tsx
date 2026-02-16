"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Anchor, Copy, Check } from "lucide-react";

interface Hook {
  id: number;
  text: string;
  style: string;
  times_used: number;
  avg_engagement_score: number | null;
}

const HOOK_STYLES = [
  "question",
  "contrarian",
  "story",
  "stat",
  "cliffhanger",
  "list",
  "statement",
];

const HooksLibraryPage = memo(function HooksLibraryPage() {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterStyle, setFilterStyle] = useState("");
  const [form, setForm] = useState({ text: "", style: "statement" });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchHooks = useCallback(async () => {
    const params = filterStyle ? `?style=${filterStyle}` : "";
    const res = await fetch(`/api/linkedin/hooks${params}`);
    const data = await res.json();
    setHooks(data.hooks || []);
  }, [filterStyle]);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/linkedin/hooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ text: "", style: "statement" });
    fetchHooks();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/linkedin/hooks/${id}`, { method: "DELETE" });
    fetchHooks();
  };

  const handleCopyHook = async (hook: Hook) => {
    await navigator.clipboard.writeText(hook.text);
    setCopiedId(hook.id);
    setTimeout(() => setCopiedId(null), 2000);
    // Track usage
    await fetch(`/api/linkedin/hooks/${hook.id}/use`, { method: "POST" });
    fetchHooks();
  };

  const styleColors: Record<string, string> = {
    question: "bg-blue-100 text-blue-700 border-blue-200",
    contrarian: "bg-red-100 text-red-700 border-red-200",
    story: "bg-purple-100 text-purple-700 border-purple-200",
    stat: "bg-green-100 text-green-700 border-green-200",
    cliffhanger: "bg-amber-100 text-amber-700 border-amber-200",
    list: "bg-cyan-100 text-cyan-700 border-cyan-200",
    statement: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Anchor className="w-6 h-6 text-indigo-600" />
            Hook Library
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {hooks.length} hook{hooks.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Hook
        </button>
      </div>

      {/* Filter by style */}
      <div className="flex gap-2 flex-wrap bg-white rounded-xl border border-gray-200 px-4 py-3">
        <button
          onClick={() => setFilterStyle("")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            !filterStyle
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {HOOK_STYLES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStyle(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
              filterStyle === s
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">New Hook</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hook Text
            </label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="The opening line that grabs attention..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style
            </label>
            <select
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              className={inputClass}
            >
              {HOOK_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Add Hook
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

      {/* Hook list */}
      <div className="space-y-3">
        {hooks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Anchor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No hooks saved yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Add hooks manually or extract them from your best posts
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Hook
            </button>
          </div>
        ) : (
          hooks.map((hook) => (
            <div
              key={hook.id}
              className="bg-white rounded-xl border border-gray-200 p-5 flex justify-between items-start gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium leading-relaxed">
                  &ldquo;{hook.text}&rdquo;
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md font-medium capitalize border ${styleColors[hook.style] || "bg-gray-100 text-gray-600"}`}
                  >
                    {hook.style}
                  </span>
                  {hook.times_used > 0 && (
                    <span className="text-xs text-gray-400">
                      Used {hook.times_used}x
                    </span>
                  )}
                  {hook.avg_engagement_score != null && (
                    <span className="text-xs text-indigo-600 font-semibold">
                      {(hook.avg_engagement_score * 100).toFixed(1)}% avg eng
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleCopyHook(hook)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Copy hook to clipboard"
                >
                  {copiedId === hook.id ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(hook.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

HooksLibraryPage.displayName = "HooksLibraryPage";
export default HooksLibraryPage;
