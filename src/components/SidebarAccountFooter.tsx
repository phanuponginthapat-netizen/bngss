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
    <SidebarFooter className="mt-auto border-t border-sidebar-border/70 bg-gradient-to-t from-sidebar-accent/20 to-transparent p-1.5">
      {!collapsed && (
        <div className="px-1.5 py-1 flex items-center gap-2 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary/30 flex-shrink-0" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </span>
          )}
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <div className="text-xs font-medium text-sidebar-foreground truncate">{fullName || userEmail}</div>
            {badge && <Badge variant={badge.variant} className="text-[9px] h-3.5 px-1 leading-none">{badge.label}</Badge>}
          </div>
        </div>
      )}
      <SidebarMenu className="gap-0">
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={handleLogout}
            tooltip={t("logout")}
            className={`h-8 text-destructive hover:text-destructive ${collapsed ? "justify-center w-10 h-8 mx-auto" : ""}`}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="text-sm">{t("logout")}</span>}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

  );
}
