import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * แสดงในพื้นที่เนื้อหาขณะโหลดโมดูล (เมนูด้านข้างยังอยู่) — กันความรู้สึกว่าระบบค้าง
 * แถบด้านบนวิ่งตลอด และถ้าเกิน 4 วินาทีจะบอกผู้ใช้ว่ายังโหลดอยู่
 */
export default function ModuleLoader({ label = "กำลังเปิดหน้า" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <div className="fixed left-0 right-0 top-0 z-[60] h-1 overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-[module-load_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {label}…{slow && " อินเทอร์เน็ตอาจช้า กรุณารอสักครู่"}
        </span>
      </div>
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <style>{`@keyframes module-load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
