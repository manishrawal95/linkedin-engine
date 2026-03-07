"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, PenTool, CalendarPlus, X, Send, CheckCircle, AlertCircle } from "lucide-react";
import DraftEditor from "../components/DraftEditor";
import { useToast } from "../components/Toast";
import { toast as sonnerToast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBackgroundTask } from "@/hooks/use-background-task";
import type { Draft, Pillar } from "@/types/linkedin";

const DraftsPage = memo(function DraftsPage() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [rescheduleModal, setRescheduleModal] = useState<Draft | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "" });
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
    const res = await fetch("/api/linkedin/drafts");
    const data = await res.json();
    setDrafts(data.drafts || []);
  }, []);

  const fetchPillars = useCallback(async () => {
    const res = await fetch("/api/linkedin/pillars");
    const data = await res.json();
    setPillars(data.pillars || []);
  }, []);

  const { running: generating, launch: launchGenerate } = useBackgroundTask<{ drafts: Draft[] }>({
    key: "drafts_generate",
    onDone: () => {
      setShowGenerate(false);
      setGenForm({ topic: "", pillar_id: "", style: "", num_variants: 3 });
      fetchDrafts();
    },
    successMessage: "Drafts generated",
  });

  useEffect(() => {
    fetchDrafts();
    fetchPillars();
  }, [fetchDrafts, fetchPillars]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError(null);
    launchGenerate(
      "/api/linkedin/drafts/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...genForm,
          pillar_id: genForm.pillar_id ? Number(genForm.pillar_id) : null,
        }),
      },
      "Generating drafts — you can navigate away safely"
    );
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

  const handleDiscard = async (id: number) => {
    await handleUpdate(id, { status: "discarded" });
  };

  const openPublishModal = (draft: Draft) => {
    const now = new Date();
    // Format as datetime-local value (YYYY-MM-DDTHH:mm) in local time
    const pad = (n: number) => String(n).padStart(2, "0");
    const localNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setPublishForm({ post_url: "", post_type: "text", posted_at: localNow });
    setPublishModal(draft);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishModal) return;
    const params = new URLSearchParams();
    if (publishForm.post_url) params.set("post_url", publishForm.post_url);
    if (publishForm.post_type) params.set("post_type", publishForm.post_type);
    if (publishForm.posted_at) params.set("posted_at", publishForm.posted_at);

    const res = await fetch(`/api/linkedin/drafts/${publishModal.id}/publish?${params}`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Failed to mark draft as posted. Please try again.");
      return;
    }
    toast.success("Draft published! Add metrics later to trigger analysis.");
    setPublishModal(null);
    setPublishForm({ post_url: "", post_type: "text", posted_at: "" });
    fetchDrafts();
  };

  const handleAutoSchedule = useCallback(async (draft: Draft) => {
    const res = await fetch(`/api/linkedin/drafts/${draft.id}/auto-schedule`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail || "Failed to schedule draft");
      return;
    }
    const data = await res.json();
    const entry = data.calendar_entry;
    const reason = entry?.reason || "AI-optimized slot";
    const dateStr = entry?.scheduled_date || "";
    const timeStr = entry?.scheduled_time || "";

    const formatted = dateStr
      ? new Date(`${dateStr}T${timeStr || "00:00"}`).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        }) + (timeStr ? ` at ${timeStr}` : "")
      : "soon";

    sonnerToast.success(`Scheduled for ${formatted}`, {
      description: reason,
      classNames: {
        description: "!text-stone-600",
      },
      action: {
        label: "Change",
        onClick: () => {
          setRescheduleModal(draft);
          setRescheduleForm({ date: dateStr, time: timeStr });
        },
      },
      duration: 8000,
    });
    fetchDrafts();
  }, [fetchDrafts, toast]);

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModal) return;

    // Find the calendar entry for this draft and update it
    const calRes = await fetch(`/api/linkedin/calendar?draft_id=${rescheduleModal.id}`);
    const calData = await calRes.json();
    const entries = calData.entries || [];
    const entry = entries.find((e: Record<string, unknown>) => e.draft_id === rescheduleModal.id);

    if (entry) {
      const res = await fetch(`/api/linkedin/calendar/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: rescheduleForm.date,
          scheduled_time: rescheduleForm.time || null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to reschedule. Please try again.");
        return;
      }
    } else {
      // No existing entry, create new
      const res = await fetch("/api/linkedin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: rescheduleForm.date,
          scheduled_time: rescheduleForm.time || null,
          draft_id: rescheduleModal.id,
          pillar_id: rescheduleModal.pillar_id,
          status: "ready",
          notes: rescheduleModal.topic,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to schedule. Please try again.");
        return;
      }
    }

    toast.success("Schedule updated");
    setRescheduleModal(null);
    setRescheduleForm({ date: "", time: "" });
    fetchDrafts();
  };

  const selectClass =
    "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-colors";

  const statusCounts = {
    active: drafts.filter((d) => d.status === "draft" || d.status === "revised").length,
    scheduled: drafts.filter((d) => d.status === "scheduled").length,
    posted: drafts.filter((d) => d.status === "posted").length,
    discarded: drafts.filter((d) => d.status === "discarded").length,
  };

  const displayedDrafts = filterStatus === "active"
    ? drafts.filter((d) => d.status === "draft" || d.status === "revised")
    : filterStatus
      ? drafts.filter((d) => d.status === filterStatus)
      : drafts;

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">Draft Workshop</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {statusCounts.active} active · {drafts.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowManual(true)}
            className="rounded-xl active:scale-[0.98] transition-all h-11 sm:h-9 text-[15px] sm:text-sm flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            Manual
          </Button>
          <Button
            onClick={() => setShowGenerate(true)}
            className="rounded-xl active:scale-[0.98] transition-all h-11 sm:h-9 text-[15px] sm:text-sm flex-1 sm:flex-none"
          >
            <PenTool className="w-4 h-4" />
            Generate
          </Button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {[
          { key: "active", label: "Active", count: statusCounts.active },
          { key: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
          { key: "posted", label: "Posted", count: statusCounts.posted },
          { key: "discarded", label: "Discarded", count: statusCounts.discarded },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filterStatus === tab.key
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 opacity-75">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Manual draft form */}
      {showManual && (
        <form
          onSubmit={handleManualCreate}
          className="bg-white rounded-2xl border border-stone-200/60 p-4 sm:p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-base sm:text-lg font-semibold text-stone-900 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-stone-600" />
              New Draft
            </h3>
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="p-1.5 hover:bg-stone-100 rounded-xl"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Topic
              </label>
              <Input
                type="text"
                value={manualForm.topic}
                onChange={(e) =>
                  setManualForm({ ...manualForm, topic: e.target.value })
                }
                className="rounded-xl border-stone-200 h-11 sm:h-9 text-base sm:text-sm"
                placeholder="What's this draft about?"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Pillar
              </label>
              <select
                value={manualForm.pillar_id}
                onChange={(e) =>
                  setManualForm({ ...manualForm, pillar_id: e.target.value })
                }
                className={selectClass}
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
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Content
            </label>
            <Textarea
              value={manualForm.content}
              onChange={(e) =>
                setManualForm({ ...manualForm, content: e.target.value })
              }
              rows={6}
              className="rounded-xl border-stone-200"
              placeholder="Write your draft..."
              required
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="submit"
              className="rounded-xl active:scale-[0.98] transition-all"
            >
              Create Draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowManual(false)}
              className="rounded-xl active:scale-[0.98] transition-all"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Generate form */}
      {showGenerate && (
        <form
          onSubmit={handleGenerate}
          className="bg-stone-50 rounded-2xl border border-stone-200/60 p-4 sm:p-6 space-y-4"
        >
          <h3 className="text-base sm:text-lg font-semibold text-stone-900 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-stone-600" />
            AI Draft Generation
          </h3>
          {generateError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{generateError}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Topic
            </label>
            <Input
              type="text"
              value={genForm.topic}
              onChange={(e) =>
                setGenForm({ ...genForm, topic: e.target.value })
              }
              className="rounded-xl border-stone-200 h-11 sm:h-9 text-base sm:text-sm"
              placeholder="e.g., 5 lessons from my first year as a manager"
              required
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Pillar
              </label>
              <select
                value={genForm.pillar_id}
                onChange={(e) =>
                  setGenForm({ ...genForm, pillar_id: e.target.value })
                }
                className={selectClass}
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
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Style
              </label>
              <Input
                type="text"
                value={genForm.style}
                onChange={(e) =>
                  setGenForm({ ...genForm, style: e.target.value })
                }
                className="rounded-xl border-stone-200 h-11 sm:h-9 text-base sm:text-sm"
                placeholder="e.g., bold"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-stone-700 mb-1">
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
                className={selectClass}
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
            <Button
              type="submit"
              disabled={generating}
              className="rounded-xl active:scale-[0.98] transition-all"
            >
              {generating ? "Generating..." : "Generate Drafts"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowGenerate(false)}
              className="rounded-xl active:scale-[0.98] transition-all"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {generating && (
        <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200/60">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-stone-700" />
          <span className="text-sm text-stone-700">
            Generating drafts with AI...
          </span>
        </div>
      )}

      {/* Draft list */}
      <div className="space-y-4">
        {displayedDrafts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200/60">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PenTool className="w-7 h-7 text-stone-400" />
            </div>
            <p className="text-base font-semibold text-stone-800">
              {filterStatus === "active" ? "No active drafts" : filterStatus === "posted" ? "No posted drafts" : "No drafts"}
            </p>
            <p className="text-sm text-stone-400 mt-1 max-w-xs mx-auto">
              {filterStatus === "active"
                ? "Drop a topic idea and let AI write your next LinkedIn post"
                : filterStatus === "posted"
                  ? "Posts you've published from drafts will appear here"
                  : "Generate drafts with AI or create them manually"}
            </p>
            {filterStatus === "active" && (
              <Button
                onClick={() => setShowGenerate(true)}
                className="mt-5 rounded-xl active:scale-[0.98] transition-all"
              >
                <PenTool className="w-4 h-4" />
                Generate with AI
              </Button>
            )}
          </div>
        ) : (
          displayedDrafts.map((draft) => (
            <DraftEditor
              key={draft.id}
              draft={draft}
              onUpdate={handleUpdate}
              onDelete={handleDiscard}
              onSchedule={handleAutoSchedule}
              onPublish={openPublishModal}
            />
          ))
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handleReschedule}
            className="bg-white rounded-2xl p-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-md shadow-xl space-y-4 mx-4 sm:mx-0"
          >
            <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-stone-600" />
              Change Schedule
            </h3>
            <p className="text-sm text-stone-500 line-clamp-2">
              &ldquo;{rescheduleModal.topic}&rdquo;
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Date
              </label>
              <Input
                type="date"
                value={rescheduleForm.date}
                onChange={(e) =>
                  setRescheduleForm({ ...rescheduleForm, date: e.target.value })
                }
                className="rounded-xl border-stone-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Time
              </label>
              <Input
                type="time"
                value={rescheduleForm.time}
                onChange={(e) =>
                  setRescheduleForm({ ...rescheduleForm, time: e.target.value })
                }
                className="rounded-xl border-stone-200"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-xl active:scale-[0.98] transition-all"
              >
                Update Schedule
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleModal(null)}
                className="rounded-xl active:scale-[0.98] transition-all"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Publish Modal */}
      {publishModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handlePublish}
            className="bg-white rounded-2xl p-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-md shadow-xl space-y-4 mx-4 sm:mx-0"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Mark as Posted
              </h3>
              <button
                type="button"
                onClick={() => setPublishModal(null)}
                className="p-1.5 hover:bg-stone-100 rounded-xl"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <p className="text-sm text-stone-500">
              &ldquo;{publishModal.topic}&rdquo;
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Post Type
              </label>
              <select
                value={publishForm.post_type}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, post_type: e.target.value })
                }
                className={selectClass}
              >
                <option value="text">Text</option>
                <option value="carousel">Carousel</option>
                <option value="personal image">Personal Image</option>
                <option value="social proof image">Social Proof Image</option>
                <option value="poll">Poll</option>
                <option value="video">Video</option>
                <option value="article">Article</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Posted At
              </label>
              <Input
                type="datetime-local"
                value={publishForm.posted_at}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, posted_at: e.target.value })
                }
                className="rounded-xl border-stone-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Post URL (optional)
              </label>
              <Input
                type="url"
                value={publishForm.post_url}
                onChange={(e) =>
                  setPublishForm({ ...publishForm, post_url: e.target.value })
                }
                className="rounded-xl border-stone-200"
                placeholder="https://linkedin.com/posts/..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all"
              >
                Create Post & Mark Posted
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPublishModal(null)}
                className="rounded-xl active:scale-[0.98] transition-all"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});

DraftsPage.displayName = "DraftsPage";
export default DraftsPage;
