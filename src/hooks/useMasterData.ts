import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hooks สำหรับข้อมูลหลัก (master data) ที่เปลี่ยนแปลงไม่บ่อย
 * ใช้ stale time นาน เพื่อลดการ query ซ้ำซ้อน
 * Realtime จะ invalidate cache อัตโนมัติเมื่อข้อมูลเปลี่ยน (ผ่าน useGlobalRealtime)
 */

const MASTER_STALE_TIME = 10 * 60 * 1000; // 10 นาที
const SETTINGS_STALE_TIME = 30 * 60 * 1000; // 30 นาที

export function useClassroomsMaster() {
  return useQuery({
    queryKey: ["all-classrooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classrooms")
        .select("id, grade_level, classroom_name, advisor_name")
        .order("grade_level")
        .order("classroom_name");
      return data || [];
    },
    staleTime: MASTER_STALE_TIME,
    gcTime: 30 * 60 * 1000,
  });
}

export function useSubjectsMaster() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .order("subject_code");
      return data || [];
    },
    staleTime: MASTER_STALE_TIME,
  });
}

export function useSchoolSettingsAll() {
  return useQuery({
    queryKey: ["school_settings_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value");
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
    staleTime: SETTINGS_STALE_TIME,
  });
}
