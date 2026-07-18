import { useState, useMemo } from "react";
import { toBE, currentBEYear } from "@/lib/utils";
import { BE_OFFSET } from "@/lib/dateBE";

const RETENTION_YEARS = 3;

/**
 * ตัวกรองปีการศึกษาแบบ reusable — แสดงปีย้อนหลัง 3 ปีเท่านั้น (อ้างอิงเวลา Asia/Bangkok)
 * คืนค่า: { selectedYear, setSelectedYear, availableYears, filterByYear, toBE, RETENTION_YEARS }
 */
export function useAcademicYearFilter() {
  // Anchor on Bangkok-timezone BE year, then convert to CE for the numeric filter axis.
  const currentYearCE = currentBEYear() - BE_OFFSET;
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let i = 0; i <= RETENTION_YEARS; i++) years.push(currentYearCE - i);
    return years;
  }, [currentYearCE]);

  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  // กรอง array ตามฟิลด์ academic_year หรือฟังก์ชัน custom
  const filterByYear = <T,>(items: T[], getter: (item: T) => number | null | undefined) => {
    if (selectedYear === "all") return items;
    return items.filter((it) => getter(it) === selectedYear);
  };

  return { selectedYear, setSelectedYear, availableYears, filterByYear, toBE, RETENTION_YEARS };
}
