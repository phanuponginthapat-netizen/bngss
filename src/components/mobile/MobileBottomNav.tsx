import { Link, useLocation } from "react-router-dom";
import { Home, Inbox, CalendarDays, User, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { MobileQuickActionsFab } from "./MobileQuickActionsFab";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  icon: React.ComponentType<any>;
  label: string;
  active: boolean;
}

const NavItem = ({ to, icon: Icon, label, active }: NavItemProps) => (
  <Link
    to={to}
    onClick={() => haptic("light")}
    className={cn(
      "flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-11 transition-colors relative",
      active ? "text-primary" : "text-muted-foreground"
    )}
    aria-label={label}
  >
    <span
      className={cn(
        "inline-flex items-center justify-center w-11 h-8 rounded-2xl transition-all duration-200",
        active
          ? "bg-primary/15 ring-1 ring-primary/25 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6),0_2px_6px_-2px_hsl(var(--primary)/0.35)]"
          : "bg-transparent"
      )}
    >
      <Icon className={cn("w-[22px] h-[22px] transition-transform", active && "fill-primary/25 scale-105")} strokeWidth={active ? 2.2 : 1.8} />
    </span>
    <span className={cn("text-[10px] font-medium truncate max-w-[64px]", active && "font-semibold")}>{label}</span>
  </Link>
);

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const { role } = useUserRole();

  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.08)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={L("เมนูหลัก", "Main navigation")}
    >
      <div className="flex items-stretch h-14 max-w-2xl mx-auto px-1">
        <NavItem to="/dashboard" icon={Home} label={L("หน้าแรก", "Home")} active={pathname === "/dashboard"} />
        <NavItem to="/dashboard/inbox" icon={Inbox} label={L("กล่องข้อความ", "Inbox")} active={isActive("/dashboard/inbox")} />

        <div className="flex-1 flex items-center justify-center">
          <MobileQuickActionsFab
            trigger={
              <button
                onClick={() => haptic("medium")}
                className="-mt-2 w-12 h-12 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/40 flex items-center justify-center active:scale-95 transition-transform ring-4 ring-background"
                aria-label={L("ทางลัด", "Quick actions")}
              >
                <Plus className="w-6 h-6" />
              </button>
            }
            role={role}
          />
        </div>

        <NavItem to="/dashboard/academic/calendar" icon={CalendarDays} label={L("ปฏิทิน", "Calendar")} active={isActive("/dashboard/academic/calendar")} />
        <NavItem to="/dashboard/profile" icon={User} label={L("ของฉัน", "Me")} active={isActive("/dashboard/profile")} />
      </div>
    </nav>
  );
}
