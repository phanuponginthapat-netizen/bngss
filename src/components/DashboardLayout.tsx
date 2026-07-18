import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ModuleGuard } from "@/components/ModuleGuard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { LogOut, User, Settings, Shield, Inbox, Search, PanelLeft } from "lucide-react";
import NotificationDropdown from "@/components/NotificationDropdown";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useGlobalRealtime } from "@/hooks/useGlobalRealtime";
import FirstLoginSetup from "@/pages/FirstLoginSetup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BackButton from "@/components/BackButton";
import { MobileBottomNav } from "@/components/mobile";
import EnablePushBanner from "@/components/EnablePushBanner";
import { useAuthSession } from "@/hooks/useAuthSession";
import CommandPalette from "@/components/CommandPalette";
import NotificationHighlightScroller from "@/components/NotificationHighlightScroller";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import AiChatBubble from "@/components/ai/AiChatBubble";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useRadixOverlayCleanup } from "@/hooks/useRadixOverlayCleanup";
import { useForceLogoutListener } from "@/hooks/useForceLogoutListener";

/** Menu item ที่ใช้ toggle sidebar — ต้องอยู่ใต้ SidebarProvider */
function SidebarToggleItem() {
  const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
  const { lang } = useLanguage();
  const isOpen = isMobile ? openMobile : state === "expanded";
  const label = isOpen
    ? (lang === "th" ? "ซ่อนแถบเมนูด้านข้าง" : "Hide sidebar")
    : (lang === "th" ? "แสดงแถบเมนูด้านข้าง" : "Show sidebar");
  return (
    <DropdownMenuItem
      onSelect={(e) => { e.preventDefault(); toggleSidebar(); }}
      className="cursor-pointer gap-2"
    >
      <PanelLeft className="w-4 h-4" /> {label}
    </DropdownMenuItem>
  );
}


const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLanguage();
  const { isReady, session } = useAuthSession();
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [studentClassroom, setStudentClassroom] = useState<string | null>(null);
  const { role, userId, loading: roleLoading } = useUserRole();
  const { appName, schoolLogo } = useSystemSettings();
  useGlobalRealtime();
  useForceLogoutListener({ userId, role, classroom: studentClassroom });
  // ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 2 ชม. (เฉพาะบน browser ที่ไม่ใช่ PWA)
  useIdleLogout(!!session);
  // กวาด pointer-events / scroll-lock ที่ Radix ทิ้งค้างตอน navigate ระหว่างที่ overlay เปิด
  useRadixOverlayCleanup();

  // load classroom for students so force-logout broadcasts can target class
  useEffect(() => {
    if (!userId || role !== "student") { setStudentClassroom(null); return; }
    supabase
      .from("students")
      .select("classrooms!students_classroom_id_fkey(name)")
      .eq("auth_user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setStudentClassroom((data as any)?.classrooms?.name ?? null);
      });
  }, [userId, role]);


  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    setUserEmail(session.user.email || "");
  }, [isReady, session, navigate]);

  useEffect(() => {
    if (!userId) return;
    // Admin / alumni are exempt from first-login setup,
    // but still need profile data (avatar + name) loaded for the header.
    const exempt = role === "admin" || role === "director" || role === "alumni";
    if (exempt) {
      setNeedsSetup(false);
      supabase
        .from("profiles")
        .select("avatar_url, first_name, last_name, nickname")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
            const name = data.first_name ? (data.nickname ? `${data.first_name} (${data.nickname})` : data.first_name) : (data.nickname || "");
            setFullName(name || "");
          }
        });
      return;
    }

    // Check if first login setup is needed
    const checkFirstLogin = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url, first_name, last_name, nickname, must_change_password, pdpa_accepted_at")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        setAvatarUrl(profile.avatar_url);
        const name = profile.first_name ? (profile.nickname ? `${profile.first_name} (${profile.nickname})` : profile.first_name) : (profile.nickname || "");
        setFullName(name || "");
        
        // Setup needed if: missing name, no PDPA consent, or admin forced password reset
        const needsName = !profile.first_name;
        const needsPdpa = !(profile as any).pdpa_accepted_at;
        const needsPwd = (profile as any).must_change_password === true;
        if (needsName || needsPdpa || needsPwd) {
          // Also check school_settings flag
          const { data: setting } = await supabase
            .from("school_settings")
            .select("setting_value")
            .eq("setting_key", `first_login_done_${userId}`)
            .maybeSingle();
          
          // PDPA and forced password reset always re-trigger setup, ignore the legacy flag
          if (needsPdpa || needsPwd) {
            setNeedsSetup(true);
          } else {
            setNeedsSetup(!setting?.setting_value);
          }
        } else {
          setNeedsSetup(false);
        }
      } else {
        setNeedsSetup(true);
      }
    };
    
    checkFirstLogin();
  }, [userId, role]);

  const handleLogout = async () => {
    try {
      const { logAudit } = await import("@/lib/auditLog");
      await logAudit({ action: "logout" });
    } catch {}
    await supabase.auth.signOut();
    navigate("/login");
  };

  const roleBadgeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    admin: { label: lang === "th" ? "ผู้ดูแลระบบ" : "Admin", variant: "destructive" },
    director: { label: lang === "th" ? "ผู้อำนวยการ" : "Director", variant: "default" },
    teacher: { label: lang === "th" ? "ครู" : "Teacher", variant: "secondary" },
    student: { label: lang === "th" ? "นักเรียน" : "Student", variant: "outline" },
    alumni: { label: lang === "th" ? "ศิษย์เก่า" : "Alumni", variant: "outline" },
    
  };

  if (!isReady || roleLoading || needsSetup === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (needsSetup && userId && role !== "admin" && role !== "director" && role !== "alumni") {
    return (
      <FirstLoginSetup
        userId={userId}
        onComplete={() => {
          setNeedsSetup(false);
          // Refresh profile data
          supabase
            .from("profiles")
            .select("avatar_url, first_name, last_name, nickname")
            .eq("id", userId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setAvatarUrl(data.avatar_url);
                const name = data.first_name ? (data.nickname ? `${data.first_name} (${data.nickname})` : data.first_name) : (data.nickname || "");
                setFullName(name || "");
              }
            });
        }}
      />
    );
  }

  const badge = role ? roleBadgeMap[role] : null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-h-[100svh] w-full bg-background">
        <main className="flex-1 flex flex-col min-w-0">

          <header
            className="sticky top-0 z-40 flex items-center gap-2 sm:gap-3 border-b border-border/40 bg-card/80 backdrop-blur-xl px-2 sm:px-6 shrink-0 shadow-[0_1px_20px_-8px_hsl(var(--primary)/0.15)]"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
              paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
              minHeight: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >



            {location.pathname !== "/dashboard" && (
              <BackButton />
            )}
            <Link to="/dashboard" className="md:hidden flex items-center gap-2 font-semibold truncate">
              {schoolLogo ? (
                <img src={schoolLogo} alt="logo" className="w-7 h-7 rounded-lg object-contain" />
              ) : (
                <span className="w-7 h-7 rounded-lg gradient-primary" aria-hidden />
              )}
              <span className="text-sm truncate max-w-[140px]">{appName}</span>
            </Link>

            {/* Search trigger — opens CommandPalette (⌘K) */}
            <button
              type="button"
              onClick={() => {
                const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
                const ev = new KeyboardEvent("keydown", {
                  key: "k",
                  code: "KeyK",
                  metaKey: isMac,
                  ctrlKey: !isMac,
                  bubbles: true,
                });
                window.dispatchEvent(ev);
              }}
              className="hidden md:flex items-center gap-2 h-9 px-3 ml-2 rounded-full bg-muted/60 hover:bg-muted border border-border/50 text-sm text-muted-foreground transition-colors w-full max-w-[320px]"
              aria-label={lang === "th" ? "ค้นหา" : "Search"}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1 text-left">
                {lang === "th" ? "ค้นหาเมนู, นักเรียน, เอกสาร…" : "Search menus, students, docs…"}
              </span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border/60 shrink-0">
                ⌘K
              </kbd>
            </button>

            <div className="flex-1" />
            <div className="ml-auto flex items-center gap-1 rounded-full bg-muted/40 border border-border/50 px-1 py-1 backdrop-blur-sm">

              <OfflineIndicator />
              <PWAInstallButton />
              <LanguageToggle />
              <NotificationDropdown />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2 sm:px-3 max-w-[200px] rounded-full hover:bg-card">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/30" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </span>
                    )}
                    <span className="hidden sm:inline text-sm truncate font-medium">{fullName || userEmail}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{fullName || userEmail}</span>
                      {badge && <Badge variant={badge.variant} className="w-fit text-xs">{badge.label}</Badge>}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SidebarToggleItem />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/profile" className="cursor-pointer gap-2">
                      <User className="w-4 h-4" /> {lang === "th" ? "โปรไฟล์" : "Profile"}
                    </Link>
                  </DropdownMenuItem>
                  {(role === "admin" || role === "director") && (
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/users" className="cursor-pointer gap-2">
                        <Shield className="w-4 h-4" /> {lang === "th" ? "จัดการผู้ใช้" : "User Management"}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive gap-2 cursor-pointer">
                    <LogOut className="w-4 h-4" /> {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div
            className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-6"
            style={{ scrollPaddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
          >

            <EnablePushBanner />
            <ErrorBoundary>
              <ModuleGuard />
              <NotificationHighlightScroller />
              <div key={location.pathname} className="animate-fade-in-up">
                <Outlet />
              </div>
            </ErrorBoundary>

          </div>
          <MobileBottomNav />
          <AiChatBubble />
        </main>
        <AppSidebar />
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
