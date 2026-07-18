import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["module-toggles", "disabled_modules"];

async function fetchDisabled(): Promise<Set<string>> {
  const { data } = await supabase
    .from("school_settings")
    .select("setting_value")
    .eq("setting_key", "disabled_modules")
    .maybeSingle();
  if (!data?.setting_value) return new Set();
  try {
    const raw = typeof data.setting_value === "string"
      ? JSON.parse(data.setting_value)
      : data.setting_value;
    if (Array.isArray(raw)) return new Set(raw.filter((x): x is string => typeof x === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

export function useModuleToggles() {
  const qc = useQueryClient();
  const { data: disabled } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDisabled,
    staleTime: 5 * 60_000,
  });

  // Realtime: refresh when admin changes the setting
  useEffect(() => {
    const ch = supabase
      .channel(`module-toggles-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "school_settings", filter: "setting_key=eq.disabled_modules" },
        () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const set = disabled ?? new Set<string>();
  return {
    disabledKeys: set,
    isModuleEnabled: (key?: string | null) => !key || !set.has(key),
  };
}

export async function saveDisabledModules(keys: string[]) {
  const payload = JSON.stringify(Array.from(new Set(keys)));
  const { error } = await supabase
    .from("school_settings")
    .upsert(
      { setting_key: "disabled_modules", setting_value: payload, updated_at: new Date().toISOString() },
      { onConflict: "setting_key" },
    );
  if (error) throw error;
}
