import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: () => ({ upsert: mocks.upsert }) },
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android", isNativePlatform: () => true } }));
vi.mock("@capacitor/push-notifications", () => ({ PushNotifications: {} }));
vi.mock("@/lib/liveNotification", () => ({ showLiveNotification: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
});

describe("Native device registration recovery", () => {
  it("retains failed registration and clears it only after successful retry", async () => {
    localStorage.setItem("pending_fcm_token", "test-device-token");
    mocks.upsert.mockResolvedValueOnce({ error: { message: "write failed" } }).mockResolvedValueOnce({ error: null });
    const { flushPendingFcmToken } = await import("../fcmPush");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBe("test-device-token");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBeNull();
    expect(mocks.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ provider: "fcm", user_id: "test-user" }), { onConflict: "user_id,endpoint" });
  });

  it("retains registration until the user signs in", async () => {
    localStorage.setItem("pending_fcm_token", "test-device-token");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { flushPendingFcmToken } = await import("../fcmPush");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBe("test-device-token");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});