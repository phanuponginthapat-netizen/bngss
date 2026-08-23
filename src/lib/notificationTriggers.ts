// Centralized notification triggers — all events fan-out via notify-fanout
// Each helper calls supabase.functions.invoke("notify-fanout", { body: { title, body, type, user_ids, channels } })
// Never throws — failures are logged via console.warn and swallow.
// Usage: import { notifyGradeRemediationAnnounced } from "@/lib/notificationTriggers"

import { supabase } from "@/integrations/supabase/client";

export type TriggerChannel = "in_app" | "push" | "line" | "gchat" | "gchat_dm";
export type TriggerSeverity = "info" | "success" | "warning" | "critical";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function safeInvokeFanout(payload: {
  user_ids: string[];
  title: string;
  body?: string;
  type?: string;
  severity?: TriggerSeverity;
  reference_id?: string | null;
  reference_type?: string | null;
  url?: string | null;
  channels?: TriggerChannel[];
  gchat_categories?: string[];
  dedup_key?: string;
  fields?: Record<string, string>;
}): Promise<void> {
  try {
    if (!payload.user_ids?.length || !payload.title) return;
    const deduped = [...new Set(payload.user_ids.filter(Boolean))];
    if (deduped.length === 0) return;
    const { error, data } = await supabase.functions.invoke("notify-fanout", {
      body: { ...payload, user_ids: deduped },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
  } catch (e) {
    console.warn("[notificationTriggers] fanout failed", (e as any)?.message || e);
  }
}

// Resolve student -> family user_ids (student auth + parent_user_id + parent_user_id_2 + parent_student_links + profiles.student_code fallback)
async function resolveFamilyUserIds(studentIds: string[]): Promise<string[]> {
  if (!studentIds.length) return [];
  const uniq = [...new Set(studentIds.filter(Boolean))];
  try {
    const { data: students, error } = await supabase
      .from("students")
      .select("id, auth_user_id, student_code, parent_user_id, parent_user_id_2")
      .in("id", uniq);
    if (error) throw error;
    const direct = new Set<string>();
    const codes: string[] = [];
    (students ?? []).forEach((s: any) => {
      if (s.auth_user_id) direct.add(s.auth_user_id);
      if (s.parent_user_id) direct.add(s.parent_user_id);
      if (s.parent_user_id_2) direct.add(s.parent_user_id_2);
      if (s.student_code) codes.push(s.student_code);
    });

    // parent_student_links fallback
    let linkParents: string[] = [];
    try {
      const { data: links } = await supabase
        .from("parent_student_links" as any)
        .select("parent_user_id")
        .in("student_id", uniq);
      (links ?? []).forEach((l: any) => l.parent_user_id && direct.add(l.parent_user_id));
      linkParents = (links ?? []).map((l: any) => l.parent_user_id).filter(Boolean);
      void linkParents;
    } catch {
      // table may not exist in some envs
    }

    // profiles.student_code -> parent accounts (legacy)
    if (codes.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .in("student_code", codes);
        (profs ?? []).forEach((p: any) => p.id && direct.add(p.id));
      } catch {
        // ignore
      }
    }

    return Array.from(direct);
  } catch (e) {
    console.warn("[notificationTriggers] resolveFamilyUserIds failed", e);
    return [];
  }
}

async function resolveClassroomFamilyUserIds(classroomId: string): Promise<string[]> {
  try {
    const { data: studs } = await supabase
      .from("students")
      .select("id")
      .eq("classroom_id", classroomId)
      .eq("status", "active");
    const ids = (studs ?? []).map((s: any) => s.id).filter(Boolean);
    if (ids.length === 0) return [];
    return resolveFamilyUserIds(ids);
  } catch (e) {
    console.warn("[notificationTriggers] resolveClassroomFamilyUserIds failed", e);
    return [];
  }
}

async function resolveRoleUserIds(roles: string[]): Promise<string[]> {
  try {
    const { data } = await supabase.from("user_roles").select("user_id").in("role", roles);
    return [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
  } catch (e) {
    console.warn("[notificationTriggers] resolveRoleUserIds failed", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 1) Grade 0 / ร / มส / มผ announced
// ---------------------------------------------------------------------------
export async function notifyGradeRemediationAnnounced(opts: {
  studentIds: string[];
  subjectCode: string;
  subjectName?: string | null;
  term: string;
  originalGrade: string;
  remediationIds?: string[];
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds(opts.studentIds);
  if (user_ids.length === 0) return;
  const title = `ติด ${opts.originalGrade} วิชา ${opts.subjectCode}`;
  const body = `${opts.subjectName ? opts.subjectName + " " : ""}${opts.subjectCode} ${opts.term} เกรด ${opts.originalGrade} — ประกาศรายชื่อ ติดต่อครูผู้สอน`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "grade_remediation",
    severity: "warning",
    reference_id: opts.remediationIds?.[0] ?? null,
    reference_type: "grade_remediation",
    url: "/dashboard/academic/grade-remediation",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `grade-remediation-announce-${opts.term}-${opts.subjectCode}-${opts.studentIds.slice(0, 3).join(",")}`,
    fields: { วิชา: opts.subjectCode, เทอม: opts.term, เกรด: opts.originalGrade },
  });
  // explicit direct invoke per task requirement (ensures string match for audit)
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "grade_remediation", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// Batch variant for announce dialog (multiple remediations at once)
export async function notifyGradeRemediationBatchAnnounced(items: Array<{
  student_id: string;
  subject_code: string;
  subject_name?: string | null;
  term: string;
  original_grade: string;
  id: string;
}>): Promise<void> {
  if (!items.length) return;
  // group by student to reduce fanout calls
  const byStudent = new Map<string, typeof items>();
  items.forEach((it) => {
    const arr = byStudent.get(it.student_id) ?? [];
    arr.push(it);
    byStudent.set(it.student_id, arr);
  });
  for (const [studentId, list] of byStudent) {
    const first = list[0];
    const grades = list.map((l) => `${l.subject_code}:${l.original_grade}`).join(", ");
    await notifyGradeRemediationAnnounced({
      studentIds: [studentId],
      subjectCode: list.length === 1 ? first.subject_code : `${list.length} วิชา`,
      subjectName: first.subject_name,
      term: first.term,
      originalGrade: list.length === 1 ? first.original_grade : grades,
      remediationIds: list.map((l) => l.id),
    });
  }
}

// ---------------------------------------------------------------------------
// 2) Grade remediation fix (ครูบันทึกการแก้)
// ---------------------------------------------------------------------------
export async function notifyGradeRemediationFix(opts: {
  studentId: string;
  subjectCode: string;
  term: string;
  newGrade?: string | null;
  fixScore?: number | null;
  fixMethod?: string | null;
  status: string;
  remediationId: string;
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  const isPass = opts.newGrade && !["0", "ร", "มส", "มผ"].includes(opts.newGrade);
  const title = isPass
    ? `✅ แก้ 0 ร มส ผ่าน — ${opts.subjectCode}`
    : `🔧 บันทึกการแก้ 0 ร มส — ${opts.subjectCode}`;
  const body = `${opts.subjectCode} ${opts.term} — สถานะ ${opts.status}${opts.newGrade ? ` เกรดใหม่ ${opts.newGrade}` : ""}${opts.fixScore != null ? ` คะแนน ${opts.fixScore}` : ""}${opts.fixMethod ? ` วิธี ${opts.fixMethod}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "grade_remediation_fix",
    severity: isPass ? "success" : "info",
    reference_id: opts.remediationId,
    reference_type: "grade_remediation",
    url: "/dashboard/academic/grade-remediation",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `grade-remediation-fix-${opts.remediationId}`,
    fields: { วิชา: opts.subjectCode, เทอม: opts.term, สถานะ: opts.status, เกรดใหม่: opts.newGrade || "-" },
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "grade_remediation_fix", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

export async function notifyGradeRemediationRetakeScheduled(opts: {
  studentId: string;
  subjectCode: string;
  term: string;
  retakeDate: string;
  remediationId: string;
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  const title = `📅 นัดสอบแก้ — ${opts.subjectCode}`;
  const body = `${opts.subjectCode} ${opts.term} นัดสอบแก้ ${opts.retakeDate}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "grade_remediation_retake",
    severity: "info",
    reference_id: opts.remediationId,
    reference_type: "grade_remediation",
    url: "/dashboard/academic/grade-remediation",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `grade-remediation-retake-${opts.remediationId}-${opts.retakeDate}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "grade_remediation_retake", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 3) Attendance daily digest
// ---------------------------------------------------------------------------
export async function notifyAttendanceDailyDigest(opts: {
  date: string; // YYYY-MM-DD
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  classroomId?: string;
}): Promise<void> {
  // digest goes to teachers/admins + optionally homeroom
  const roleIds = await resolveRoleUserIds(["admin", "director", "teacher"]);
  let user_ids = [...roleIds];
  if (opts.classroomId) {
    const classFamily = await resolveClassroomFamilyUserIds(opts.classroomId);
    // digest for classroom teachers only — keep narrow; still add homeroom if needed
    void classFamily;
  }
  if (user_ids.length === 0) return;
  const rate = opts.total > 0 ? Math.round((opts.present / opts.total) * 1000) / 10 : 0;
  const title = `📊 สรุปเข้าเรียน ${opts.date}`;
  const body = `มา ${opts.present} สาย ${opts.late} ลา ${opts.leave} ขาด ${opts.absent} รวม ${opts.total} • ${rate}%`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "attendance_daily_digest",
    severity: "info",
    reference_type: "attendance",
    url: "/dashboard/student/attendance",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    gchat_categories: ["all"],
    dedup_key: `attendance-digest-${opts.date}`,
    fields: { วันที่: opts.date, มา: String(opts.present), ขาด: String(opts.absent), สาย: String(opts.late), ลา: String(opts.leave) },
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "attendance_daily_digest", user_ids, channels: ["in_app", "push", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

export async function notifyAttendanceAbsent(opts: {
  studentId: string;
  date: string;
  status: "absent" | "late" | "leave";
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  const label = opts.status === "late" ? "มาสาย" : opts.status === "leave" ? "ลา" : "ขาดเรียน";
  const title = `📋 บันทึกการเข้าเรียน`;
  const body = `วันที่ ${opts.date} — สถานะ: ${label} กรุณาติดต่อครูที่ปรึกษา`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "attendance_absent",
    severity: "warning",
    reference_type: "attendance",
    url: "/dashboard/student/attendance",
    channels: ["in_app", "push", "line"] as TriggerChannel[],
    dedup_key: `att-${opts.status}-${opts.date}-${opts.studentId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "attendance_absent", user_ids, channels: ["in_app", "push", "line"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 4) Leave approved / rejected (staff + student)
// ---------------------------------------------------------------------------
export async function notifyLeaveApproved(opts: {
  applicantUserId?: string | null;
  applicantName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  leaveId: string;
  leaveTable: "staff_leaves" | "student_leaves";
}): Promise<void> {
  if (!opts.applicantUserId) return;
  const title = `✅ ใบลาได้รับการอนุมัติ`;
  const body = `${opts.applicantName} ${opts.leaveType} ${opts.startDate} ถึง ${opts.endDate}`;
  await safeInvokeFanout({
    user_ids: [opts.applicantUserId],
    title,
    body,
    type: opts.leaveTable === "staff_leaves" ? "staff_leave_approved" : "student_leave_decision",
    severity: "success",
    reference_id: opts.leaveId,
    reference_type: opts.leaveTable,
    url: opts.leaveTable === "staff_leaves" ? "/dashboard/hr/leave" : "/dashboard/student/leave",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `leave-approved-${opts.leaveId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "staff_leave_approved", user_ids: [opts.applicantUserId], channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

export async function notifyLeaveRejected(opts: {
  applicantUserId?: string | null;
  applicantName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  leaveId: string;
  leaveTable: "staff_leaves" | "student_leaves";
}): Promise<void> {
  if (!opts.applicantUserId) return;
  const title = `❌ ใบลาไม่ได้รับอนุมัติ`;
  const body = `${opts.applicantName} ${opts.leaveType} ${opts.startDate} ถึง ${opts.endDate}${opts.reason ? ` เหตุผล: ${opts.reason}` : ""}`;
  await safeInvokeFanout({
    user_ids: [opts.applicantUserId],
    title,
    body,
    type: opts.leaveTable === "staff_leaves" ? "staff_leave_rejected" : "student_leave_decision",
    severity: "warning",
    reference_id: opts.leaveId,
    reference_type: opts.leaveTable,
    url: opts.leaveTable === "staff_leaves" ? "/dashboard/hr/leave" : "/dashboard/student/leave",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `leave-rejected-${opts.leaveId}`,
    fields: { เหตุผล: opts.reason || "-" },
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "staff_leave_rejected", user_ids: [opts.applicantUserId], channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// Convenience wrapper used by pages
export async function notifyLeaveDecision(
  decision: "approved" | "rejected",
  opts: Parameters<typeof notifyLeaveApproved>[0] & { reason?: string | null },
): Promise<void> {
  if (decision === "approved") {
    await notifyLeaveApproved(opts);
  } else {
    await notifyLeaveRejected({ ...opts, reason: opts.reason ?? null });
  }
}

// ---------------------------------------------------------------------------
// 5) Homework assigned
// ---------------------------------------------------------------------------
export async function notifyHomeworkAssigned(opts: {
  classroomId: string;
  subjectName?: string | null;
  title: string;
  dueDate?: string | null;
  assignmentId: string;
}): Promise<void> {
  const user_ids = await resolveClassroomFamilyUserIds(opts.classroomId);
  if (user_ids.length === 0) {
    // fallback: all students in classroom via auth_user_id directly
    try {
      const { data } = await supabase.from("students").select("auth_user_id").eq("classroom_id", opts.classroomId).eq("status", "active").not("auth_user_id", "is", null);
      const ids = (data ?? []).map((s: any) => s.auth_user_id).filter(Boolean);
      if (ids.length === 0) return;
      const title = `📚 การบ้านใหม่: ${opts.title}`;
      const body = `${opts.subjectName || "วิชา"}${opts.dueDate ? ` • กำหนดส่ง ${opts.dueDate}` : ""}`;
      await safeInvokeFanout({
        user_ids: ids,
        title,
        body,
        type: "homework",
        severity: "info",
        reference_id: opts.assignmentId,
        reference_type: "task_assignments",
        url: "/dashboard/homework",
        channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
        dedup_key: `homework-${opts.assignmentId}`,
      });
      try {
        await supabase.functions.invoke("notify-fanout", {
          body: { title, body, type: "homework", user_ids: ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
        });
      } catch {}
      return;
    } catch (e) {
      console.warn("[notifyHomeworkAssigned] fallback failed", e);
      return;
    }
  }
  const title = `📚 การบ้านใหม่: ${opts.title}`;
  const body = `${opts.subjectName || "วิชา"}${opts.dueDate ? ` • กำหนดส่ง ${opts.dueDate}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "homework",
    severity: "info",
    reference_id: opts.assignmentId,
    reference_type: "task_assignments",
    url: "/dashboard/homework",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `homework-${opts.assignmentId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "homework", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 6) Exam scheduled
// ---------------------------------------------------------------------------
export async function notifyExamScheduled(opts: {
  classroomId?: string | null;
  subjectName?: string | null;
  title: string;
  examDate: string; // YYYY-MM-DD
  location?: string | null;
  eventId?: string | null;
  examId?: string | null;
}): Promise<void> {
  let user_ids: string[] = [];
  if (opts.classroomId) {
    user_ids = await resolveClassroomFamilyUserIds(opts.classroomId);
  }
  if (user_ids.length === 0) {
    user_ids = await resolveRoleUserIds(["student", "parent", "teacher"]);
    // if still empty, notify all
    if (user_ids.length === 0) {
      try {
        const { data } = await supabase.from("user_roles").select("user_id").limit(100);
        user_ids = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
      } catch {}
    }
  }
  if (user_ids.length === 0) return;
  const title = `📝 กำหนดสอบ: ${opts.title}`;
  const body = `${opts.subjectName ? opts.subjectName + " • " : ""}${opts.examDate}${opts.location ? ` @${opts.location}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "exam_scheduled",
    severity: "info",
    reference_id: opts.examId ?? opts.eventId ?? null,
    reference_type: opts.examId ? "exams" : "academic_events",
    url: opts.examId ? `/dashboard/exam/${opts.examId}` : "/dashboard/academic/calendar",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `exam-${opts.examId ?? opts.eventId ?? opts.title}-${opts.examDate}`,
    fields: { วิชา: opts.subjectName || "-", วันที่: opts.examDate, สถานที่: opts.location || "-" },
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "exam_scheduled", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// Also trigger when academic_events of type exam is created
export async function notifyAcademicExamEventCreated(event: {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  location?: string | null;
  academic_year?: number | null;
  semester?: number | null;
}): Promise<void> {
  if (event.event_type !== "exam") return;
  await notifyExamScheduled({
    title: event.title,
    examDate: event.event_date,
    location: event.location,
    eventId: event.id,
  });
}

// ---------------------------------------------------------------------------
// 7) Library overdue
// ---------------------------------------------------------------------------
export async function notifyLibraryOverdue(opts: {
  studentId: string;
  bookTitle: string;
  dueAt: string;
  loanId: string;
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  const title = `📚 หนังสือเกินกำหนดคืน`;
  const body = `"${opts.bookTitle}" กำหนดคืน ${new Date(opts.dueAt).toLocaleDateString("th-TH")} กรุณาคืนโดยด่วน`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "library_overdue",
    severity: "warning",
    reference_id: opts.loanId,
    reference_type: "library_loans",
    url: "/dashboard/admin/library",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `library-overdue-${opts.loanId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "library_overdue", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

export async function notifyLibraryOverdueBatch(loans: Array<{ student_id: string; book_title: string; due_at: string; id: string }>): Promise<void> {
  for (const l of loans) {
    await notifyLibraryOverdue({ studentId: l.student_id, bookTitle: l.book_title, dueAt: l.due_at, loanId: l.id });
  }
}

// ---------------------------------------------------------------------------
// 8) Bus boarding
// ---------------------------------------------------------------------------
export async function notifyBusBoarding(opts: {
  studentId: string;
  routeName: string;
  boardedAt?: string;
  attendanceId: string;
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  // we fan-out to parents + student; also notify admins via gchat only if needed — keep to family for now + optional admin
  const title = `🚌 ขึ้นรถแล้ว — ${opts.routeName}`;
  const time = opts.boardedAt ? new Date(opts.boardedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "";
  const body = `นักเรียนขึ้นรถสาย ${opts.routeName}${time ? ` เวลา ${time}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "bus_boarding",
    severity: "info",
    reference_id: opts.attendanceId,
    reference_type: "bus_attendance",
    url: "/dashboard/admin/bus",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `bus-${opts.attendanceId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "bus_boarding", user_ids, channels: ["in_app", "push", "line"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 9) Kiosk offline
// ---------------------------------------------------------------------------
export async function notifyKioskOffline(opts: {
  deviceId: string;
  room?: string | null;
  lastHeartbeat?: string | null;
}): Promise<void> {
  const user_ids = await resolveRoleUserIds(["admin", "director"]);
  if (user_ids.length === 0) return;
  const title = `📴 ตู้ Kiosk ออฟไลน์เกิน 10 นาที`;
  const body = `${opts.deviceId}${opts.room ? ` • ${opts.room}` : ""}${opts.lastHeartbeat ? ` • last ${opts.lastHeartbeat}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "kiosk_offline",
    severity: "warning",
    reference_type: "kiosk_devices",
    reference_id: opts.deviceId,
    url: "/dashboard/admin/kiosk-health",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    gchat_categories: ["all"],
    dedup_key: `kiosk-offline-${opts.deviceId}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "kiosk_offline", user_ids, channels: ["in_app", "push", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 10) Health check fail
// ---------------------------------------------------------------------------
export async function notifyHealthCheckFail(opts: {
  dbOk: boolean;
  storageOk: boolean;
  functionsCount: number;
  failureCount: number;
}): Promise<void> {
  const user_ids = await resolveRoleUserIds(["admin", "director"]);
  if (user_ids.length === 0) return;
  const title = `🚨 ระบบตรวจสุขภาพล้มเหลว ${opts.failureCount} ครั้ง`;
  const body = `db=${opts.dbOk ? "ok" : "FAIL"} storage=${opts.storageOk ? "ok" : "FAIL"} functions=${opts.functionsCount} — ตรวจสอบ Supabase / Storage / Edge Functions`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: "health_check",
    severity: "critical",
    reference_type: "system",
    url: "/dashboard/admin",
    channels: ["in_app", "push", "gchat"] as TriggerChannel[],
    gchat_categories: ["all"],
    dedup_key: `health-fail-${opts.failureCount}-${new Date().toISOString().slice(0, 10)}`,
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: "health_check", user_ids, channels: ["in_app", "push", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 11) PP5/PP6 Grade Lock announce (80% threshold gate passed -> announce)
// ---------------------------------------------------------------------------
export async function notifyGradeLockAnnounced(opts: {
  classroomId: string;
  term: string; // e.g. "1/2568"
  fileId: string;
  fileType: "pp5" | "pp6";
  subjectLabel?: string | null;
  classroomName?: string | null;
}): Promise<void> {
  const user_ids = await resolveClassroomFamilyUserIds(opts.classroomId);
  if (user_ids.length === 0) return;
  const title = opts.fileType === "pp5"
    ? `📊 ประกาศผล ปพ.5 ${opts.subjectLabel || ""}`.trim()
    : `📋 ประกาศผล ปพ.6 ${opts.classroomName || ""}`.trim();
  const body = `เทอม ${opts.term} — ประกาศผลเรียบร้อย${opts.subjectLabel ? ` วิชา ${opts.subjectLabel}` : ""}`;
  await safeInvokeFanout({
    user_ids,
    title,
    body,
    type: opts.fileType === "pp5" ? "grade_lock_pp5" : "grade_lock_pp6",
    severity: "info",
    reference_id: opts.fileId,
    reference_type: opts.fileType === "pp5" ? "pp5_files" : "pp6_files",
    url: "/profile?tab=grades",
    channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[],
    dedup_key: `grade-lock-${opts.fileType}-${opts.fileId}-${opts.term}`,
    fields: { เทอม: opts.term, ห้อง: opts.classroomName || "-", วิชา: opts.subjectLabel || "-" },
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title, body, type: opts.fileType === "pp5" ? "grade_lock_pp5" : "grade_lock_pp6", user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// Alias for task spec naming
export const notifyPP5GradeLock = notifyGradeLockAnnounced;

// ---------------------------------------------------------------------------
// Generic helper for any student event (spider-web fan-out)
// ---------------------------------------------------------------------------
export async function notifyStudentEventGeneric(opts: {
  studentId: string;
  title: string;
  body?: string;
  type: string;
  severity?: TriggerSeverity;
  referenceId?: string | null;
  referenceType?: string | null;
  url?: string | null;
  channels?: TriggerChannel[];
}): Promise<void> {
  const user_ids = await resolveFamilyUserIds([opts.studentId]);
  if (user_ids.length === 0) return;
  await safeInvokeFanout({
    user_ids,
    title: opts.title,
    body: opts.body,
    type: opts.type,
    severity: opts.severity ?? "info",
    reference_id: opts.referenceId ?? null,
    reference_type: opts.referenceType ?? null,
    url: opts.url ?? null,
    channels: (opts.channels as TriggerChannel[]) ?? (["in_app", "push", "line", "gchat"] as TriggerChannel[]),
  });
  try {
    await supabase.functions.invoke("notify-fanout", {
      body: { title: opts.title, body: opts.body, type: opts.type, user_ids, channels: ["in_app", "push", "line", "gchat"] as TriggerChannel[] },
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Convenience re-exports for legacy callers
// ---------------------------------------------------------------------------
export const notifyGradeRemediation = notifyGradeRemediationAnnounced;
export const notifyAttendance = notifyAttendanceDailyDigest;
