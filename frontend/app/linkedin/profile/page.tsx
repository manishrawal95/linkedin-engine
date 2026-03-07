"use client";

import { useCallback, useState } from "react";
import { User, PenTool, Save, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorCard } from "@/components/ui/error-card";
import { useApi } from "@/hooks/use-api";
import { toast } from "sonner";
import type { CreatorProfile } from "@/types/linkedin";

export default function ProfilePage() {
  const { data: profile, loading, error, refetch } = useApi<CreatorProfile>("/api/linkedin/profile");
  const [aboutMe, setAboutMe] = useState<string | null>(null);
  const [writingSkill, setWritingSkill] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Use local state if edited, otherwise fall back to fetched data
  const currentAboutMe = aboutMe ?? profile?.about_me ?? "";
  const currentWritingSkill = writingSkill ?? profile?.writing_skill ?? "";

  const hasChanges =
    (aboutMe !== null && aboutMe !== (profile?.about_me ?? "")) ||
    (writingSkill !== null && writingSkill !== (profile?.writing_skill ?? ""));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/linkedin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          about_me: currentAboutMe,
          writing_skill: currentWritingSkill,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Save failed (${res.status})`);
      }
      toast.success("Profile saved — condensed context regenerated");
      setAboutMe(null);
      setWritingSkill(null);
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [currentAboutMe, currentWritingSkill, refetch]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="h-64 skeleton rounded-2xl" />
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Creator Profile</h1>
        <ErrorCard message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
            Creator Profile
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Tell the AI who you are and how you write. Used proactively in every draft and idea.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="rounded-xl gap-1.5 active:scale-[0.98] transition-all shrink-0"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>

      {/* About Me */}
      <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-stone-100">
            <User className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">About Me</h2>
            <p className="text-xs text-stone-500">
              Your role, expertise, audience, goals, personal stories — anything the AI should know about you
            </p>
          </div>
        </div>
        <Textarea
          value={currentAboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          rows={10}
          placeholder="e.g., I'm a product manager at a B2B SaaS startup. 8 years in tech, previously at Google. I write for mid-career PMs who want to grow into leadership. My goal is to become a thought leader in product strategy..."
          className="rounded-xl border-stone-200 resize-y leading-relaxed min-h-[120px]"
        />
      </div>

      {/* Writing Skill */}
      <div className="bg-white rounded-2xl border border-stone-200/60 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-stone-100">
            <PenTool className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Writing Skill</h2>
            <p className="text-xs text-stone-500">
              Your post writing rules, structure preferences, do's and don'ts, formatting guidelines
            </p>
          </div>
        </div>
        <Textarea
          value={currentWritingSkill}
          onChange={(e) => setWritingSkill(e.target.value)}
          rows={14}
          placeholder="e.g., Always start with a hook question or bold statement. Keep paragraphs to 1-2 lines. Use line breaks between ideas. Never use emojis. End with a question to drive comments..."
          className="rounded-xl border-stone-200 resize-y leading-relaxed min-h-[160px] font-mono text-sm"
        />
      </div>

      {/* Condensed Context Preview */}
      {profile?.condensed_context && (
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-stone-200/60 shrink-0">
              <Brain className="w-4 h-4 text-stone-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-stone-900">Condensed Context</p>
                <Badge variant="secondary" className="bg-stone-200/60 text-stone-600 rounded-full text-[10px]">
                  auto-generated
                </Badge>
              </div>
              <div
                className="text-sm text-stone-600 leading-relaxed whitespace-pre-line [&_strong]:font-semibold [&_strong]:text-stone-800 [&_em]:italic"
                dangerouslySetInnerHTML={{
                  __html: profile.condensed_context
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>"),
                }}
              />
              <p className="text-[11px] text-stone-400 mt-3">
                This condensed version (~200 tokens) is injected into ideation and analysis prompts.
                Full writing skill is used for draft generation where voice accuracy matters.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last updated */}
      {profile?.updated_at && (
        <p className="text-xs text-stone-400 px-1">
          Last updated {new Date(profile.updated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
