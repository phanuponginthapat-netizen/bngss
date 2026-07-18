import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, FileText, Heart, Wallet, Package, Calendar, Users, Network,
  Inbox, Megaphone, ClipboardCheck, ScanFace, BookOpenCheck, Shield, Bus,
  Utensils, BookMarked, GraduationCap, Brain, Camera, Radio, Bell, MoreHorizontal,
  Building2, Sparkles, Wrench, Globe,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { haptic } from "@/lib/haptics";

type Tile = {
  th: string;
  en: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  link: string;
  badge?: number;
  roles?: AppRole[]; // visible to these roles only; omit = all
};

/**
 * Super-app shortcut grid — covers every major module in the system.
 * Tiles are filtered per role so each user sees only what they can use.
 */
export default function SuperAppShortcuts({ alerts = 0 }: { alerts?: number }) {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [expanded, setExpanded] = useState(false);
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const ALL_TILES: Tile[] = useMemo(() => [
    // ── Daily/operational (everyone or staff) ──
    { th: "เช็คชื่อ", en: "Attendance", icon: ClipboardList, bg: "bg-gradient-to-br from-success to-success", link: "/dashboard/student/attendance", roles: ["teacher", "admin", "director"] },
    { th: "สแกนใบหน้า", en: "Face Scan", icon: ScanFace, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/student/face-scan", roles: ["teacher", "admin", "director"] },
    { th: "ตารางเรียน", en: "Schedule", icon: Calendar, bg: "bg-gradient-to-br from-warning to-warning", link: "/dashboard/academic/schedule" },
    { th: "การบ้าน", en: "Homework", icon: BookOpenCheck, bg: "bg-gradient-to-br from-success to-success", link: "/dashboard/homework" },
    { th: "ปพ.5", en: "PP.5 Grades", icon: ClipboardCheck, bg: "bg-gradient-to-br from-danger to-info", link: "/dashboard/academic/pp5", roles: ["teacher", "admin", "director"] },
    { th: "บันทึกหลังสอน", en: "Teaching Reflection", icon: ClipboardCheck, bg: "bg-gradient-to-br from-info to-success", link: "/dashboard/academic/teaching-reflections" },
    { th: "พฤติกรรม", en: "Behavior", icon: Shield, bg: "bg-gradient-to-br from-danger to-danger", link: "/dashboard/student/behavior", roles: ["teacher", "admin", "director", "parent"] },
    { th: "การลา", en: "Leave", icon: FileText, bg: "bg-gradient-to-br from-warning to-warning", link: "/dashboard/student/leave" },
    { th: "สุขภาพ", en: "Health", icon: Heart, bg: "bg-gradient-to-br from-danger to-danger", link: "/dashboard/student/health-trend" },
    { th: "สุขภาพฉัน", en: "My Fitness", icon: Heart, bg: "bg-gradient-to-br from-danger to-danger", link: "/dashboard/fitness" },

    // ── Communication / community ──
    { th: "ข่าวสาร", en: "News", icon: Megaphone, bg: "bg-gradient-to-br from-warning to-danger", link: "/dashboard/admin/news" },
    { th: "โซเชียลวอลล์", en: "Social Wall", icon: Sparkles, bg: "bg-gradient-to-br from-danger to-danger", link: "/dashboard/feed" },
    { th: "กล่องข้อความ", en: "Inbox", icon: Inbox, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/inbox", badge: alerts },
    { th: "E-Form", en: "E-Form", icon: FileText, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/admin/eform" },

    // ── Library / cafeteria / transport / scholarships ──
    { th: "ห้องสมุด", en: "Library", icon: BookMarked, bg: "bg-gradient-to-br from-success to-info", link: "/dashboard/library/books" },
    { th: "โรงอาหาร", en: "Cafeteria", icon: Utensils, bg: "bg-gradient-to-br from-warning to-warning", link: "/dashboard/cafeteria/menus" },
    { th: "รถรับ-ส่ง", en: "Bus", icon: Bus, bg: "bg-gradient-to-br from-warning to-warning", link: "/dashboard/bus/routes" },
    { th: "ทุนการศึกษา", en: "Scholarships", icon: GraduationCap, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/finance/scholarships" },

    // ── Finance / assets / HR (staff) ──
    { th: "งบประมาณ", en: "Budget", icon: Wallet, bg: "bg-gradient-to-br from-success to-success", link: "/dashboard/finance/budget", roles: ["admin", "director"] },
    { th: "ทรัพย์สิน", en: "Assets", icon: Package, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/finance/assets", roles: ["admin", "director", "teacher"] },
    { th: "บุคลากร", en: "HR", icon: Users, bg: "bg-gradient-to-br from-info to-danger", link: "/dashboard/hr/personnel", roles: ["admin", "director"] },
    { th: "จองห้อง", en: "Room Booking", icon: Building2, bg: "bg-gradient-to-br from-neutral to-neutral", link: "/dashboard/admin/rooms", roles: ["teacher", "admin", "director"] },

    // ── Security / AI / monitoring (staff) ──
    { th: "CCTV", en: "CCTV", icon: Camera, bg: "bg-gradient-to-br from-neutral to-neutral", link: "/dashboard/admin/cctv-live", roles: ["admin", "director"] },
    { th: "Early Warning", en: "Early Warning", icon: Bell, bg: "bg-gradient-to-br from-danger to-warning", link: "/dashboard/admin/early-warning", roles: ["admin", "director", "teacher"] },
    { th: "บันทึก AI", en: "AI Logs", icon: Brain, bg: "bg-gradient-to-br from-info to-info", link: "/dashboard/admin/ai-logs", roles: ["admin", "director"] },
    { th: "LINE OA", en: "LINE OA", icon: Radio, bg: "bg-gradient-to-br from-success to-success", link: "/dashboard/admin/line-oa", roles: ["admin", "director"] },

    // ── Universal hub ──
    { th: "เว็บไซต์โรงเรียน", en: "Public Site", icon: Globe, bg: "bg-gradient-to-br from-info to-info", link: "/" },
    { th: "แจ้งซ่อม", en: "Repair", icon: Wrench, bg: "bg-gradient-to-br from-neutral to-neutral", link: "/dashboard/finance/assets" },
    { th: "ศูนย์รวมโมดูล", en: "Module Hub", icon: Network, bg: "bg-gradient-to-br from-neutral to-neutral", link: "/dashboard/hub" },
  ], [alerts]);

  const tiles = useMemo(
    () => ALL_TILES.filter((t) => !t.roles || (role && t.roles.includes(role))),
    [ALL_TILES, role],
  );

  const PREVIEW_COUNT = 11; // 12th slot becomes "More"
  const shown = expanded ? tiles : tiles.slice(0, PREVIEW_COUNT);
  const hasMore = tiles.length > PREVIEW_COUNT;

  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl p-3 sm:p-4 bg-card/80 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-foreground tracking-tight">{L("เมนูทางลัด", "Quick Access")}</h3>
        <span className="text-[11px] text-muted-foreground font-medium">{tiles.length} {L("รายการ", "items")}</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
        {shown.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.link + t.en}
              type="button"
              onClick={() => { haptic("light"); navigate(t.link); }}
              className="group flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 active:scale-95 transition-all"
            >
              <div className="relative">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${t.bg} flex items-center justify-center shadow-sm ring-1 ring-black/[0.04] group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-sm" />
                </div>
                {t.badge != null && t.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-foreground/80 text-center leading-tight line-clamp-2 w-full">
                {L(t.th, t.en)}
              </span>
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => { haptic("light"); setExpanded((v) => !v); }}
            className="group flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 active:scale-95 transition-all"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-muted flex items-center justify-center ring-1 ring-border">
              <MoreHorizontal className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
            </div>
            <span className="text-[11px] sm:text-xs text-muted-foreground text-center leading-tight font-medium">
              {expanded ? L("ย่อ", "Less") : L("ดูทั้งหมด", "More")}
            </span>
          </button>
        )}
      </div>
    </Card>
  );
}
