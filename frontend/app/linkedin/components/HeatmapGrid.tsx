"use client";

import { BarChart3 } from "lucide-react";
import type { HeatmapEntry } from "@/types/linkedin";

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HeatmapGrid({ data }: { data: HeatmapEntry[] }) {
  const map = new Map<string, Map<number, number>>();
  let maxEng = 0;
  for (const entry of data) {
    if (!map.has(entry.day_of_week)) map.set(entry.day_of_week, new Map());
    map.get(entry.day_of_week)!.set(entry.hour, entry.avg_engagement);
    if (entry.avg_engagement > maxEng) maxEng = entry.avg_engagement;
  }
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  let bestDay = "", bestHour = 0, bestEng = 0;
  for (const entry of data) {
    if (entry.avg_engagement > bestEng) {
      bestEng = entry.avg_engagement;
      bestDay = entry.day_of_week;
      bestHour = entry.hour;
    }
  }

  return (
    <div className="space-y-4">
      {bestEng > 0 && (
        <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200/60">
          <div className="w-8 h-8 rounded-xl bg-stone-200/60 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-900">
              {bestDay.charAt(0).toUpperCase() + bestDay.slice(1)}s at{" "}
              {bestHour > 12 ? bestHour - 12 : bestHour === 0 ? 12 : bestHour}
              {bestHour >= 12 ? "pm" : "am"}
            </p>
            <p className="text-xs text-stone-500">Your highest engagement time slot</p>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-12" />
              {hours.map((h) => (
                <th key={h} className="text-[11px] text-stone-400 font-normal pb-1 text-center">
                  {h % 3 === 0 ? `${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS_ORDER.map((day, di) => {
              const dayMap = map.get(day) || new Map();
              return (
                <tr key={day}>
                  <td className="text-xs text-stone-500 text-right pr-2 py-0.5 font-medium">
                    {DAYS_SHORT[di]}
                  </td>
                  {hours.map((h) => {
                    const eng = dayMap.get(h) || 0;
                    const intensity = maxEng > 0 ? eng / maxEng : 0;
                    return (
                      <td key={h} className="p-[1.5px]">
                        <div
                          className="w-full aspect-square rounded-sm min-h-[14px]"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(87, 83, 78, ${0.12 + intensity * 0.6})`
                              : "#f5f5f4",
                          }}
                          title={`${DAYS_SHORT[di]} ${h}:00 — ${eng > 0 ? (eng * 100).toFixed(2) + "% eng" : "no data"}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[11px] text-stone-400">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <div
            key={v}
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor: v > 0
                ? `rgba(87, 83, 78, ${0.12 + v * 0.6})`
                : "#f5f5f4",
            }}
          />
        ))}
        <span className="text-[11px] text-stone-400">More</span>
      </div>
    </div>
  );
}
