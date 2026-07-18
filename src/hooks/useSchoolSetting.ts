import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bulk loader — โหลดทุก school_settings ครั้งเดียวแล้ว cache ไว้ 30 นาที
 * ลดการ query ซ้ำซ้อนเมื่อหลายหน้าอ่าน setting หลายตัว
 */
function useAllSchoolSettings() {
  return useQuery({
    queryKey: ["school_settings_bulk"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value");
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (s.setting_value !== null) map[s.setting_key] = s.setting_value;
      });
      return map;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Read a school_settings row by key. Returns string value or undefined.
 * อ่านจาก bulk cache — ไม่ query ใหม่ทุกครั้ง
 */
export const useSchoolSetting = (key: string) => {
  const { data, isLoading } = useAllSchoolSettings();
  return { value: data?.[key] ?? null, isLoading };
};

/** Returns true if a feature flag stored as 'true'/'false' is enabled. Default: enabled. */
export const useFeatureFlag = (key: string, defaultEnabled = true) => {
  const { value, isLoading } = useSchoolSetting(key);
  if (isLoading) return defaultEnabled;
  if (value === null || value === undefined) return defaultEnabled;
  return value === "true";
};
