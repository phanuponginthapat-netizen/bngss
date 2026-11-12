// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ writes: [] as any[], records: new Map<string, any>(), subjects: [] as any[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    const query: any = {
      select: () => query, in: () => query, eq: () => query,
      then: (resolve: any) => resolve({ data: table === "students"
        ? [{ id: "student-uuid", student_code: "2845" }]
        : table === "subjects" ? source.subjects : [], error: null }),
      upsert: async (rows: any[], options: any) => {
        source.writes.push({ table, rows, options });
        if (rows.some(row => "student_id" in row)) return { error: { code: "PGRST204", message: "Could not find the 'student_id' column of 'student_scores' in the schema cache" } };
        for (const row of rows) source.records.set(`${row.student_code}:${row.subject_id}:${row.semester}:${row.academic_year}`, row);
        return { error: null };
      },
    };
    return query;
  } },
}));
import { applyPpFileToSystem, upsertStudentScoresForTerm } from "../pp5ApplyToSystem";

beforeEach(() => { source.writes = []; source.records.clear(); source.subjects = [{ id: "science", code: "ว", name_th: "วิทยาศาสตร์", semester: 2 }]; });

describe("term-scoped ปพ. score distribution", () => {
  it("preserves primary science imports after the curriculum title correction", async () => {
    source.subjects = [{ id: "primary-science", code: "ว14101", grade_level: "ป.4", name_th: "วิทยาศาสตร์และเทคโนโลยี 4", semester: 1 }];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2569, grade_level: "ป.4", parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { "วิทยาศาสตร์ 4": { totalScore: 79, grade: "3.5" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual([]);
    expect(source.writes[0].rows[0]).toMatchObject({ subject_id: "primary-science", total_score: 79 });
  });
  it("matches the confirmed เชื้อเพลิงฯ 3 file alias to ว22203 only for ม.2 semester 1/2569", async () => {
    source.subjects = [{ id: "fuel1", code: "ว22203", name_th: "เชื้อเพลิงเพื่อการคมนาคมขนส่ง 1", semester: 1 }];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2569, grade_level: "ม.2", parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { "เชื้อเพลิงเพื่อการคมนาคมขนส่ง 3": { totalScore: 79, grade: "3.5" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual([]);
    expect(source.writes[0].rows[0]).toMatchObject({ subject_id: "fuel1", total_score: 79, semester: 1, academic_year: 2026 });
  });
  it("does not generalize the confirmed fuel alias to a different year", async () => {
    source.subjects = [{ id: "fuel1", code: "ว22203", name_th: "เชื้อเพลิงเพื่อการคมนาคมขนส่ง 1", semester: 1 }];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2570, grade_level: "ม.2", parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { "เชื้อเพลิงเพื่อการคมนาคมขนส่ง 3": { totalScore: 79, grade: "3.5" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual(["เชื้อเพลิงเพื่อการคมนาคมขนส่ง 3"]);
    expect(source.writes).toHaveLength(0);
  });
  it("matches curriculum พลังงานไฟฟ้า 1 to ว23203 in semester 1, not ว23204 semester 2", async () => {
    source.subjects = [
      { id: "1836ea4c-4595-4084-8508-1b7597398593", code: "ว23203", name_th: "พลังงานไฟฟ้า 1", semester: 1 },
      { id: "electric2", code: "ว23204", name_th: "พลังงานไฟฟ้า 2", semester: 2 },
    ];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2569, parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { "พลังงานไฟฟ้า 1": { totalScore: 79, grade: "3.5" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual([]);
    expect(source.writes[0].rows[0]).toMatchObject({ subject_id: "1836ea4c-4595-4084-8508-1b7597398593", semester: 1, academic_year: 2026, total_score: 79 });
  });
  it("matches การสร้างการ์ตูนแอนิเมชั่น to the existing แอนิเมชัน subject without crossing semesters", async () => {
    source.subjects = [
      { id: "bfb96c31-0e06-4905-b1b4-1ea4fdc848ce", code: "ว22201", name_th: "การสร้างการ์ตูนแอนิเมชัน", semester: 1 },
      { id: "9aadba2f-26b9-4f6e-90a4-4a82897a0143", code: "ว22201", name_th: "การสร้างการ์ตูนแอนิเมชัน", semester: 2 },
    ];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2569, grade_level: "ม.2", parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { "การสร้างการ์ตูนแอนิเมชั่น": { totalScore: 79, grade: "3.5" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual([]);
    expect(source.writes[0].rows[0]).toMatchObject({ subject_id: "bfb96c31-0e06-4905-b1b4-1ea4fdc848ce", total_score: 79, semester: 1, academic_year: 2026 });
  });
  it("stores each activity's ผ/มผ without a numeric score or grade point", async () => {
    source.subjects = ["ชุมนุม", "ลูกเสือ", "แนะแนว"].map(name => ({ id: name, name_th: name, semester: 1 }));
    await applyPpFileToSystem({ semester: 1, academic_year: 2569, parsed_data: {
      consolidated: [{ studentCode: "2845", perSubject: { ชุมนุม: { grade: "มผ" }, ลูกเสือ: { grade: "ผ" }, แนะแนว: { grade: "ผ" } } }],
    } }, "pp6");
    expect(source.writes[0].rows.map((r: any) => [r.subject_id, r.grade, r.total_score, r.grade_point]))
      .toEqual([["ชุมนุม", "มผ", null, null], ["ลูกเสือ", "ผ", null, null], ["แนะแนว", "ผ", null, null]]);
  });
  it("distributes AI curriculum scores to the existing ว21201 subject in the correct semester", async () => {
    source.subjects = [
      { id: "083503be-f231-48bd-88c3-d03475d516cb", code: "ว21201", name_th: "ปัญญาประดิษฐ์", semester: 1 },
      { id: "201489f6-347e-460f-97d5-adf448cc963a", code: "ว21201", name_th: "ปัญญาประดิษฐ์", semester: 2 },
    ];
    const result = await applyPpFileToSystem({ semester: 1, academic_year: 2569, grade_level: "ม.1", parsed_data: {
      consolidated: [{ studentCode: "2845", studentName: "ทดสอบ", perSubject: { ปัญญาประดิษฐ์: { totalScore: 83, grade: "4" } } }],
    } }, "pp6");
    expect(result.unmatchedSubjects).toEqual([]);
    expect(result.distributed).toBe(1);
    expect(source.writes[0].rows[0]).toMatchObject({ subject_id: "083503be-f231-48bd-88c3-d03475d516cb", total_score: 83, semester: 1, academic_year: 2026 });
  });
  it("distributes ปพ.6 using student_code, not the nonexistent student_id column", async () => {
    const result = await applyPpFileToSystem({ semester: 2, academic_year: 2569, parsed_data: {
      consolidated: [{ studentCode: "2845", studentName: "นักเรียนทดสอบ", perSubject: {
        วิทยาศาสตร์: { totalScore: 83, grade: "4", midScore: 10, finalScore: 20 },
      } }],
    } }, "pp6");
    expect(result.distributed).toBe(1);
    expect(source.writes[0].rows[0]).not.toHaveProperty("student_id");
    expect(source.writes[0].rows[0]).toMatchObject({ student_code: "2845", total_score: 83, grade: "4", semester: 2, academic_year: 2026 });
  });
  it("normalizes 2569 to 2026 at the shared write boundary", async () => {
    expect(await upsertStudentScoresForTerm([{ student_code: "2845", subject_id: "science", student_name: "ทดสอบ", total_score: 83 }], 2, 2569)).toBeNull();
    expect(source.writes[0].rows[0].academic_year).toBe(2026);
  });
  it("rejects a missing term before any write", async () => {
    expect(await upsertStudentScoresForTerm([{ student_code: "2845", subject_id: "science" }], 0, 2026)).toBeInstanceOf(Error);
    expect(source.writes).toHaveLength(0);
  });
  it("keeps different semesters and years separate and preserves file totals", async () => {
    const row = { student_code: "2845", subject_id: "science", student_name: "ทดสอบ" };
    await upsertStudentScoresForTerm([{ ...row, total_score: 73 }], 1, 2026);
    await upsertStudentScoresForTerm([{ ...row, total_score: 83 }], 2, 2026);
    await upsertStudentScoresForTerm([{ ...row, total_score: 93 }], 2, 2027);
    expect([...source.records.values()].map(row => row.total_score)).toEqual([73, 83, 93]);
    expect(source.writes.every(write => write.options.onConflict === "student_code,subject_id,semester,academic_year")).toBe(true);
  });
});