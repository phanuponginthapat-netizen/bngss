import { describe, it, expect } from "vitest";
import {
  ANDROID_APK_DOWNLOAD_URL,
  FALLBACK_ANDROID_RELEASE,
  formatReleaseDate,
  formatReleaseSize,
  parseAndroidRelease,
} from "../githubRelease";

const realRelease = {
  name: "BNG Smart (Android) (1.0.169-169)",
  tag_name: "android-latest",
  draft: false,
  prerelease: false,
  published_at: "2026-11-10T06:37:01Z",
  body: "รุ่ล่าสุด 1.0.169-169 — สร้างอัตโนมัติ",
  assets: [
    {
      name: "bngss-app.apk",
      size: 31081833,
      browser_download_url: ANDROID_APK_DOWNLOAD_URL,
      content_type: "application/vnd.android.package-archive",
    },
  ],
};

describe("parseAndroidRelease", () => {
  it("accepts the real android-latest release and keeps the canonical download link", () => {
    const release = parseAndroidRelease(realRelease);
    expect(release).not.toBeNull();
    expect(release!.version).toBe("1.0.169-169");
    expect(release!.sizeBytes).toBe(31081833);
    expect(release!.downloadUrl).toBe(
      "https://github.com/phanuponginthapat-netizen/bngss/releases/download/android-latest/bngss-app.apk"
    );
    expect(release!.fileName).toBe("bngss-app.apk");
  });

  it("never follows a download URL supplied by the API", () => {
    const tampered = {
      ...realRelease,
      assets: [{ ...realRelease.assets[0], browser_download_url: "https://evil.example/apk.apk" }],
    };
    expect(parseAndroidRelease(tampered)!.downloadUrl).toBe(ANDROID_APK_DOWNLOAD_URL);
  });

  it("rejects drafts, other tags and releases without the APK asset", () => {
    expect(parseAndroidRelease({ ...realRelease, draft: true })).toBeNull();
    expect(parseAndroidRelease({ ...realRelease, tag_name: "scanner-latest" })).toBeNull();
    expect(parseAndroidRelease({ ...realRelease, assets: [] })).toBeNull();
    expect(parseAndroidRelease(null)).toBeNull();
  });
});

describe("release formatting", () => {
  it("shows the APK size in MB", () => {
    expect(formatReleaseSize(31081833)).toBe("29.6 MB");
    expect(formatReleaseSize(0)).toBe("-");
  });

  it("shows the publish date in Thai Buddhist era (Bangkok time)", () => {
    expect(formatReleaseDate("2026-11-10T06:37:01Z")).toBe("10 พฤศจิกายน 2569");
    expect(formatReleaseDate("not-a-date")).toBe("-");
  });

  it("keeps the offline fallback pointing at the same file", () => {
    expect(FALLBACK_ANDROID_RELEASE.downloadUrl).toBe(ANDROID_APK_DOWNLOAD_URL);
    expect(FALLBACK_ANDROID_RELEASE.fileName).toBe("bngss-app.apk");
  });
});
