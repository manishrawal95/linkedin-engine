import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-4 rounded-2xl bg-stone-100 mb-4">
        <Icon className="w-6 h-6 text-stone-400" />
      </div>
      <h3 className="text-sm font-semibold text-stone-900 mb-1">{title}</h3>
      <p className="text-sm text-stone-500 max-w-sm leading-relaxed">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          disabled={action.loading}
          className="mt-4 gap-2 rounded-xl"
        >
          {action.loading ? "Loading..." : action.label}
        </Button>
      )}
    </div>
  );
}
