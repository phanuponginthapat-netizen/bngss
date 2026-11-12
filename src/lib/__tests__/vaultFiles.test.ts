import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth }, SUPABASE_RUNTIME_URL: "https://school.example", SUPABASE_RUNTIME_ANON_KEY: "public-test-key" }));
import { clearVaultFileCache, getVaultFileUrl, requireArchiveFile } from "../vaultFiles";

describe("Vault authenticated files", () => {
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
    clearVaultFileCache();
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "user-a" } }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("file", { status: 200 })));
  });
  it("rejects missing files instead of leaving a loading result", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no_file", { status: 404 }));
    await expect(getVaultFileUrl("missing")).rejects.toThrow("ไม่พบไฟล์ต้นฉบับ");
  });
  it("rejects expired LINE originals without caching a fake file", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("source_expired", { status: 410 }));
    await expect(getVaultFileUrl("expired-line")).rejects.toThrow("กรุณาส่งไฟล์เข้ากลุ่ม LINE อีกครั้ง");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("does not reuse files across accounts and revokes the previous blob", async () => {
    await getVaultFileUrl("same-file");
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "user-b" } }, error: null });
    vi.mocked(fetch).mockResolvedValue(new Response("forbidden", { status: 403 }));
    await expect(getVaultFileUrl("same-file")).rejects.toThrow("ไม่มีสิทธิ์");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
  it("does not publish an incomplete ZIP when any selected file is missing", () => {
    expect(() => requireArchiveFile(null, "report.pdf")).toThrow("report.pdf");
    expect(requireArchiveFile({ filename: "report.pdf" }, "report.pdf")).toEqual({ filename: "report.pdf" });
  });
  it("does not retain a response after sign-out", async () => {
    let finish: (value: Response) => void = () => {};
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const request = getVaultFileUrl("file");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    clearVaultFileCache();
    finish(new Response("file"));
    await expect(request).rejects.toThrow("บัญชีเปลี่ยนแล้ว");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});