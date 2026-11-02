// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_BACKEND, getBackendConfig, isBlockedBackendUrl } from "../runtimeConfig";

describe("Cloud recovery backend", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k)});
    vi.unstubAllEnvs();
  });
  it("uses Cloud instead of a saved restricted school backend", () => {
    localStorage.setItem("bng.backend.config", JSON.stringify({url: "https://gwmszzoqqxmejefhayqf.supabase.co", anonKey: "old"}));
    expect(getBackendConfig().projectId).toBe("dlkyxvhnnffblerwedjz");
    expect(getBackendConfig().url).toBe(CANONICAL_BACKEND.url);
  });
  it("allows the Cloud project", () => {
    expect(isBlockedBackendUrl("https://dlkyxvhnnffblerwedjz.supabase.co")).toBe(false);
    expect(isBlockedBackendUrl("https://gwmszzoqqxmejefhayqf.supabase.co")).toBe(true);
  });
  it("ignores stale standalone configuration during hosted recovery", () => {
    vi.stubGlobal("window", { __BNG_CONFIG__: { DEPLOY_MODE: "standalone", SUPABASE_URL: "https://old.example", SUPABASE_ANON_KEY: "old" } });
    vi.stubEnv("VITE_STANDALONE", "1");
    expect(getBackendConfig().url).toBe(CANONICAL_BACKEND.url);
    expect(getBackendConfig().storageProvider).toBe("supabase");
  });
});