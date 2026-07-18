import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export type BrowserShortcut = {
  id: string;
  label_th: string;
  label_en: string;
  icon: string | null;
  logo_url: string | null;
  bg_class: string;
  target_url: string;
  visible_roles: string[];
  sort_order: number;
  is_active: boolean;
};

/**
 * Central hook for browser shortcuts (admin-managed in /dashboard/admin/browser-shortcuts).
 * Used by: Agent page, Browser page, Sidebar — one source of truth, realtime-synced.
 */
export function useBrowserShortcuts() {
  const { role } = useUserRole();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["browser_shortcuts", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("browser_shortcuts" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as BrowserShortcut[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime → admin แก้ที่เดียว เห็นทุกจอทันที
  useEffect(() => {
    const ch = supabase
      .channel("browser_shortcuts_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "browser_shortcuts" },
        () => qc.invalidateQueries({ queryKey: ["browser_shortcuts"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const shortcuts = role
    ? (query.data || []).filter((s) => s.visible_roles.includes(role))
    : (query.data || []);

  return { shortcuts, isLoading: query.isLoading };
}

/** เปิด URL — แจ้ง extension ให้ log/filter ก่อน, fallback window.open */
export function openBrowserUrl(raw: string) {
  let url = raw.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes(".") && !url.includes(" ")) url = "https://" + url;
    else url = "https://www.google.com/search?q=" + encodeURIComponent(url);
  }
  window.postMessage({ type: "SB_OPEN_URL", url }, "*");
  window.open(url, "_blank", "noopener,noreferrer");
}
