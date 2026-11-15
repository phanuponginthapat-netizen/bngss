// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scanTimestamp } from "../../../supabase/functions/_shared/scanTimestamp";
describe("FaceGate captured time", () => {
  const now = new Date("2026-11-15T02:00:00Z");
  it("retains yesterday's scan when uploaded today", () => {
    expect(scanTimestamp("2026-11-14T01:00:00Z", now).toISOString()).toBe("2026-11-14T01:00:00.000Z");
  });
  it("does not relabel an old pending scan as today", () => {
    expect(scanTimestamp("2026-11-01T01:00:00Z", now).toISOString()).toBe("2026-11-01T01:00:00.000Z");
  });
  it("rejects invalid captured time", () => expect(() => scanTimestamp("bad", now)).toThrow());
  it("rejects future captured time", () => expect(() => scanTimestamp("2026-11-15T03:00:00Z", now)).toThrow());
  it("preserves legacy clients without a timestamp", () => expect(scanTimestamp(undefined, now)).toEqual(now));
});