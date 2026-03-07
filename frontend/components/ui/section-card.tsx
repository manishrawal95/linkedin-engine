import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, icon: Icon, children, action, className = "" }: SectionCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-stone-200/60 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-stone-400" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
