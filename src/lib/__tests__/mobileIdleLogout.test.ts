// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue({}), cleanup: undefined as (() => void) | undefined }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void) | undefined) => { mocks.cleanup = effect(); } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));
import { useIdleLogout } from "../../hooks/useIdleLogout";

describe("mobile inactivity lifecycle", () => {
  let store: Map<string, string>;
  let replace: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T09:06:00Z"));
    mocks.signOut.mockClear();
    store = new Map();
    replace = vi.fn();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
    vi.stubGlobal("window", { location: { pathname: "/dashboard", search: "", replace }, navigator: {}, matchMedia: () => ({ matches: false }), addEventListener: vi.fn(), removeEventListener: vi.fn(), setInterval, clearInterval });
    vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => { mocks.cleanup?.(); mocks.cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each([
    ["Android LINE", "Android Mobile Line/14", "Linux armv8l", 5],
    ["iPhone", "iPhone Mobile Safari", "iPhone", 5],
    ["iPad desktop mode", "Macintosh Safari", "MacIntel", 5],
  ])("keeps %s logged in after 24 hours of inactivity and resume", async (_name, userAgent, platform, maxTouchPoints) => {
    vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
    useIdleLogout(true);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("still logs a touch-screen Windows PC out after exactly 2 hours", async () => {
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0", platform: "Win32", maxTouchPoints: 10 });
    useIdleLogout(true);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000 - 1);
    expect(mocks.signOut).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fdashboard");
  });
});