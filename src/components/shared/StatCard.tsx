import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StatCardTone =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "accent"
  | "muted";

const TONE_STYLES: Record<StatCardTone, { value: string; icon: string }> = {
  primary: { value: "text-primary", icon: "text-primary/30" },
  success: { value: "text-success", icon: "text-success/30" },
  warning: { value: "text-warning", icon: "text-warning/30" },
  destructive: { value: "text-destructive", icon: "text-destructive/30" },
  info: { value: "text-info", icon: "text-info/30" },
  accent: { value: "text-accent", icon: "text-accent/30" },
  muted: { value: "text-foreground", icon: "text-muted-foreground/40" },
};

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
  hint?: ReactNode;
  highlighted?: boolean;
  className?: string;
}

/**
 * StatCard — compact KPI card used across dashboards and module summaries.
 * Always uses semantic design tokens (no hardcoded colors).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  highlighted,
  className,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <Card
      className={cn(
        "transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md",
        highlighted && "ring-2 ring-primary/30",
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p
              className={cn(
                "text-2xl font-bold leading-tight tabular-nums truncate",
                styles.value,
              )}
            >
              {value}
            </p>
            {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
          </div>
          {Icon && <Icon className={cn("w-8 h-8 shrink-0", styles.icon)} aria-hidden="true" />}
        </div>
      </CardContent>
    </Card>
  );
}
