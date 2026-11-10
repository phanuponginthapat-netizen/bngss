import { describe, expect, it } from "vitest";
import { canUseSchoolTool, isSchoolTool } from "../../../supabase/functions/ai-school-tools/policy";
describe("school tool access preserves existing role visibility", () => {
  it("allows teacher documents but not student documents", () => {
    expect(canUseSchoolTool("worksheet", ["teacher"])).toBe(true);
    expect(canUseSchoolTool("lesson", ["student"])).toBe(false);
  });
  it("allows student practice quizzes but not parent quiz generation", () => {
    expect(canUseSchoolTool("quiz", ["student"])).toBe(true);
    expect(canUseSchoolTool("quiz", ["parent"])).toBe(false);
  });
  it("allows pasted grade summaries without granting data access", () => {
    expect(canUseSchoolTool("grades", ["parent"])).toBe(true);
  });
  it("rejects unknown tools including prototype keys", () => {
    expect(isSchoolTool("video")).toBe(false);
    expect(isSchoolTool("constructor")).toBe(false);
    expect(isSchoolTool("worksheet")).toBe(true);
  });
});