"use client";

import { memo, useState } from "react";
import { BarChart3, X, Eye, Users, UserPlus, Heart, MessageCircle, Repeat2, Bookmark, Send } from "lucide-react";

interface MetricsFormProps {
  postId: number;
  author?: string;
  onSubmit: (postId: number, data: Record<string, number>) => Promise<void>;
  onCancel: () => void;
}

const MetricsForm = memo(function MetricsForm({
  postId,
  author = "me",
  onSubmit,
  onCancel,
}: MetricsFormProps) {
  const isOther = author !== "me";
  const [form, setForm] = useState({
    impressions: 0,
    members_reached: 0,
    profile_viewers: 0,
    followers_gained: 0,
    likes: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
    sends: 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(postId, form);
    } finally {
      setSaving(false);
    }
  };

  const engagementScore =
    form.impressions > 0
      ? ((form.comments * 3 + form.reposts * 2 + form.saves * 2 + form.sends * 1.5 + form.likes) /
          form.impressions) *
        100
      : 0;

  // For other users, only show metrics visible on LinkedIn (reactions, comments, reposts).
  // Impressions, saves, sends, profile viewers, followers are private to the post author.
  const fields = isOther
    ? [
        { key: "likes", label: "Reactions", icon: Heart, section: "public" },
        { key: "comments", label: "Comments", icon: MessageCircle, section: "public" },
        { key: "reposts", label: "Reposts", icon: Repeat2, section: "public" },
      ] as const
    : [
        { key: "impressions", label: "Impressions", icon: Eye, section: "discovery" },
        { key: "members_reached", label: "Members Reached", icon: Users, section: "discovery" },
        { key: "profile_viewers", label: "Profile Viewers", icon: Users, section: "profile" },
        { key: "followers_gained", label: "Followers Gained", icon: UserPlus, section: "profile" },
        { key: "likes", label: "Reactions", icon: Heart, section: "engagement" },
        { key: "comments", label: "Comments", icon: MessageCircle, section: "engagement" },
        { key: "reposts", label: "Reposts", icon: Repeat2, section: "engagement" },
        { key: "saves", label: "Saves", icon: Bookmark, section: "engagement" },
        { key: "sends", label: "Sends", icon: Send, section: "engagement" },
      ] as const;

  const sections = isOther
    ? [{ id: "public", label: "Public Metrics", color: "text-indigo-600" }]
    : [
        { id: "discovery", label: "Discovery", color: "text-blue-600" },
        { id: "profile", label: "Profile Activity", color: "text-purple-600" },
        { id: "engagement", label: "Social Engagement", color: "text-green-600" },
      ];

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-5 space-y-5"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          Update Metrics — Post #{postId}
          {isOther && <span className="text-xs font-normal text-gray-400 ml-2">(Public metrics only)</span>}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${section.color}`}>
            {section.label}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {fields
              .filter((f) => f.section === section.id)
              .map((field) => (
                <div key={field.key} className="relative">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1">
                    <field.icon className="w-3.5 h-3.5" />
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form[field.key]}
                    onChange={(e) =>
                      setForm({ ...form, [field.key]: parseInt(e.target.value) || 0 })
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      {!isOther && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Engagement Score</p>
              <p className="text-xs text-gray-500 mt-0.5">
                (comments×3 + reposts×2 + saves×2 + sends×1.5 + reactions) / impressions
              </p>
            </div>
            <div className="text-2xl font-bold text-indigo-600">
              {engagementScore.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Metrics"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
});

MetricsForm.displayName = "MetricsForm";
export default MetricsForm;
