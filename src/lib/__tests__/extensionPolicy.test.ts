// @vitest-environment node
import { describe, expect, it } from "vitest";
import { safeVisit, EXT_CONFIG_KEYS } from "../../../supabase/functions/_shared/extensionPolicy";
describe("extension data boundaries", () => {
  it("removes credentials and secret parameters without inventing user ownership", () => {
    expect(safeVisit({ url: "https://name:pass@example.org/path?token=secret&q=lesson#access_token=secret", action: "visit", user_id: "other" })).toEqual({ url: "https://example.org/path?q=lesson", domain: "example.org", action: "visit", reason: null });
  });
  it("rejects executable URLs and unsupported log actions", () => {
    expect(() => safeVisit({ url: "javascript:alert(1)", action: "visit" })).toThrow();
    expect(() => safeVisit({ url: "https://example.org", action: "success" })).toThrow();
  });
  it("never publishes kiosk credentials or unrelated CMS secrets", () => {
    expect(EXT_CONFIG_KEYS).not.toContain("kiosk_exit_pin");
    expect(EXT_CONFIG_KEYS).not.toContain("wifi_password");
    expect(EXT_CONFIG_KEYS.every(k => k.startsWith("browser_") || ["school_name", "school_name_en", "school_logo", "footer_school_name", "app_name", "app_short_name", "app_favicon_url"].includes(k))).toBe(true);
  });
});