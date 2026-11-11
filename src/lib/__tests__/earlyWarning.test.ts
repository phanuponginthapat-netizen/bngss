// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ fail: false, reads: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const q: any = { select: (cols: string) => { h.reads.push(`${table}:${cols}`); return q; }, eq: () => q, is: () => q, gte: () => q, lte: () => q, order: () => q, limit: () => q, in: () => q, neq: () => q, range: () => q,
    maybeSingle: () => q, then: (resolve: any) => resolve({ error: h.fail && table === "attendance" ? new Error("attendance unavailable") : null, data: table === "students" ? { id: "s", student_code: "2845", first_name: "Test" } : table === "academic_probation" || table === "sdq_records" ? null : [] }) };
  return q;
} } }));
import { calculateRisk } from "../earlyWarning";
describe("risk read integrity", () => {
  beforeEach(() => { h.fail = false; h.reads.length = 0; });
  it("rejects failed evidence instead of classifying the student as normal", async () => {
    h.fail = true;
    await expect(calculateRisk("s")).rejects.toThrow("attendance unavailable");
  });
  it("reads saved GPAX from probation rather than nonexistent score identity and GPAX columns", async () => {
    const result = await calculateRisk("s");
    expect(result.details.gpa).toBeNull();
    expect(h.reads.some(x => x.startsWith("student_scores:"))).toBe(false);
    expect(h.reads).toContain("academic_probation:gpax");
  });
});