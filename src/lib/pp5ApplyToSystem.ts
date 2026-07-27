// Apply parsed ปพ.5 data (from pp5_files.parsed_data) into the live grading
// system (subject_score_columns + student_column_scores).
//
// Strategy: create/reuse a single "รวม (นำเข้าจากไฟล์)" score column per
// subject, then upsert each parsed student's totalScore into it. Students are
// matched by student_code within the file's classroom.

import { supabase } from "@/integrations/supabase/client";

export interface Pp5ApplyResult {
  applied: number;
  skipped: number;
  columnId: string;
  columnName: string;
  unmatched: string[]; // student codes not found in the classroom
}

export async function applyPp5FileToSystem(fileRow: any): Promise<Pp5ApplyResult> {
  const parsed = fileRow?.parsed_data;
  if (!parsed) throw new Error("ไฟล์นี้ยังไม่ได้อ่านข้อมูล — กรุณาอัปโหลดใหม่ผ่าน 'นำเข้า ปพ.5 (อ่านอัตโนมัติ)'");

  const subjectId: string | null = parsed.subject_id || null;
  const classroomId: string | null = parsed.classroom_id || null;
  if (!subjectId) throw new Error("ไม่พบรหัสวิชา (subject_id) ในไฟล์ — โปรดจับคู่วิชาตอนอัปโหลดใหม่");
  if (!classroomId) throw new Error("ไม่พบห้องเรียน (classroom_id) ในไฟล์ — โปรดจับคู่ห้องตอนอัปโหลดใหม่");

  const consolidated: Array<{ studentCode: string; perSubject: Record<string, any> }> = parsed.consolidated || [];
  if (consolidated.length === 0) throw new Error("ไม่พบข้อมูลนักเรียนในไฟล์");

  // 1. Find or create the import target column
  const COLUMN_NAME = "รวม (นำเข้าจากไฟล์ ปพ.5)";
  const { data: existingCols } = await supabase
    .from("subject_score_columns")
    .select("id, column_name, sort_order")
    .eq("subject_id", subjectId);

  let target = (existingCols || []).find((c: any) => c.column_name === COLUMN_NAME);
  if (!target) {
    const nextOrder = (existingCols || []).reduce((m: number, c: any) => Math.max(m, c.sort_order ?? 0), 0) + 1;
    const { data: created, error: createErr } = await supabase
      .from("subject_score_columns")
      .insert({
        subject_id: subjectId,
        column_name: COLUMN_NAME,
        column_type: "final",
        max_score: 100,
        sort_order: nextOrder,
        half: "post",
        is_enabled: true,
      })
      .select("id, column_name")
      .single();
    if (createErr) throw new Error(`สร้างช่องคะแนนไม่สำเร็จ: ${createErr.message}`);
    target = created;
  }

  // 2. Resolve student_code → student.id within the target classroom
  const codes = consolidated.map((c) => String(c.studentCode).trim()).filter(Boolean);
  const { data: students, error: studErr } = await supabase
    .from("students")
    .select("id, student_code")
    .eq("classroom_id", classroomId)
    .in("student_code", codes);
  if (studErr) throw new Error(`ค้นหานักเรียนไม่สำเร็จ: ${studErr.message}`);
  const codeToId = new Map((students || []).map((s: any) => [String(s.student_code), s.id]));

  // 3. Build upsert rows from the first (canonical) subject bucket per student
  const rows: any[] = [];
  const unmatched: string[] = [];
  for (const c of consolidated) {
    const sid = codeToId.get(String(c.studentCode).trim());
    if (!sid) { unmatched.push(c.studentCode); continue; }
    const bucket = Object.values(c.perSubject || {})[0] as any;
    const score = bucket?.totalScore ?? bucket?.examScore;
    if (typeof score !== "number") continue;
    rows.push({ student_id: sid, column_id: target!.id, score: Math.round(score * 100) / 100, status: "graded" });
  }

  if (rows.length === 0) {
    return { applied: 0, skipped: consolidated.length, columnId: target!.id, columnName: target!.column_name, unmatched };
  }

  const { error: upErr } = await supabase
    .from("student_column_scores")
    .upsert(rows, { onConflict: "student_id,column_id" });
  if (upErr) throw new Error(`บันทึกคะแนนไม่สำเร็จ: ${upErr.message}`);

  return {
    applied: rows.length,
    skipped: consolidated.length - rows.length,
    columnId: target!.id,
    columnName: target!.column_name,
    unmatched,
  };
}
