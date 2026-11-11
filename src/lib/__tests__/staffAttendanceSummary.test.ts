// @vitest-environment node
import { describe, expect, it } from "vitest";
import { staffAttendanceSummary, staffPercentage, staffReportDates } from "../staffAttendanceSummary";
describe("staff attendance truth", () => {
  const ids = Array.from({length:24}, (_,i)=>`p${i}`);
  const rows = ids.slice(0,8).map(personnel_id=>({personnel_id,clock_date:"2026-11-11",status:"normal",clock_in:"2026-11-11T00:30:00Z"}));
  it("8 of 24 entries is 33.3%, with 16 unrecorded", () => {
    const {totals} = staffAttendanceSummary(ids,["2026-11-11"],rows);
    expect(totals).toMatchObject({total:24,normal:8,unrecorded:16});
    expect(staffPercentage(totals.normal,totals.total)).toBe(33.3);
  });
  it("never counts duplicate clock rows twice", () => expect(staffAttendanceSummary(ids,["2026-11-11"],[...rows,...rows]).totals.normal).toBe(8));
  it("empty data stays unrecorded, not absent or 100%", () => expect(staffAttendanceSummary(ids,["2026-11-11"],[]).totals).toMatchObject({normal:0,absent:0,unrecorded:24}));
  it("normal status without clock-in evidence is not attending", () => expect(staffAttendanceSummary(["p0"],["2026-11-11"],[{...rows[0],clock_in:null}]).totals.normal).toBe(0));
  it("keeps leave and official statuses separate from attendance", () => expect(staffAttendanceSummary(["p0","p1"],["2026-11-11"],[{...rows[0],status:"leave",clock_in:null},{...rows[1],status:"official",clock_in:null}]).totals).toMatchObject({normal:0,leave:1,official:1}));
  it("uses all roster days for period percentages", () => expect(staffAttendanceSummary(ids,["2026-11-10","2026-11-11"],rows).totals).toMatchObject({total:48,normal:8,unrecorded:40}));
  it("excludes weekends, announced holidays and future dates", () => expect(staffReportDates("2026-10-23","2026-10-28","2026-10-27",[])).toEqual(["2026-10-26","2026-10-27"]));
  it("excludes school holidays", () => expect(staffReportDates("2026-11-10","2026-11-11","2026-11-11",[{event_date:"2026-11-10",end_date:null}])).toEqual(["2026-11-11"]));
});