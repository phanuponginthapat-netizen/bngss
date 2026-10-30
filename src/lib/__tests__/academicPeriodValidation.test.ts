import { describe, expect, it } from "vitest";
import { validateTermDates } from "../academicPeriodValidation";
const terms = [{ semester: 1, start_date: "2026-05-16", end_date: "2026-10-10" }, { semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" }];
describe("admin term date validation", () => {
  it("accepts the school's 2 November opening", () => expect(validateTermDates(terms)).toBeNull());
  it("rejects closing before opening", () => expect(validateTermDates([terms[0], { ...terms[1], end_date: "2026-11-01" }])).not.toBeNull());
  it("rejects overlapping semesters", () => expect(validateTermDates([terms[0], { ...terms[1], start_date: "2026-10-10" }])).not.toBeNull());
  it("requires both semesters and complete dates", () => { expect(validateTermDates([terms[0]])).not.toBeNull(); expect(validateTermDates([terms[0], { ...terms[1], start_date: "" }])).not.toBeNull(); });
});