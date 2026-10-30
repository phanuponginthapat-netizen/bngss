import { describe, expect, it } from "vitest";
import { MAX_GAP_DAYS, resolveAcademicPeriod } from "../academicPeriod";

// Term rows as registered for the school (CE dates, Bangkok calendar).
const SCHOOL_PERIODS = [
  { academic_year_be: 2569, semester: 1, start_date: "2026-05-16", end_date: "2026-10-10" },
  { academic_year_be: 2569, semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" },
];

describe("resolveAcademicPeriod", () => {
  it("inside semester 1 returns semester 1", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2026-10-10")).toEqual({
      yearBE: 2569,
      semester: 1,
      basis: "in-period",
    });
  });

  it("the day before the opening day (1 Nov 2026) is still semester 1", () => {
    const got = resolveAcademicPeriod(SCHOOL_PERIODS, "2026-11-01");
    expect(got?.semester).toBe(1);
    expect(got?.basis).toBe("recent-past");
  });

  it("the opening day (2 Nov 2026) is semester 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2026-11-02")).toEqual({
      yearBE: 2569,
      semester: 2,
      basis: "in-period",
    });
  });

  it("a date deep inside semester 2 returns semester 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2027-02-01")).toEqual({
      yearBE: 2569,
      semester: 2,
      basis: "in-period",
    });
  });

  it("the closing day (31 Mar 2027) is still semester 2", () => {
    expect(resolveAcademicPeriod(SCHOOL_PERIODS, "2027-03-31")).toEqual({
      yearBE: 2569,
      semester: 2,
      basis: "in-period",
    });
  });

  it("shortly after the closing day keeps semester 2", () => {
    const got = resolveAcademicPeriod(SCHOOL_PERIODS, "2027-04-20");
    expect(got?.semester).toBe(2);
    expect(got?.basis).toBe("recent-past");
  });

  it("a long gap with no matching term returns null", () => {
    const stale = [{ academic_year_be: 2567, semester: 1, start_date: "2024-05-16", end_date: "2024-10-10" }];
    expect(resolveAcademicPeriod(stale, "2026-11-02")).toBeNull();
  });

  it("no registered term returns null", () => {
    expect(resolveAcademicPeriod([], "2026-11-02")).toBeNull();
  });

  it("rows that are not semester 1 or 2 are ignored", () => {
    const rows = [{ academic_year_be: 2569, semester: 3, start_date: "2026-11-02", end_date: "2027-03-31" }];
    expect(resolveAcademicPeriod(rows, "2026-11-02")).toBeNull();
  });

  it("exposes the gap that is still treated as the last term", () => {
    expect(MAX_GAP_DAYS).toBe(180);
  });
});
