// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { createSignedUrl, fromBucket } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  fromBucket: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: (bucket: string) => { fromBucket(bucket); return { createSignedUrl }; } } },
}));

import { kioskMediaParts, resolveKioskMediaUrl } from "../kioskMediaUrl";

describe("FaceGate scan photos on the active backend", () => {
  it("reads a stored private path as face-photos object", () => {
    expect(kioskMediaParts("scans/2026-11-13/unknown-1.jpg")).toEqual({ bucket: "face-photos", path: "scans/2026-11-13/unknown-1.jpg" });
  });

  it("re-signs a retired backend link against the same object path", () => {
    expect(kioskMediaParts("https://old.example/storage/v1/object/sign/face-photos/scans/2026-10-12/unknown-2.jpg?token=expired"))
      .toEqual({ bucket: "face-photos", path: "scans/2026-10-12/unknown-2.jpg" });
  });

  it("refuses a link that is not a storage object", () => {
    expect(kioskMediaParts("https://example.test/other.jpg")).toBeNull();
    expect(kioskMediaParts("data:text/html;base64,AAAA")).toBeNull();
  });

  it("returns a fresh link for a stored path", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://active.example/fresh" }, error: null });
    expect(await resolveKioskMediaUrl("scans/2026-11-13/unknown-3.jpg")).toBe("https://active.example/fresh");
    expect(fromBucket).toHaveBeenCalledWith("face-photos");
    expect(createSignedUrl).toHaveBeenCalledWith("scans/2026-11-13/unknown-3.jpg", 3600);
  });

  it("gives up quietly when the object is missing, without throwing", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("Object not found") });
    expect(await resolveKioskMediaUrl("scans/2026-10-12/missing-4.jpg")).toBeNull();
  });

  it("gives up quietly when the storage call itself fails", async () => {
    createSignedUrl.mockRejectedValue(new Error("network down"));
    expect(await resolveKioskMediaUrl("scans/2026-10-12/missing-5.jpg")).toBeNull();
  });

  it("does not retry a failed object on every refresh", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("Object not found") });
    await resolveKioskMediaUrl("scans/2026-10-12/missing-6.jpg");
    await resolveKioskMediaUrl("scans/2026-10-12/missing-6.jpg");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("keeps an inline image as-is and drops unreadable inline data", async () => {
    expect(await resolveKioskMediaUrl("data:image/jpeg;base64,/9j/AA==")).toBe("data:image/jpeg;base64,/9j/AA==");
    expect(await resolveKioskMediaUrl("data:text/html;base64,AAAA")).toBeNull();
    expect(await resolveKioskMediaUrl(null)).toBeNull();
    expect(await resolveKioskMediaUrl("   ")).toBeNull();
  });
});
