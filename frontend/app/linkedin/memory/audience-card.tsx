"use client";

import { Users, Bookmark, MessageSquare, Repeat2, Heart } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import type { AudienceModel } from "@/types/linkedin";

/** Render inline **bold** markdown as <strong> tags */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-stone-700">{part}</strong> : part
  );
}

interface Props {
  audience: AudienceModel;
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  saves: <Bookmark className="w-3.5 h-3.5 text-amber-500" />,
  comments: <MessageSquare className="w-3.5 h-3.5 text-blue-500" />,
  reposts: <Repeat2 className="w-3.5 h-3.5 text-green-500" />,
  likes: <Heart className="w-3.5 h-3.5 text-red-400" />,
};

export default function AudienceCard({ audience }: Props) {
  if (audience.error) {
    return (
      <SectionCard title="Audience Model" icon={Users}>
        <p className="text-sm text-stone-500">Audience model could not be analyzed yet.</p>
      </SectionCard>
    );
  }

  const segments = audience.inferred_segments ?? [];
  const triggers = audience.engagement_triggers;
  const gaps = audience.content_gaps ?? [];

  return (
    <SectionCard title="Audience Model" icon={Users}>
      <div className="space-y-5">
        {/* Inferred segments */}
        {segments.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Who Engages</p>
            <div className="space-y-2.5">
              {segments.map((seg, i) => (
                <div key={i} className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
                  <p className="text-sm font-medium text-stone-900">{seg.label}</p>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{seg.evidence}</p>
                  <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-wide">
                    Engages via: {seg.engagement_type}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engagement triggers */}
        {triggers && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">What Triggers</p>
            <div className="space-y-2">
              {Object.entries(triggers).map(([key, val]) => val && (
                <div key={key} className="flex items-start gap-2">
                  {TRIGGER_ICONS[key] ?? null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-stone-700 capitalize">{key}</p>
                    <p className="text-xs text-stone-500 leading-relaxed">{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content gaps */}
        {gaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Content Gaps</p>
            <div className="space-y-2">
              {gaps.map((gap, i) => (
                <div key={i} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/60">
                  <p className="text-xs text-stone-600 leading-relaxed">{renderBold(gap)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
