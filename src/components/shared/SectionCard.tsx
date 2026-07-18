import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface SectionCardProps {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
}

/**
 * SectionCard — common card+title pattern with a slot for actions in the header.
 * Use to standardize the look of grouped content across pages.
 */
export function SectionCard({
  title,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
  padded = true,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-primary" />}
            {title}
          </CardTitle>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(padded ? undefined : "p-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
