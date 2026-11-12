import { describe, expect, it, vi } from "vitest";
import { recoverLineVaultFile } from "../../../supabase/functions/_shared/lineVaultRecovery";

const item = { id: "pending", source: "line", kind: "file", line_message_id: "639822190916927795", line_group_id: "group", created_at: "2026-11-09T03:30:49Z", title: "EDU Presentation.pdf", original_filename: null, mime_type: null, storage_path: null, drive_file_id: null };
function fixture(bytes = [1, 2, 3]) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const download = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
  const query: any = { eq: vi.fn(() => query), is: vi.fn(() => query), select: vi.fn(() => query), maybeSingle: vi.fn().mockResolvedValue({ data: { id: item.id }, error: null }) };
  const update = vi.fn(() => query);
  return { sb: { storage: { from: () => ({ upload, download }) }, from: () => ({ update }) }, upload, update, query };
}
const content = async () => ({ data: new Uint8Array([1, 2, 3]), mime: "application/pdf" });
describe("Incomplete LINE Vault recovery", () => {
  it("saves verified original bytes and attaches the existing row", async () => {
    const f = fixture();
    const result = await recoverLineVaultFile(f.sb, item, content);
    expect(result?.storage_path).toBe("2026/11/group/639822190916927795.pdf");
    expect(result?.original_filename).toBe("EDU Presentation.pdf");
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ size_bytes: 3 }));
  });
  it("does not fabricate an expired original", async () => {
    const f = fixture();
    expect(await recoverLineVaultFile(f.sb, item, async () => null)).toBeNull();
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
  it("does not attach mismatching stored bytes", async () => {
    const f = fixture([1, 2, 4]);
    await expect(recoverLineVaultFile(f.sb, item, content)).rejects.toThrow("byte mismatch");
    expect(f.update).not.toHaveBeenCalled();
  });
  it("never restores a Drive mirror or re-fetches a complete item", async () => {
    const f = fixture(); const read = vi.fn(content);
    expect(await recoverLineVaultFile(f.sb, { ...item, drive_file_id: "verified-drive" }, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("does not claim success if row linkage fails", async () => {
    const f = fixture(); f.query.maybeSingle.mockResolvedValue({ data: null, error: new Error("save failed") });
    await expect(recoverLineVaultFile(f.sb, item, content)).rejects.toThrow("save failed");
  });
});