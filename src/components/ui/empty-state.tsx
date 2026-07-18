import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  /** Optional illustration node (overrides icon if provided) */
  illustration?: ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * Reusable empty state with icon/illustration, title, description, and CTAs.
 * Replaces plain "ยังไม่มี..." text across the app.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  illustration,
  size = "md",
}: EmptyStateProps) {
  const padding = size === "sm" ? "py-6 px-4" : size === "lg" ? "py-16 px-6" : "py-10 px-5";
  const iconWrap = size === "sm" ? "w-12 h-12" : size === "lg" ? "w-20 h-20" : "w-16 h-16";
  const iconSize = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-8 h-8";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        padding,
        className
      )}
    >
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : Icon ? (
        <div
          className={cn(
            "rounded-2xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 flex items-center justify-center mb-4 ring-1 ring-border/50",
            iconWrap
          )}
        >
          <Icon className={cn("text-primary/70", iconSize)} strokeWidth={1.5} />
        </div>
      ) : null}

      <h3 className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground mt-1 max-w-sm",
            size === "sm" ? "text-xs" : "text-sm"
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
          {action && (
            <Button onClick={action.onClick} size={size === "sm" ? "sm" : "default"}>
              {action.icon && <action.icon className="w-4 h-4 mr-1.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={size === "sm" ? "sm" : "default"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
