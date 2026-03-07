interface ScoreRingProps {
  /** Value between 0 and 1 */
  value: number;
  /** Size in pixels */
  size?: number;
  /** Label shown below the score */
  label?: string;
  className?: string;
}

export function ScoreRing({ value, size = 48, label, className = "" }: ScoreRingProps) {
  const pct = Math.round(value * 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);

  const color =
    pct >= 70 ? "text-emerald-500 stroke-emerald-500" :
    pct >= 40 ? "text-amber-500 stroke-amber-500" :
    "text-stone-400 stroke-stone-400";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            className="text-stone-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={color}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${color.split(" ")[0]}`}>
          {pct}
        </span>
      </div>
      {label && <span className="text-[10px] text-stone-500 font-medium">{label}</span>}
    </div>
  );
}
