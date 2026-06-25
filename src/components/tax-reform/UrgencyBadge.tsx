import { cn } from "@/lib/utils";
import { TaxReformUrgency } from "./types";

const URGENCY_CONFIG: Record<TaxReformUrgency, { label: string; badge: string; border: string }> = {
  critical: {
    label: "Crítico",
    badge: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    border: "border-l-red-500",
  },
  important: {
    label: "Importante",
    badge: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    border: "border-l-amber-500",
  },
  informational: {
    label: "Informativo",
    badge: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
    border: "border-l-blue-400",
  },
};

export function urgencyBorderClass(urgency: TaxReformUrgency) {
  return URGENCY_CONFIG[urgency].border;
}

interface Props {
  urgency: TaxReformUrgency;
  className?: string;
}

export function UrgencyBadge({ urgency, className }: Props) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
        cfg.badge,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
