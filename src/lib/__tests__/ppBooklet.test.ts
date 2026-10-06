import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildTranscriptBooklet, buildReportCardBooklet } from "../ppBooklet";
import { writeFileSync } from "fs";
const data: any = {
  classroom: { grade_level: "ม.1", name: "1", homeroom_teacher: "ครูสมศรี ใจดี" },
  students: [{ id: "s1", student_code: "12345", prefix: "ด.ช.", first_name: "สมชาย", last_name: "รักเรียน" }],
  subjects: [{ id: "a", code: "ท21101", name_th: "ภาษาไทย 1", credits: 1.5 }, { id: "b", code: "ค21101", name_th: "คณิตศาสตร์ 1", credits: 1.5 }, { id: "c", code: "ว21101", name_th: "วิทยาศาสตร์ 1", credits: 1.5 }],
  scores: [
    { student_code: "12345", subject_id: "a", academic_year: 2569, semester: 1, grade: "4", grade_point: 4, midterm_score: 18, final_score: 25, total_score: 85 },
    { student_code: "12345", subject_id: "b", academic_year: 2569, semester: 1, grade: "3", grade_point: 3, midterm_score: 15, final_score: 20, total_score: 72 },
    { student_code: "12345", subject_id: "c", academic_year: 2569, semester: 1, grade: "ร", grade_point: 0 },
  ],
  assessments: [], attendance: [{ student_id: "s1", status: "present" }, { student_id: "s1", status: "late" }, { student_id: "s1", status: "absent" }],
};
describe("ppBooklet", () => {
  it("GPA ไม่นับ ร และนับสายเป็นมาเรียน", () => {
    const school = { school_name: "โรงเรียนทดสอบ", school_address: "อ.เมือง จ.ทดสอบ" };
    const t = buildTranscriptBooklet(data, school);
    expect(t).toContain("3.50");
    const r = buildReportCardBooklet(data, school, { semester: 1, academicYearBE: "2569" });
    expect(r).toContain("2/3");
    if (process.env.BK_OUT) writeFileSync(process.env.BK_OUT, `<html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet"></head><body style="width:210mm;margin:0">${t}${r}</body></html>`);
  });
});
