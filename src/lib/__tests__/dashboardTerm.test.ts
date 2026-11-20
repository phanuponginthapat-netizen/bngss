// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dashboardTermDates, dashboardDateInTerm } from "../dashboardTerm";
const periods = [
  { academic_year_be:2569, semester:1, start_date:"2026-05-16", end_date:"2026-10-10" },
  { academic_year_be:2569, semester:2, start_date:"2026-11-02", end_date:"2027-03-31" },
];
describe("dashboard actual term", () => {
  it("uses term 2 registered school dates, excluding term 1", () => {
    const dates = dashboardTermDates(periods,2569,2);
    expect(dates).toEqual({start:"2026-11-02",end:"2027-03-31"});
    expect(dashboardDateInTerm("2026-11-01",dates)).toBe(false);
    expect(dashboardDateInTerm("2026-11-02",dates)).toBe(true);
    expect(dashboardDateInTerm("2026-10-10",dates)).toBe(false);
  });
  it("uses Bangkok dates for worksheet timestamps at opening boundary", () => {
    const dates = dashboardTermDates(periods,2569,2);
    expect(dashboardDateInTerm("2026-11-01T17:00:00Z",dates)).toBe(true);
    expect(dashboardDateInTerm("2026-11-01T16:59:59Z",dates)).toBe(false);
  });
  it("does not invent an unregistered term", () => {
    expect(()=>dashboardTermDates(periods,2570,2)).toThrow();
  });
});