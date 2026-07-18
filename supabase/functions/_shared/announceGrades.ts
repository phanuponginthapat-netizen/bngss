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

export async function announceGrades(opts: AnnounceGradesOptions) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = opts.authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing authorization");

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) throw new Error("Unauthorized");
  const caller = userData.user;

  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", caller.id).in("role", ["admin", "director", "teacher", "super_admin"]).limit(1).maybeSingle();
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
    .select("id, student_code, auth_user_id")
    .in("student_code", codes);
  const codeToStudent = new Map<string, { id: string; uid: string | null }>();
  for (const s of students || []) {
    codeToStudent.set(String((s as any).student_code), {
      id: (s as any).id,
      uid: (s as any).auth_user_id || null,
    });
  }

  // Parent links
  const studentIds = Array.from(codeToStudent.values()).map((s) => s.id);
  const { data: parentLinks } = studentIds.length
    ? await admin.from("parent_student_links").select("student_id, parent_user_id").in("student_id", studentIds)
    : { data: [] as any[] };
  const studentIdToParents = new Map<string, string[]>();
  for (const pl of parentLinks || []) {
    const arr = studentIdToParents.get((pl as any).student_id) || [];
    arr.push((pl as any).parent_user_id);
    studentIdToParents.set((pl as any).student_id, arr);
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
