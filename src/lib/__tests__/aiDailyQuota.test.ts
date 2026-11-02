// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { bangkokDayStart, checkDailyChatQuota } from "../../../supabase/functions/_shared/aiDailyQuota";
const database = (count: number | null, error: unknown = null) => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gte: vi.fn(async () => ({ count, error })) }) }) }) }) });
describe("AI daily quota", () => {
  it("changes day at Bangkok midnight rather than UTC midnight", () => {
    expect(bangkokDayStart(new Date("2026-11-01T17:00:00Z"))).toBe("2026-11-01T17:00:00.000Z");
    expect(bangkokDayStart(new Date("2026-11-01T16:59:59Z"))).toBe("2026-10-31T17:00:00.000Z");
  });
  it("preserves the configured 30-message limit", async () => {
    expect(await checkDailyChatQuota(database(29), "u", 30)).toBe("allowed");
    expect(await checkDailyChatQuota(database(30), "u", 30)).toBe("limited");
  });
  it("does not treat unavailable quota data as unlimited", async () => {
    expect(await checkDailyChatQuota(database(null, { code: "503" }), "u", 30)).toBe("unavailable");
  });
});