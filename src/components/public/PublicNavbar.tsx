import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { icons as lucideIcons, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  parent_id: string | null;
  label: string;
  url: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
  open_in_new_tab: boolean;
  children?: NavItem[];
}

const Icon = ({ name, className }: { name?: string | null; className?: string }) => {
  if (!name) return null;
  const Cmp = (lucideIcons as any)[name];
  if (!Cmp) return null;
  return <Cmp className={className} />;
};

export default function PublicNavbar() {
  const s = useSystemSettings();
  const [items, setItems] = useState<NavItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cms_nav_menu")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      const all = (data ?? []) as NavItem[];
      const roots = all.filter((i) => !i.parent_id);
      roots.forEach((r) => (r.children = all.filter((c) => c.parent_id === r.id)));
      setItems(roots);
    })();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [location.pathname]);

  const schoolName = s.schoolName || "โรงเรียน";
  const logo = s.schoolLogo;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={schoolName} className="h-11 w-11 rounded-xl object-cover ring-2 ring-primary/20" />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-primary/20" />
          )}
          <div className="hidden sm:block">
            <div className="text-sm font-bold leading-tight text-foreground">{schoolName}</div>
            <div className="text-[11px] text-muted-foreground">School Website</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {items.map((item) => {
            const hasChildren = (item.children?.length ?? 0) > 0;
            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => hasChildren && setOpenMenu(item.id)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                {hasChildren ? (
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                      "text-foreground/80 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                    {item.label}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                ) : (
                  <Link
                    to={item.url || "#"}
                    target={item.open_in_new_tab ? "_blank" : undefined}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-primary/10 hover:text-primary"
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                )}

                {hasChildren && openMenu === item.id && (
                  <div className="absolute left-0 top-full pt-2">
                    <div className="w-72 rounded-2xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
                      {item.children!.map((child) => (
                        <Link
                          key={child.id}
                          to={child.url || "#"}
                          target={child.open_in_new_tab ? "_blank" : undefined}
                          className="flex items-start gap-3 rounded-xl p-3 transition hover:bg-primary/10"
                        >
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon name={child.icon} className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{child.label}</div>
                            {child.description && (
                              <div className="text-xs text-muted-foreground">{child.description}</div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
          >
            เข้าสู่ระบบ
          </Link>
          <button
            className="rounded-xl p-2 text-foreground lg:hidden hover:bg-primary/10"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="max-h-[70vh] space-y-1 overflow-y-auto px-4 py-3">
            {items.map((item) => (
              <div key={item.id}>
                {item.url ? (
                  <Link to={item.url} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-primary/10">
                    <Icon name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                ) : (
                  <div className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</div>
                )}
                {item.children?.map((c) => (
                  <Link
                    key={c.id}
                    to={c.url || "#"}
                    target={c.open_in_new_tab ? "_blank" : undefined}
                    className="ml-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-primary/10 hover:text-primary"
                  >
                    <Icon name={c.icon} className="h-4 w-4" />
                    {c.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link to="/login" className="mt-2 flex items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
