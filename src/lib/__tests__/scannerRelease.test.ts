import { describe, expect, it } from "vitest";
import { parseScannerRelease } from "../scannerRelease";

const release = {
  product: "scanner", appId: "com.bngss.scanner", appName: "BNG Scanner",
  identityVerified: true, sha256: "a".repeat(64), version: "build-7",
  files: [{ name: "bngss-scanner-build-7.apk", url: "https://example.com/bngss-scanner-build-7.apk", sizeBytes: 123 }],
};
describe("Scanner download identity", () => {
  it("accepts a versioned APK verified after packaging", () => {
    expect(parseScannerRelease(release)?.files[0].name).toBe("bngss-scanner-build-7.apk");
  });
  it("rejects the existing release without final APK identity", () => {
    expect(parseScannerRelease({ product: "scanner", version: "build-6", files: release.files })).toBeNull();
  });
  it("rejects main-app labels and mutable legacy APK aliases", () => {
    expect(parseScannerRelease({ ...release, appName: "BNG Smart" })).toBeNull();
    expect(parseScannerRelease({ ...release, files: [{ name: "bngss-scanner.apk", url: "https://example.com/bngss-scanner.apk", sizeBytes: 123 }] })).toBeNull();
    expect(parseScannerRelease({ ...release, files: [{ ...release.files[0], url: "https://example.com/bngss-app.apk" }] })).toBeNull();
  });
});