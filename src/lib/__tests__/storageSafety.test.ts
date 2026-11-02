// @vitest-environment node
import { describe, expect, it } from "vitest";
import { oldApks, verifyCopy, NEVER_OFFLOAD } from "../../../supabase/functions/_shared/storageSafety";

describe("Storage retention", () => {
  it("retains exactly the current main APK without deleting scanner or manifests", () => {
    expect(oldApks(["bngss-app-v1.0.116-116.apk", "bngss-app-v1.0.115-115.apk", "bngss-app-latest.apk", "bngss-scanner-build-8.apk", "version.json"], "bngss-app-v1.0.116-116.apk", "android")).toEqual(["bngss-app-v1.0.115-115.apk", "bngss-app-latest.apk"]);
  });
  it("retains exactly the current scanner APK", () => {
    expect(oldApks(["bngss-scanner-build-8.apk", "bngss-scanner-build-7.apk", "bngss-app-v1.0.116-116.apk"], "bngss-scanner-build-8.apk", "scanner")).toEqual(["bngss-scanner-build-7.apk"]);
  });
  it("refuses pruning when the current file is missing", () => {
    expect(() => oldApks(["bngss-scanner-build-7.apk"], "bngss-scanner-build-8.apk", "scanner")).toThrow();
  });
  it("requires matching content, not just matching sizes, before removing Cloud copies", async () => {
    await expect(verifyCopy(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).rejects.toThrow("checksum");
    await expect(verifyCopy(new Uint8Array([1, 2]), new Uint8Array([1]))).rejects.toThrow("size");
    await expect(verifyCopy(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).resolves.toBeUndefined();
  });
  it("keeps active installers and essential branding out of generic offload", () => {
    expect(NEVER_OFFLOAD.has("app-downloads")).toBe(true);
    expect(NEVER_OFFLOAD.has("cms-images")).toBe(true);
  });
});