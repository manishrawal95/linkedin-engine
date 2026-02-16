"use client";

import { memo, useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  CheckCircle,
  FileText,
  X,
} from "lucide-react";

interface CalendarEntry {
  id: number;
  scheduled_date: string;
  scheduled_time: string | null;
  draft_id: number | null;
  pillar_id: number | null;
  series_id: number | null;
  status: string;
  notes: string | null;
  post_id: number | null;
}

interface Pillar {
  id: number;
  name: string;
  color: string;
}

interface Draft {
  id: number;
  topic: string;
  content: string;
  status: string;
  pillar_id: number | null;
}

interface Series {
  id: number;
  name: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 border-blue-200 text-blue-700",
  ready: "bg-green-100 border-green-200 text-green-700",
  posted: "bg-gray-100 border-gray-200 text-gray-500",
  skipped: "bg-red-100 border-red-200 text-red-400",
};

const CalendarPage = memo(function CalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<unknown[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [markPostModal, setMarkPostModal] = useState<CalendarEntry | null>(null);
  const [postForm, setPostForm] = useState({
    content: "",
    post_url: "",
    post_type: "text",
    posted_at: "",
  });
  const [addForm, setAddForm] = useState({
    scheduled_time: "",
    pillar_id: "",
    draft_id: "",
    series_id: "",
    notes: "",
    status: "planned",
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchData = useCallback(async () => {
    const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;

    const [eRes, pRes, dRes, sRes] = await Promise.all([
      fetch(
        `/api/linkedin/calendar?date_from=${dateFrom}&date_to=${dateTo}`
      ),
      fetch("/api/linkedin/pillars"),
      fetch("/api/linkedin/drafts?status=draft"),
      fetch("/api/linkedin/series"),
    ]);
    const eData = await eRes.json();
    const pData = await pRes.json();
    const dData = await dRes.json();
    const sData = await sRes.json();
    setEntries(eData.entries || []);
    setPillars(pData.pillars || []);
    setDrafts(dData.drafts || []);
    setSeriesList(sData.series || []);
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleAddEntry = async (e: React.FormEvent, date: string) => {
    e.preventDefault();
    await fetch("/api/linkedin/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_date: date,
        scheduled_time: addForm.scheduled_time || null,
        pillar_id: addForm.pillar_id ? Number(addForm.pillar_id) : null,
        draft_id: addForm.draft_id ? Number(addForm.draft_id) : null,
        series_id: addForm.series_id ? Number(addForm.series_id) : null,
        notes: addForm.notes || null,
        status: addForm.status,
      }),
    });
    setShowAdd(null);
    setAddForm({
      scheduled_time: "",
      pillar_id: "",
      draft_id: "",
      series_id: "",
      notes: "",
      status: "planned",
    });
    fetchData();
  };

  const handleDeleteEntry = async (id: number) => {
    await fetch(`/api/linkedin/calendar/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleUpdateStatus = async (entryId: number, status: string) => {
    await fetch(`/api/linkedin/calendar/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const handleMarkPosted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markPostModal) return;

    // Create the post
    const postRes = await fetch("/api/linkedin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "me",
        content: postForm.content,
        post_url: postForm.post_url || null,
        post_type: postForm.post_type,
        posted_at: postForm.posted_at || new Date().toISOString(),
        pillar_id: markPostModal.pillar_id,
        series_id: markPostModal.series_id || null,
        topic_tags: [],
        cta_type: "none",
      }),
    });
    const postData = await postRes.json();

    // Update calendar entry to posted
    await fetch(`/api/linkedin/calendar/${markPostModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "posted",
        post_id: postData.post?.id,
      }),
    });

    // If linked to a draft, mark it as posted
    if (markPostModal.draft_id && postData.post?.id) {
      await fetch(
        `/api/linkedin/drafts/${markPostModal.draft_id}/mark-posted?post_id=${postData.post.id}`,
        { method: "POST" }
      );
    }

    setMarkPostModal(null);
    setPostForm({ content: "", post_url: "", post_type: "text", posted_at: "" });
    fetchData();
  };

  const handleGetSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/linkedin/calendar/suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      // failed
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));
  const draftMap = Object.fromEntries(drafts.map((d) => [d.id, d]));

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : null;

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        <button
          onClick={handleGetSuggestions}
          disabled={loadingSuggestions}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {loadingSuggestions ? "Loading..." : "AI Suggestions"}
        </button>
      </div>

      {/* Suggestions */}
      {suggestions && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
          <h3 className="text-sm font-semibold text-indigo-900 mb-2">
            AI Content Suggestions for Next Week
          </h3>
          <pre className="text-xs text-indigo-700 whitespace-pre-wrap">
            {JSON.stringify(suggestions, null, 2)}
          </pre>
          <button
            onClick={() => setSuggestions(null)}
            className="mt-2 text-xs text-indigo-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
          {currentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50"
                />
              );
            }

            const dateStr = getDateStr(day);
            const dayEntries = entries.filter(
              (e) => e.scheduled_date === dateStr
            );
            const isToday = day === todayStr;

            return (
              <div
                key={day}
                className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 ${isToday ? "bg-indigo-50/50" : ""}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`text-xs font-medium ${isToday ? "bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-gray-500"}`}
                  >
                    {day}
                  </span>
                  <button
                    onClick={() => setShowAdd(dateStr)}
                    className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Entries */}
                {dayEntries.map((entry) => {
                  const pillar = entry.pillar_id
                    ? pillarMap[entry.pillar_id]
                    : null;
                  const linkedDraft = entry.draft_id
                    ? draftMap[entry.draft_id]
                    : null;
                  return (
                    <div
                      key={entry.id}
                      className={`group text-[10px] px-1.5 py-1 rounded border mb-0.5 ${STATUS_COLORS[entry.status] || ""}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          {entry.scheduled_time && (
                            <span className="font-medium">
                              {entry.scheduled_time}{" "}
                            </span>
                          )}
                          {pillar && (
                            <span
                              className="font-medium"
                              style={{ color: pillar.color }}
                            >
                              {pillar.name}
                            </span>
                          )}
                          {linkedDraft && (
                            <div className="flex items-center gap-0.5 text-indigo-600">
                              <FileText className="w-2.5 h-2.5" />
                              <span className="truncate">{linkedDraft.topic}</span>
                            </div>
                          )}
                          {entry.notes && (
                            <p className="truncate">{entry.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                          {entry.status !== "posted" && (
                            <button
                              onClick={() => {
                                setMarkPostModal(entry);
                                // Pre-fill content from linked draft
                                if (linkedDraft) {
                                  setPostForm({
                                    content: linkedDraft.content,
                                    post_url: "",
                                    post_type: "text",
                                    posted_at: `${entry.scheduled_date}T${entry.scheduled_time || "09:00"}`,
                                  });
                                }
                              }}
                              className="p-0.5 hover:bg-green-100 rounded"
                              title="Mark as posted"
                            >
                              <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-0.5 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      {/* Quick status toggle */}
                      {entry.status === "planned" && (
                        <button
                          onClick={() => handleUpdateStatus(entry.id, "ready")}
                          className="text-[9px] text-blue-600 hover:underline mt-0.5"
                        >
                          Mark ready
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add form for this date */}
                {showAdd === dateStr && (
                  <form
                    onSubmit={(e) => handleAddEntry(e, dateStr)}
                    className="mt-1 p-1.5 rounded bg-indigo-50 border border-indigo-200 space-y-1"
                  >
                    <input
                      type="time"
                      value={addForm.scheduled_time}
                      onChange={(e) =>
                        setAddForm({
                          ...addForm,
                          scheduled_time: e.target.value,
                        })
                      }
                      className="w-full border rounded px-1 py-0.5 text-[10px]"
                    />
                    <select
                      value={addForm.pillar_id}
                      onChange={(e) =>
                        setAddForm({ ...addForm, pillar_id: e.target.value })
                      }
                      className="w-full border rounded px-1 py-0.5 text-[10px]"
                    >
                      <option value="">Pillar</option>
                      {pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {drafts.length > 0 && (
                      <select
                        value={addForm.draft_id}
                        onChange={(e) =>
                          setAddForm({ ...addForm, draft_id: e.target.value })
                        }
                        className="w-full border rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="">Link draft...</option>
                        {drafts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.topic}
                          </option>
                        ))}
                      </select>
                    )}
                    {seriesList.length > 0 && (
                      <select
                        value={addForm.series_id}
                        onChange={(e) =>
                          setAddForm({ ...addForm, series_id: e.target.value })
                        }
                        className="w-full border rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="">Series...</option>
                        {seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={addForm.notes}
                      onChange={(e) =>
                        setAddForm({ ...addForm, notes: e.target.value })
                      }
                      className="w-full border rounded px-1 py-0.5 text-[10px]"
                      placeholder="Notes..."
                    />
                    <div className="flex gap-1">
                      <button
                        type="submit"
                        className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] rounded"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdd(null)}
                        className="px-1.5 py-0.5 text-gray-600 text-[10px] rounded border"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mark as Posted Modal */}
      {markPostModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm">
          <form
            onSubmit={handleMarkPosted}
            className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Mark as Posted
              </h3>
              <button
                type="button"
                onClick={() => setMarkPostModal(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Create a post record for this calendar entry.
              {markPostModal.notes && (
                <span className="block mt-1 font-medium text-gray-700">
                  {markPostModal.notes}
                </span>
              )}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Post Content
              </label>
              <textarea
                value={postForm.content}
                onChange={(e) =>
                  setPostForm({ ...postForm, content: e.target.value })
                }
                rows={6}
                className={inputClass}
                placeholder="Paste the published post content..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Post Type
                </label>
                <select
                  value={postForm.post_type}
                  onChange={(e) =>
                    setPostForm({ ...postForm, post_type: e.target.value })
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
                  value={postForm.posted_at}
                  onChange={(e) =>
                    setPostForm({ ...postForm, posted_at: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Post URL
              </label>
              <input
                type="url"
                value={postForm.post_url}
                onChange={(e) =>
                  setPostForm({ ...postForm, post_url: e.target.value })
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
                onClick={() => setMarkPostModal(null)}
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

CalendarPage.displayName = "CalendarPage";
export default CalendarPage;
