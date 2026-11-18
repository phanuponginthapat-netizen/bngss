// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mobile: true, signOut: vi.fn(), effects: [] as (() => unknown)[] }));
vi.mock("react", () => ({
  useEffect: (effect: () => unknown) => { mocks.effects.push(effect); },
  useRef: () => ({ current: null }),
  useState: () => [{ idleLogoutMin: 1 }, vi.fn()],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("@/lib/mobileSession", () => ({ isMobileSession: () => mocks.mobile }));
vi.mock("@/lib/monitorSignal", () => ({ callLocalCtl: vi.fn() }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
import { useKioskRuntimeConfig } from "../../hooks/useKioskRuntimeConfig";

afterEach(() => { mocks.effects = []; vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("mobile kiosk inactivity", () => {
  it("does not schedule logout on a mobile device even when kiosk timeout is saved", () => {
    const timer = vi.fn();
    vi.stubGlobal("window", { setTimeout: timer, addEventListener: vi.fn() });
    useKioskRuntimeConfig(true);
    mocks.effects[1]?.();
    expect(timer).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});