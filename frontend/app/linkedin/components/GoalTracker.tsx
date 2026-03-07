"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { Goal } from "@/types/linkedin";

const GoalTracker = memo(function GoalTracker() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    metric: "",
    target_value: 0,
    current_value: 0,
    deadline: "",
  });

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/goals");
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (err) {
      console.error("GoalTracker.fetchGoals: GET /api/linkedin/goals failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/linkedin/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        deadline: form.deadline || null,
      }),
    });
    setShowForm(false);
    setForm({ metric: "", target_value: 0, current_value: 0, deadline: "" });
    fetchGoals();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/linkedin/goals/${id}`, { method: "DELETE" });
    fetchGoals();
  };

  const handleMarkAchieved = async (id: number) => {
    await fetch(`/api/linkedin/goals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "achieved" }),
    });
    fetchGoals();
  };

  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const progress = goal.target_value > 0
          ? Math.min(100, (goal.current_value / goal.target_value) * 100)
          : 0;
        const isAchieved = goal.status === "achieved";
        const fmt = (v: number) => {
          if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
          if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
          return (v * 100).toFixed(2) + "%";
        };
        return (
          <div
            key={goal.id}
            className={`p-3 rounded-xl border ${isAchieved ? "bg-emerald-50/50 border-emerald-200/60" : "bg-stone-50 border-stone-200/60"}`}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-900 capitalize">
                  {goal.metric}
                </span>
                {goal.source === "auto" && (
                  <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                    auto
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">
                  {fmt(goal.current_value)} / {fmt(goal.target_value)}
                </span>
                {!isAchieved && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleMarkAchieved(goal.id)}
                    className="h-7 w-7 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50"
                    title="Mark achieved"
                    aria-label={`Mark ${goal.metric} as achieved`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(goal.id)}
                  className="h-7 w-7 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                  aria-label={`Delete ${goal.metric} goal`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <Progress
              value={progress}
              className={`h-2 ${isAchieved ? "bg-emerald-100" : "bg-stone-200"}`}
            />
            {goal.deadline && (
              <p className="text-xs text-stone-400 mt-1">
                Deadline: {new Date(goal.deadline).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}

      {showForm ? (
        <form
          onSubmit={handleAdd}
          className="p-3 rounded-xl border border-stone-200/60 bg-stone-50 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Metric
              </label>
              <Input
                type="text"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                className="rounded-xl border-stone-200 h-8 text-sm"
                placeholder="e.g. impressions"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Target
              </label>
              <Input
                type="number"
                value={form.target_value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_value: parseFloat(e.target.value) || 0,
                  })
                }
                className="rounded-xl border-stone-200 h-8 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="rounded-xl text-xs h-7">
              Add Goal
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              className="rounded-xl text-xs h-7 border-stone-200"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      )}
    </div>
  );
});

GoalTracker.displayName = "GoalTracker";
export default GoalTracker;
