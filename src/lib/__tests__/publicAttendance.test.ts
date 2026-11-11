// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aggregatePublicAttendance } from "../../../supabase/functions/_shared/publicAttendance";

describe("public school attendance", () => {
  const compute = (dates: string[], rows: any[] = [], scans: any[] = [], clock = "10:00:00") => aggregatePublicAttendance(["s1", "s2"], dates, rows, scans, "2026-11-11", clock, "08:30", "09:00");
  it("counts each student once per day and preserves school evidence", () => {
    const result = compute(["2026-11-11"], [{ student_id: "s1", status: "absent", attendance_date: "2026-11-11" }], [{ student_id: "s1", scan_date: "2026-11-11", scan_type: "entry", scan_time: "2026-11-11T01:00:00Z" }, { student_id: "s1", scan_date: "2026-11-11", scan_type: "entry", scan_time: "2026-11-11T02:00:00Z" }]);
    expect(result[0]).toMatchObject({ present: 1, absent: 1, total: 2 });
  });
  it("does not fabricate absence on days without evidence", () => {
    expect(compute(["2026-11-10"])[0]).toMatchObject({ absent: 0, unrecorded: 2, evidence: false });
  });
  it("keeps missing students unrecorded before check-in closes", () => {
    expect(compute(["2026-11-11"], [{ student_id: "s1", status: "present", attendance_date: "2026-11-11" }], [], "08:59:00")[0]).toMatchObject({ present: 1, unrecorded: 1, absent: 0 });
  });
  it("separates daily results for month and term totals", () => {
    const rows = [{ student_id: "s1", status: "late", attendance_date: "2026-11-10" }, { student_id: "s2", status: "sick", attendance_date: "2026-11-11" }];
    expect(compute(["2026-11-10", "2026-11-11"], rows).map(r => [r.late, r.leave, r.absent])).toEqual([[1, 0, 1], [0, 1, 1]]);
  });
  it("ignores evidence outside the active roster", () => {
    expect(compute(["2026-11-11"], [{ student_id: "old", status: "present", attendance_date: "2026-11-11" }])[0]).toMatchObject({ evidence: false, absent: 0, unrecorded: 2 });
  });
});