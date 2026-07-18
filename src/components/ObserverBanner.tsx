import { Eye } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export default function ObserverBanner() {
  const { isObserver } = useUserRole();
  if (!isObserver) return null;
  return (
    <div className="w-full bg-warning text-warning-foreground text-xs sm:text-sm font-medium px-3 py-1.5 flex items-center justify-center gap-2 border-b border-warning/50">
      <Eye className="w-4 h-4" />
      <span>โหมดผู้สังเกตการณ์ — อ่านอย่างเดียว ไม่สามารถแก้ไขข้อมูลได้</span>
    </div>
  );
}
