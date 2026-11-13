import { Link, useLocation } from "react-router-dom";
import { Home, Inbox, CalendarDays, User, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
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
      "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 min-h-14 transition-colors relative",
      active ? "text-primary" : "text-muted-foreground"
    )}
    aria-label={label}
    aria-current={active ? "page" : undefined}
  >
    <span
      className={cn(
        "inline-flex items-center justify-center w-11 h-7 rounded-md transition-colors duration-200",
        active
          ? "bg-primary/10"
          : "bg-transparent"
      )}
    >
      <Icon className={cn("w-[22px] h-[22px] transition-transform", active && "fill-primary/25 scale-105")} strokeWidth={active ? 2.2 : 1.8} />
    </span>
    <span className={cn("text-[11px] font-medium truncate max-w-[72px]", active && "font-semibold")}>{label}</span>
  </Link>
);

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const { openMobile, setOpenMobile } = useSidebar();

  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <nav
      className="mobile-app-nav fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={L("เมนูหลัก", "Main navigation")}
    >
      <div className="flex items-stretch h-16 max-w-2xl mx-auto px-1">
        <NavItem to="/dashboard" icon={Home} label={L("หน้าแรก", "Home")} active={pathname === "/dashboard"} />
        <NavItem to="/dashboard/inbox" icon={Inbox} label={L("ข้อความ", "Inbox")} active={isActive("/dashboard/inbox")} />

        <div className="flex-1 flex items-center justify-center">
          <Button variant="ghost" className="h-16 w-full flex-col gap-1 rounded-none px-1 text-muted-foreground"
            aria-label={L("เมนูทั้งหมด", "All menus")} aria-expanded={openMobile}
            onClick={() => { haptic("light"); setOpenMobile(true); }}>
            <span className="flex h-7 w-11 items-center justify-center"><Menu className="h-[22px] w-[22px]" /></span>
            <span className="text-[11px] font-medium">{L("เมนู", "Menu")}</span>
          </Button>
        </div>

        <NavItem to="/dashboard/academic/calendar" icon={CalendarDays} label={L("ปฏิทิน", "Calendar")} active={isActive("/dashboard/academic/calendar")} />
        <NavItem to="/dashboard/profile" icon={User} label={L("ของฉัน", "Me")} active={isActive("/dashboard/profile")} />
      </div>
    </nav>
  );
}
