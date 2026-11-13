// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { kioskMediaUrl } from "../../../supabase/functions/_shared/kioskMedia";
describe("Kiosk media on the active backend", () => {
  it("uses a registered image as fallback but rejects non-image data", async () => {
    expect(await kioskMediaUrl({}, "data:image/jpeg;base64,/9j/AA==")).toBe("data:image/jpeg;base64,/9j/AA==");
    expect(await kioskMediaUrl({}, "data:text/html;base64,AAAA")).toBeNull();
  });
  it("re-signs an old backend profile path instead of using its retired URL", async () => {
    const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://active.example/avatar" }, error: null });
    const from = vi.fn(() => ({ createSignedUrl: sign }));
    expect(await kioskMediaUrl({ storage: { from } }, "https://old.example/storage/v1/object/public/profile-images/student/avatar.webp")).toBe("https://active.example/avatar");
    expect(from).toHaveBeenCalledWith("profile-images");
    expect(sign).toHaveBeenCalledWith("student/avatar.webp", 3600);
  });
  it("renews expired snapshot signatures", async () => {
    const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "fresh" }, error: null });
    expect(await kioskMediaUrl({ storage: { from: () => ({ createSignedUrl: sign }) } }, "https://old.example/storage/v1/object/sign/face-photos/scans/a.jpg?token=expired")).toBe("fresh");
    expect(sign).toHaveBeenCalledWith("scans/a.jpg", 3600);
  });
  it("leaves unreadable media unavailable rather than fabricating a URL", async () => {
    const db = { storage: { from: () => ({ createSignedUrl: async () => ({ error: new Error("missing") }) }) } };
    expect(await kioskMediaUrl(db, "https://old.example/storage/v1/object/public/profile-images/missing.jpg")).toBeNull();
  });
  it("signs a stored private path against the default bucket", async () => {
    const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "fresh" }, error: null });
    expect(await kioskMediaUrl({ storage: { from: () => ({ createSignedUrl: sign }) } }, "scans/2026-11-13/unknown-7.jpg")).toBe("fresh");
    expect(sign).toHaveBeenCalledWith("scans/2026-11-13/unknown-7.jpg", 3600);
  });
});