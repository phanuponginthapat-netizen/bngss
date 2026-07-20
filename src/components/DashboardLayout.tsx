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
import { LogOut, User, Settings, Shield, Inbox, PanelLeft } from "lucide-react";
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
import ObserverBanner from "@/components/ObserverBanner";
import { useAuthSession } from "@/hooks/useAuthSession";
// CommandPalette removed to prevent cross-role access via global search
import NotificationHighlightScroller from "@/components/NotificationHighlightScroller";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import AiChatBubble from "@/components/ai/AiChatBubble";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useSessionKeepAlive } from "@/hooks/useSessionKeepAlive";
import { useRadixOverlayCleanup } from "@/hooks/useRadixOverlayCleanup";
import { useForceLogoutListener } from "@/hooks/useForceLogoutListener";
import OnboardingTour from "@/components/OnboardingTour";
import { resolveProfileImageUrl } from "@/lib/profileImageUrl";

/** ปุ่ม avatar ที่ toggle sidebar (แทน dropdown เดิม) */
function AvatarSidebarToggle({ avatarUrl, fullName, userEmail }: { avatarUrl: string | null; fullName: string; userEmail: string }) {
  const { toggleSidebar, state, isMobile, openMobile } = useSidebar();
  const { lang } = useLanguage();
  const isOpen = isMobile ? openMobile : state === "expanded";
  const aria = isOpen
    ? (lang === "th" ? "ซ่อนแถบเมนู" : "Hide sidebar")
    : (lang === "th" ? "แสดงแถบเมนู" : "Show sidebar");
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label={aria}
      aria-expanded={isOpen}
      title={fullName || userEmail}
      data-tour="avatar-toggle"
      className="h-9 w-9 rounded-full p-0 hover:bg-card shrink-0"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30" />
      ) : (
        <span className="w-8 h-8 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </span>
      )}
    </Button>
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
  // ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 2 ชม. (เฉพาะ desktop browser — ยกเว้น PWA/มือถือ/kiosk)
  useIdleLogout(!!session);
  // รักษา session ให้อยู่รอดบนมือถือ/PWA — refresh token เมื่อกลับมา visible + reconnect realtime
  useSessionKeepAlive(!!session);
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
        .then(async ({ data }) => {
          if (data) {
            setAvatarUrl(await resolveProfileImageUrl(data.avatar_url));
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
        setAvatarUrl(await resolveProfileImageUrl(profile.avatar_url));
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
            .then(async ({ data }) => {
              if (data) {
                setAvatarUrl(await resolveProfileImageUrl(data.avatar_url));
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

            {/* Desktop brand lockup — CMS logo + school name */}
            <Link
              to="/dashboard"
              className="hidden md:flex items-center gap-3 ml-1 pl-2 pr-4 py-1.5 rounded-2xl group relative overflow-hidden"
              aria-label={appName}
            >
              {/* soft gradient wash */}
              <span
                aria-hidden
                className="absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(120deg, hsl(var(--primary)/0.12), hsl(var(--accent)/0.10) 55%, transparent)",
                }}
              />
              {/* logo puck */}
              <span className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.45)] ring-1 ring-primary/20 overflow-hidden">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt=""
                    className="w-9 h-9 object-contain"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  <span className="w-9 h-9 rounded-lg gradient-primary" aria-hidden />
                )}
              </span>
              {/* text lockup */}
              <span className="relative flex flex-col leading-tight min-w-0">
                <span
                  className="text-[15px] font-bold tracking-tight truncate max-w-[260px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {appName}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground/80 tracking-wide truncate max-w-[260px]">
                  {lang === "th" ? "ระบบบริหารจัดการโรงเรียนอัจฉริยะ" : "Smart School Management"}
                </span>
              </span>
            </Link>




            <div className="flex-1" />
            <div className="ml-auto flex items-center gap-1 rounded-full bg-muted/40 border border-border/50 px-1 py-1 backdrop-blur-sm">

              <OfflineIndicator />
              <PWAInstallButton />
              <LanguageToggle />
              <NotificationDropdown />

              <AvatarSidebarToggle avatarUrl={avatarUrl} fullName={fullName} userEmail={userEmail} />
            </div>
          </header>
          <div
            className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-6"
            style={{ scrollPaddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
          >

            <EnablePushBanner />
            <ObserverBanner />
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
        {/* CommandPalette disabled — global search removed for access-control safety */}
        <OnboardingTour />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
