// @vitest-environment node
import { describe, expect, it } from "vitest";
import { priorityTasks, safeTaskPath, taskLoginUrl } from "../navigation/taskEntry";
describe("task entry", () => {
  it("keeps the requested school task after sign in", () => {
    expect(taskLoginUrl("/dashboard/academic/schedule?semester=2")).toBe("/login?next=%2Fdashboard%2Facademic%2Fschedule%3Fsemester%3D2");
  });
  it("rejects external redirects", () => {
    for (const path of ["https://example.com", "//example.com", "/\\example.com"]) expect(safeTaskPath(path)).toBe("/dashboard");
  });
  it("keeps teacher tasks within existing access", () => {
    const paths = priorityTasks("teacher", "th", () => true).map(i => i.url);
    expect(paths).toContain("/dashboard/academic/schedule");
    expect(paths).not.toContain("/dashboard/admin/school-settings");
  });
  it("honors disabled homework and unresolved roles", () => {
    expect(priorityTasks("student", "th", key => key !== "homework").map(i => i.url)).not.toContain("/dashboard/homework");
    expect(priorityTasks(null, "th", () => true)).toEqual([]);
  });
});