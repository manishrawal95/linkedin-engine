"use client";

import { memo, useState } from "react";
import { BarChart3, X, Eye, Users, UserPlus, Heart, MessageCircle, Repeat2, Bookmark, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MetricsFormProps {
  postId: number;
  author?: string;
  initialMetrics?: {
    impressions?: number;
    members_reached?: number;
    profile_viewers?: number;
    followers_gained?: number;
    likes?: number;
    comments?: number;
    reposts?: number;
    saves?: number;
    sends?: number;
  };
  onSubmit: (postId: number, data: Record<string, number>) => Promise<void>;
  onCancel: () => void;
}

const MetricsForm = memo(function MetricsForm({
  postId,
  author = "me",
  initialMetrics,
  onSubmit,
  onCancel,
}: MetricsFormProps) {
  const isOther = author !== "me";
  const [form, setForm] = useState({
    impressions: initialMetrics?.impressions ?? 0,
    members_reached: initialMetrics?.members_reached ?? 0,
    profile_viewers: initialMetrics?.profile_viewers ?? 0,
    followers_gained: initialMetrics?.followers_gained ?? 0,
    likes: initialMetrics?.likes ?? 0,
    comments: initialMetrics?.comments ?? 0,
    reposts: initialMetrics?.reposts ?? 0,
    saves: initialMetrics?.saves ?? 0,
    sends: initialMetrics?.sends ?? 0,
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
    ? [{ id: "public", label: "Public Metrics", color: "text-stone-600" }]
    : [
        { id: "discovery", label: "Discovery", color: "text-stone-600" },
        { id: "profile", label: "Profile Activity", color: "text-stone-600" },
        { id: "engagement", label: "Social Engagement", color: "text-stone-600" },
      ];

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-stone-200/60 p-5 space-y-5"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-stone-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-stone-400" />
          Update Metrics — Post #{postId}
          {isOther && <span className="text-xs font-normal text-stone-400 ml-2">(Public metrics only)</span>}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-8 w-8 rounded-xl text-stone-400 hover:text-stone-700"
          aria-label="Close metrics form"
        >
          <X className="w-5 h-5" />
        </Button>
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
                <div key={field.key}>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-stone-500 mb-1">
                    <field.icon className="w-3.5 h-3.5" />
                    {field.label}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form[field.key]}
                    onChange={(e) =>
                      setForm({ ...form, [field.key]: parseInt(e.target.value) || 0 })
                    }
                    className="rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus-visible:ring-stone-400"
                  />
                </div>
              ))}
          </div>
        </div>
      ))}

      {!isOther && (
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-stone-700">Engagement Score</p>
              <p className="text-xs text-stone-400 mt-0.5">
                (comments x3 + reposts x2 + saves x2 + sends x1.5 + reactions) / impressions
              </p>
            </div>
            <div className="text-2xl font-semibold text-stone-900">
              {engagementScore.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={saving} className="rounded-xl active:scale-[0.98] transition-all">
          {saving ? "Saving..." : "Save Metrics"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl border-stone-200">
          Cancel
        </Button>
      </div>
    </form>
  );
});

MetricsForm.displayName = "MetricsForm";
export default MetricsForm;
