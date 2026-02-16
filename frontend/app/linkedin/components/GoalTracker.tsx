"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { Plus, X, Check, Trash2 } from "lucide-react";

interface Goal {
  id: number;
  metric: string;
  target_value: number;
  current_value: number;
  deadline: string | null;
  status: string;
}

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
    } catch {
      // ignore
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
        const progress = Math.min(
          100,
          (goal.current_value / goal.target_value) * 100
        );
        const isAchieved = goal.status === "achieved";
        return (
          <div
            key={goal.id}
            className={`p-3 rounded-lg border ${isAchieved ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-900 capitalize">
                {goal.metric}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {goal.current_value} / {goal.target_value}
                </span>
                {!isAchieved && (
                  <button
                    onClick={() => handleMarkAchieved(goal.id)}
                    className="p-1 hover:bg-green-100 rounded text-gray-400 hover:text-green-600"
                    title="Mark achieved"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isAchieved ? "bg-green-500" : "bg-indigo-600"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {goal.deadline && (
              <p className="text-xs text-gray-400 mt-1">
                Deadline: {new Date(goal.deadline).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}

      {showForm ? (
        <form
          onSubmit={handleAdd}
          className="p-3 rounded-lg border border-indigo-200 bg-indigo-50 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Metric
              </label>
              <input
                type="text"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                placeholder="e.g. impressions"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Target
              </label>
              <input
                type="number"
                value={form.target_value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    target_value: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
            >
              Add Goal
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-gray-600 text-xs font-medium rounded-lg border border-gray-300 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
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
