// @vitest-environment node
import { describe, expect, it } from "vitest";
import { subjectBelongsToTerm } from "../subjectTermPolicy";
describe("2569 health and physical education curriculum", () => {
  it.each([
    ["ม.1", "ท21101", 1], ["ม.1", "ท21102", 2], ["ม.1", "ง21201", 1], ["ม.1", "ง21202", 2],
    ["ม.2", "ค22101", 1], ["ม.2", "ค22102", 2], ["ม.2", "ว22201", 1], ["ม.2", "ว22202", 2],
    ["ม.3", "ส23101", 1], ["ม.3", "ส23103", 2], ["ม.3", "ว23201", 1], ["ม.3", "ว23202", 2],
    ["ม.3", "ศ23205", 1], ["ม.3", "ศ23206", 2], ["ม.1", "ว21201", 1],
  ] as const)("keeps %s %s in curriculum semester %i", (grade_level, code, term) => {
    const wrong = term === 1 ? 2 : 1;
    expect(subjectBelongsToTerm({ code, grade_level, semester: wrong }, wrong, 2569)).toBe(false);
    expect(subjectBelongsToTerm({ code, grade_level, semester: term }, term, 2569)).toBe(true);
  });
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