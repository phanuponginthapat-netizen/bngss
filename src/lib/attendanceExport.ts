// Attendance export — รายงานการเข้าเรียนตามเทมเพลต สพฐ.
import * as XLSX from "xlsx";

export interface AttendanceExportRow {
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  classroom: string;
  total_days: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  sick: number;
  attendance_rate: number; // percentage
}

/**
 * Export monthly attendance summary per student — OBEC format
 */
export function exportAttendanceMonthly(
  rows: AttendanceExportRow[],
  meta: { month: string; year: string; schoolName: string },
  fileName = "attendance_monthly.xlsx"
) {
  const header = [
    "ลำดับ",
    "เลขประจำตัว",
    "ชื่อ",
    "นามสกุล",
    "ห้อง",
    "มาเรียน (วัน)",
    "สาย (วัน)",
    "ขาด (วัน)",
    "ลา (วัน)",
    "ป่วย (วัน)",
    "รวม (วัน)",
    "อัตราการมาเรียน (%)",
  ];
  const data = rows.map((r, i) => [
    i + 1,
    r.student_code,
    r.first_name,
    r.last_name,
    r.classroom,
    r.present,
    r.late,
    r.absent,
    r.leave,
    r.sick,
    r.total_days,
    r.attendance_rate.toFixed(2),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    [`โรงเรียน ${meta.schoolName}`],
    [`รายงานการเข้าเรียน เดือน${meta.month} ปีการศึกษา ${meta.year}`],
    [],
    header,
    ...data,
  ]);
  ws["!cols"] = header.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ATTENDANCE");
  XLSX.writeFile(wb, fileName);
}

/**
 * Find students with attendance below threshold (OBEC requires 80%)
 */
export function findAtRiskAttendance(
  rows: AttendanceExportRow[],
  threshold = 80
): AttendanceExportRow[] {
  return rows.filter((r) => r.attendance_rate < threshold);
}
