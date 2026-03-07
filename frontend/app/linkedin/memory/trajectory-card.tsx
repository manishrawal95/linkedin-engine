"use client";

import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import type { GrowthTrajectory } from "@/types/linkedin";

interface Props {
  trajectory: GrowthTrajectory;
}

const MOMENTUM_STYLES = {
  accelerating: { icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200/60" },
  stable: { icon: Minus, color: "text-stone-600", bg: "bg-stone-50", border: "border-stone-200/60" },
  declining: { icon: ArrowDownRight, color: "text-red-600", bg: "bg-red-50", border: "border-red-200/60" },
};

export default function TrajectoryCard({ trajectory }: Props) {
  if (trajectory.error) {
    return (
      <SectionCard title="Growth Trajectory" icon={TrendingUp}>
        <p className="text-sm text-stone-500">Growth trajectory could not be analyzed yet.</p>
      </SectionCard>
    );
  }

  const phases = trajectory.phases ?? [];
  const momentum = trajectory.current_momentum;
  const inflections = trajectory.inflection_points ?? [];
  const mStyle = momentum ? MOMENTUM_STYLES[momentum.trend] ?? MOMENTUM_STYLES.stable : null;

  return (
    <SectionCard title="Growth Trajectory" icon={TrendingUp}>
      <div className="space-y-5">
        {/* Current momentum */}
        {momentum && mStyle && (
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${mStyle.bg} ${mStyle.border}`}>
            <mStyle.icon className={`w-5 h-5 ${mStyle.color}`} />
            <div>
              <p className={`text-sm font-semibold capitalize ${mStyle.color}`}>{momentum.trend}</p>
              {momentum.recent_avg_engagement != null && (
                <p className="text-xs text-stone-500">
                  Recent avg: {(momentum.recent_avg_engagement * 100).toFixed(2)}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* Phases timeline */}
        {phases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Phases</p>
            <div className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-px before:bg-stone-200">
              {phases.map((phase, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-3 top-1.5 w-2 h-2 rounded-full bg-stone-400 border-2 border-white" />
                  <div>
                    <p className="text-sm font-medium text-stone-900">{phase.label}</p>
                    <p className="text-xs text-stone-500">{phase.period}</p>
                    {phase.key_event && (
                      <p className="text-xs text-stone-600 mt-0.5">{phase.key_event}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inflection points */}
        {inflections.length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Inflection Points</p>
            <div className="space-y-2">
              {inflections.map((ip, i) => (
                <div key={i} className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-stone-700">{ip.change}</p>
                    <Badge variant="secondary" className="text-[10px] bg-stone-100">{ip.date}</Badge>
                  </div>
                  <p className="text-xs text-stone-500">{ip.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
