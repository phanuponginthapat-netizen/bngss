import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { Network } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export type DashboardShortcut = {
  id: string;
  label_th: string;
  label_en: string;
  icon: string | null;
  logo_url: string | null;
  bg_class: string;
  target_url: string;
  open_in_new_tab: boolean;
  visible_roles: string[];
  sort_order: number;
  is_active: boolean;
};

function IconFor({ name, className }: { name?: string | null; className?: string }) {
  const Comp =
    (name && (LucideIcons as any)[name]) ||
    Network;
  return <Comp className={className} />;
}

/**
 * Dashboard shortcut tiles — admin-configurable via /dashboard/admin/dashboard-shortcuts
 * Labels, icons, logos, colors, target URLs, visible roles all stored in `dashboard_shortcuts`.
 */
export default function SuperAppShortcuts({ alerts = 0 }: { alerts?: number }) {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const navigate = useNavigate();

  const { data: tiles = [] } = useQuery({
    queryKey: ["dashboard_shortcuts", "active"],
    queryFn: async (): Promise<DashboardShortcut[]> => {
      const { data } = await supabase
        .from("dashboard_shortcuts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data as DashboardShortcut[]) || [];
    },
    staleTime: 60_000,
  });

  const visible = tiles.filter((t) =>
    role ? t.visible_roles.includes(role) : t.visible_roles.length === 0 || t.visible_roles.includes("student"),
  );

  const handleClick = (t: DashboardShortcut) => {
    if (t.open_in_new_tab || /^https?:\/\//i.test(t.target_url)) {
      window.open(t.target_url, t.open_in_new_tab ? "_blank" : "_self", "noopener,noreferrer");
    } else {
      navigate(t.target_url);
    }
  };

  if (visible.length === 0) return null;

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl p-3 sm:p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-3 sm:gap-4">
        {visible.map((t) => {
          const isInbox = t.target_url.includes("/inbox");
          const badge = isInbox ? alerts : 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleClick(t)}
              className="group flex flex-col items-center gap-1.5 p-1 rounded-xl active:scale-95 transition-transform"
            >
              <div className="relative">
                {/* Neumorphic squircle — soft outer shadow + inner top highlight + subtle bottom shade,
                    so the tile reads like an iOS app icon rather than a flat chip. */}
                <div
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] ${t.bg_class} flex items-center justify-center overflow-hidden
                    shadow-[0_6px_14px_-6px_hsl(0_0%_0%/0.25),0_2px_4px_-2px_hsl(0_0%_0%/0.15)]
                    ring-1 ring-black/[0.06]
                    group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_22px_-8px_hsl(0_0%_0%/0.3)]
                    transition-all duration-200`}
                >
                  {/* top gloss */}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[22px] bg-gradient-to-b from-white/45 to-transparent" />
                  {/* bottom inner shade */}
                  <span className="pointer-events-none absolute inset-0 rounded-[22px] shadow-[inset_0_-6px_10px_-6px_hsl(0_0%_0%/0.25),inset_0_1px_0_hsl(0_0%_100%/0.35)]" />
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="relative w-full h-full object-contain p-2 drop-shadow-[0_1px_1px_hsl(0_0%_0%/0.25)]" />
                  ) : (
                    <IconFor
                      name={t.icon}
                      className="relative w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-[0_1px_1px_hsl(0_0%_0%/0.35)]"
                    />
                  )}
                </div>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background shadow-md">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-foreground/85 text-center leading-tight line-clamp-2 w-full font-medium">
                {lang === "th" ? t.label_th : t.label_en}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
