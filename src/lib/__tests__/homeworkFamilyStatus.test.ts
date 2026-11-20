// @vitest-environment node
import { describe, expect, it } from "vitest";
import { familyHomeworkScore, familyHomeworkStatus, matchesFamilyHomework } from "../homeworkFamilyStatus";

describe("student and parent homework status", () => {
  it("keeps submitted and graded homework in all history", () => {
    expect(matchesFamilyHomework("all", { status: "submitted" })).toBe(true);
    expect(matchesFamilyHomework("all", { status: "graded", grade: 8 })).toBe(true);
  });
  it("distinguishes drafts and missing work from confirmed submissions", () => {
    expect(familyHomeworkStatus(null)).toBe("not_submitted");
    expect(familyHomeworkStatus({ status: "draft" })).toBe("not_submitted");
    expect(matchesFamilyHomework("submitted", { status: "submitted" })).toBe(true);
    expect(matchesFamilyHomework("submitted", { status: "draft" })).toBe(false);
  });
  it("keeps returned work in history without labelling it unsent", () => {
    expect(familyHomeworkStatus({ status: "needs_revision" })).toBe("needs_revision");
    expect(matchesFamilyHomework("not_submitted", { status: "needs_revision" })).toBe(false);
  });
  it("shows teacher final score including zero and task grades, never pending scores", () => {
    expect(familyHomeworkScore({ status: "graded", final_score: 0, score: 9 })).toBe(0);
    expect(familyHomeworkScore({ status: "graded", grade: 8 })).toBe(8);
    expect(familyHomeworkScore({ status: "submitted", score: 9 })).toBeNull();
  });
});