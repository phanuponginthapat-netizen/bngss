// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isMobileSessionDevice } from "../mobileSession";

describe("persistent mobile sessions", () => {
  it.each([
    ["Android browser", "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile", "Linux armv8l", 5],
    ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari", "iPhone", 5],
    ["LINE Android", "Mozilla/5.0 (Linux; Android 14) Mobile Line/14", "Linux armv8l", 5],
    ["LINE iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Line/14", "iPhone", 5],
    ["iPad desktop mode", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari", "MacIntel", 5],
    ["Android tablet desktop mode", "Mozilla/5.0 (Linux; Android 14) Chrome/130", "Linux armv8l", 5],
  ])("exempts %s from inactivity logout", (_name, userAgent, platform, maxTouchPoints) => {
    expect(isMobileSessionDevice({ userAgent, platform, maxTouchPoints })).toBe(true);
  });
  it.each(["android", "ios"])("exempts native %s even without a mobile user agent", nativePlatform => {
    expect(isMobileSessionDevice({ userAgent: "Custom WebView", platform: "", maxTouchPoints: 0, nativePlatform })).toBe(true);
  });
  it.each([
    ["Windows touch PC", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 10],
    ["Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 0],
    ["Linux PC", "Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64", 0],
  ])("retains desktop timeout for %s", (_name, userAgent, platform, maxTouchPoints) => {
    expect(isMobileSessionDevice({ userAgent, platform, maxTouchPoints })).toBe(false);
  });
});