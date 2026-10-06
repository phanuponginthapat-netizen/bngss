import { describe, it, expect } from "vitest";
import { remediatedGrade } from "../gradeRemediation";
describe("remediatedGrade", () => {
  it("caps at 1", () => { expect(remediatedGrade("0", 4)).toBe("1"); expect(remediatedGrade("ร", 2.5)).toBe("1"); });
  it("still fails", () => { expect(remediatedGrade("มส", 0)).toBe("0"); expect(remediatedGrade("0", null)).toBeNull(); });
  it("activity", () => { expect(remediatedGrade("มผ", 1)).toBe("ผ"); });
});
