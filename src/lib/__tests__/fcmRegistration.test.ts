import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) },
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
    mocks.rpc.mockResolvedValueOnce({ error: { code: "XX000", message: "write failed" } }).mockResolvedValueOnce({ error: null });
    const { flushPendingFcmToken } = await import("../fcmPush");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBe("test-device-token");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBeNull();
    expect(mocks.rpc).toHaveBeenLastCalledWith("register_push_subscription", expect.objectContaining({ _provider: "fcm", _device_token: "test-device-token" }));
  });

  it("treats an already-registered device as success when the database function is missing", async () => {
    localStorage.setItem("pending_fcm_token", "test-device-token");
    mocks.rpc.mockResolvedValue({ error: { code: "PGRST202", message: "Could not find the function" } });
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const { flushPendingFcmToken } = await import("../fcmPush");
    await flushPendingFcmToken();
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "test-user", provider: "fcm" }));
    expect(localStorage.getItem("pending_fcm_token")).toBeNull();
  });

  it("retains registration until the user signs in", async () => {
    localStorage.setItem("pending_fcm_token", "test-device-token");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { flushPendingFcmToken } = await import("../fcmPush");
    await flushPendingFcmToken();
    expect(localStorage.getItem("pending_fcm_token")).toBe("test-device-token");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
