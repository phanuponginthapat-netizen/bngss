// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scanQueryAffected } from "../scanRealtime";
describe("shared scan receipt refresh", () => {
  it("refreshes the school homepage, teacher card and FaceGate reports", () => {
    for (const key of ["public-school-attendance","teacher_school_attendance","homeroom_dashboard","face-logs-range","face-chart","face-report-accurate","spider_attend","dashboard_stats_v3","director_dashboard_stats","student_dashboard","teacher_daily_briefing","subject_dashboard"])
      expect(scanQueryAffected([key])).toBe(true);
  });
  it("does not reload unrelated scores or personal templates", () => {
    expect(scanQueryAffected(["student_scores"])).toBe(false);
    expect(scanQueryAffected(["work-report-templates"])).toBe(false);
  });
});