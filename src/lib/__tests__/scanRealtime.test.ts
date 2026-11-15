// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scanQueryAffected } from "../scanRealtime";
import {followReportDate} from "../followReportDate";
describe("shared scan receipt refresh", () => {
  it("refreshes the school homepage, teacher card and FaceGate reports", () => {
    for (const key of ["public-school-attendance","teacher_school_attendance","homeroom_dashboard","face-logs-range","face-chart","face-report-accurate","spider_attend","dashboard_stats_v3","director_dashboard_stats","student_dashboard","teacher_daily_briefing","subject_dashboard"])
      expect(scanQueryAffected([key])).toBe(true);
  });
  it("does not reload unrelated scores or personal templates", () => {
    expect(scanQueryAffected(["student_scores"])).toBe(false);
    expect(scanQueryAffected(["work-report-templates"])).toBe(false);
  });
  it("follows Bangkok midnight only when the selected date was today",()=>{
    expect(followReportDate("2026-11-15","2026-11-15","2026-11-16")).toBe("2026-11-16");
    expect(followReportDate("2026-11-14","2026-11-15","2026-11-16")).toBe("2026-11-14");
  });
});