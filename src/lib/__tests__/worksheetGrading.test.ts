// @vitest-environment node
import { describe, expect, it } from "vitest";
import { gradeField, isWorksheetGradable } from "../worksheetGrading";
import type { WorksheetField } from "../pdfWorksheet";

const field: WorksheetField = { id: "question", type: "mc", page: 1, x: 0, y: 0, w: 25, h: 10, correct: 0, score: 2, options: ["A", "B"] };
describe("worksheet grading", () => {
  it("does not grade an unanswered choice as option zero", () => {
    for (const answer of [null, undefined, "", " "]) expect(gradeField(field, answer)).toEqual({ correct: false, score: 0 });
  });
  it("accepts deliberately selected option zero", () => {
    expect(gradeField(field, 0)).toEqual({ correct: true, score: 2 });
    expect(gradeField(field, 1)).toEqual({ correct: false, score: 0 });
  });
  it("rejects choices outside the available options", () => {
    expect(gradeField({ ...field, correct: 3 }, 3)).toEqual({ correct: false, score: 0 });
  });
  it("does not count audio or drawing as automatic score", () => {
    expect(isWorksheetGradable({ ...field, type: "audio" })).toBe(false);
    expect(isWorksheetGradable({ ...field, type: "draw" })).toBe(false);
  });
  it("keeps alternative text answers and default score", () => {
    expect(gradeField({ ...field, type: "text", correct: "yes|ใช่", score: undefined }, " YES ")).toEqual({ correct: true, score: 1 });
    expect(gradeField({ ...field, type: "text", correct: "yes|" }, "")).toEqual({ correct: false, score: 0 });
  });
});