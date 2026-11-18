// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradeField, hasWorksheetAnswer } from "../worksheetGrading";
import type { WorksheetField } from "../pdfWorksheet";
const base: WorksheetField = { id: "q", type: "text", page: 1, x: 0, y: 0, w: 30, h: 10, score: 2 };
describe("interactive worksheet answers", () => {
  it("grades dropdown option zero only when deliberately answered", () => {
    const f = { ...base, type: "select" as const, options: ["ก", "ข"], correct: 0 };
    expect(gradeField(f, "").score).toBe(0); expect(gradeField(f, 0).score).toBe(2);
  });
  it("requires the exact multiple-choice set without extra selections", () => {
    const f = { ...base, type: "multiselect" as const, options: ["ก", "ข", "ค"], correct: [0, 2] };
    expect(gradeField(f, [2, 0]).score).toBe(2); expect(gradeField(f, [0, 1, 2]).score).toBe(0);
  });
  it("checks every matching pair", () => {
    const f = { ...base, type: "match" as const, pairs: [{ left: "1", right: "one" }, { left: "2", right: "two" }] };
    expect(gradeField(f, [0, 1]).score).toBe(2); expect(gradeField(f, [1, 0]).score).toBe(0);
    expect(hasWorksheetAnswer(f, [0, null])).toBe(false);
  });
  it("accepts only the original correct ordering", () => {
    const f = { ...base, type: "order" as const, options: ["first", "second", "third"] };
    expect(gradeField(f, [0, 1, 2]).score).toBe(2); expect(gradeField(f, [2, 1, 0]).score).toBe(0);
  });
  it("checks numeric tolerance without converting blank answers to zero", () => {
    const f = { ...base, type: "number" as const, correct: 10, tolerance: .5 };
    expect(gradeField(f, 10.5).score).toBe(2); expect(gradeField(f, 10.6).score).toBe(0); expect(gradeField(f, "").score).toBe(0);
  });
  it("recognizes deliberately false checkboxes and zero numbers as answers", () => {
    expect(hasWorksheetAnswer({ ...base, type: "checkbox" }, false)).toBe(true);
    expect(hasWorksheetAnswer({ ...base, type: "number" }, 0)).toBe(true);
  });
});