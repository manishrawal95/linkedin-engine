"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Layers, X, ToggleLeft, ToggleRight, FileText, Clock } from "lucide-react";

interface Series {
  id: number;
  name: string;
  description: string | null;
  pillar_id: number | null;
  frequency: string;
  preferred_day: string | null;
  preferred_time: string | null;
  is_active: number;
  created_at: string;
}

interface Pillar {
  id: number;
  name: string;
  color: string;
}

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SeriesPage = memo(function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [seriesStats, setSeriesStats] = useState<Record<number, { post_count: number; last_posted: string | null }>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    pillar_id: "",
    frequency: "weekly",
    preferred_day: "",
    preferred_time: "",
  });

  const fetchData = useCallback(async () => {
    const [sRes, pRes] = await Promise.all([
      fetch("/api/linkedin/series"),
      fetch("/api/linkedin/pillars"),
    ]);
    const sData = await sRes.json();
    const pData = await pRes.json();
    const seriesList = sData.series || [];
    setSeries(seriesList);
    setPillars(pData.pillars || []);

    // Fetch stats for each series
    const stats: Record<number, { post_count: number; last_posted: string | null }> = {};
    await Promise.all(
      seriesList.map(async (s: Series) => {
        try {
          const res = await fetch(`/api/linkedin/series/${s.id}/stats`);
          const data = await res.json();
          stats[s.id] = { post_count: data.post_count || 0, last_posted: data.last_posted || null };
        } catch {
          stats[s.id] = { post_count: 0, last_posted: null };
        }
      })
    );
    setSeriesStats(stats);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/linkedin/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        pillar_id: form.pillar_id ? Number(form.pillar_id) : null,
        preferred_day: form.preferred_day || null,
        preferred_time: form.preferred_time || null,
      }),
    });
    setShowForm(false);
    setForm({
      name: "",
      description: "",
      pillar_id: "",
      frequency: "weekly",
      preferred_day: "",
      preferred_time: "",
    });
    fetchData();
  };

  const handleToggleActive = async (s: Series) => {
    await fetch(`/api/linkedin/series/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }),
    });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this series?")) return;
    await fetch(`/api/linkedin/series/${id}`, { method: "DELETE" });
    fetchData();
  };

  const pillarMap = Object.fromEntries(pillars.map((p) => [p.id, p]));

  const freqColors: Record<string, string> = {
    daily: "bg-red-100 text-red-700",
    weekly: "bg-blue-100 text-blue-700",
    biweekly: "bg-cyan-100 text-cyan-700",
    monthly: "bg-purple-100 text-purple-700",
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Content Series
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {series.length} series, {series.filter((s) => s.is_active).length} active
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Series
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">New Series</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="e.g., Monday Motivation"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pillar</label>
              <select
                value={form.pillar_id}
                onChange={(e) => setForm({ ...form, pillar_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Any pillar</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="What's this series about?"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className={inputClass}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Day</label>
              <select
                value={form.preferred_day}
                onChange={(e) => setForm({ ...form, preferred_day: e.target.value })}
                className={inputClass}
              >
                <option value="">Any day</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
              <input
                type="time"
                value={form.preferred_time}
                onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Create Series
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

      {series.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No content series yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Create recurring content series for consistency
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Series
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {series.map((s) => {
            const pillar = s.pillar_id ? pillarMap[s.pillar_id] : null;
            return (
              <div
                key={s.id}
                className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow ${!s.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${freqColors[s.frequency] || "bg-gray-100 text-gray-600"}`}>
                        {s.frequency}
                      </span>
                      {pillar && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-md font-medium"
                          style={{
                            backgroundColor: `${pillar.color}15`,
                            color: pillar.color,
                          }}
                        >
                          {pillar.name}
                        </span>
                      )}
                      {s.preferred_day && (
                        <span className="text-xs text-gray-400">
                          {s.preferred_day}
                        </span>
                      )}
                      {s.preferred_time && (
                        <span className="text-xs text-gray-400">
                          at {s.preferred_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleActive(s)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                      title={s.is_active ? "Deactivate" : "Activate"}
                    >
                      {s.is_active ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {s.description && (
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                    {s.description}
                  </p>
                )}
                {/* Stats */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-semibold text-gray-700">{seriesStats[s.id]?.post_count || 0}</span> posts
                  </span>
                  {seriesStats[s.id]?.last_posted && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      Last: {new Date(seriesStats[s.id].last_posted!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {!seriesStats[s.id]?.last_posted && seriesStats[s.id]?.post_count === 0 && (
                    <span className="text-xs text-amber-500 font-medium">No posts yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SeriesPage.displayName = "SeriesPage";
export default SeriesPage;
