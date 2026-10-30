// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCmsCache, CMS_CACHE_TTL } from "../cmsSettingsCache";

describe("CMS settings cache", () => {
  const now = 100000000;
  const make = (data: unknown, backend = "school", at = now) => JSON.stringify({ data, backend, at });
  it("rejects an empty cached response", () => {
    expect(parseCmsCache(make({}), "school", now)).toBeNull();
  });
  it("does not reuse another backend's settings", () => {
    expect(parseCmsCache(make({ app_name: "Other" }, "other"), "school", now)).toBeNull();
  });
  it("reads the school's cached settings", () => {
    expect(parseCmsCache(make({ app_name: "School" }), "school", now)?.data.app_name).toBe("School");
  });
  it("rejects expired settings", () => {
    expect(parseCmsCache(make({ app_name: "School" }, "school", now - CMS_CACHE_TTL - 1), "school", now)).toBeNull();
  });
});