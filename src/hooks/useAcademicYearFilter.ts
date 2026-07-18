import { useState, useMemo } from "react";

const RETENTION_YEARS = 3;

/**
 * ตัวกรองปีการศึกษาแบบ reusable — แสดงปีย้อนหลัง 3 ปีเท่านั้น
 * คืนค่า: { selectedYear, setSelectedYear, availableYears, filterByYear, YearLabel }
 */
export function useAcademicYearFilter() {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let i = 0; i <= RETENTION_YEARS; i++) years.push(currentYear - i);
    return years;
  }, [currentYear]);

  const [selectedYear, setSelectedYear] = useState<number | "all">("all");

  // กรอง array ตามฟิลด์ academic_year หรือฟังก์ชัน custom
  const filterByYear = <T,>(items: T[], getter: (item: T) => number | null | undefined) => {
    if (selectedYear === "all") return items;
    return items.filter((it) => getter(it) === selectedYear);
  };

  const toBE = (y: number) => y + 543;

  return { selectedYear, setSelectedYear, availableYears, filterByYear, toBE, RETENTION_YEARS };
}
