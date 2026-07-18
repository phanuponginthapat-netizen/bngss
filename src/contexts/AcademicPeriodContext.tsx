import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAcademicTerm, DEFAULT_SEMESTER_CFG } from "@/lib/academicTerm";

export interface AcademicPeriod {
  id: string;
  academic_year_be: number;
  semester: 1 | 2;
  start_date: string;
  end_date: string;
  midterm_date: string | null;
  final_date: string | null;
  is_current: boolean;
  is_closed: boolean;
  note: string | null;
}

interface Ctx {
  /** ทุกปี/เทอมที่มีในระบบ */
  periods: AcademicPeriod[];
  /** ปี/เทอมที่ admin กำหนดว่าเป็น "ปัจจุบัน" */
  currentPeriod: AcademicPeriod | null;
  /** ปี/เทอมที่ผู้ใช้กำลังดู (default = currentPeriod) */
  selectedPeriod: AcademicPeriod | null;
  selectedYear: number;
  selectedSemester: 1 | 2;
  setSelected: (year: number, semester: 1 | 2) => void;
  /** หา period ของ record date ใดๆ */
  resolvePeriodByDate: (date: string | Date | null | undefined) => AcademicPeriod | null;
  /** เช็คว่า record date ตรงกับ period ที่เลือกอยู่หรือไม่ */
  isInSelectedPeriod: (date: string | Date | null | undefined) => boolean;
  isLoading: boolean;
}

const AcademicPeriodCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "lovable.academicPeriod";

function loadStored(): { year: number; semester: 1 | 2 } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.year === "number" && (v.semester === 1 || v.semester === 2)) return v;
  } catch {}
  return null;
}

export function AcademicPeriodProvider({ children }: { children: ReactNode }) {
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["academic_periods_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academic_periods" as any)
        .select("*")
        .order("academic_year_be", { ascending: false })
        .order("semester", { ascending: true });
      return (data || []) as unknown as AcademicPeriod[];
    },
    staleTime: 60_000,
  });

  const currentPeriod = useMemo(
    () => periods.find((p) => p.is_current) || null,
    [periods],
  );

  const [selected, setSelectedState] = useState<{ year: number; semester: 1 | 2 } | null>(
    () => loadStored(),
  );

  // หากยังไม่มีค่าใน localStorage → ใช้ current period
  useEffect(() => {
    if (selected) return;
    if (currentPeriod) {
      setSelectedState({ year: currentPeriod.academic_year_be, semester: currentPeriod.semester });
    } else if (!isLoading) {
      // fallback คำนวณจากวันที่
      const t = resolveAcademicTerm(new Date(), DEFAULT_SEMESTER_CFG);
      setSelectedState({ year: t.academicYearBE, semester: t.semester });
    }
  }, [selected, currentPeriod, isLoading]);

  const setSelected = (year: number, semester: 1 | 2) => {
    const next = { year, semester };
    setSelectedState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const selectedPeriod = useMemo(() => {
    if (!selected) return null;
    return (
      periods.find(
        (p) => p.academic_year_be === selected.year && p.semester === selected.semester,
      ) || null
    );
  }, [selected, periods]);

  const resolvePeriodByDate = (date: string | Date | null | undefined): AcademicPeriod | null => {
    if (!date) return null;
    const d = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    return periods.find((p) => d >= p.start_date && d <= p.end_date) || null;
  };

  const isInSelectedPeriod = (date: string | Date | null | undefined): boolean => {
    if (!date || !selectedPeriod) return false;
    const d = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    return d >= selectedPeriod.start_date && d <= selectedPeriod.end_date;
  };

  const value: Ctx = {
    periods,
    currentPeriod,
    selectedPeriod,
    selectedYear: selected?.year ?? new Date().getFullYear() + 543,
    selectedSemester: selected?.semester ?? 1,
    setSelected,
    resolvePeriodByDate,
    isInSelectedPeriod,
    isLoading,
  };

  return <AcademicPeriodCtx.Provider value={value}>{children}</AcademicPeriodCtx.Provider>;
}

export function useAcademicPeriod() {
  const ctx = useContext(AcademicPeriodCtx);
  if (!ctx) throw new Error("useAcademicPeriod must be used inside <AcademicPeriodProvider>");
  return ctx;
}

/** Safe hook ที่ใช้นอก provider ได้ — คืน null ถ้าไม่มี provider */
export function useAcademicPeriodSafe(): Ctx | null {
  return useContext(AcademicPeriodCtx);
}
