// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sign, from } = vi.hoisted(() => {
  const sign = vi.fn();
  return { sign, from: vi.fn(() => ({ createSignedUrl: sign })) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({data:{session:{user:{id:'staff'}}}}) }, storage: { from } } }));

describe("private family portraits", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn() });
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
  it('does not trust an expired signed URL on initial display', async () => {
    const { resolveProfileImageUrl } = await import('../profileImageUrl');
    expect(await resolveProfileImageUrl('https://old.example/storage/v1/object/sign/face-photos/student/photo.jpg?token=expired')).toBe('https://current.example/readable.webp?token=fresh');
    expect(from).toHaveBeenCalledWith('face-photos');
    expect(sign).toHaveBeenCalledWith('student/photo.jpg',3600);
  });
  it('propagates unreadable file errors instead of returning broken saved links', async () => {
    sign.mockResolvedValueOnce({data:null,error:new Error('Object not found')});
    const { resolveProfileImageUrl } = await import('../profileImageUrl');
    await expect(resolveProfileImageUrl('student/missing.webp')).rejects.toThrow('Object not found');
  });
});