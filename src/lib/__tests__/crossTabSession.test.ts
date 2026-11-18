// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), refresh: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut, onAuthStateChange: vi.fn() }, realtime: { isConnected: () => false, connect: vi.fn() } } }));
vi.mock("../sessionRefresh", () => ({ refreshSessionIfNeeded: mocks.refresh }));
vi.mock("../offlineQueue", () => ({ flush: vi.fn() }));
import { installCrossTabSync } from "../crossTabSync";

afterEach(() => vi.unstubAllGlobals());
describe("cross-tab logout safety", () => {
  it("does not revoke a signed-in account from a delayed SIGNED_OUT message", () => {
    let channel: { onmessage?: (event: { data: unknown }) => void } = {};
    vi.stubGlobal("BroadcastChannel", class { constructor() { channel = this; } onmessage?: (event: { data: unknown }) => void; });
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn() });
    installCrossTabSync();
    channel.onmessage?.({ data: { kind: "auth", event: "SIGNED_OUT", hasSession: false, at: Date.now() - 10000 } });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});