import { Eye } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * แถบแจ้งเตือนด้านบน สำหรับบัญชี Observer (ศน.)
 * แสดงเฉพาะเมื่อ role จริง = observer
 */
export default function ObserverBanner() {
  const { isObserver } = useUserRole();
  if (!isObserver) return null;
  return (
    <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2 shadow-sm">
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-semibold">โหมดผู้สังเกตการณ์ (ศน.):</span>
      <span className="opacity-90">
        ดูข้อมูลได้ทุกหน้า แต่ไม่สามารถแก้ไข/บันทึก/ลบข้อมูลได้
      </span>
    </div>
  );
}
