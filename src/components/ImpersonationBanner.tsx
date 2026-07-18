import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole, setRoleOverride } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

/**
 * แสดงแถบเตือนเมื่อ admin กำลังสลับโหมดเป็นครู
 * เพื่อให้รู้ชัดว่ากำลังทำงานในบริบทของครู (ดูเมนู/ข้อมูลแบบครู)
 */
export default function ImpersonationBanner() {
  const { isImpersonating, role } = useUserRole();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-3 sm:px-6 py-2 flex items-center gap-2 text-xs sm:text-sm">
      <GraduationCap className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">
        {lang === "th"
          ? `กำลังใช้งานในโหมด "ครู" — การบันทึก/แสดงข้อมูลจะเป็นบริบทของครู (role จริง: ผู้ดูแลระบบ)`
          : `Acting as "Teacher" — saves and views use teacher context (actual role: Admin)`}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs hover:bg-amber-500/20"
        onClick={() => {
          setRoleOverride(null);
          navigate("/dashboard");
        }}
      >
        <X className="w-3 h-3 mr-1" />
        {lang === "th" ? "ออกจากโหมดครู" : "Exit teacher mode"}
      </Button>
    </div>
  );
}
