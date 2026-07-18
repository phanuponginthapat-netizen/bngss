import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAcademicPeriodSafe } from "@/contexts/AcademicPeriodContext";

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

/**
 * จัดการปีการศึกษา + เทอม โดยรวมศูนย์
 * - หากมี AcademicPeriodProvider (global switcher บน header) จะอ่านค่าจาก context
 * - หากไม่มี ใช้ค่าจาก school_settings เป็น fallback
 */
export function useAcademicYear() {
  const ctx = useAcademicPeriodSafe();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["semester-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "semester_1_start_month",
          "semester_1_end_month",
          "semester_2_start_month",
          "semester_2_end_month",
          "academic_year_start_month",
        ]);
      return data || [];
    },
    staleTime: 60_000,
  });

  const config = useMemo((): SemesterConfig => {
    const map: Record<string, string> = {};
    settings.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
    return {
      semester1StartMonth: parseInt(map.semester_1_start_month) || DEFAULT_CONFIG.semester1StartMonth,
      semester1EndMonth: parseInt(map.semester_1_end_month) || DEFAULT_CONFIG.semester1EndMonth,
      semester2StartMonth: parseInt(map.semester_2_start_month) || DEFAULT_CONFIG.semester2StartMonth,
      semester2EndMonth: parseInt(map.semester_2_end_month) || DEFAULT_CONFIG.semester2EndMonth,
      academicYearStartMonth: parseInt(map.academic_year_start_month) || DEFAULT_CONFIG.academicYearStartMonth,
    };
  }, [settings]);

  const fallback = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const ceYear = month >= config.academicYearStartMonth ? year : year - 1;
    const academicYear = ceYear + 543;
    let semester = 1;
    if (config.semester2StartMonth > config.semester2EndMonth) {
      if (month >= config.semester2StartMonth || month <= config.semester2EndMonth) semester = 2;
    } else if (month >= config.semester2StartMonth && month <= config.semester2EndMonth) {
      semester = 2;
    }
    return { academicYear, semester };
  }, [config]);

  // Prefer global context (set by AcademicPeriodSwitcher on the topbar)
  const currentAcademicYear = ctx?.selectedYear ?? fallback.academicYear;
  const currentSemester = ctx?.selectedSemester ?? fallback.semester;

  const academicYearOptions = useMemo(() => {
    const ctxYears = ctx?.periods.map((p) => p.academic_year_be) || [];
    const set = new Set<number>(ctxYears);
    for (let i = -4; i <= 1; i++) set.add(currentAcademicYear + i);
    return Array.from(set).sort((a, b) => b - a);
  }, [ctx?.periods, currentAcademicYear]);

  return {
    config,
    currentAcademicYear,
    currentSemester,
    academicYearOptions,
    isLoading,
    /** period record ของปี/เทอมที่เลือก (ถ้ามี) — มี start/end date จริง */
    selectedPeriod: ctx?.selectedPeriod || null,
    /** true ถ้า period ถูกปิด (ห้ามแก้คะแนน/บันทึก) */
    isClosed: !!ctx?.selectedPeriod?.is_closed,
  };
}
