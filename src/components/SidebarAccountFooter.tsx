import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Shield, LogOut } from "lucide-react";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveProfileImageUrl } from "@/lib/profileImageUrl";

export function SidebarAccountFooter() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { session } = useAuthSession();
  const { role } = useUserRole();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const userEmail = session?.user?.email || "";

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    supabase
      .from("profiles")
      .select("avatar_url, first_name, nickname")
      .eq("id", uid)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          const signed = await resolveProfileImageUrl(data.avatar_url);
          setAvatarUrl(signed);
          const name = data.first_name
            ? data.nickname
              ? `${data.first_name} (${data.nickname})`
              : data.first_name
            : data.nickname || "";
          setFullName(name || "");
        }
      });
  }, [session?.user?.id]);

  const closeMobile = () => { if (isMobile) setOpenMobile(false); };

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
  const badge = role ? roleBadgeMap[role] : null;

  return (
    <SidebarFooter className="border-t border-sidebar-border/70 bg-gradient-to-t from-sidebar-accent/25 to-transparent p-2 gap-1.5">
      {!collapsed ? (
        <div className="flex items-center gap-2 min-w-0 px-1.5 py-1 rounded-lg hover:bg-sidebar-accent/40 transition-colors">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30 flex-shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{fullName || userEmail.split("@")[0]}</div>
            {badge && (
              <Badge variant={badge.variant} className="mt-0.5 text-[9px] h-3.5 px-1 leading-none font-medium">
                {badge.label}
              </Badge>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={t("logout")}
            aria-label={t("logout")}
            className="flex-shrink-0 w-7 h-7 rounded-md inline-flex items-center justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          title={t("logout")}
          aria-label={t("logout")}
          className="mx-auto w-9 h-9 rounded-lg inline-flex items-center justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </SidebarFooter>


  );
}
