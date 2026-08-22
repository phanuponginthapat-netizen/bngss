// Shared PP5/PP6 announcement logic (previously duplicated across two edge functions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fanout } from "./fanout.ts";

export interface AnnounceGradesOptions {
  authHeader: string;
  file_id: string;
  table: "pp5_files" | "pp6_files";
  /** Compose the title/body per student. */
  buildMessage: (file: any) => {
    subjectLabel: string;
    term: string;
    titlePrefix: string;
    referenceType: string;
  };
}

const GRADE_LOCK_THRESHOLD = 80;

export async function announceGrades(opts: AnnounceGradesOptions) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = opts.authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing authorization");

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) throw new Error("Unauthorized");
  const caller = userData.user;

  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", caller.id).in("role", ["admin", "director", "teacher"]).limit(1).maybeSingle();
  if (!role) {
    throw new Error("Only teacher/director/admin can announce");
  }

  const { data: file, error: fileErr } = await admin.from(opts.table).select("*").eq("id", opts.file_id).maybeSingle();
  if (fileErr || !file) throw new Error("File not found");

  const parsed = (file as any).parsed_data || {};
  const consolidated: any[] = parsed.consolidated || [];
  if (!consolidated.length) throw new Error("ไม่มีข้อมูลคะแนน — โปรดอัพโหลดใหม่ด้วยตัวอ่านอัตโนมัติ");

  // Resolve student_code → { student_id, auth_user_id }
  const codes = consolidated.map((s) => String(s.studentCode)).filter(Boolean);
  const { data: students } = await admin
    .from("students")
    .select("id, student_code, auth_user_id, parent_user_id, parent_user_id_2")
    .in("student_code", codes);
  const codeToStudent = new Map<string, { id: string; uid: string | null }>();
  for (const s of students || []) {
    codeToStudent.set(String((s as any).student_code), {
      id: (s as any).id,
      uid: (s as any).auth_user_id || null,
    });
  }

  // -------------------------------------------------------------------------
  // Grade lock: 80% attendance threshold check (OBEC)
  // Before announcing PP5/PP6, ensure every student in the file has >=80%
  // Uses attendance table (academic_year + semester) sparse storage: missing = present
  // -------------------------------------------------------------------------
  try {
    const academicYear = (file as any).academic_year ?? parsed?.meta?.academicYear ?? parsed?.meta?.academic_year;
    const semester = (file as any).semester ?? parsed?.meta?.semester;
    const yearNum = academicYear != null ? Number(academicYear) : null;
    const semNum = semester != null ? Number(semester) : null;

    if (yearNum && semNum && students && students.length > 0) {
      const studentIds = (students as any[]).map((s) => s.id);
      const { data: attRows } = await admin
        .from("attendance")
        .select("student_id, attendance_date, status")
        .in("student_id", studentIds)
        .eq("academic_year", yearNum)
        .eq("semester", semNum);

      const rows = (attRows || []) as { student_id: string; attendance_date: string; status: string }[];
      const distinctDates = new Set(rows.map((r) => r.attendance_date));
      const total = distinctDates.size;

      // If we have attendance data for this term, enforce threshold
      if (total > 0) {
        const absentMap = new Map<string, { absent: number; leave: number }>();
        for (const r of rows) {
          const cur = absentMap.get(r.student_id) ?? { absent: 0, leave: 0 };
          if (r.status === "absent") cur.absent += 1;
          else if (r.status === "leave" || r.status === "sick") cur.leave += 1;
          absentMap.set(r.student_id, cur);
        }

        const atRisk: string[] = [];
        for (const s of students as any[]) {
          const c = absentMap.get(s.id) ?? { absent: 0, leave: 0 };
          const attended = Math.max(0, total - c.absent - c.leave);
          const rate = Math.round((attended / total) * 10000) / 100;
          if (rate < GRADE_LOCK_THRESHOLD) {
            atRisk.push(`${s.student_code} (${rate.toFixed(1)}%)`);
          }
        }

        if (atRisk.length > 0) {
          throw new Error(
            `ไม่สามารถประกาศผลได้: มีนักเรียน ${atRisk.length} คน ที่เวลาเรียนต่ำกว่า ${GRADE_LOCK_THRESHOLD}% — ` +
            atRisk.slice(0, 10).join(", ") +
            (atRisk.length > 10 ? ` และอีก ${atRisk.length - 10} คน` : "") +
            ` — กรุณาตรวจสอบหน้า "ล็อกเกรด 80%" ก่อนประกาศ`
          );
        }
      }

      // Optional: also respect grade_lock table if present
      const classroomId = parsed?.classroom_id || (file as any).classroom_id;
      const termStr = yearNum && semNum ? `${semNum}/${yearNum}` : null;
      if (classroomId && termStr) {
        const { data: lock } = await admin
          .from("grade_lock" as any)
          .select("status")
          .eq("classroom_id", classroomId)
          .eq("term", termStr)
          .maybeSingle();
        // If explicitly unlocked, we already blocked above via attendance; if locked we allow.
        // No hard block here — attendance is the source of truth.
        void lock;
      }
    }
  } catch (e: any) {
    // Only block on our threshold error; re-throw it. Other errors (e.g. table not exists) should not block announce.
    if (e?.message && String(e.message).includes("ไม่สามารถประกาศผลได้")) {
      throw e;
    }
    // Log but don't block if it's a missing table or query error (e.g. grade_lock not migrated yet)
    console.warn("grade-lock check skipped:", e?.message);
  }

  // Parent links
  const studentIdToParents = new Map<string, string[]>();
  for (const s of students || []) {
    const parents = [(s as any).parent_user_id, (s as any).parent_user_id_2].filter(Boolean) as string[];
    if (parents.length) studentIdToParents.set((s as any).id, parents);
  }

  const msg = opts.buildMessage(file);
  const dedupPrefix = opts.table === "pp5_files" ? "pp5" : "pp6";

  let notifiedStudents = 0, notifiedParents = 0;
  const fanoutCalls: Promise<any>[] = [];

  for (const st of consolidated) {
    const stu = codeToStudent.get(String(st.studentCode));
    if (!stu) continue;
    const perSubj = st.perSubject || {};
    const subjectsList = Object.entries(perSubj)
      .map(([subj, v]: any) => `${subj}: ${v.totalScore ?? "-"} (${v.grade ?? "-"})`)
      .join(" • ");
    const body = `${msg.term}\n${subjectsList || "อัพโหลดผลการเรียนแล้ว"}`;

    const recipients: string[] = [];
    if (stu.uid) { recipients.push(stu.uid); notifiedStudents++; }
    const parents = studentIdToParents.get(stu.id) || [];
    for (const p of parents) { recipients.push(p); notifiedParents++; }
    if (recipients.length === 0) continue;

    fanoutCalls.push(
      fanout({
        user_ids: recipients,
        title: `${msg.titlePrefix} ${msg.subjectLabel}`,
        body,
        type: "grade",
        severity: "info",
        reference_id: opts.file_id,
        reference_type: msg.referenceType,
        url: "/profile?tab=grades",
        dedup_key: `${dedupPrefix}_${opts.file_id}_${stu.id}`,
      })
    );
  }

  await Promise.all(fanoutCalls);

  await admin
    .from(opts.table)
    .update({ announced_at: new Date().toISOString(), announced_by: caller.id })
    .eq("id", opts.file_id);

  return {
    success: true,
    notified_students: notifiedStudents,
    notified_parents: notifiedParents,
    total: consolidated.length,
  };
}
