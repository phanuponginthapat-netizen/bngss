// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
describe("YouTube playback preservation", () => {
  it("restores original mute and playback speed when the ad finishes", () => {
    const video = { muted: false, playbackRate: 1.25, duration: 10, currentTime: 0 };
    let ad = true; let tick = () => {};
    const ctx = vm.createContext({ location: { hostname: "www.youtube.com" }, window: { addEventListener: () => {} }, document: {
      createElement: () => ({}), head: { appendChild: () => {} }, querySelectorAll: () => [],
      querySelector: () => ad ? { querySelector: () => video } : null,
    }, setInterval: (f: () => void) => { tick = f; }, isFinite });
    vm.runInContext(fs.readFileSync("extension/yt-ads.js", "utf8"), ctx);
    tick(); expect(video.muted).toBe(true); expect(video.playbackRate).toBe(16);
    ad = false; tick(); expect(video.muted).toBe(false); expect(video.playbackRate).toBe(1.25);
  });
});