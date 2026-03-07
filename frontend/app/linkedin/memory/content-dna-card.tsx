"use client";

import { Dna } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import type { ContentDNA } from "@/types/linkedin";

interface Props {
  dna: ContentDNA;
}

export default function ContentDNACard({ dna }: Props) {
  const hooks = dna.hook_performance ?? [];
  const formats = dna.format_performance ?? [];
  const topics = dna.topic_performance ?? [];
  const length = dna.length_sweet_spot;
  const timing = dna.best_timing ?? [];

  return (
    <SectionCard title="Content DNA" icon={Dna}>
      <div className="space-y-5">
        {/* Best hooks */}
        {hooks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Hook Performance</p>
            <div className="space-y-1.5">
              {hooks.map((h, i) => (
                <div key={h.style} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400 w-4">{i + 1}.</span>
                    <span className="text-sm text-stone-700 capitalize">{h.style}</span>
                    <Badge variant="secondary" className="text-[10px] bg-stone-100 text-stone-500">
                      {h.count} posts
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-stone-600">
                    {(h.avg_engagement * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Format performance */}
        {formats.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Format Performance</p>
            <div className="space-y-1.5">
              {formats.map((f) => (
                <div key={f.format} className="flex items-center justify-between">
                  <span className="text-sm text-stone-700 capitalize">{f.format}</span>
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span>{f.post_count} posts</span>
                    <span className="font-mono">{(f.avg_engagement * 100).toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Length sweet spot */}
        {length?.optimal_range && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Optimal Length</p>
            <p className="text-sm text-stone-700">
              <span className="font-semibold text-stone-900">
                {length.optimal_range[0]}&ndash;{length.optimal_range[1]} words
              </span>
              {length.median && (
                <span className="text-stone-500"> (median: {length.median})</span>
              )}
            </p>
          </div>
        )}

        {/* Top pillars */}
        {topics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Top Pillars</p>
            <div className="space-y-1.5">
              {topics.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm text-stone-700">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span>{t.post_count} posts</span>
                    <span className="font-mono">{(t.avg_engagement * 100).toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Best timing */}
        {timing.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1.5">Best Times</p>
            <div className="flex flex-wrap gap-1.5">
              {timing.slice(0, 3).map((t, i) => (
                <Badge key={i} variant="secondary" className="bg-stone-100 text-stone-600 text-xs capitalize">
                  {t.day}s {t.hour > 12 ? t.hour - 12 : t.hour}{t.hour >= 12 ? "pm" : "am"}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
