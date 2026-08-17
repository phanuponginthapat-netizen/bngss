// Pre-import checks for ปพ.5 / ปพ.6 workbooks:
//  1. ตรวจว่าไฟล์เป็นปีการศึกษา ย้อนหลัง / ปัจจุบัน / ล่วงหน้า
//  2. ตรวจรายชื่อนักเรียนกับตาราง students → ถ้าไม่พบ = ศิษย์เก่า (ต้องบรรจุเข้าระบบ)

import { supabase } from "@/integrations/supabase/client";
import { BE_OFFSET } from "@/lib/dateBE";

export type YearStatus = "past" | "current" | "future";

export interface YearCheck {
  status: YearStatus;
  currentYear: number;
  currentSemester?: number;
  label: string;
}

/** ปีการศึกษาไทยเริ่มพฤษภาคม → ก่อนพฤษภาคมยังนับเป็นปีก่อนหน้า */
export function currentAcademicYearBE(now = new Date()): number {
  const be = now.getFullYear() + BE_OFFSET;
  return now.getMonth() + 1 >= 5 ? be : be - 1;
}

let periodCache: { year: number; semester?: number } | null = null;

/** ใช้ academic_periods เป็นหลัก ถ้าไม่มีค่อยคำนวณจากวันที่ */
export async function getCurrentPeriod(): Promise<{ year: number; semester?: number }> {
  if (periodCache) return periodCache;
  try {
    const { data } = await supabase
      .from("academic_periods")
      .select("academic_year_be, semester")
      .eq("is_current", true)
      .maybeSingle();
    if (data?.academic_year_be) {
      periodCache = { year: Number(data.academic_year_be), semester: (data as any).semester ?? undefined };
      return periodCache;
    }
  } catch {
    /* ตารางอาจยังไม่มีข้อมูล */
  }
  periodCache = { year: currentAcademicYearBE() };
  return periodCache;
}

export async function checkAcademicYear(year: number, semester?: number): Promise<YearCheck> {
  const cur = await getCurrentPeriod();
  let status: YearStatus = "current";
  if (year < cur.year) status = "past";
  else if (year > cur.year) status = "future";
  else if (semester && cur.semester && semester < cur.semester) status = "past";
  else if (semester && cur.semester && semester > cur.semester) status = "future";

  const label =
    status === "past"
      ? `ย้อนหลัง (ปัจจุบัน ${cur.year})`
      : status === "future"
        ? `ล่วงหน้า (ปัจจุบัน ${cur.year})`
        : `ปีปัจจุบัน ${cur.year}`;
  return { status, currentYear: cur.year, currentSemester: cur.semester, label };
}

export interface StudentMatch {
  matched: number;
  missing: { studentCode: string; studentName: string }[];
}

/** เทียบเลขประจำตัวกับตาราง students (ทุกสถานะ รวมศิษย์เก่า) */
export async function matchStudents(
  rows: { studentCode: string; studentName?: string }[],
): Promise<StudentMatch> {
  const codes = Array.from(new Set(rows.map((r) => String(r.studentCode).trim()).filter(Boolean)));
  if (codes.length === 0) return { matched: 0, missing: [] };
  const found = new Set<string>();
  for (let i = 0; i < codes.length; i += 300) {
    const { data } = await supabase
      .from("students")
      .select("student_code")
      .in("student_code", codes.slice(i, i + 300));
    for (const s of data || []) found.add(String((s as any).student_code));
  }
  const missing = rows
    .filter((r) => !found.has(String(r.studentCode).trim()))
    .map((r) => ({ studentCode: String(r.studentCode).trim(), studentName: r.studentName || "" }));
  return { matched: found.size, missing };
}

const PREFIXES = ["เด็กชาย", "เด็กหญิง", "นางสาว", "นาย", "นาง"];

export function splitThaiName(full: string): { prefix: string | null; first: string; last: string } {
  let s = (full || "").replace(/\s+/g, " ").trim();
  let prefix: string | null = null;
  for (const p of PREFIXES) {
    if (s.startsWith(p)) { prefix = p; s = s.slice(p.length).trim(); break; }
  }
  const parts = s.split(" ").filter(Boolean);
  return { prefix, first: parts[0] || s || "-", last: parts.slice(1).join(" ") || "-" };
}

/** บรรจุนักเรียนที่ไม่พบในระบบเป็น "ศิษย์เก่า" (status = graduated) */
export async function provisionAlumni(
  missing: { studentCode: string; studentName: string }[],
  opts: { gradeLevel?: string | null; academicYear?: number | null },
): Promise<{ created: number; failed: number }> {
  if (missing.length === 0) return { created: 0, failed: 0 };
  const gradYear = opts.academicYear || currentAcademicYearBE();
  const rows = missing.map((m) => {
    const { prefix, first, last } = splitThaiName(m.studentName);
    return {
      student_code: m.studentCode,
      prefix,
      first_name: first,
      last_name: last,
      status: "graduated",
      classroom_id: null,
      graduation_year: gradYear,
      graduation_level: opts.gradeLevel || null,
      graduated_at: `${gradYear - BE_OFFSET}-03-31`,
    };
  });

  let created = 0, failed = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error, data } = await (supabase.from("students") as any)
      .upsert(chunk, { onConflict: "student_code", ignoreDuplicates: true })
      .select("id");
    if (error) failed += chunk.length;
    else created += (data as any[])?.length ?? chunk.length;
  }
  return { created, failed };
}
