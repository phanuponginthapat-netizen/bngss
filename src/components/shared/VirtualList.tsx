import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface VirtualListProps<T> {
  items: T[];
  /** ความสูงต่อแถว (px) — ต้องคงที่ */
  rowHeight: number;
  /** ความสูงของกรอบที่เลื่อนได้ (px) */
  height?: number;
  /** จำนวนแถวส่วนเกินที่เรนเดอร์เผื่อบน/ล่าง */
  overscan?: number;
  renderRow: (item: T, index: number) => ReactNode;
  header?: ReactNode;
  empty?: ReactNode;
  className?: string;
}

/**
 * VirtualList — เรนเดอร์เฉพาะแถวที่มองเห็น (windowing) โดยไม่พึ่งไลบรารีเพิ่ม
 * ใช้กับตารางนักเรียน/บุคลากร/รายงานสแกน ที่มีข้อมูลหลักพันแถว
 * เพื่อลดจำนวน DOM node และทำให้เลื่อนลื่นบนเครื่องสเปกต่ำ
 */
export function VirtualList<T>({
  items,
  rowHeight,
  height = 560,
  overscan = 8,
  renderRow,
  header,
  empty,
  className,
}: VirtualListProps<T>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  // รีเซ็ตตำแหน่งเมื่อชุดข้อมูลเปลี่ยน (เช่น เปลี่ยนตัวกรอง)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    setScrollTop(0);
  }, [items.length]);

  const total = items.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visibleCount);
  const slice = items.slice(start, end);

  if (total === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("rounded-md border", className)}>
      {header}
      <div ref={ref} onScroll={onScroll} style={{ height, overflowY: "auto" }}>
        <div style={{ height: total * rowHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
            {slice.map((item, i) => (
              <div key={start + i} style={{ height: rowHeight }}>
                {renderRow(item, start + i)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
