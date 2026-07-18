import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  density?: "default" | "compact";
  className?: string;
}

/**
 * PageHeader — standard top-of-page header for module screens.
 * Pairs a title (with optional icon) with description, breadcrumb slot, and actions.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  density = "default",
  className,
}: PageHeaderProps) {
  const compact = density === "compact";
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div
            className={cn(
              "shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center",
              compact ? "w-9 h-9" : "w-10 h-10",
            )}
            aria-hidden="true"
          >
            <Icon className={compact ? "w-4 h-4" : "w-5 h-5"} />
          </div>
        )}
        <div className="min-w-0">
          {breadcrumbs && (
            <div className="text-xs text-muted-foreground mb-1 truncate">{breadcrumbs}</div>
          )}
          <h1
            className={cn(
              "font-bold text-foreground leading-tight tracking-tight",
              compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      )}
    </header>
  );
}
