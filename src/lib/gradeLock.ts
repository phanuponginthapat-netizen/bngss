// Grade lock workflow — OBEC 80% attendance threshold before announcing PP5/PP6
// Integrates with attendanceExport threshold and supabase grade_lock table.

import { supabase } from "@/integrations/supabase/client";
import { findAtRiskAttendance, type AttendanceExportRow } from "./attendanceExport";
import { toCE } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------
export const GRADE_LOCK_THRESHOLD = 80;
export const GRADE_LOCK_THRESHOLD_FRACTION = 0.8;

export type GradeLockStatus = "locked" | "unlocked" | "pending";

export interface GradeLock {
  id: string;
  classroom_id: string;
  term: string; // e.g. "1/2568" or "2568-1"
  academic_year?: number | null;
  semester?: number | null;
  locked_at: string;
  locked_by: string | null;
  status: GradeLockStatus;
  created_at?: string;
  updated_at?: string;
}

export interface StudentAttendanceRate {
  studentId: string;
  studentCode?: string | null;
  attendanceRate: number; // 0-100
  present: number;
  absent: number;
  leave: number;
  total: number;
}

export interface CanAnnounceResult {
  allowed: boolean;
  rate: number;
  threshold: number;
  reason?: string;
}

export interface ClassroomAnnounceCheck {
  canAnnounce: boolean;
  atRisk: StudentAttendanceRate[];
  passed: StudentAttendanceRate[];
  total: number;
  failedCount: number;
}

// ---------------------------------------------------------------------------
// Core logic — pure functions (no IO)
// ---------------------------------------------------------------------------
/**
 * Check if a single student passes the 80% attendance threshold.
 * Mirrors OBEC requirement: attendance_rate >= 80%
 */
export function canAnnounceGrades(
  _studentId: string,
  attendanceRate: number,
  threshold: number = GRADE_LOCK_THRESHOLD
): boolean {
  if (!Number.isFinite(attendanceRate)) return false;
  return attendanceRate >= threshold;
}

/**
 * Alias with explicit naming
 */
export function isAttendancePass(
  attendanceRate: number,
  threshold: number = GRADE_LOCK_THRESHOLD
): boolean {
  return canAnnounceGrades("", attendanceRate, threshold);
}

export function getAttendanceStatus(
  attendanceRate: number,
  threshold: number = GRADE_LOCK_THRESHOLD
): "pass" | "fail" {
  return attendanceRate >= threshold ? "pass" : "fail";
}

/**
 * Evaluate a list of per-student attendance rates against threshold.
 * Returns partitioned atRisk / passed lists and overall canAnnounce flag.
 */
export function evaluateClassroomAttendance(
  rates: StudentAttendanceRate[],
  threshold: number = GRADE_LOCK_THRESHOLD
): ClassroomAnnounceCheck {
  const atRisk = rates.filter((r) => r.attendanceRate < threshold);
  const passed = rates.filter((r) => r.attendanceRate >= threshold);
  return {
    canAnnounce: atRisk.length === 0,
    atRisk,
    passed,
    total: rates.length,
    failedCount: atRisk.length,
  };
}

/**
 * Adapt attendanceExport rows to grade-lock check.
 * Reuses threshold from attendanceExport.findAtRiskAttendance
 */
export function checkAttendanceThreshold(
  rows: AttendanceExportRow[],
  threshold: number = GRADE_LOCK_THRESHOLD
): { canAnnounce: boolean; atRisk: AttendanceExportRow[] } {
  const atRisk = findAtRiskAttendance(rows, threshold);
  return { canAnnounce: atRisk.length === 0, atRisk };
}

/**
 * Calculate attendance rate from raw counts.
 * present+late counts as present; absent+leave counts as not present.
 */
export function calculateAttendanceRate(
  present: number,
  _late: number,
  absent: number,
  leave: number,
  totalDays: number
): number {
  if (totalDays <= 0) return 100;
  const attended = Math.max(0, totalDays - absent - leave);
  return Math.round((attended / totalDays) * 10000) / 100;
}

/**
 * Calculate attendance rates from sparse attendance table data.
 * Total is distinct school days; missing row = present.
 * rows: attendance records for a term (filtered by classroom/student set)
 */
export function calculateRatesFromAttendanceRows(
  students: { id: string; student_code?: string | null }[],
  attendanceRows: { student_id: string; attendance_date: string; status: string }[],
  expectedTotalDays?: number
): StudentAttendanceRate[] {
  const distinctDates = new Set(attendanceRows.map((r) => r.attendance_date));
  const total = expectedTotalDays ?? distinctDates.size;

  // if no attendance recorded yet, treat as 100% (allow announce)
  if (total === 0) {
    return students.map((s) => ({
      studentId: s.id,
      studentCode: s.student_code ?? null,
      attendanceRate: 100,
      present: 0,
      absent: 0,
      leave: 0,
      total: 0,
    }));
  }

  const byStudent = new Map<string, { absent: number; leave: number }>();
  for (const r of attendanceRows) {
    const cur = byStudent.get(r.student_id) ?? { absent: 0, leave: 0 };
    if (r.status === "absent") cur.absent += 1;
    else if (r.status === "leave" || r.status === "sick") cur.leave += 1;
    // present / late / etc are not counted as absent
    byStudent.set(r.student_id, cur);
  }

  return students.map((s) => {
    const counts = byStudent.get(s.id) ?? { absent: 0, leave: 0 };
    const attended = Math.max(0, total - counts.absent - counts.leave);
    const rate = Math.round((attended / total) * 10000) / 100;
    return {
      studentId: s.id,
      studentCode: s.student_code ?? null,
      attendanceRate: rate,
      present: attended,
      absent: counts.absent,
      leave: counts.leave,
      total,
    };
  });
}

// ---------------------------------------------------------------------------
// Supabase IO — grade_lock table
// ---------------------------------------------------------------------------
export function buildTermString(
  academicYear: number,
  semester: number
): string {
  // Store as "semester/academicYear" e.g. "1/2568" (BE) or "1/2025" (CE)
  return `${semester}/${academicYear}`;
}

export function parseTerm(term: string): { semester: number; academicYear: number } | null {
  const parts = term.split("/").map((p) => parseInt(p, 10));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
    return { semester: parts[0], academicYear: parts[1] };
  }
  const dash = term.split("-").map((p) => parseInt(p, 10));
  if (dash.length === 2 && dash.every((n) => Number.isFinite(n))) {
    return { semester: dash[1], academicYear: dash[0] };
  }
  return null;
}

/**
 * Fetch grade lock record for a classroom + term.
 */
export async function getGradeLock(
  classroomId: string,
  term: string
): Promise<GradeLock | null> {
  const { data, error } = await supabase
    .from("grade_lock" as any)
    .select("*")
    .eq("classroom_id", classroomId)
    .eq("term", term)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as GradeLock) ?? null;
}

/**
 * List locks for a classroom (all terms) or all classrooms.
 */
export async function listGradeLocks(
  classroomId?: string
): Promise<GradeLock[]> {
  let q = supabase.from("grade_lock" as any).select("*").order("locked_at", { ascending: false });
  if (classroomId) q = q.eq("classroom_id", classroomId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as GradeLock[]) ?? [];
}

/**
 * Lock grades for a classroom/term — creates or updates grade_lock row.
 * Also validates attendance threshold if rates are provided.
 */
export async function lockGrades(
  classroomId: string,
  term: string,
  opts: {
    lockedBy?: string | null;
    status?: GradeLockStatus;
    academicYear?: number | null;
    semester?: number | null;
    force?: boolean; // if true, skip attendance threshold check
    attendanceRates?: StudentAttendanceRate[];
  } = {}
): Promise<GradeLock> {
  const { lockedBy = null, status = "locked", academicYear = null, semester = null, force = false, attendanceRates } = opts;

  if (!force && attendanceRates && attendanceRates.length > 0) {
    const check = evaluateClassroomAttendance(attendanceRates);
    if (!check.canAnnounce) {
      throw new Error(
        `ไม่สามารถล็อกผลการเรียนได้: มีนักเรียน ${check.failedCount} คน ที่เวลาเรียนต่ำกว่า ${GRADE_LOCK_THRESHOLD}%`
      );
    }
  }

  // upsert by (classroom_id, term) unique
  const payload: Record<string, unknown> = {
    classroom_id: classroomId,
    term,
    locked_at: new Date().toISOString(),
    locked_by: lockedBy,
    status,
  };
  if (academicYear != null) payload.academic_year = academicYear;
  if (semester != null) payload.semester = semester;

  const { data, error } = await supabase
    .from("grade_lock" as any)
    .upsert(payload as any, { onConflict: "classroom_id,term" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GradeLock;
}

/**
 * Unlock (or set to pending) for a classroom+term
 */
export async function unlockGrades(
  classroomId: string,
  term: string,
  opts: { unlockedBy?: string | null } = {}
): Promise<GradeLock> {
  const { unlockedBy = null } = opts;
  const { data, error } = await supabase
    .from("grade_lock" as any)
    .update({
      status: "unlocked",
      locked_by: unlockedBy,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("classroom_id", classroomId)
    .eq("term", term)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GradeLock;
}

/**
 * Check before announcing PP5/PP6 scores — fetch students + attendance + grade_lock
 * Returns detailed check result to drive UI (disable button / warning dialog)
 */
export async function checkCanAnnounceForClassroom(
  classroomId: string,
  academicYear: number,
  semester: number,
  opts: { threshold?: number; expectedTotalDays?: number; subjectId?: string | null } = {}
): Promise<ClassroomAnnounceCheck & { rates: StudentAttendanceRate[]; lock: GradeLock | null }> {
  const threshold = opts.threshold ?? GRADE_LOCK_THRESHOLD;
  const term = buildTermString(academicYear, semester);

  // fetch students in classroom
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id, student_code")
    .eq("classroom_id", classroomId)
    .eq("status", "active");

  if (sErr) throw sErr;

  const studentList = (students ?? []) as { id: string; student_code: string | null }[];

  if (studentList.length === 0) {
    const lock = await getGradeLock(classroomId, term).catch(() => null);
    return { canAnnounce: true, atRisk: [], passed: [], total: 0, failedCount: 0, rates: [], lock };
  }

  const studentIds = studentList.map((s) => s.id);

  // fetch attendance rows for term
  const { data: rows, error: aErr } = await supabase
    .from("attendance")
    .select("student_id, attendance_date, status")
    .in("student_id", studentIds)
    .eq("academic_year", toCE(academicYear))
    .eq("semester", semester)
    // เวลาเรียนนับรายวิชา (เช็คชื่อรายคาบ) — ไม่ใช่การสแกนหน้าเข้าโรงเรียน
    .match(opts.subjectId ? { subject_id: opts.subjectId } : {})
    .not("subject_id", "is", null);

  if (aErr) throw aErr;

  const rates = calculateRatesFromAttendanceRows(studentList, (rows ?? []) as any, opts.expectedTotalDays);
  const check = evaluateClassroomAttendance(rates, threshold);
  const lock = await getGradeLock(classroomId, term).catch(() => null);

  // if already locked, consider locked as not allowed to re-announce without unlock
  return { ...check, rates, lock };
}

/**
 * Helper to invoke announce edge function with grade-lock guard.
 * Returns { allowed, atRisk } before invoking; caller decides to show dialog or proceed.
 */
export async function guardAnnounce(
  classroomId: string,
  academicYear: number,
  semester: number,
  attendanceRates?: StudentAttendanceRate[]
): Promise<{ allowed: boolean; atRisk: StudentAttendanceRate[] }> {
  let rates = attendanceRates;
  if (!rates) {
    const res = await checkCanAnnounceForClassroom(classroomId, academicYear, semester);
    rates = res.rates;
  }
  const check = evaluateClassroomAttendance(rates ?? []);
  return { allowed: check.canAnnounce, atRisk: check.atRisk };
}

/**
 * Announce PP5/PP6 via edge functions — wrapper that respects edge function existence.
 * Use supabase.functions.invoke internally; caller should handle toast.
 */
export async function announcePP5Scores(fileId: string): Promise<{ success: boolean; notified_students?: number; notified_parents?: number; total?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("announce-pp5-scores", {
    body: { file_id: fileId },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export async function announcePP6Scores(fileId: string): Promise<{ success: boolean; notified_students?: number; notified_parents?: number; total?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("announce-pp6-scores", {
    body: { file_id: fileId },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

/**
 * Attendance 80% gate used directly by the ปพ.5/ปพ.6 announce buttons.
 * Returns true to continue announcing. Students under 80% already get "มส"
 * when the file is applied; the teacher must explicitly acknowledge them.
 */
export async function confirmAttendanceBeforeAnnounce(file: {
  classroom_id?: string | null;
  academic_year?: number | null;
  semester?: number | null;
  subject_id?: string | null;
  parsed_data?: any;
}): Promise<boolean> {
  const { swal } = await import("@/lib/swal");
  if (!file.academic_year || !file.semester) return true;

  // 1) เวลาเรียนจากไฟล์ ปพ.5 (แผ่นเวลาเรียน) เป็นแหล่งหลัก
  const parsed = file.parsed_data || {};
  const fileRisk: { label: string; rate: number }[] = [];
  let fileCount = 0;
  for (const sh of (parsed.sheets || []) as any[]) {
    for (const st of sh.students || []) {
      const m = st.attendanceMarks;
      if (!m || !(m.days > 0)) continue;
      fileCount++;
      const rate = Math.round((Math.max(0, m.days - m.absent - m.leave) / m.days) * 1000) / 10;
      if (rate < GRADE_LOCK_THRESHOLD) fileRisk.push({ label: st.studentName || st.studentCode || "-", rate });
    }
  }

  let risk: { label: string; rate: number }[] = fileRisk;
  if (fileCount === 0) {
    // 2) ไม่มีในไฟล์ → ใช้การเช็คชื่อรายคาบของวิชานี้
    const subjectId = file.subject_id || parsed.subject_id || null;
    if (!file.classroom_id || !subjectId) {
      return await swal.confirm({
        title: "ไม่มีข้อมูลเวลาเรียนรายวิชา",
        text: "ไฟล์นี้ไม่มีแผ่นเวลาเรียน และระบบไม่พบวิชา/ห้องสำหรับตรวจการเช็คชื่อรายคาบ จึงตรวจเวลาเรียน 80% ไม่ได้ ต้องการประกาศผลต่อหรือไม่?",
        confirmText: "ประกาศต่อ",
      });
    }
    let res: Awaited<ReturnType<typeof checkCanAnnounceForClassroom>>;
    try {
      res = await checkCanAnnounceForClassroom(file.classroom_id, Number(file.academic_year), Number(file.semester), { subjectId });
    } catch {
      return await swal.confirm({ title: "ตรวจเวลาเรียนไม่สำเร็จ", text: "ไม่สามารถตรวจเวลาเรียน 80% ได้ ต้องการประกาศผลต่อหรือไม่?" });
    }
    const hasRows = res.rates.some((r: any) => (r.totalDays ?? r.total ?? 0) > 0);
    if (!hasRows) {
      return await swal.confirm({
        title: "ยังไม่มีการเช็คชื่อรายคาบของวิชานี้",
        text: "ไฟล์ ปพ.5 ไม่มีจำนวนวันเข้าเรียน และครูยังไม่ได้เช็คชื่อรายคาบ จึงตรวจเวลาเรียน 80% ไม่ได้ ต้องการประกาศผลต่อหรือไม่?",
        confirmText: "ประกาศต่อ",
      });
    }
    if (res.canAnnounce) return true;
    const { data: names } = await supabase.from("students").select("id, first_name, last_name").in("id", res.atRisk.map((r) => r.studentId));
    const nameOf = new Map((names ?? []).map((s: any) => [s.id, `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()]));
    risk = res.atRisk.map((r) => ({ label: nameOf.get(r.studentId) || r.studentCode || "-", rate: r.attendanceRate }));
  }
  if (risk.length === 0) return true;
  const list = risk.slice(0, 15).map((r) => `• ${r.label} — ${r.rate.toFixed(1)}%`).join("\n");
  const more = risk.length > 15 ? `\nและอีก ${risk.length - 15} คน` : "";
  return await swal.confirm({
    title: `มีนักเรียน ${risk.length} คน เวลาเรียนวิชานี้ต่ำกว่า ${GRADE_LOCK_THRESHOLD}%`,
    text: `ตามระเบียบ สพฐ. นักเรียนกลุ่มนี้จะได้ผล "มส"\n\n${list}${more}\n\nต้องการประกาศผลต่อหรือไม่?`,
    confirmText: "ประกาศต่อ",
  });
}
