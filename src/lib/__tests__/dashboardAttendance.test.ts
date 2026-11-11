// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { attendanceRate } from "../dashboardAttendance";
const day = { date: "2026-11-11", total: 168, present: 157, late: 0, absent: 11, leave: 0, unrecorded: 0, evidence: true };
describe("school dashboard attendance denominator", () => {
  it("157 of 168 students is 93.5%, not 100% of recorded entries", () => expect(attendanceRate(day)).toBe(93.5));
  it("counts late arrivals as attending", () => expect(attendanceRate({ ...day, present: 156, late: 1 })).toBe(93.5));
  it("shows 100% only when all 168 students attended", () => expect(attendanceRate({ ...day, present: 168, absent: 0 })).toBe(100));
  it("does not report success or absence percentages without evidence", () => expect(attendanceRate({ ...day, present: 0, evidence: false })).toBeNull());
});