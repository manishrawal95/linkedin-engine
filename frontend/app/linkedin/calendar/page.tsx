"use client";

import { memo, useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle,
  FileText,
  X,
  Eye,
} from "lucide-react";
import type { CalendarEntry, Pillar, Draft, Series } from "@/types/linkedin";
import { useToast } from "../components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-50 border-blue-200/60 text-blue-700",
  ready: "bg-emerald-50 border-emerald-200/60 text-emerald-700",
  posted: "bg-stone-100 border-stone-200/60 text-stone-500",
  skipped: "bg-red-50 border-red-200/60 text-red-400",
};

const selectClass =
  "w-full rounded-xl border border-stone-200 bg-white text-stone-700 text-sm h-9 px-3 outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-300 transition-colors";

const selectCompactClass =
  "w-full rounded-lg border border-stone-200 bg-white text-stone-700 text-sm px-1 py-0.5 outline-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-300 transition-colors";

const CalendarPage = memo(function CalendarPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);
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
      fetch("/api/linkedin/drafts"),
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
    if (!postRes.ok) {
      toast.error("Failed to create post record — please try again.");
      return;
    }
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
          Content Calendar
        </h1>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          Ready
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
          Posted
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="hover:bg-stone-100"
        >
          <ChevronLeft className="w-5 h-5 text-stone-600" />
        </Button>
        <h2 className="text-lg font-semibold text-stone-900 min-w-[200px] text-center">
          {currentDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="hover:bg-stone-100"
        >
          <ChevronRight className="w-5 h-5 text-stone-600" />
        </Button>
      </div>

      {/* Mobile: list view */}
      <div className="sm:hidden space-y-2">
        {(() => {
          const daysWithEntries: { day: number; dateStr: string; dayEntries: CalendarEntry[] }[] = [];
          for (let d = 1; d <= daysInMonth; d++) {
            const ds = getDateStr(d);
            const de = entries.filter((e) => e.scheduled_date === ds);
            if (de.length > 0) daysWithEntries.push({ day: d, dateStr: ds, dayEntries: de });
          }
          if (daysWithEntries.length === 0) {
            return (
              <div className="text-center py-12 text-sm text-stone-400">
                No scheduled posts this month
              </div>
            );
          }
          return daysWithEntries.map(({ day, dateStr: ds, dayEntries: de }) => (
            <div key={day} className="bg-white rounded-2xl border border-stone-200/60 p-3">
              <p className="text-xs font-semibold text-stone-500 mb-2">
                {new Date(year, month, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {day === todayStr && <span className="ml-1.5 text-stone-900">Today</span>}
              </p>
              <div className="space-y-1.5">
                {de.map((entry) => {
                  const pillar = entry.pillar_id ? pillarMap[entry.pillar_id] : null;
                  const linkedDraft = entry.draft_id ? draftMap[entry.draft_id] : null;
                  const displayText = linkedDraft?.topic || entry.notes || "";
                  return (
                    <div
                      key={entry.id}
                      onClick={() => linkedDraft && setPreviewDraft(linkedDraft)}
                      className={`text-sm px-3 py-2.5 rounded-xl border ${STATUS_COLORS[entry.status] || ""} ${linkedDraft ? "cursor-pointer active:scale-[0.98] transition-all" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {entry.scheduled_time && (
                          <span className="font-semibold text-xs shrink-0">{entry.scheduled_time}</span>
                        )}
                        {pillar && (
                          <span className="font-medium text-xs" style={{ color: pillar.color }}>
                            {pillar.name}
                          </span>
                        )}
                      </div>
                      {displayText && (
                        <p className="text-stone-600 text-xs mt-1 line-clamp-2">{displayText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Desktop: Calendar grid */}
      <div className="hidden sm:block bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-stone-200/60">
          {DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-stone-500 uppercase"
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
                  className="min-h-[120px] border-b border-r border-stone-100 bg-stone-50/50"
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
                className={`min-h-[120px] border-b border-r border-stone-100 p-1.5 ${isToday ? "bg-stone-50/80" : ""}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`text-xs font-medium ${isToday ? "bg-stone-900 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-stone-500"}`}
                  >
                    {day}
                  </span>
                  <button
                    onClick={() => setShowAdd(dateStr)}
                    className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600"
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
                  const displayText = linkedDraft?.topic || entry.notes || "";
                  return (
                    <div
                      key={entry.id}
                      className={`group text-xs px-1.5 py-1 rounded-lg border mb-0.5 ${STATUS_COLORS[entry.status] || ""}`}
                    >
                      <div className="flex justify-between items-start gap-0.5">
                        <div
                          className={`min-w-0 flex-1 ${linkedDraft ? "cursor-pointer" : ""}`}
                          onClick={() => linkedDraft && setPreviewDraft(linkedDraft)}
                        >
                          <p className="truncate">
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
                          </p>
                          {displayText && (
                            <p className="truncate text-stone-600">{displayText}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                          {entry.status !== "posted" ? (
                            <button
                              onClick={() => {
                                setMarkPostModal(entry);
                                if (linkedDraft) {
                                  setPostForm({
                                    content: linkedDraft.content,
                                    post_url: "",
                                    post_type: "text",
                                    posted_at: `${entry.scheduled_date}T${entry.scheduled_time || "09:00"}`,
                                  });
                                }
                              }}
                              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-emerald-100 rounded"
                              title="Mark as posted"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Quick status toggle */}
                      {entry.status === "planned" && (
                        <button
                          onClick={() => handleUpdateStatus(entry.id, "ready")}
                          className="text-xs text-stone-600 hover:text-stone-900 hover:underline mt-0.5"
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
                    className="mt-1 p-1.5 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1"
                  >
                    <Input
                      type="time"
                      value={addForm.scheduled_time}
                      onChange={(e) =>
                        setAddForm({
                          ...addForm,
                          scheduled_time: e.target.value,
                        })
                      }
                      className="h-7 text-sm px-1 rounded-lg border-stone-200"
                    />
                    <select
                      value={addForm.pillar_id}
                      onChange={(e) =>
                        setAddForm({ ...addForm, pillar_id: e.target.value })
                      }
                      className={selectCompactClass}
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
                        className={selectCompactClass}
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
                        className={selectCompactClass}
                      >
                        <option value="">Series...</option>
                        {seriesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <Input
                      type="text"
                      value={addForm.notes}
                      onChange={(e) =>
                        setAddForm({ ...addForm, notes: e.target.value })
                      }
                      className="h-7 text-sm px-1 rounded-lg border-stone-200"
                      placeholder="Notes..."
                    />
                    <div className="flex gap-1">
                      <Button
                        type="submit"
                        size="xs"
                        className="bg-stone-900 text-white hover:bg-stone-800"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setShowAdd(null)}
                        className="border-stone-200 text-stone-600"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mark as Posted Modal */}
      <Dialog
        open={markPostModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMarkPostModal(null);
            setPostForm({ content: "", post_url: "", post_type: "text", posted_at: "" });
          }
        }}
      >
        <DialogContent className="rounded-2xl border-stone-200/60">
          <form onSubmit={handleMarkPosted} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-stone-900">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Mark as Posted
              </DialogTitle>
              <DialogDescription className="text-stone-500">
                Create a post record for this calendar entry.
                {markPostModal?.notes && (
                  <span className="block mt-1 font-medium text-stone-700">
                    {markPostModal.notes}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Post Content
              </label>
              <Textarea
                value={postForm.content}
                onChange={(e) =>
                  setPostForm({ ...postForm, content: e.target.value })
                }
                rows={6}
                className="rounded-xl border-stone-200 bg-stone-50/50 focus:bg-white text-sm"
                placeholder="Paste the published post content..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Post Type
                </label>
                <select
                  value={postForm.post_type}
                  onChange={(e) =>
                    setPostForm({ ...postForm, post_type: e.target.value })
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
                  value={postForm.posted_at}
                  onChange={(e) =>
                    setPostForm({ ...postForm, posted_at: e.target.value })
                  }
                  className="rounded-xl border-stone-200 bg-stone-50/50 focus:bg-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Post URL
              </label>
              <Input
                type="url"
                value={postForm.post_url}
                onChange={(e) =>
                  setPostForm({ ...postForm, post_url: e.target.value })
                }
                className="rounded-xl border-stone-200 bg-stone-50/50 focus:bg-white text-sm"
                placeholder="https://linkedin.com/posts/..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMarkPostModal(null)}
                className="border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                Create Post & Mark Posted
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Draft Preview Modal */}
      {previewDraft && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setPreviewDraft(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900 truncate">
                {previewDraft.topic}
              </h3>
              <button
                onClick={() => setPreviewDraft(null)}
                className="p-1.5 hover:bg-stone-100 rounded-lg"
              >
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                {previewDraft.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CalendarPage.displayName = "CalendarPage";
export default CalendarPage;
