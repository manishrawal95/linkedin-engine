"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Palette, PenTool, Check, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pillar, MoodBoardItem } from "@/types/linkedin";

const ITEM_TYPES = ["note", "idea", "quote", "link", "saved post"];

const TYPE_STYLES: Record<string, string> = {
  note: "bg-blue-50 text-blue-700 border-blue-200/60",
  idea: "bg-amber-50 text-amber-700 border-amber-200/60",
  quote: "bg-purple-50 text-purple-700 border-purple-200/60",
  link: "bg-cyan-50 text-cyan-700 border-cyan-200/60",
  saved_post: "bg-green-50 text-green-700 border-green-200/60",
};

const MoodBoardPage = memo(function MoodBoardPage() {
  const router = useRouter();
  const toast = useToast();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [items, setItems] = useState<MoodBoardItem[]>([]);
  const [draftedIds, setDraftedIds] = useState<Set<number>>(new Set());
  const [generatingDraftId, setGeneratingDraftId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [deletingPillarId, setDeletingPillarId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        fetch("/api/linkedin/pillars"),
        fetch("/api/linkedin/mood-board"),
      ]);
      const pData = await pRes.json();
      const mData = await mRes.json();
      setPillars(pData.pillars || []);
      setItems(mData.items || []);
      setDraftedIds(new Set(mData.drafted_item_ids || []));
    } finally {
      setLoading(false);
    }
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
    await fetch(`/api/linkedin/pillars/${id}`, { method: "DELETE" });
    setDeletingPillarId(null);
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
        toast.error(`Draft generation failed: ${err.detail || "Unknown error"}`);
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
    } catch (err) {
      console.error("MoodBoardPage.handleCreateDraft: POST /api/linkedin/drafts/generate failed:", err);
      toast.error("Draft generation failed. Check that the backend is running.");
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

  const deletingPillar = pillars.find((p) => p.id === deletingPillarId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Delete pillar confirmation dialog */}
      <Dialog open={deletingPillarId !== null} onOpenChange={(open) => { if (!open) setDeletingPillarId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pillar</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{deletingPillar?.name}&rdquo; and all its mood board items? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPillarId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingPillarId !== null && handleDeletePillar(deletingPillarId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Mood Board</h1>
          <p className="text-sm text-stone-500 mt-1">
            {pillars.length} pillar{pillars.length !== 1 ? "s" : ""}, {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowPillarForm(true)}>
          <Plus className="w-4 h-4" />
          Add Pillar
        </Button>
      </div>

      {showPillarForm && (
        <form
          onSubmit={handleAddPillar}
          className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-stone-900">
            New Content Pillar
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Name
              </label>
              <Input
                type="text"
                value={pillarForm.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPillarForm({ ...pillarForm, name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={pillarForm.color}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, color: e.target.value })
                }
                className="w-full h-9 border border-stone-200/60 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Description
              </label>
              <Input
                type="text"
                value={pillarForm.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPillarForm({ ...pillarForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit">
              Create Pillar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPillarForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Columns layout */}
      {pillars.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200/60">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Palette className="w-8 h-8 text-stone-400" />
          </div>
          <p className="text-sm font-medium text-stone-600">No pillars yet</p>
          <p className="text-xs text-stone-400 mt-1">
            Create your first content pillar to start organizing ideas
          </p>
          <Button
            onClick={() => setShowPillarForm(true)}
            className="mt-4"
          >
            <Plus className="w-4 h-4" />
            Add Pillar
          </Button>
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
                className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden"
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
                        <Input
                          type="text"
                          value={editPillarForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPillarForm({ ...editPillarForm, name: e.target.value })}
                          className="flex-1 font-semibold"
                          required
                        />
                        <input
                          type="color"
                          value={editPillarForm.color}
                          onChange={(e) => setEditPillarForm({ ...editPillarForm, color: e.target.value })}
                          className="w-8 h-8 border border-stone-200/60 rounded cursor-pointer"
                        />
                      </div>
                      <Input
                        type="text"
                        value={editPillarForm.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditPillarForm({ ...editPillarForm, description: e.target.value })}
                        className="text-xs"
                        placeholder="Description (optional)"
                      />
                      <div className="flex gap-1">
                        <Button type="submit" size="xs">
                          Save
                        </Button>
                        <Button type="button" variant="outline" size="xs" onClick={() => setEditingPillar(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-stone-900 text-sm">
                          {pillar.name}
                        </h3>
                        {pillar.description && (
                          <p className="text-xs text-stone-500 mt-0.5">
                            {pillar.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => startEditPillar(pillar)}
                          title="Edit pillar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setAddingToPillar(pillar.id)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeletingPillarId(pillar.id)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="p-3 space-y-2 min-h-[120px]">
                  {addingToPillar === pillar.id && (
                    <form
                      onSubmit={(e) => handleAddItem(e, pillar.id)}
                      className="p-3 rounded-xl border border-stone-200/60 bg-stone-50 space-y-2"
                    >
                      <Select
                        value={itemForm.type}
                        onValueChange={(value: string) =>
                          setItemForm({ ...itemForm, type: value })
                        }
                      >
                        <SelectTrigger className="w-full" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={itemForm.content}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setItemForm({ ...itemForm, content: e.target.value })
                        }
                        rows={3}
                        className="text-xs"
                        placeholder="Content..."
                        required
                      />
                      <div className="flex gap-1">
                        <Button type="submit" size="xs">
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setAddingToPillar(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}

                  {pillarItems.map((item) => (
                    <div
                      key={item.id}
                      className="group p-2.5 rounded-xl bg-stone-50 border border-stone-100 hover:border-stone-200/60 transition-all"
                    >
                      {editingItem === item.id ? (
                        <form onSubmit={(e) => handleUpdateItem(e, item.id)} className="space-y-2">
                          <Select
                            value={editItemForm.type}
                            onValueChange={(value: string) => setEditItemForm({ ...editItemForm, type: value })}
                          >
                            <SelectTrigger className="w-full" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            value={editItemForm.content}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditItemForm({ ...editItemForm, content: e.target.value })}
                            rows={3}
                            className="text-xs"
                            required
                          />
                          <div className="flex gap-1">
                            <Button type="submit" size="xs">
                              Save
                            </Button>
                            <Button type="button" variant="outline" size="xs" onClick={() => setEditingItem(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <div className="min-w-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-semibold ${TYPE_STYLES[item.type] || "bg-stone-50 text-stone-600"}`}
                              >
                                {item.type.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                              </Badge>
                              {draftedIds.has(item.id) && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] uppercase font-semibold bg-green-50 text-green-600 border-green-200/60 ml-1"
                                >
                                  drafted
                                </Badge>
                              )}
                              <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                                {item.content}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => startEditItem(item)}
                              title="Edit item"
                              aria-label="Edit item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <button
                              onClick={() => !draftedIds.has(item.id) && generatingDraftId !== item.id && handleCreateDraft(item, pillar.name)}
                              className={`p-0.5 rounded ${draftedIds.has(item.id) ? "text-green-400 cursor-default" : generatingDraftId === item.id ? "text-stone-500 animate-pulse cursor-wait" : "hover:bg-stone-100 text-stone-400 hover:text-stone-600"}`}
                              title={draftedIds.has(item.id) ? "Already drafted" : generatingDraftId === item.id ? "Generating draft with AI..." : "Generate AI draft from this"}
                            >
                              {draftedIds.has(item.id) ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <PenTool className="w-3 h-3" />
                              )}
                            </button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDeleteItem(item.id)}
                              className="hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {pillarItems.length === 0 && addingToPillar !== pillar.id && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-xs text-stone-400">No items yet</p>
                      <button
                        onClick={() => setAddingToPillar(pillar.id)}
                        className="mt-2 text-xs text-stone-600 hover:text-stone-700 font-medium"
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
