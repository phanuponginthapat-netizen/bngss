import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bulk loader — โหลด cms_settings ทั้งหมดครั้งเดียวต่อ session แล้ว cache ไว้
 * แทนการ query เป็นชุดเล็ก ๆ ในแต่ละหน้า → ลด round-trip ลงมหาศาล
 *
 * ทุก hook ที่อ่าน cms_settings ต้องใช้ผ่าน selector นี้
 */
export function useCmsSettingsBulk() {
  return useQuery({
    queryKey: ["cms_settings_bulk"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase
        .from("cms_settings")
        .select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (s?.key) map[s.key] = s.value ?? "";
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/** อ่านค่าเดียวจาก cms_settings (ผ่าน bulk cache) */
export function useCmsValue(key: string): string {
  const { data } = useCmsSettingsBulk();
  return data?.[key] ?? "";
}

/** อ่านหลายค่าจาก cms_settings (ผ่าน bulk cache) */
export function useCmsValues(keys: string[]): Record<string, string> {
  const { data } = useCmsSettingsBulk();
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = data?.[k] ?? "";
  return out;
}
