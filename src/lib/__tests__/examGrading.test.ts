import { describe, it, expect } from "vitest";
import { gradeAnswers, answerKeyProblem, cleanStudentCode } from "@/lib/examGrading";

const key = [{ question_no: 1, correct_answer: "A" }, { question_no: 2, correct_answer: "c" }, { question_no: 3, correct_answer: "D" }];

describe("ZipGrade-style grading", () => {
  it("scores matching answers case-insensitively and counts blanks as wrong", () => {
    const r = gradeAnswers(key, { "1": "a", "2": "C", "3": null });
    expect(r).toMatchObject({ score: 2, total: 3, blank: 1, percentage: 66.67 });
    expect(r.correctMap).toEqual({ "1": true, "2": true, "3": false });
  });
  it("refuses to grade with a missing or incomplete answer key", () => {
    expect(answerKeyProblem([], 3)).not.toBeNull();
    expect(answerKeyProblem(key.slice(0, 2), 3)).not.toBeNull();
    expect(answerKeyProblem([{ question_no: 1, correct_answer: "" }], 1)).not.toBeNull();
    expect(answerKeyProblem(key, 3)).toBeNull();
  });
  it("never zero-pads a partially read student code", () => {
    expect(cleanStudentCode("253", 5)).toBeNull();
    expect(cleanStudentCode("", 5)).toBeNull();
    expect(cleanStudentCode("02531", 5)).toBe("02531");
  });
});
