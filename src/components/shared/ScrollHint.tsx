import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollHintProps {
  className?: string;
  label?: string;
}

/**
 * ScrollHint — subtle right-edge affordance shown above horizontally scrollable
 * tables on small screens. Purely decorative; hidden on md+.
 */
export function ScrollHint({ className, label = "เลื่อนดูข้อมูลเพิ่มเติม" }: ScrollHintProps) {
  return (
    <div
      className={cn(
        "md:hidden flex items-center justify-end gap-1 text-[11px] text-muted-foreground/70 pb-1",
        className,
      )}
      aria-hidden="true"
    >
      <span>{label}</span>
      <ChevronRight className="w-3 h-3 motion-safe:animate-pulse" />
    </div>
  );
}
