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

import { parseAnswerKeyText, reviewReasons, analyzeExam, scaleScore, evanaText } from "@/lib/examGrading";

describe("exam workflow extras", () => {
  it("parses Thai, numeric and Latin answer-key strings", () => {
    expect(parseAnswerKeyText("กขคง")).toEqual(["A", "B", "C", "D"]);
    expect(parseAnswerKeyText("1 2 - 4")).toEqual(["A", "B", null, "D"]);
    expect(parseAnswerKeyText("1.ก 2.ค")).toEqual(["A", "C"]);
  });
  it("free items score for everyone and excluded items leave the total", () => {
    const k = [{ question_no: 1, correct_answer: "A" }, { question_no: 2, correct_answer: null, scoring_mode: "free" }, { question_no: 3, correct_answer: "B", scoring_mode: "excluded" }];
    expect(gradeAnswers(k, { "1": "A", "2": null, "3": "B" })).toMatchObject({ score: 2, total: 2 });
    expect(answerKeyProblem(k, 3)).toBeNull();
  });
  it("flags missing codes, unknown students and duplicates for review", () => {
    expect(reviewReasons({ studentCode: null, studentFound: false, duplicate: false, blank: 0, total: 10 })).toContain("อ่านรหัสนักเรียนไม่ครบ");
    expect(reviewReasons({ studentCode: "12345", studentFound: true, duplicate: true, blank: 0, total: 10 })).toEqual(["สแกนซ้ำรหัสเดิม"]);
    expect(reviewReasons({ studentCode: "12345", studentFound: true, duplicate: false, blank: 0, total: 10 })).toEqual([]);
  });
  it("computes difficulty and discrimination from high/low groups", () => {
    const k = [{ question_no: 1, correct_answer: "A" }, { question_no: 2, correct_answer: "B" }];
    const subs = [{ answers: { "1": "A", "2": "B" } }, { answers: { "1": "A", "2": "B" } }, { answers: { "1": "C", "2": "B" } }, { answers: { "1": "C", "2": "C" } }];
    const a = analyzeExam(k, subs, 0.5);
    expect(a.groupSize).toBe(2);
    expect(a.items[0]).toMatchObject({ p: 0.5, r: 1 });
    expect(a.mean).toBe(1.25);
  });
  it("scales exam score into a gradebook column", () => {
    expect(scaleScore(30, 40, 20)).toBe(15);
    expect(scaleScore(5, 0, 20)).toBe(0);
  });
  it("writes EVANA lines with 1-4 and 0 for blanks", () => {
    expect(evanaText([{ question_no: 1, correct_answer: "B" }], [{ code: "123", answers: {} }])).toBe("KEY 2\r\n123 0\r\n");
  });
});
