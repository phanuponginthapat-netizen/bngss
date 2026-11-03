import { describe, it, expect } from "vitest";
import { getModuleKeyForPath } from "./moduleRegistry";

describe("module toggles cover pages", () => {
  it("ignores query strings so face-scan staff tab is still toggleable", () => {
    expect(getModuleKeyForPath("/dashboard/student/face-scan?tab=staff")).toBe("face_scan");
  });
  it("covers score status and grade lock pages", () => {
    expect(getModuleKeyForPath("/dashboard/academic/score-status")).toBe("score_status");
    expect(getModuleKeyForPath("/dashboard/academic/grade-lock")).toBe("grade_lock");
  });
  it("keeps DMC student records as a core page that cannot be disabled", () => {
    expect(getModuleKeyForPath("/dashboard/academic/all-students")).toBeNull();
  });
});
