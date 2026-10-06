// Apply parsed ปพ.5 / ปพ.6 data (from parsed_data) into the live grading system
// and distribute the results to the other ปพ. documents.
//
// Targets:
//  1. subject_score_columns + student_column_scores  → หน้ากรอกคะแนน ปพ.5
//  2. student_scores (คะแนนรวม/เกรดต่อวิชา)           → ปพ.1 / ปพ.6 / ปพ.7 / transcript / profile
//
// Students are matched by student_code (scoped to the file's classroom when known).

import { supabase } from "@/integrations/supabase/client";

export interface PpApplyResult {
  applied: number;          // rows written to student_column_scores
  distributed: number;      // rows written to student_scores
  skipped: number;
  columnId: string | null;
  columnName: string | null;
  unmatched: string[];      // student codes not found
  unmatchedSubjects: string[];
  assessments?: number;     // rows written to student_assessment_scores
}

const GRADE_POINT: Record<string, number> = {
  "4": 4, "3.5": 3.5, "3": 3, "2.5": 2.5, "2": 2, "1.5": 1.5, "1": 1, "0": 0,
};

// ผลการเรียนแบบไม่ใช่ตัวเลข (ร / มส / มผ / ผ) — ห้ามคำนวณเกรดจากคะแนนทับ
const NON_NUMERIC_GRADE = /^(ร|มส|มผ|ผ|ผ่าน|ไม่ผ่าน|ดีเยี่ยม|ดี)$/;

function toGradePoint(grade: any, score: any): number | null {
  const g = String(grade ?? "").trim();
  if (g && GRADE_POINT[g] !== undefined) return GRADE_POINT[g];
  if (g && (NON_NUMERIC_GRADE.test(g) || isNaN(Number(g)))) return null;
  const s = typeof score === "number" ? score : Number(score);
  if (score === null || score === undefined || !Number.isFinite(s)) return null;
  if (s >= 80) return 4;
  if (s >= 75) return 3.5;
  if (s >= 70) return 3;
  if (s >= 65) return 2.5;
  if (s >= 60) return 2;
  if (s >= 55) return 1.5;
  if (s >= 50) return 1;
  return 0;
}

function toGrade(grade: any, score: any): string | null {
  const g = String(grade ?? "").trim();
  if (g) return g;
  const gp = toGradePoint(null, score);
  return gp === null ? null : String(gp);
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
/** ทำชื่อ/รหัสวิชาให้เทียบกันได้: เลขไทย→อารบิก, ตัดคำนำหน้า "รายวิชา/วิชา", ป้าย (พื้นฐาน)/(เพิ่มเติม), ช่องว่างและเครื่องหมาย */
const norm = (s: any) => String(s ?? "")
  .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
  .toLowerCase()
  .replace(/\((พื้นฐาน|เพิ่มเติม|พ|ม)\)/g, "")
  .replace(/^(รายวิชา|วิชา)/, "")
  .replace(/[\s.\-_/:,]+/g, "")
  .trim();
// "ท21101 ภาษาไทย 1" → ["ท21101", "ภาษาไทย1"]
const subjectKeys = (raw: string): string[] => {
  const s = String(raw ?? "").trim();
  const keys = new Set<string>([norm(s)]);
  const code = s.match(/[ก-ฮA-Za-z]{1,3}\s*\d{4,6}/);
  if (code) keys.add(norm(code[0]));
  const rest = s.replace(/[ก-ฮA-Za-z]{1,3}\s*\d{4,6}/, "").replace(/[()]/g, "");
  if (rest.trim()) keys.add(norm(rest));
  return Array.from(keys).filter(Boolean);
};

export async function applyPpFileToSystem(
  fileRow: any,
  kind: "pp5" | "pp6" = "pp5",
): Promise<PpApplyResult> {
  const parsed = fileRow?.parsed_data;
  if (!parsed) {
    throw new Error(
      `ไฟล์นี้ยังไม่ได้อ่านข้อมูล — กรุณาอัปโหลดใหม่ผ่าน 'นำเข้า ${kind === "pp5" ? "ปพ.5" : "ปพ.6"} (อ่านอัตโนมัติ)'`,
    );
  }

  const consolidated: Array<{ studentCode: string; studentName?: string; perSubject: Record<string, any> }> =
    parsed.consolidated || [];
  if (consolidated.length === 0) throw new Error("ไม่พบข้อมูลนักเรียนในไฟล์");

  const classroomId: string | null = parsed.classroom_id || fileRow?.classroom_id || null;
  const subjectId: string | null = parsed.subject_id || fileRow?.subject_id || null;
  const semester: number = Number(fileRow?.semester ?? parsed?.meta?.semester ?? 1);
  const academicYear: number = Number(fileRow?.academic_year ?? parsed?.meta?.academicYear ?? 0) || null as any;
  const gradeLevel: string | null = fileRow?.grade_level || parsed?.meta?.gradeLevel || null;

  if (kind === "pp5" && !subjectId) {
    throw new Error("ไม่พบรหัสวิชา (subject_id) ในไฟล์ — โปรดจับคู่วิชาตอนอัปโหลดใหม่");
  }

  // ── 1. Resolve student_code → student.id ────────────────────────────────
  const codes = consolidated.map((c) => String(c.studentCode).trim()).filter(Boolean);
  let studentQuery = supabase.from("students").select("id, student_code").in("student_code", codes);
  if (classroomId) studentQuery = studentQuery.eq("classroom_id", classroomId);
  const { data: students, error: studErr } = await studentQuery;
  if (studErr) throw new Error(`ค้นหานักเรียนไม่สำเร็จ: ${studErr.message}`);
  const codeToId = new Map((students || []).map((s: any) => [String(s.student_code), s.id]));

  // ศิษย์เก่า/นักเรียนย้ายห้อง จะไม่อยู่ในห้องที่ระบุ → ค้นซ้ำแบบไม่ผูกห้อง
  const stillMissing = codes.filter((c) => !codeToId.has(c));
  if (classroomId && stillMissing.length > 0) {
    const { data: extra } = await supabase
      .from("students")
      .select("id, student_code")
      .in("student_code", stillMissing);
    for (const s of extra || []) codeToId.set(String((s as any).student_code), (s as any).id);
  }


  const unmatched: string[] = [];
  const unmatchedSubjects = new Set<string>();

  // ── 2. Subject resolution ───────────────────────────────────────────────
  // ปพ.5 = one subject per file. ปพ.6 = many subjects per classroom → match by name/code.
  const subjectByName = new Map<string, string>();
  if (kind === "pp6") {
    let subjQuery = supabase.from("subjects").select("id, code, name_th, grade_level, semester");
    if (gradeLevel) subjQuery = subjQuery.eq("grade_level", gradeLevel);
    const { data: subs } = await subjQuery;
    // วิชาภาคเรียนเดียวกันมาทีหลัง → ชนะเมื่อชื่อซ้ำกันข้ามภาค
    const ordered = [...(subs || [])].sort(
      (a: any, b: any) => Number(a.semester === semester) - Number(b.semester === semester),
    );
    for (const s of ordered) {
      if ((s as any).name_th) subjectByName.set(norm((s as any).name_th), (s as any).id);
      if ((s as any).code) subjectByName.set(norm((s as any).code), (s as any).id);
    }
  }
  const resolveSubject = (name: string): string | null => {
    for (const k of subjectKeys(name)) {
      const id = subjectByName.get(k);
      if (id) return id;
    }
    // ชื่อวิชาในไฟล์สั้นกว่าในระบบ เช่น "ภาษาไทย" ↔ "ภาษาไทย 2" — รับเมื่อพบตรงตัวเดียวเท่านั้น
    const key = norm(String(name).replace(/[๐-๙0-9\s]+$/, ""));
    if (key.length >= 3) {
      const hits = new Set<string>();
      for (const [k, id] of subjectByName) if (k.startsWith(key) && /^[๐-๙0-9]*$/.test(k.slice(key.length))) hits.add(id);
      if (hits.size === 1) return [...hits][0];
    }
    return null;
  };

  // ── 3. ปพ.5 score column (aggregate import column) ──────────────────────
  let targetId: string | null = null;
  let targetName: string | null = null;
  if (kind === "pp5" && subjectId) {
    const COLUMN_NAME = "รวม (นำเข้าจากไฟล์ ปพ.5)";
    const { data: existingCols } = await supabase
      .from("subject_score_columns")
      .select("id, column_name, sort_order")
      .eq("subject_id", subjectId);

    const found = (existingCols || []).find((c: any) => c.column_name === COLUMN_NAME);
    if (found) {
      targetId = (found as any).id;
      targetName = (found as any).column_name;
    } else {
      const nextOrder =
        (existingCols || []).reduce((m: number, c: any) => Math.max(m, c.sort_order ?? 0), 0) + 1;
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
      targetId = (created as any).id;
      targetName = (created as any).column_name;
    }
  }

  // ── 4. Build rows ───────────────────────────────────────────────────────
  const columnRows: any[] = [];
  const scoreRows: any[] = [];

  for (const c of consolidated) {
    const code = String(c.studentCode).trim();
    const sid = codeToId.get(code);
    if (!sid) { unmatched.push(code); continue; }

    const entries = Object.entries(c.perSubject || {}) as Array<[string, any]>;
    if (entries.length === 0) continue;

    // ปพ.5 → single aggregate column score
    if (kind === "pp5" && targetId) {
      const bucket = entries[0][1];
      const score = bucket?.totalScore ?? bucket?.examScore;
      if (typeof score === "number") {
        columnRows.push({
          student_id: sid,
          column_id: targetId,
          score: Math.round(score * 100) / 100,
          status: "graded",
        });
      }
    }

    // Distribution → student_scores (per subject)
    for (const [subjName, v] of entries) {
      const sIdForRow = kind === "pp5" ? subjectId : resolveSubject(subjName);
      if (!sIdForRow) { unmatchedSubjects.add(subjName); continue; }
      const total = typeof v?.totalScore === "number" ? v.totalScore : Number(v?.totalScore);
      const hasTotal = Number.isFinite(total);
      let grade = toGrade(v?.grade, hasTotal ? total : null);
      // ระเบียบ สพฐ.: เวลาเรียนไม่ถึง 80% → "มส" (ไม่มีสิทธิ์สอบ) ไม่คิดเกรดจากคะแนน
      const attPct = Number(v?.attendancePercent);
      if (Number.isFinite(attPct) && attPct < 80 && (!grade || GRADE_POINT[grade] !== undefined)) grade = "มส";
      if (!hasTotal && !grade) continue;
      scoreRows.push({
        student_code: code,
        student_id: sid,
        student_name: c.studentName || null,
        subject_id: sIdForRow,
        total_score: hasTotal ? Math.round(total * 100) / 100 : null,
        // คะแนนระหว่างเรียน / ปลายภาค (จากแผ่นสรุปตัดสินผลการเรียน)
        midterm_score: typeof v?.midScore === "number" ? v.midScore : typeof v?.midtermScore === "number" ? v.midtermScore : null,
        final_score: typeof v?.finalScore === "number" ? v.finalScore : null,
        grade,
        grade_point: grade === "มส" ? null : toGradePoint(grade, hasTotal ? total : null),
        semester,
        academic_year: academicYear,
      });
    }
  }

  // ── 5. Write ────────────────────────────────────────────────────────────
  if (columnRows.length > 0) {
    const { error: upErr } = await supabase
      .from("student_column_scores")
      .upsert(columnRows, { onConflict: "student_id,column_id" });
    if (upErr) throw new Error(`บันทึกคะแนนไม่สำเร็จ: ${upErr.message}`);
  }

  if (scoreRows.length > 0) {
    // chunk to keep payloads reasonable for large classrooms
    for (let i = 0; i < scoreRows.length; i += 500) {
      const { error: sErr } = await supabase
        .from("student_scores")
        .upsert(scoreRows.slice(i, i + 500), { onConflict: "student_code,subject_id" });
      if (sErr) throw new Error(`กระจายผลการเรียนไม่สำเร็จ: ${sErr.message}`);
    }
  }

  // ── 6. ผลประเมินอ่านคิดเขียน / คุณลักษณะ / สมรรถนะ → ปพ.6, ปพ.7, เล่ม ปพ. ──
  let assessments = 0;
  try { assessments = await writeAssessments(consolidated, codeToId, semester, academicYear, parsed?.meta?.subjectName); }
  catch (e) { console.warn("[pp5] write assessments failed", e); }

  if (fileRow?.id) {
    await (supabase.from(kind === "pp5" ? "pp5_files" : "pp6_files") as any)
      .update({ applied_at: new Date().toISOString() })
      .eq("id", fileRow.id);
  }

  return {
    applied: columnRows.length,
    distributed: scoreRows.length,
    skipped: Math.max(consolidated.length - (kind === "pp5" ? columnRows.length : scoreRows.length), 0),
    columnId: targetId,
    columnName: targetName,
    unmatched,
    unmatchedSubjects: Array.from(unmatchedSubjects),
    assessments,
  };
}

const LEVEL_KEY: Record<string, string> = { "ดีเยี่ยม": "excellent", "ดี": "good", "ผ่าน": "moderate", "ไม่ผ่าน": "needs_improvement" };
const LEVEL_NUM: Record<number, string> = { 3: "excellent", 2: "good", 1: "moderate", 0: "needs_improvement" };
const ASSESS_CATS: Array<{ cat: string; title: string; text: string; num: string }> = [
  { cat: "reading_writing", title: "การอ่าน คิดวิเคราะห์ และเขียน (สรุปจาก ปพ.5)", text: "readingResult", num: "readingLevel" },
  { cat: "desirable", title: "คุณลักษณะอันพึงประสงค์ (สรุปจาก ปพ.5)", text: "characterResult", num: "characterLevel" },
  { cat: "competency", title: "สมรรถนะสำคัญของผู้เรียน (สรุปจาก ปพ.5)", text: "competencyResult", num: "competencyLevel" },
];

async function writeAssessments(
  consolidated: Array<{ studentCode: string; perSubject: Record<string, any> }>,
  codeToId: Map<string, string>, semester: number, academicYear: number | null, subjectName?: string,
): Promise<number> {
  const rows: any[] = [];
  const criteriaId: Record<string, string> = {};
  for (const def of ASSESS_CATS) {
    const has = consolidated.some((c) => Object.values(c.perSubject || {}).some((v: any) => v?.[def.text] || [0, 1, 2, 3].includes(v?.[def.num])));
    if (!has) continue;
    const { data: found } = await (supabase as any).from("assessment_criteria").select("id").eq("category", def.cat).eq("title", def.title).maybeSingle();
    let id = found?.id;
    if (!id) {
      const { data: created, error } = await (supabase as any).from("assessment_criteria")
        .insert({ category: def.cat, title: def.title, sort_order: 999, is_active: true }).select("id").single();
      if (error) throw error;
      id = created.id;
    }
    criteriaId[def.cat] = id;
  }
  for (const c of consolidated) {
    const sid = codeToId.get(String(c.studentCode).trim());
    if (!sid) continue;
    const v: any = Object.values(c.perSubject || {})[0] || {};
    for (const def of ASSESS_CATS) {
      if (!criteriaId[def.cat]) continue;
      const level = LEVEL_KEY[String(v[def.text] ?? "").trim()] ?? LEVEL_NUM[v[def.num] as number];
      if (!level) continue;
      rows.push({
        student_id: sid, criteria_id: criteriaId[def.cat], level,
        score: ({ excellent: 3, good: 2, moderate: 1, needs_improvement: 0 } as any)[level],
        semester, academic_year: academicYear,
        notes: subjectName ? `นำเข้าจาก ปพ.5 วิชา${subjectName}` : "นำเข้าจาก ปพ.5",
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await (supabase as any).from("student_assessment_scores")
      .upsert(rows.slice(i, i + 500), { onConflict: "student_id,criteria_id,semester,academic_year" });
    if (error) throw error;
  }
  return rows.length;
}

/** Backwards-compatible alias used by the ปพ.5 page. */
export const applyPp5FileToSystem = (fileRow: any) => applyPpFileToSystem(fileRow, "pp5");
export type Pp5ApplyResult = PpApplyResult;
