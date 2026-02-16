"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Palette, PenTool, Check, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface Pillar {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface MoodBoardItem {
  id: number;
  pillar_id: number;
  type: string;
  content: string;
  source_url: string | null;
  sort_order: number;
}

const ITEM_TYPES = ["note", "idea", "quote", "link", "saved_post"];

const TYPE_STYLES: Record<string, string> = {
  note: "bg-blue-50 text-blue-600 border-blue-100",
  idea: "bg-amber-50 text-amber-600 border-amber-100",
  quote: "bg-purple-50 text-purple-600 border-purple-100",
  link: "bg-cyan-50 text-cyan-600 border-cyan-100",
  saved_post: "bg-green-50 text-green-600 border-green-100",
};

const MoodBoardPage = memo(function MoodBoardPage() {
  const router = useRouter();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [items, setItems] = useState<MoodBoardItem[]>([]);
  const [draftedIds, setDraftedIds] = useState<Set<number>>(new Set());
  const [generatingDraftId, setGeneratingDraftId] = useState<number | null>(null);
  const [showPillarForm, setShowPillarForm] = useState(false);
  const [addingToPillar, setAddingToPillar] = useState<number | null>(null);
  const [pillarForm, setPillarForm] = useState({
    name: "",
    color: "#6366f1",
    description: "",
  });
  const [itemForm, setItemForm] = useState({
    type: "note",
    content: "",
    source_url: "",
  });
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    type: "note",
    content: "",
    source_url: "",
  });
  const [editingPillar, setEditingPillar] = useState<number | null>(null);
  const [editPillarForm, setEditPillarForm] = useState({
    name: "",
    color: "#6366f1",
    description: "",
  });

  const fetchData = useCallback(async () => {
    const [pRes, mRes] = await Promise.all([
      fetch("/api/linkedin/pillars"),
      fetch("/api/linkedin/mood-board"),
    ]);
    const pData = await pRes.json();
    const mData = await mRes.json();
    setPillars(pData.pillars || []);
    setItems(mData.items || []);
    setDraftedIds(new Set(mData.drafted_item_ids || []));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddPillar = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/linkedin/pillars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pillarForm),
    });
    setShowPillarForm(false);
    setPillarForm({ name: "", color: "#6366f1", description: "" });
    fetchData();
  };

  const handleDeletePillar = async (id: number) => {
    if (!confirm("Delete this pillar and all its mood board items?")) return;
    await fetch(`/api/linkedin/pillars/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleAddItem = async (e: React.FormEvent, pillarId: number) => {
    e.preventDefault();
    await fetch("/api/linkedin/mood-board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pillar_id: pillarId,
        ...itemForm,
        source_url: itemForm.source_url || null,
      }),
    });
    setAddingToPillar(null);
    setItemForm({ type: "note", content: "", source_url: "" });
    fetchData();
  };

  const handleDeleteItem = async (id: number) => {
    await fetch(`/api/linkedin/mood-board/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleCreateDraft = async (item: MoodBoardItem, pillarName: string) => {
    setGeneratingDraftId(item.id);
    try {
      const topic = `${pillarName}: ${item.content.slice(0, 100)}`;
      const res = await fetch("/api/linkedin/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          pillar_id: item.pillar_id,
          num_variants: 2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Draft generation failed: ${err.detail || "Unknown error"}`);
        return;
      }
      const data = await res.json();
      // Link mood board item to the generated drafts
      for (const draft of data.drafts || []) {
        await fetch(`/api/linkedin/drafts/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood_board_item_id: item.id }),
        });
      }
      setDraftedIds((prev) => new Set(prev).add(item.id));
      router.push("/linkedin/drafts");
    } catch {
      alert("Draft generation failed. Check that the backend is running.");
    } finally {
      setGeneratingDraftId(null);
    }
  };

  const startEditItem = (item: MoodBoardItem) => {
    setEditingItem(item.id);
    setEditItemForm({
      type: item.type,
      content: item.content,
      source_url: item.source_url || "",
    });
  };

  const handleUpdateItem = async (e: React.FormEvent, itemId: number) => {
    e.preventDefault();
    await fetch(`/api/linkedin/mood-board/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editItemForm.type,
        content: editItemForm.content,
        source_url: editItemForm.source_url || null,
      }),
    });
    setEditingItem(null);
    fetchData();
  };

  const startEditPillar = (pillar: Pillar) => {
    setEditingPillar(pillar.id);
    setEditPillarForm({
      name: pillar.name,
      color: pillar.color,
      description: pillar.description || "",
    });
  };

  const handleUpdatePillar = async (e: React.FormEvent, pillarId: number) => {
    e.preventDefault();
    await fetch(`/api/linkedin/pillars/${pillarId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editPillarForm),
    });
    setEditingPillar(null);
    fetchData();
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mood Board</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pillars.length} pillar{pillars.length !== 1 ? "s" : ""}, {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowPillarForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Pillar
        </button>
      </div>

      {showPillarForm && (
        <form
          onSubmit={handleAddPillar}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">
            New Content Pillar
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={pillarForm.name}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, name: e.target.value })
                }
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={pillarForm.color}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, color: e.target.value })
                }
                className="w-full h-9 border border-gray-200 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={pillarForm.description}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, description: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Create Pillar
            </button>
            <button
              type="button"
              onClick={() => setShowPillarForm(false)}
              className="px-5 py-2.5 text-gray-700 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Columns layout */}
      {pillars.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Palette className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No pillars yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Create your first content pillar to start organizing ideas
          </p>
          <button
            onClick={() => setShowPillarForm(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Pillar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pillars.map((pillar) => {
            const pillarItems = items.filter(
              (i) => i.pillar_id === pillar.id
            );
            return (
              <div
                key={pillar.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Pillar header */}
                <div
                  className="px-4 py-3"
                  style={{
                    borderBottom: `3px solid ${editingPillar === pillar.id ? editPillarForm.color : pillar.color}`,
                  }}
                >
                  {editingPillar === pillar.id ? (
                    <form onSubmit={(e) => handleUpdatePillar(e, pillar.id)} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editPillarForm.name}
                          onChange={(e) => setEditPillarForm({ ...editPillarForm, name: e.target.value })}
                          className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white font-semibold"
                          required
                        />
                        <input
                          type="color"
                          value={editPillarForm.color}
                          onChange={(e) => setEditPillarForm({ ...editPillarForm, color: e.target.value })}
                          className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                        />
                      </div>
                      <input
                        type="text"
                        value={editPillarForm.description}
                        onChange={(e) => setEditPillarForm({ ...editPillarForm, description: e.target.value })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                        placeholder="Description (optional)"
                      />
                      <div className="flex gap-1">
                        <button type="submit" className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingPillar(null)} className="px-2.5 py-1 text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {pillar.name}
                        </h3>
                        {pillar.description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {pillar.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditPillar(pillar)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                          title="Edit pillar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setAddingToPillar(pillar.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePillar(pillar.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="p-3 space-y-2 min-h-[120px]">
                  {addingToPillar === pillar.id && (
                    <form
                      onSubmit={(e) => handleAddItem(e, pillar.id)}
                      className="p-3 rounded-lg border border-indigo-200 bg-indigo-50 space-y-2"
                    >
                      <select
                        value={itemForm.type}
                        onChange={(e) =>
                          setItemForm({ ...itemForm, type: e.target.value })
                        }
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
                      >
                        {ITEM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={itemForm.content}
                        onChange={(e) =>
                          setItemForm({ ...itemForm, content: e.target.value })
                        }
                        rows={3}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
                        placeholder="Content..."
                        required
                      />
                      <div className="flex gap-1">
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingToPillar(null)}
                          className="px-3 py-1.5 text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {pillarItems.map((item) => (
                    <div
                      key={item.id}
                      className="group p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all"
                    >
                      {editingItem === item.id ? (
                        <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-2">
                          <select
                            value={editItemForm.type}
                            onChange={(e) => setEditItemForm({ ...editItemForm, type: e.target.value })}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
                          >
                            {ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <textarea
                            value={editItemForm.content}
                            onChange={(e) => setEditItemForm({ ...editItemForm, content: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white"
                            required
                          />
                          <div className="flex gap-1">
                            <button type="submit" className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
                              Save
                            </button>
                            <button type="button" onClick={() => setEditingItem(null)} className="px-2.5 py-1 text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0 cursor-grab" />
                            <div className="min-w-0">
                              <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${TYPE_STYLES[item.type] || "bg-gray-50 text-gray-600"}`}>
                                {item.type}
                              </span>
                              {draftedIds.has(item.id) && (
                                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border bg-green-50 text-green-600 border-green-100 ml-1">
                                  drafted
                                </span>
                              )}
                              <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                                {item.content}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => startEditItem(item)}
                              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                              title="Edit item"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => !draftedIds.has(item.id) && generatingDraftId !== item.id && handleCreateDraft(item, pillar.name)}
                              className={`p-0.5 rounded ${draftedIds.has(item.id) ? "text-green-400 cursor-default" : generatingDraftId === item.id ? "text-indigo-500 animate-pulse cursor-wait" : "hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"}`}
                              title={draftedIds.has(item.id) ? "Already drafted" : generatingDraftId === item.id ? "Generating draft with AI..." : "Generate AI draft from this"}
                            >
                              {draftedIds.has(item.id) ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <PenTool className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {pillarItems.length === 0 && addingToPillar !== pillar.id && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-xs text-gray-400">No items yet</p>
                      <button
                        onClick={() => setAddingToPillar(pillar.id)}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        + Add item
                      </button>
                    </div>
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

MoodBoardPage.displayName = "MoodBoardPage";
export default MoodBoardPage;
