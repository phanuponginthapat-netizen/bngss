import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  DASHBOARD_WIDGETS,
  type WidgetColor,
  type WidgetSize,
} from "@/lib/dashboardWidgets";

export interface UserWidgetRow {
  id?: string;
  widget_key: string;
  position: number;
  size: WidgetSize;
  color_theme: WidgetColor;
  enabled: boolean;
}

/**
 * Returns the merged widget config (defaults + overrides from DB) sorted by position.
 * Provides mutations to toggle/resize/recolor/reorder, persisted to user_dashboard_widgets.
 */
export function useDashboardWidgets() {
  const { userId } = useUserRole();
  const qc = useQueryClient();

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["user_dashboard_widgets", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_dashboard_widgets")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []) as UserWidgetRow[];
    },
  });

  // Merge defaults with user overrides.
  // For widgets without a saved row (e.g. newly added like mascot_hero), insert them
  // right after the previous registry widget so they keep their intended slot.
  let prevPos = -1;
  const widgets = DASHBOARD_WIDGETS.map((def, idx) => {
    const row = rows.find((r) => r.widget_key === def.key);
    const position = row?.position ?? prevPos + 0.5;
    prevPos = position;
    return {
      def,
      key: def.key,
      enabled: row?.enabled ?? def.defaultEnabled ?? true,
      size: (row?.size as WidgetSize) ?? def.defaultSize,
      color: (row?.color_theme as WidgetColor) ?? def.defaultColor,
      position,
      _registryIdx: idx,
    };
  }).sort((a, b) => a.position - b.position || a._registryIdx - b._registryIdx);

  const upsert = useMutation({
    onError: () => toast.error("บันทึกการจัดวางไม่สำเร็จ กรุณาลองใหม่"),
    mutationFn: async (patch: Partial<UserWidgetRow> & { widget_key: string }) => {
      if (!userId) return;
      const def = DASHBOARD_WIDGETS.find((d) => d.key === patch.widget_key);
      const existing = rows.find((r) => r.widget_key === patch.widget_key);
      const payload = {
        user_id: userId,
        widget_key: patch.widget_key,
        enabled: patch.enabled ?? existing?.enabled ?? def?.defaultEnabled ?? true,
        size: patch.size ?? existing?.size ?? def?.defaultSize ?? "md",
        color_theme: patch.color_theme ?? existing?.color_theme ?? def?.defaultColor ?? "primary",
        position: patch.position ?? existing?.position ?? DASHBOARD_WIDGETS.findIndex((d) => d.key === patch.widget_key),
      };
      const { error } = await supabase
        .from("user_dashboard_widgets")
        .upsert(payload, { onConflict: "user_id,widget_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_dashboard_widgets", userId] }),
  });

  const reorder = useMutation({
    onError: () => toast.error("บันทึกลำดับไม่สำเร็จ กรุณาลองใหม่"),
    mutationFn: async (orderedKeys: string[]) => {
      if (!userId) return;
      const payload = orderedKeys.map((key, idx) => {
        const def = DASHBOARD_WIDGETS.find((d) => d.key === key);
        const existing = rows.find((r) => r.widget_key === key);
        return {
          user_id: userId,
          widget_key: key,
          position: idx,
          enabled: existing?.enabled ?? def?.defaultEnabled ?? true,
          size: existing?.size ?? def?.defaultSize ?? "md",
          color_theme: existing?.color_theme ?? def?.defaultColor ?? "primary",
        };
      });
      const { error } = await supabase
        .from("user_dashboard_widgets")
        .upsert(payload, { onConflict: "user_id,widget_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_dashboard_widgets", userId] }),
  });

  const resetAll = useMutation({
    onError: () => toast.error("คืนการจัดวางไม่สำเร็จ กรุณาลองใหม่"),
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from("user_dashboard_widgets").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_dashboard_widgets", userId] }),
  });

  return { widgets, isLoading, error, upsert, resetAll, reorder };
}
