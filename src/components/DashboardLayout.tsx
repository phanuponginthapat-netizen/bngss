import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ModuleGuard } from "@/components/ModuleGuard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, setRoleOverride } from "@/hooks/useUserRole";
import { GraduationCap, Repeat } from "lucide-react";
import { LogOut, User, Settings, Shield, Inbox } from "lucide-react";
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
import PWAInstallBanner from "@/components/PWAInstallBanner";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import AiChatBubble from "@/components/ai/AiChatBubble";
import { MessengerBubble } from "@/components/chat/MessengerBubble";
import { AcademicPeriodProvider } from "@/contexts/AcademicPeriodContext";
import AcademicPeriodSwitcher from "@/components/AcademicPeriodSwitcher";
import NotificationToastListener from "@/components/NotificationToastListener";
import ObserverBanner from "@/components/ObserverBanner";
import ImpersonationBanner from "@/components/ImpersonationBanner";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang } = useLanguage();
  const { isReady, session, error: authError } = useAuthSession();
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [positionTitle, setPositionTitle] = useState<string>("");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const { role, userId, loading: roleLoading, canSwitchRole, isImpersonating, error: roleError, refetchRole } = useUserRole();
  const { appName, schoolLogo } = useSystemSettings();
  useGlobalRealtime();

  useEffect(() => {
    if (!isReady || authError) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    setUserEmail(session.user.email || "");
  }, [isReady, session, authError, navigate]);

  useEffect(() => {
    if (!userId) return;
    // Admin / alumni are exempt from first-login setup,
    // but still need profile data (avatar + name) loaded for the header.
    const exempt = role === "admin" || role === "alumni" || role === "observer";
    if (exempt) {
      setNeedsSetup(false);
      supabase
        .from("profiles")
        .select("avatar_url, first_name, last_name, nickname, position_title")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
            const name = data.first_name ? (data.nickname ? `${data.first_name} (${data.nickname})` : data.first_name) : (data.nickname || "");
            setFullName(name || "");
            setPositionTitle((data as any).position_title || "");
          }
        });
      return;
    }

    // Check if first login setup is needed
    const checkFirstLogin = async () => {
      try {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("avatar_url, first_name, last_name, nickname, must_change_password, pdpa_accepted_at, position_title")
          .eq("id", userId)
          .maybeSingle();

        if (profileErr) throw profileErr;

        if (profile) {
          setAvatarUrl(profile.avatar_url);
          const name = profile.first_name ? (profile.nickname ? `${profile.first_name} (${profile.nickname})` : profile.first_name) : (profile.nickname || "");
          setFullName(name || "");
          setPositionTitle((profile as any).position_title || "");

          // Setup needed if: missing name, no PDPA consent, or admin forced password reset
          const needsName = !profile.first_name;
          const needsPdpa = !(profile as any).pdpa_accepted_at;
          const needsPwd = (profile as any).must_change_password === true;
          if (needsName || needsPdpa || needsPwd) {
            const { data: setting } = await supabase
              .from("school_settings")
              .select("setting_value")
              .eq("setting_key", `first_login_done_${userId}`)
              .maybeSingle();

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
      } catch (e) {
        // Never leave the layout stuck on the loading spinner — fail open so
        // the sidebar/UI can render. Setup will re-check on next mount.
        console.warn("[DashboardLayout] first-login check failed:", e);
        setNeedsSetup(false);
      }
    };

    // Safety timeout: if the check hangs (slow network / RLS lag), unblock
    // the UI after 6s so the sidebar always shows.
    const timeoutId = window.setTimeout(() => {
      setNeedsSetup((v) => (v === null ? false : v));
    }, 6000);

    checkFirstLogin().finally(() => window.clearTimeout(timeoutId));
    return () => window.clearTimeout(timeoutId);

  }, [userId, role]);

  const handleLogout = async () => {
    try {
      const { logAudit } = await import("@/lib/auditLog");
      await logAudit({ action: "logout" });
    } catch {}
    await supabase.auth.signOut();
    navigate("/login");
  };

  const isDeputy = /รองผู้อำนวยการ|รองผอ/.test(positionTitle || "");
  const roleBadgeMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    admin: { label: lang === "th" ? "ผู้ดูแลระบบ" : "Admin", variant: "destructive" },
    director: {
      label: isDeputy ? (lang === "th" ? "รองผู้อำนวยการ" : "Deputy Director") : (lang === "th" ? "ผู้อำนวยการ" : "Director"),
      variant: "default",
    },
    teacher: { label: lang === "th" ? "ครู" : "Teacher", variant: "secondary" },
    student: { label: lang === "th" ? "นักเรียน" : "Student", variant: "outline" },
    alumni: { label: lang === "th" ? "ศิษย์เก่า" : "Alumni", variant: "outline" },
    observer: { label: lang === "th" ? "ผู้สังเกตการณ์" : "Observer", variant: "outline" },
    
  };

  const guardError = authError || roleError;

  if (guardError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-center px-4">
        <h2 className="text-2xl font-bold text-destructive">โหลดระบบไม่สำเร็จ</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          ระบบตรวจสอบบัญชีหรือสิทธิ์การใช้งานไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง
        </p>
        <Button onClick={() => refetchRole()}>ลองใหม่</Button>
      </div>
    );
  }

  if (!isReady || roleLoading || needsSetup === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (needsSetup && userId && role !== "admin" && role !== "alumni" && role !== "observer") {
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
    <AcademicPeriodProvider>
    <SidebarProvider>
      <div
        className="flex w-full bg-background overflow-hidden"
        style={{ height: "100svh" }}
      >
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <ObserverBanner />
          <ImpersonationBanner />
          <header
            className="flex items-center gap-2 sm:gap-4 border-b bg-card/80 backdrop-blur-sm px-2 sm:px-6 shrink-0"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
              paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
              minHeight: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >
            <SidebarTrigger />
            {location.pathname !== "/dashboard" && (
              <BackButton />
            )}
            <Link to="/dashboard" className="md:hidden flex items-center gap-2 font-semibold truncate">
              {schoolLogo ? (
                <img src={schoolLogo} alt="logo" className="w-7 h-7 object-contain" />
              ) : (
                <span className="w-7 h-7 rounded-lg gradient-primary" aria-hidden />
              )}
              <span className="text-sm truncate max-w-[140px]">{appName}</span>
            </Link>
            <div className="flex-1" />
            <div className="flex items-center gap-1 sm:gap-3">
              <AcademicPeriodSwitcher />
              <OfflineIndicator />
              <PWAInstallButton />
              <LanguageToggle />
              <NotificationDropdown />


              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="gap-2 px-2 sm:px-3 max-w-[200px] min-h-11 min-w-11"
                    aria-label={fullName || userEmail || "โปรไฟล์"}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-border" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </span>
                    )}
                    <span className="hidden sm:inline text-sm truncate">{fullName || userEmail}</span>
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
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/profile" className="cursor-pointer gap-2">
                      <User className="w-4 h-4" /> {lang === "th" ? "โปรไฟล์" : "Profile"}
                    </Link>
                  </DropdownMenuItem>
                  {role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/users" className="cursor-pointer gap-2">
                        <Shield className="w-4 h-4" /> {lang === "th" ? "จัดการผู้ใช้" : "User Management"}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canSwitchRole && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        {lang === "th" ? "สลับโหมด" : "Switch mode"}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => {
                          setRoleOverride(null);
                          navigate("/dashboard");
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span className="flex-1">{lang === "th" ? "ผู้ดูแลระบบ" : "Admin"}</span>
                        {!isImpersonating && <Badge variant="secondary" className="text-[10px]">●</Badge>}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setRoleOverride("teacher");
                          navigate("/dashboard");
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span className="flex-1">{lang === "th" ? "ครู" : "Teacher"}</span>
                        {isImpersonating && <Badge variant="secondary" className="text-[10px]">●</Badge>}
                      </DropdownMenuItem>
                    </>
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
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-3 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-6"
            style={{ scrollPaddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
          >
            <EnablePushBanner />
            <ErrorBoundary>
              <ModuleGuard />
              <div key={location.pathname} className="animate-fade-in-up">
                <Outlet />
              </div>
            </ErrorBoundary>
          </div>
          <MobileBottomNav />
          <AiChatBubble />
          <MessengerBubble />
          <NotificationToastListener />
        </main>
        <CommandPalette />
        <PWAInstallBanner />
      </div>
    </SidebarProvider>
    </AcademicPeriodProvider>
  );
};

export default DashboardLayout;
