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