import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * EmptyState — placeholder for empty lists, tabs, and panels.
 * Uses muted-foreground tokens for consistent visual weight.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center motion-safe:animate-fade-in",
        compact ? "py-6 gap-2" : "py-12 gap-3",
        className,
      )}
    >
      {Icon && (
        <div
          aria-hidden="true"
          className={cn(
            "rounded-full bg-muted text-muted-foreground flex items-center justify-center ring-1 ring-border/60",
            compact ? "w-10 h-10" : "w-14 h-14",
          )}
        >
          <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
        </div>
      )}
      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
