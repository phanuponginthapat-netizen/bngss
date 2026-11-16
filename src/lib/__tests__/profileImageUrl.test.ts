import { beforeEach, describe, expect, it, vi } from "vitest";

const { sign, from } = vi.hoisted(() => {
  const sign = vi.fn();
  return { sign, from: vi.fn(() => ({ createSignedUrl: sign })) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from } } }));

describe("private family portraits", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    sign.mockResolvedValue({ data: { signedUrl: "https://current.example/readable.webp?token=fresh" } });
  });

  it("resolves saved public profile URLs through authenticated signing", async () => {
    const { resolveProfileImageUrl } = await import("../profileImageUrl");
    const result = await resolveProfileImageUrl("https://old.example/storage/v1/object/public/profile-images/owner/student/avatar.webp");
    expect(from).toHaveBeenCalledWith("profile-images");
    expect(sign).toHaveBeenCalledWith("owner/student/avatar.webp", expect.any(Number));
    expect(result).toBe("https://current.example/readable.webp?token=fresh");
  });

  it("retries an expired signed portrait by requesting a new URL", async () => {
    const { resolveProfileImageUrl } = await import("../profileImageUrl");
    await resolveProfileImageUrl("https://old.example/storage/v1/object/sign/profile-images/owner/avatar.webp?token=expired", true);
    expect(sign).toHaveBeenCalledWith("owner/avatar.webp", expect.any(Number));
  });
});