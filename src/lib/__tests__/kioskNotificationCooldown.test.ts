// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { claimKioskNotification, releaseKioskNotification } from "../../../supabase/functions/_shared/kioskNotificationCooldown";

describe("kiosk notification frequency", () => {
  it("claims unknown-face alerts per device for 10 minutes regardless of repeat severity", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: "claim", error: null }) };
    expect(await claimKioskNotification(db, "gate-1", "unknown_face")).toEqual({ key: "kiosk:unknown_face:gate-1", token: "claim" });
    expect(db.rpc).toHaveBeenCalledWith("claim_kiosk_notification", { p_key: "kiosk:unknown_face:gate-1", p_seconds: 600 });
  });
  it("claims offline alerts per device for 30 minutes", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: "claim", error: null }) };
    await claimKioskNotification(db, "gate-2", "offline");
    expect(db.rpc).toHaveBeenCalledWith("claim_kiosk_notification", { p_key: "kiosk:offline:gate-2", p_seconds: 1800 });
  });
  it("suppresses a duplicate claim", async () => {
    expect(await claimKioskNotification({ rpc: async () => ({ data: null, error: null }) }, "gate-1", "unknown_face")).toBeNull();
  });
  it("fails closed when the dedup source fails", async () => {
    await expect(claimKioskNotification({ rpc: async () => ({ error: new Error("offline") }) }, "gate-1", "unknown_face")).rejects.toThrow("offline");
  });
  it("releases only its own failed delivery claim", async () => {
    const eq = vi.fn().mockReturnThis();
    const db = { from: vi.fn(() => ({ delete: () => ({ eq }) })) };
    await releaseKioskNotification(db, { key: "kiosk:offline:gate-1", token: "claim-1" });
    expect(eq.mock.calls).toEqual([["notification_key", "kiosk:offline:gate-1"], ["claim_token", "claim-1"]]);
  });
});