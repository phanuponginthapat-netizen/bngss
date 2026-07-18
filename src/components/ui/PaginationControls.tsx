import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

/** Compact pagination footer for data tables */
export function PaginationControls({
  page, totalPages, total, pageSize, onPrev, onNext, className,
}: PaginationControlsProps) {
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className={`flex items-center justify-between gap-2 text-sm ${className || ""}`}>
      <div className="text-muted-foreground">
        แสดง {start.toLocaleString()}–{end.toLocaleString()} จาก {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
