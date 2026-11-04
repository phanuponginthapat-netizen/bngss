import { ShieldCheck, GraduationCap } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * ปุ่มสลับมุมมองสำหรับครูที่เป็น admin
 * - โหมด Admin  = เห็นเมนู admin เต็ม
 * - โหมด ครู    = เห็นเมนูเฉพาะที่ครูใช้งาน (บันทึกเช็คชื่อ/คะแนน/การบ้าน ฯลฯ)
 * ไม่ลดสิทธิ์จริง — แค่ซ่อน/แสดง UI ให้เหมาะกับงานที่กำลังทำ
 */
export function ViewModeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { isTeacherAdmin, viewMode, setMode, loading } = useViewMode();

  if (loading || !isTeacherAdmin) return null;

  const toggle = (mode: "admin" | "teacher") => {
    if (viewMode === mode) return;
    setMode(mode);
    toast({
      title: mode === "admin" ? "เปลี่ยนเป็นมุมมองผู้ดูแล" : "เปลี่ยนเป็นมุมมองครู",
      description:
        mode === "admin"
          ? "เห็นเมนูจัดการระบบทั้งหมด"
          : "เห็นเมนูสำหรับบันทึกงานสอน เช็คชื่อ คะแนน ฯลฯ",
    });
  };

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={viewMode === "admin" ? "สลับเป็นมุมมองครู" : "สลับเป็นมุมมองแอดมิน"}
        onClick={() => toggle(viewMode === "admin" ? "teacher" : "admin")}
        className={cn(
          "w-9 h-9 mx-auto rounded-xl flex items-center justify-center transition-all",
          viewMode === "admin" ? "side-mode-admin" : "side-mode-teacher"
        )}
      >
        {viewMode === "admin" ? <ShieldCheck className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className="side-mode-track mx-1 my-1 p-0.5 rounded-lg flex items-stretch gap-1">
      {(["admin", "teacher"] as const).map((m) => {
        const active = viewMode === m;
        const Icon = m === "admin" ? ShieldCheck : GraduationCap;
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-1.5 py-[3px] rounded-md text-[11px] font-semibold transition-all",
              active
                ? m === "admin"
                  ? "side-mode-admin"
                  : "side-mode-teacher"
                : "side-mode-idle"
            )}
          >
            <Icon className="w-3 h-3" />
            {m === "admin" ? "Admin" : "ครู"}
          </button>
        );
      })}
    </div>
  );
}
