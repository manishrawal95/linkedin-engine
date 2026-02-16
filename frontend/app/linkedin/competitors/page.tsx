"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Users, ExternalLink, X, Edit2 } from "lucide-react";

interface Competitor {
  id: number;
  name: string;
  linkedin_url: string | null;
  niche: string | null;
  notes: string | null;
  avg_impressions: number | null;
  avg_engagement_score: number | null;
  post_count: number;
  created_at: string;
}

const CompetitorsPage = memo(function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    linkedin_url: "",
    niche: "",
    notes: "",
  });

  const fetchCompetitors = useCallback(async () => {
    const res = await fetch("/api/linkedin/competitors");
    const data = await res.json();
    setCompetitors(data.competitors || []);
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      ...form,
      linkedin_url: form.linkedin_url || null,
      niche: form.niche || null,
      notes: form.notes || null,
    };

    if (editId) {
      await fetch(`/api/linkedin/competitors/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/linkedin/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setShowForm(false);
    setEditId(null);
    setForm({ name: "", linkedin_url: "", niche: "", notes: "" });
    fetchCompetitors();
  };

  const handleEdit = (comp: Competitor) => {
    setForm({
      name: comp.name,
      linkedin_url: comp.linkedin_url || "",
      niche: comp.niche || "",
      notes: comp.notes || "",
    });
    setEditId(comp.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this competitor?")) return;
    await fetch(`/api/linkedin/competitors/${id}`, { method: "DELETE" });
    fetchCompetitors();
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Competitor Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm({ name: "", linkedin_url: "", niche: "", notes: "" });
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Competitor
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {editId ? "Edit Competitor" : "Add Competitor"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
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
                placeholder="Competitor name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niche</label>
              <input
                type="text"
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
                className={inputClass}
                placeholder="e.g., Tech Leadership"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              className={inputClass}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="What makes them stand out? What can you learn?"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              {editId ? "Update" : "Add Competitor"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="px-5 py-2.5 text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {competitors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No competitors tracked yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add competitors to analyze their content strategy
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Competitor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competitors.map((comp) => (
            <div
              key={comp.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{comp.name}</h3>
                  {comp.niche && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium mt-1 inline-block">
                      {comp.niche}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {comp.linkedin_url && (
                    <a
                      href={comp.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(comp)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {comp.notes && (
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                  {comp.notes}
                </p>
              )}

              <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {comp.post_count}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {comp.avg_impressions
                      ? Math.round(comp.avg_impressions).toLocaleString()
                      : "-"}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">Avg Imp</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-indigo-600">
                    {comp.avg_engagement_score
                      ? `${(comp.avg_engagement_score * 100).toFixed(1)}%`
                      : "-"}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">Avg Eng</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

CompetitorsPage.displayName = "CompetitorsPage";
export default CompetitorsPage;
