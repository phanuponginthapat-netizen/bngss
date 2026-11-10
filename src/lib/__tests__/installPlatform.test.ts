import { describe, expect, it } from "vitest";
import { detectInstallPlatform, isEmbeddedBrowser } from "../installPlatform";

describe("install platform detection", () => {
  it("recognizes Android phones and tablets", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Linux; Android 14) Chrome/130")).toBe("android");
  });
  it("recognizes iPhone", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
  });
  it("recognizes desktop-mode iPad without misclassifying a Mac", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5)).toBe("ios");
    expect(detectInstallPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0)).toBe("desktop");
  });
  it("keeps Windows and Linux in desktop", () => {
    expect(detectInstallPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(detectInstallPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("desktop");
  });
  it("recognizes LINE's browser rather than ordinary Safari", () => {
    expect(isEmbeddedBrowser("iPhone Safari Line/15.0")).toBe(true);
    expect(isEmbeddedBrowser("iPhone Version/18.0 Safari/604.1")).toBe(false);
  });
});