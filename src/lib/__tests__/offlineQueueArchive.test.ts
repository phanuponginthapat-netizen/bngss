import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
import { archiveFailedItem } from "../offlineQueue";
const item = { id: "synthetic", table: "face_scan_logs", op: "insert" as const, payload: { student_id: "synthetic" }, createdAt: 0, attempts: 11 };
describe("failed scan preservation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("retains the local scan when Cloud rejects the archive", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "42501" } });
    expect(await archiveFailedItem(item, "failed")).toBe(false);
  });
  it("retains the local scan when the connection fails", async () => {
    mocks.insert.mockRejectedValue(new Error("network"));
    expect(await archiveFailedItem(item, "failed")).toBe(false);
  });
  it("allows removing the local scan only after archive confirmation", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    expect(await archiveFailedItem(item, "failed")).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ queue_name: "face_scan_logs", attempts: 11, payload: item }));
  });
});