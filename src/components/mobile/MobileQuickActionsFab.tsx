import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
import {
  FileText, ScanFace, ClipboardCheck, Camera, MessageSquare, CalendarDays,
  Megaphone, BookOpenCheck, Shield, Heart, Wallet, Bus, Utensils, BookMarked,
  GraduationCap, Bell, Users,
} from "lucide-react";
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
  roles?: AppRole[]; // omit = all
}

const ACTIONS: Action[] = [
  // Staff-focused (top of sheet)
  { to: "/dashboard/student/attendance", icon: ClipboardCheck, th: "เช็คชื่อ", en: "Attendance", color: "from-info to-info", roles: ["teacher", "admin", "director"] },
  { to: "/dashboard/student/face-scan", icon: ScanFace, th: "สแกนใบหน้า", en: "Face Scan", color: "from-success to-success", roles: ["teacher", "admin", "director"] },
  { to: "/dashboard/academic/pp5", icon: BookOpenCheck, th: "ปพ.5", en: "PP.5", color: "from-danger to-info", roles: ["teacher", "admin", "director"] },
  { to: "/dashboard/student/behavior", icon: Shield, th: "พฤติกรรม", en: "Behavior", color: "from-danger to-danger", roles: ["teacher", "admin", "director", "parent"] },
  { to: "/dashboard/admin/news?compose=1", icon: Megaphone, th: "โพสต์ข่าว", en: "Post News", color: "from-warning to-danger", roles: ["admin", "director"] },
  { to: "/dashboard/admin/eform", icon: FileText, th: "ส่งเอกสาร", en: "Send Form", color: "from-info to-info" },

  // Universal
  { to: "/dashboard/feed?compose=1", icon: Camera, th: "โพสต์รูป", en: "Post Photo", color: "from-danger to-danger" },
  { to: "/dashboard/inbox", icon: MessageSquare, th: "ข้อความ", en: "Messages", color: "from-warning to-warning" },
  { to: "/dashboard/academic/calendar", icon: CalendarDays, th: "ปฏิทิน", en: "Calendar", color: "from-info to-info" },
  { to: "/dashboard/student/leave?new=1", icon: FileText, th: "ยื่นใบลา", en: "Request Leave", color: "from-warning to-warning" },
  { to: "/dashboard/student/health-trend", icon: Heart, th: "สุขภาพ", en: "Health", color: "from-danger to-danger" },

  // Services
  { to: "/dashboard/library/books", icon: BookMarked, th: "ห้องสมุด", en: "Library", color: "from-success to-info" },
  { to: "/dashboard/cafeteria/menus", icon: Utensils, th: "โรงอาหาร", en: "Cafeteria", color: "from-warning to-warning" },
  { to: "/dashboard/bus/routes", icon: Bus, th: "รถรับ-ส่ง", en: "Bus", color: "from-warning to-warning" },
  { to: "/dashboard/finance/scholarships", icon: GraduationCap, th: "ทุน", en: "Scholarships", color: "from-info to-info" },

  // Admin extras
  { to: "/dashboard/admin/early-warning", icon: Bell, th: "Early Warning", en: "Early Warning", color: "from-danger to-warning", roles: ["admin", "director", "teacher"] },
  { to: "/dashboard/finance/budget", icon: Wallet, th: "งบประมาณ", en: "Budget", color: "from-success to-success", roles: ["admin", "director"] },
  { to: "/dashboard/hr/personnel", icon: Users, th: "บุคลากร", en: "HR", color: "from-danger to-info", roles: ["admin", "director"] },
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
        className="rounded-t-2xl border-t-0 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[85dvh] overflow-y-auto"
      >
        <SheetHeader className="text-left mb-3">
          <SheetTitle className="text-base">{L("ทางลัด", "Quick actions")}</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
