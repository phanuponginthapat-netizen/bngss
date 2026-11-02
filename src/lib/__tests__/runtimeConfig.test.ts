// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CANONICAL_BACKEND, getBackendConfig, isBlockedBackendUrl } from "../runtimeConfig";

describe("Cloud recovery backend", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllEnvs(); });
  it("uses Cloud instead of a saved restricted school backend", () => {
    localStorage.setItem("bng.backend.config", JSON.stringify({url: "https://gwmszzoqqxmejefhayqf.supabase.co", anonKey: "old"}));
    expect(getBackendConfig().projectId).toBe("dlkyxvhnnffblerwedjz");
    expect(getBackendConfig().url).toBe(CANONICAL_BACKEND.url);
  });
  it("allows the Cloud project", () => {
    expect(isBlockedBackendUrl("https://dlkyxvhnnffblerwedjz.supabase.co")).toBe(false);
    expect(isBlockedBackendUrl("https://gwmszzoqqxmejefhayqf.supabase.co")).toBe(true);
  });
});