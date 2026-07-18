import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder that matches StatCard dimensions to prevent layout shift. */
export function StatCardSkeleton() {
  return (
    <Card aria-busy="true">
      <CardContent className="p-3 sm:p-4 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
