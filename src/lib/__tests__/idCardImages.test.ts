import { describe, expect, it, vi } from "vitest";
import { waitForIdCardImages } from "../idCardImages";

describe("ID card export image readiness", () => {
  it("rejects an unreadable saved photo instead of exporting a blank card", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-card-photo-state="error"></div>';
    await expect(waitForIdCardImages(root)).rejects.toThrow("โหลดรูปบนบัตรไม่สำเร็จ");
  });
  it("waits for photo resolution before exporting", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      root.innerHTML = '<div data-card-photo-state="loading"></div>';
      let done = false;
      const result = waitForIdCardImages(root).then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(100);
      expect(done).toBe(false);
      root.firstElementChild?.setAttribute("data-card-photo-state", "ready");
      await vi.advanceTimersByTimeAsync(100);
      await result;
      expect(done).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it("allows a card with no saved photo", async () => {
    await expect(waitForIdCardImages(document.createElement("div"))).resolves.toBeUndefined();
  });
});