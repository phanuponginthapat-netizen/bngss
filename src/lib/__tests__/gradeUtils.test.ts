import { describe, it, expect } from "vitest";
import { calculateGrade, calculateGPA } from "../gradeUtils";
describe("gradeUtils", () => {
  it("ตัดเกรด 8 ระดับ", () => {
    expect(calculateGrade(80).grade).toBe("4");
    expect(calculateGrade(79.5).grade).toBe("4");
    expect(calculateGrade(49).grade).toBe("0");
    expect(calculateGrade(NaN).grade).toBe("0");
  });
  it("GPA ไม่ปัดเศษ และข้าม ร/มส", () => {
    expect(calculateGPA([{ gradePoint: 4, credits: 1 }, { gradePoint: 3.5, credits: 1 }, { gradePoint: 3.5, credits: 1 }])).toBe(3.66);
    expect(calculateGPA([{ gradePoint: 4, credits: 1 }, { gradePoint: null, credits: 1 }])).toBe(4);
  });
});
