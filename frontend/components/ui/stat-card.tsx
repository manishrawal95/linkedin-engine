interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trendPct?: number | null;
  trendLabel?: string;
  className?: string;
}

export function StatCard({ icon, label, value, trendPct, trendLabel, className = "" }: StatCardProps) {
  const hasTrend = trendPct != null;
  const isUp = hasTrend && trendPct > 0;
  const isDown = hasTrend && trendPct < 0;

  return (
    <div className={`bg-white rounded-2xl border border-stone-200/60 p-4 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-stone-100 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium truncate">{label}</p>
          <p className="text-2xl font-semibold text-stone-900 leading-tight">{value}</p>
          {hasTrend && (
            <p className={`text-[11px] font-medium mt-0.5 ${isUp ? "text-emerald-600" : isDown ? "text-red-500" : "text-stone-400"}`}>
              {isUp ? "\u2191" : isDown ? "\u2193" : "\u2014"} {Math.abs(trendPct)}% {trendLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
