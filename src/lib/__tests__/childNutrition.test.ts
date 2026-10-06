import { describe, it, expect } from "vitest";
import { classifyChildBmi } from "../childNutrition";
describe("classifyChildBmi", () => {
  it("10y boy", () => {
    expect(classifyChildBmi(12, 10, false)).toBe("ผอม");
    expect(classifyChildBmi(16, 10, false)).toBe("สมส่วน");
    expect(classifyChildBmi(20, 10, false)).toBe("ท้วม");
    expect(classifyChildBmi(23, 10, false)).toBe("อ้วน");
  });
  it("out of range", () => { expect(classifyChildBmi(20, 30, true)).toBeNull(); });
});
