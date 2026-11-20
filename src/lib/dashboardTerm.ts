import type { AcademicPeriodRow } from "./academicPeriod";

export function dashboardTermDates(periods: AcademicPeriodRow[], year: number, semester: number) {
  const period = periods.find(p => Number(p.academic_year_be) === year && Number(p.semester) === semester);
  if (!period?.start_date || !period.end_date || period.start_date > period.end_date) {
    throw new Error("ยังไม่มีวันเปิด–ปิดของภาคเรียนนี้ กรุณาตรวจปฏิทินโรงเรียน");
  }
  return { start: period.start_date, end: period.end_date };
}

export function dashboardDateInTerm(value: string | null | undefined, dates: { start: string; end: string }) {
  if (!value) return false;
  let day = value;
  if (value.includes("T")) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return false;
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && dates.start <= day && day <= dates.end;
}