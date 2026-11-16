// @vitest-environment node
import { expect, it } from "vitest";
import { mapWarehouseFacts } from "../../../supabase/functions/bigdata-warehouse-cron/mapFacts";
it("preserves stored totals and student-code term keys without recalculation", () => {
  const result = mapWarehouseFacts([], [{ id: "score", student_code: "2777", subject_id: "subject", total_score: 79,
    grade: "3", grade_point: 3, academic_year: 2026, semester: 1 }], [], "now");
  expect(result.grades[0]).toMatchObject({ student_code: "2777", total_score: 79, grade: "3", academic_year: 2026, semester: 1 });
  expect(result.grades[0]).not.toHaveProperty("student_id");
});
it("rejects missing academic terms instead of inventing a current term", () => {
  expect(() => mapWarehouseFacts([], [{ student_code: "2777", subject_id: "subject", academic_year: 2026 }], [], "now")).toThrow();
});
it("keeps scan direction and method without inferring attendance status", () => {
  const row = mapWarehouseFacts([{ id: "scan", scan_type: "out", entry_method: "qr" }], [], [], "now").attendance[0];
  expect(row).toMatchObject({ scan_type: "out", entry_method: "qr" });
  expect(row).not.toHaveProperty("status");
});