// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc } }));
import { readMonitorEvent, sendMonitorEvent } from "../monitorSignal";
describe("verified monitor events", () => {
  beforeEach(() => h.rpc.mockReset());
  it("ignores caller-supplied commands without a server receipt", async () => {
    expect(await readMonitorEvent({ type: "command", from: "teacher", to: "*", action: "shutdown" })).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("does not broadcast when the server denies authorization", async () => {
    h.rpc.mockResolvedValue({ error: new Error("Forbidden"), data: null });
    const send = vi.fn();
    await expect(sendMonitorEvent({ send } as any, { type: "command", from: "fake", to: "*", action: "lock" })).rejects.toThrow("Forbidden");
    expect(send).not.toHaveBeenCalled();
  });
  it("sends only the server receipt and rejects failed delivery", async () => {
    h.rpc.mockResolvedValue({ error: null, data: "receipt-id" });
    const send = vi.fn().mockResolvedValue("timed out");
    await expect(sendMonitorEvent({ send } as any, { type: "command", from: "u", to: "*", action: "lock" })).rejects.toThrow("ส่งคำสั่งไม่สำเร็จ");
    expect(send).toHaveBeenCalledWith({ type: "broadcast", event: "monitor", payload: { receipt: "receipt-id" } });
  });
});