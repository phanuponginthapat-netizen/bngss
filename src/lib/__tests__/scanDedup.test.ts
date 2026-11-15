// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: mocks.query }) }) }) } }));
vi.mock("@/lib/serverClock", () => ({ serverTodayBangkok: () => "2026-11-02", serverNow: () => new Date("2026-11-02T01:00:00Z") }));
import { checkTodayScan, clearScanDedupCache, markScanned } from "../scanDedup";
describe("shared face and QR duplicate check", () => {
  beforeEach(() => { clearScanDedupCache(); vi.clearAllMocks(); });
  it("does not treat a failed lookup as an unscanned student", async () => {
    mocks.query.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(checkTodayScan("synthetic")).rejects.toThrow();
  });
  it("does not trust a cached state when a forced check fails", async () => {
    markScanned("synthetic", "entry", "qr");
    mocks.query.mockResolvedValue({ data: null, error: { code: "503" } });
    await expect(checkTodayScan("synthetic", true)).rejects.toThrow();
  });
  it("does not mark yesterday’s uploaded scan as scanned today", async () => {
    markScanned("synthetic", "entry", "face", "2026-11-01T01:00:00Z");
    mocks.query.mockResolvedValue({data:[],error:null});
    expect(await checkTodayScan("synthetic")).toMatchObject({entry:false,exit:false});
    expect(mocks.query).toHaveBeenCalled();
  });
  it("detects a QR entry for the shared face scan path", async () => {
    mocks.query.mockResolvedValue({ data: [{ scan_type: "entry", entry_method: "qr", scan_time: "2026-11-02T01:00:00Z" }], error: null });
    expect(await checkTodayScan("synthetic")).toMatchObject({ entry: true, exit: false, entryMethod: "qr" });
  });
});