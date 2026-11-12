// @vitest-environment node
import { describe, expect, it } from "vitest";
import { subjectBelongsToTerm } from "../subjectTermPolicy";
describe("2569 health and physical education curriculum", () => {
  it.each([["ม.1", "พ21101", "พ21102"], ["ม.2", "พ22101", "พ22102"], ["ม.3", "พ23101", "พ23102"]])("keeps %s courses in their curriculum semester", (grade_level, first, second) => {
    expect(subjectBelongsToTerm({ code: second, grade_level, semester: 1 }, 1, 2026)).toBe(false);
    expect(subjectBelongsToTerm({ code: first, grade_level, semester: 1 }, 1, 2026)).toBe(true);
    expect(subjectBelongsToTerm({ code: second, grade_level, semester: 2 }, 2, 2026)).toBe(true);
    expect(subjectBelongsToTerm({ code: first, grade_level, semester: 2 }, 2, 2026)).toBe(false);
  });
  it("does not exclude primary annual health education", () => {
    expect(subjectBelongsToTerm({ code: "พ12101", grade_level: "ป.2", semester: 1 }, 1, 2026)).toBe(true);
    expect(subjectBelongsToTerm({ code: "พ12101", grade_level: "ป.2", semester: 2 }, 2, 2026)).toBe(true);
  });
});