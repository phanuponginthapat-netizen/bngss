// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canCreateAcademicEvent } from "../academicCalendarAccess";

describe("academic calendar creation", () => {
  it("allows any verified staff member, including non-teaching personnel", () => {
    expect(canCreateAcademicEvent(true, false)).toBe(true);
  });
  it("does not allow students, parents or unverified accounts", () => {
    expect(canCreateAcademicEvent(false, false)).toBe(false);
  });
  it("preserves observer read-only access", () => {
    expect(canCreateAcademicEvent(true, true)).toBe(false);
  });
});