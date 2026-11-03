// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readDigestRows, resolveDigestStatuses } from "../../../supabase/functions/_shared/attendanceDigest";

describe("LINE attendance evidence", () => {
  it("rescues a scanned student from an absent record", () => {
    const statuses = resolveDigestStatuses([{ student_id: "s1", status: "absent" }], [{ student_id: "s1", scan_time: "2026-11-03T00:50:00Z", scan_type: "entry" }], "08:00");
    expect(statuses.get("s1")).toBe("present");
  });
  it("does not invent an absence for a student without evidence", () => {
    expect(resolveDigestStatuses([], [], "08:00").get("s1") ?? "unrecorded").toBe("unrecorded");
  });
  it("preserves saved late attendance despite an earlier scan", () => {
    expect(resolveDigestStatuses([{ student_id: "s1", status: "late" }], [{ student_id: "s1", scan_time: "2026-11-03T00:50:00Z", scan_type: "entry" }], "08:00").get("s1")).toBe("late");
  });
  it("uses the configured threshold and earliest entry, ignoring exits", () => {
    const scans = [
      { student_id: "on-time", scan_time: "2026-11-03T01:00:00Z", scan_type: "entry" },
      { student_id: "on-time", scan_time: "2026-11-03T01:30:00Z", scan_type: "assembly" },
      { student_id: "late", scan_time: "2026-11-03T01:00:01Z", scan_type: "entry" },
      { student_id: "exit-only", scan_time: "2026-11-03T00:00:00Z", scan_type: "exit" },
    ];
    const statuses = resolveDigestStatuses([], scans, "08:00");
    expect(statuses.get("on-time")).toBe("present");
    expect(statuses.get("late")).toBe("late");
    expect(statuses.has("exit-only")).toBe(false);
  });
  it("fails rather than returning partial scan data", async () => {
    await expect(readDigestRows(async (start) => start === 0 ? { data: Array(500).fill({ id: 1 }), error: null } : { data: null, error: new Error("scan unavailable") })).rejects.toThrow("scan unavailable");
  });
  it("rejects missing scan times instead of inventing the current time", () => {
    expect(() => resolveDigestStatuses([], [{ student_id: "s1", scan_time: null, scan_type: "entry" }], "08:00")).toThrow("Invalid entry scan timestamp");
  });
});