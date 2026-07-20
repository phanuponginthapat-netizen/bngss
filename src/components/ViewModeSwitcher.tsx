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
          "ring-1 ring-border/60 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5)]",
          viewMode === "admin"
            ? "bg-primary/15 text-primary"
            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        )}
      >
        {viewMode === "admin" ? <ShieldCheck className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className="mx-2 my-1.5 p-0.5 rounded-xl bg-muted/60 ring-1 ring-border/60 flex items-stretch gap-1 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5)]">
      {(["admin", "teacher"] as const).map((m) => {
        const active = viewMode === m;
        const Icon = m === "admin" ? ShieldCheck : GraduationCap;
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold transition-all",
              active
                ? m === "admin"
                  ? "bg-background text-primary shadow-sm ring-1 ring-primary/25"
                  : "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {m === "admin" ? "Admin" : "ครู"}
          </button>
        );
      })}
    </div>
  );
}
