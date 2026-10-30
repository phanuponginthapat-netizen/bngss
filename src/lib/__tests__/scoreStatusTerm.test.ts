import { describe, expect, it } from "vitest";
import { matchesAcademicTerm } from "../scoreStatusTerm";

describe("score status term isolation", () => {
  it("accepts only the selected semester 2 of year 2569/2026", () => {
    expect(matchesAcademicTerm({ academic_year: 2026, semester: 2 }, 2569, 2)).toBe(true);
    expect(matchesAcademicTerm({ academic_year: 2569, semester: 2 }, 2569, 2)).toBe(true);
    expect(matchesAcademicTerm({ academic_year: 2026, semester: 1 }, 2569, 2)).toBe(false);
    expect(matchesAcademicTerm({ academic_year: 2025, semester: 2 }, 2569, 2)).toBe(false);
  });
  it("does not assume missing year or semester belongs to the selected term", () => {
    expect(matchesAcademicTerm({ academic_year: 2026, semester: null }, 2569, 2)).toBe(false);
    expect(matchesAcademicTerm({ academic_year: null, semester: 2 }, 2569, 2)).toBe(false);
    expect(matchesAcademicTerm({}, 2569, 2)).toBe(false);
  });
});