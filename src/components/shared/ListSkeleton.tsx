import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListSkeletonProps {
  rows?: number;
  avatar?: boolean;
  className?: string;
}

/**
 * ListSkeleton — uniform loading placeholder for lists and inboxes.
 * Prefer this over a lone spinner to prevent layout shift.
 */
export function ListSkeleton({ rows = 5, avatar = true, className }: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
          {avatar && <Skeleton className="w-10 h-10 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}
