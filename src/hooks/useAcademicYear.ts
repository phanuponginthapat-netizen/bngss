import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BE_OFFSET } from "@/lib/dateBE";

interface SemesterConfig {
  semester1StartMonth: number;
  semester1EndMonth: number;
  semester2StartMonth: number;
  semester2EndMonth: number;
  academicYearStartMonth: number;
}

const DEFAULT_CONFIG: SemesterConfig = {
  semester1StartMonth: 5,
  semester1EndMonth: 10,
  semester2StartMonth: 11,
  semester2EndMonth: 4,
  academicYearStartMonth: 5,
};

const SETTING_KEYS = [
  "semester_1_start_month",
  "semester_1_end_month",
  "semester_2_start_month",
  "semester_2_end_month",
  "academic_year_start_month",
  "academic_year_override",   // ตัวเลข พ.ศ. หรือว่าง = ไม่กำหนด
  "semester_override",        // "1" | "2" หรือว่าง = ไม่กำหนด
] as const;

/**
 * Hook ที่จัดการปีการศึกษาและภาคเรียน
 * - อ่านค่าจาก school_settings
 * - รองรับโหมด "อัตโนมัติ" (คำนวณจากเดือน) และ "กำหนดเอง" (override)
 * - ค่าปีการศึกษาเป็น พ.ศ.
 */
export function useAcademicYear() {
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["semester-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", SETTING_KEYS as unknown as string[]);
      return data || [];
    },
    staleTime: 60_000,
  });

  const rawMap = useMemo(() => {
    const map: Record<string, string> = {};
    settings.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
    return map;
  }, [settings]);

  const config = useMemo((): SemesterConfig => ({
    semester1StartMonth: parseInt(rawMap.semester_1_start_month) || DEFAULT_CONFIG.semester1StartMonth,
    semester1EndMonth: parseInt(rawMap.semester_1_end_month) || DEFAULT_CONFIG.semester1EndMonth,
    semester2StartMonth: parseInt(rawMap.semester_2_start_month) || DEFAULT_CONFIG.semester2StartMonth,
    semester2EndMonth: parseInt(rawMap.semester_2_end_month) || DEFAULT_CONFIG.semester2EndMonth,
    academicYearStartMonth: parseInt(rawMap.academic_year_start_month) || DEFAULT_CONFIG.academicYearStartMonth,
  }), [rawMap]);

  const yearOverride = parseInt(rawMap.academic_year_override || "");
  const semOverride = parseInt(rawMap.semester_override || "");
  const hasYearOverride = Number.isFinite(yearOverride) && yearOverride > 2000;
  const hasSemOverride = semOverride === 1 || semOverride === 2;
  const isManualMode = hasYearOverride || hasSemOverride;

  const { autoAcademicYear, autoSemester } = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const ceYear = month >= config.academicYearStartMonth ? year : year - 1;
    const academicYear = ceYear + BE_OFFSET;

    let semester = 1;
    if (config.semester2StartMonth > config.semester2EndMonth) {
      if (month >= config.semester2StartMonth || month <= config.semester2EndMonth) semester = 2;
    } else if (month >= config.semester2StartMonth && month <= config.semester2EndMonth) {
      semester = 2;
    }
    return { autoAcademicYear: academicYear, autoSemester: semester };
  }, [config]);

  const currentAcademicYear = hasYearOverride ? yearOverride : autoAcademicYear;
  const currentSemester = hasSemOverride ? semOverride : autoSemester;

  const academicYearOptions = useMemo(() => {
    const years: number[] = [];
    for (let i = -4; i <= 2; i++) years.push(currentAcademicYear + i);
    return years.sort((a, b) => b - a);
  }, [currentAcademicYear]);

  return {
    config,
    currentAcademicYear,
    currentSemester,
    autoAcademicYear,
    autoSemester,
    isManualMode,
    hasYearOverride,
    hasSemOverride,
    academicYearOptions,
    isLoading,
  };
}
