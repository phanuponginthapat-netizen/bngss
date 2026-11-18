// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: mocks } }));
import { refreshSessionIfNeeded } from "../sessionRefresh";

afterEach(() => vi.resetAllMocks());
describe("shared session refresh", () => {
  it("coalesces simultaneous resume/focus/online calls into one refresh", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: Date.now() / 1000 + 30 } } });
    mocks.refreshSession.mockResolvedValue({});
    await Promise.all([refreshSessionIfNeeded(), refreshSessionIfNeeded(), refreshSessionIfNeeded()]);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
  });
  it("never signs out on failed session reads", async () => {
    mocks.getSession.mockRejectedValue(new Error("offline"));
    await refreshSessionIfNeeded();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
  it("never signs out on failed refresh and permits retry", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: Date.now() / 1000 + 10 } } });
    mocks.refreshSession.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
    await refreshSessionIfNeeded();
    await refreshSessionIfNeeded();
    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("does not refresh a session with over five minutes left", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { expires_at: Date.now() / 1000 + 600 } } });
    await refreshSessionIfNeeded();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
});