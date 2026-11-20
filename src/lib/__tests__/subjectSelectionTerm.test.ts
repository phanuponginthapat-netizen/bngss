// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assignmentInSelectionTerm, remediationSelectionTerms, subjectInSelectionTerm } from "../subjectSelectionTerm";
describe("subject options follow the requested term", () => {
  const term = { academicYear: 2569, semester: 2 };
  it("shows term 2 subjects but not term 1 subjects", () => {
    expect(subjectInSelectionTerm({ semester: 1, academic_year: 2026 }, term)).toBe(false);
    expect(subjectInSelectionTerm({ semester: 2, academic_year: 2026 }, term)).toBe(true);
  });
  it("rejects other academic years while accepting CE and BE for the same year", () => {
    expect(subjectInSelectionTerm({ semester: 2, academic_year: 2568 }, term)).toBe(false);
    expect(subjectInSelectionTerm({ semester: 2, academic_year: 2569 }, term)).toBe(true);
  });
  it("rejects old or unscoped assignments even if their subject is reusable", () => {
    expect(assignmentInSelectionTerm({ subjects: {}, academic_year: 2026, semester: 1 }, term)).toBe(false);
    expect(assignmentInSelectionTerm({ subjects: {}, academic_year: 2026, semester: 2 }, term)).toBe(true);
    expect(assignmentInSelectionTerm({ subjects: {} }, term)).toBe(false);
  });
  it("keeps declared shared annual catalog subjects available", () => {
    expect(subjectInSelectionTerm({ semester: null, academic_year: null }, term)).toBe(true);
  });
  it("allows current and previous semester for remediation in semester 2", () => {
    expect(remediationSelectionTerms(term)).toEqual([{ academicYear: 2569, semester: 2 }, { academicYear: 2569, semester: 1 }]);
  });
  it("rolls remediation previous semester back to the prior academic year", () => {
    expect(remediationSelectionTerms({ academicYear: 2569, semester: 1 })).toEqual([{ academicYear: 2569, semester: 1 }, { academicYear: 2568, semester: 2 }]);
  });
});