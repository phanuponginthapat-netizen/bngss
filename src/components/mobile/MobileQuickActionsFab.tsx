import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
import { FileText, ScanFace, ClipboardCheck, Camera, MessageSquare, CalendarDays } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptic } from "@/lib/haptics";
import { ReactNode } from "react";
import type { AppRole } from "@/hooks/useUserRole";

interface Props {
  trigger: ReactNode;
  role?: AppRole | null;
}

interface Action {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  th: string;
  en: string;
  color: string;
  roles?: AppRole[];
}

const ACTIONS: Action[] = [
  { to: "/dashboard/admin/eform", icon: FileText, th: "ส่งเอกสาร", en: "Send Form", color: "from-blue-500 to-blue-600" },
  { to: "/dashboard/student/face-scan", icon: ScanFace, th: "สแกนนักเรียน", en: "Scan Student", color: "from-emerald-500 to-emerald-600", roles: ["teacher", "admin", "director"] },
  { to: "/dashboard/student/attendance", icon: ClipboardCheck, th: "เช็คชื่อ", en: "Attendance", color: "from-violet-500 to-violet-600", roles: ["teacher", "admin", "director"] },
  { to: "/dashboard/feed?compose=1", icon: Camera, th: "ถ่าย/อัปรูป", en: "Post Photo", color: "from-pink-500 to-pink-600" },
  { to: "/dashboard/inbox", icon: MessageSquare, th: "ข้อความ", en: "Messages", color: "from-orange-500 to-orange-600" },
  { to: "/dashboard/academic/calendar", icon: CalendarDays, th: "ปฏิทิน", en: "Calendar", color: "from-cyan-500 to-cyan-600" },
];

export function MobileQuickActionsFab({ trigger, role }: Props) {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const items = ACTIONS.filter(a => !a.roles || (role && a.roles.includes(role)));

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-t-0 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[80vh]"
      >
        <SheetHeader className="text-left mb-3">
          <SheetTitle className="text-base">{L("ทางลัด", "Quick actions")}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3">
          {items.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              onClick={() => haptic("light")}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/40 hover:bg-muted active:scale-95 transition-all"
            >
              <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-md`}>
                <a.icon className="w-6 h-6 text-white" />
              </span>
              <span className="text-xs font-medium text-center leading-tight">{L(a.th, a.en)}</span>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
