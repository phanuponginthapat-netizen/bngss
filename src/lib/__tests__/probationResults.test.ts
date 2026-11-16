// @vitest-environment node
import { expect, it } from "vitest";
import { probationResults } from "../probationResults";
it("combines subject rows once using real student UUID and credit weighting", () => {
  expect(probationResults([
    { student_code: "2777", subject_id: "a", grade_point: 1 },
    { student_code: "2777", subject_id: "b", grade_point: 4 },
  ], [{ id: "student-uuid", student_code: "2777" }], [{ id: "a", credits: 2 }, { id: "b", credits: 1 }]))
    .toEqual([{ student_id: "student-uuid", student_code: "2777", gpax: 2 }]);
});
it("does not fabricate GPA when subject credits are unavailable", () => {
  expect(() => probationResults([{ student_code: "2777", subject_id: "missing", grade_point: 1 }],
    [{ id: "student-uuid", student_code: "2777" }], [])).toThrow();
});