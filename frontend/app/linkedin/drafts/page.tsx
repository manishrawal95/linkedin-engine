"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Sparkles, Plus, PenTool, CalendarPlus, X, Send, CheckCircle } from "lucide-react";
import DraftEditor from "../components/DraftEditor";

interface Draft {
  id: number;
  topic: string;
  content: string;
  hook_variant: string | null;
  pillar_id: number | null;
  status: string;
  ai_model: string | null;
  created_at: string;
}

interface Pillar {
  id: number;
  name: string;
}

const DraftsPage = memo(function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [scheduleModal, setScheduleModal] = useState<Draft | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    time: "",
  });
  const [publishModal, setPublishModal] = useState<Draft | null>(null);
  const [publishForm, setPublishForm] = useState({
    post_url: "",
    post_type: "text",
    posted_at: "",
  });
  const [genForm, setGenForm] = useState({
    topic: "",
    pillar_id: "",
    style: "",
    num_variants: 3,
  });
  const [manualForm, setManualForm] = useState({
    topic: "",
    content: "",
    pillar_id: "",
  });

  const fetchDrafts = useCallback(async () => {
    const params = filterStatus ? `?status=${filterStatus}` : "";
    const res = await fetch(`/api/linkedin/drafts${params}`);
    const data = await res.json();
    setDrafts(data.drafts || []);
  }, [filterStatus]);

  const fetchPillars = useCallback(async () => {
    const res = await fetch("/api/linkedin/pillars");
    const data = await res.json();
    setPillars(data.pillars || []);
  }, []);

  useEffect(() => {
    fetchDrafts();
    fetchPillars();
  }, [fetchDrafts, fetchPillars]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await fetch("/api/linkedin/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...genForm,
          pillar_id: genForm.pillar_id ? Number(genForm.pillar_id) : null,
        }),
      });
      setShowGenerate(false);
      setGenForm({ topic: "", pillar_id: "", style: "", num_variants: 3 });
      fetchDrafts();
    } catch {
      // generation failed
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/linkedin/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...manualForm,
        pillar_id: manualForm.pillar_id ? Number(manualForm.pillar_id) : null,
      }),
    });
    setShowManual(false);
    setManualForm({ topic: "", content: "", pillar_id: "" });
    fetchDrafts();
  };

  const handleUpdate = async (id: number, data: Record<string, unknown>) => {
    await fetch(`/api/linkedin/drafts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchDrafts();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this draft?")) return;
    await fetch(`/api/linkedin/drafts/${id}`, { method: "DELETE" });
    fetchDrafts();
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishModal) return;
    const params = new URLSearchParams();
    if (publishForm.post_url) params.set("post_url", publishForm.post_url);
    if (publishForm.post_type) params.set("post_type", publishForm.post_type);
    if (publishForm.posted_at) params.set("posted_at", publishForm.posted_at);

    await fetch(`/api/linkedin/drafts/${publishModal.id}/publish?${params}`, {
      method: "POST",
    });
    setPublishModal(null);
    setPublishForm({ post_url: "", post_type: "text", posted_at: "" });
    fetchDrafts();
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModal) return;
    await fetch("/api/linkedin/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_date: scheduleForm.date,
        scheduled_time: scheduleForm.time || null,
        draft_id: scheduleModal.id,
        pillar_id: scheduleModal.pillar_id,
        status: "ready",
        notes: scheduleModal.topic,
      }),
    });
    setScheduleModal(null);
    setScheduleForm({ date: "", time: "" });
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  const statusCounts = {
    all: drafts.length,
    draft: drafts.filter((d) => d.status === "draft").length,
    revised: drafts.filter((d) => d.status === "revised").length,
    posted: drafts.filter((d) => d.status === "posted").length,
    discarded: drafts.filter((d) => d.status === "discarded").length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Draft Workshop</h1>
          <p className="text-sm text-gray-500 mt-1">
            {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manual Draft
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate with AI
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3">
        {[
          { key: "", label: "All", count: statusCounts.all },
          { key: "draft", label: "Drafts", count: statusCounts.draft },
          { key: "revised", label: "Revised", count: statusCounts.revised },
          { key: "posted", label: "Posted", count: statusCounts.posted },
          { key: "discarded", label: "Discarded", count: statusCounts.discarded },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              filterStatus === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 opacity-75">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Manual draft form */}
      {showManual && (
        <form
          onSubmit={handleManualCreate}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-indigo-600" />
              New Draft
            </h3>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic
              </label>
              <input
                type="text"
                value={manualForm.topic}
                onChange={(e) =>
                  setManualForm({ ...manualForm, topic: e.target.value })
                }
                className={inputClass}
                placeholder="What's this draft about?"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pillar
              </label>
              <select
                value={manualForm.pillar_id}
                onChange={(e) =>
                  setManualForm({ ...manualForm, pillar_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Any</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              value={manualForm.content}
              onChange={(e) =>
                setManualForm({ ...manualForm, content: e.target.value })
              }
              rows={6}
              className={inputClass}
              placeholder="Write your draft..."
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Create Draft
            </button>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Generate form */}
      {showGenerate && (
        <form
          onSubmit={handleGenerate}
          className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI Draft Generation
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <input
              type="text"
              value={genForm.topic}
              onChange={(e) =>
                setGenForm({ ...genForm, topic: e.target.value })
              }
              className={inputClass}
              placeholder="e.g., 5 lessons from my first year as a manager"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pillar
              </label>
              <select
                value={genForm.pillar_id}
                onChange={(e) =>
                  setGenForm({ ...genForm, pillar_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Any</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style
              </label>
              <input
                type="text"
                value={genForm.style}
                onChange={(e) =>
                  setGenForm({ ...genForm, style: e.target.value })
                }
                className={inputClass}
                placeholder="e.g., conversational, bold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variants
              </label>
              <select
                value={genForm.num_variants}
                onChange={(e) =>
                  setGenForm({
                    ...genForm,
                    num_variants: Number(e.target.value),
                  })
                }
                className={inputClass}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={generating}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {generating ? "Generating..." : "Generate Drafts"}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerate(false)}
              className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {generating && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
          <span className="text-sm text-indigo-700">
            Generating drafts with AI...
          </span>
        </div>
      )}

      {/* Draft list */}
      <div className="space-y-4">
        {drafts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <PenTool className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">No drafts yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Generate drafts with AI or create them manually
            </p>
            <button
              onClick={() => setShowGenerate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          </div>
        ) : (
          drafts.map((draft) => (
            <DraftEditor
              key={draft.id}
              draft={draft}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSchedule={setScheduleModal}
              onPublish={setPublishModal}
            />
          ))
        )}
      </div>

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handleSchedule}
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-indigo-600" />
              Schedule Draft
            </h3>
            <p className="text-sm text-gray-500">
              &ldquo;{scheduleModal.topic}&rdquo;
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={scheduleForm.date}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, date: e.target.value })
                }
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time (optional)
              </label>
              <input
                type="time"
                value={scheduleForm.time}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, time: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setScheduleModal(null)}
                className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Publish Modal */}
      {publishModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handlePublish}
            className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Mark as Posted
              </h3>
              <button
                type="button"
                onClick={() => setPublishModal(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              &ldquo;{publishModal.topic}&rdquo;
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Post Type
              </label>
              <select
                value={publishForm.post_type}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, post_type: e.target.value })
                }
                className={inputClass}
              >
                <option value="text">Text</option>
                <option value="carousel">Carousel</option>
                <option value="poll">Poll</option>
                <option value="video">Video</option>
                <option value="article">Article</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Posted At
              </label>
              <input
                type="datetime-local"
                value={publishForm.posted_at}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, posted_at: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Post URL (optional)
              </label>
              <input
                type="url"
                value={publishForm.post_url}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, post_url: e.target.value })
                }
                className={inputClass}
                placeholder="https://linkedin.com/posts/..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                Create Post & Mark Posted
              </button>
              <button
                type="button"
                onClick={() => setPublishModal(null)}
                className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});

DraftsPage.displayName = "DraftsPage";
export default DraftsPage;
