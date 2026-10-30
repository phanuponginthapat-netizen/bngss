// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ day: "2026-11-01", semester: 1, fail: false }));
vi.mock("@/lib/dateBE", () => ({ BE_OFFSET: 543, todayBangkok: () => state.day }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.fail ? null : { academic_year_be: 2569, semester: state.semester }, error: state.fail ? new Error("offline") : null }) }) }) }) } }));
beforeEach(() => { vi.resetModules(); state.day = "2026-11-01"; state.semester = 1; state.fail = false; });
describe("import current period refresh", () => {
  it("does not keep semester 1 cached when 2 November starts", async () => {
    const { getCurrentPeriod } = await import("../ppImportChecks");
    expect(await getCurrentPeriod()).toEqual({ year: 2569, semester: 1 });
    state.day = "2026-11-02"; state.semester = 2;
    expect(await getCurrentPeriod()).toEqual({ year: 2569, semester: 2 });
  });
  it("does not cache a failed lookup or guess a missing semester", async () => {
    const { getCurrentPeriod } = await import("../ppImportChecks");
    state.fail = true;
    expect(await getCurrentPeriod()).toEqual({ year: 2569 });
    state.fail = false; state.semester = 2;
    expect(await getCurrentPeriod()).toEqual({ year: 2569, semester: 2 });
  });
});