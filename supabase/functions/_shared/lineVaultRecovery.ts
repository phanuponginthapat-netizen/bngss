// Repair incomplete LINE placeholders without guessing a Drive file or changing access.
export interface RecoverableVaultItem {
  id: string;
  source: string;
  kind: string;
  line_message_id: string | null;
  line_group_id: string | null;
  created_at: string;
  title: string | null;
  original_filename: string | null;
  mime_type: string | null;
  storage_path: string | null;
  drive_file_id: string | null;
}

export async function recoverLineVaultFile(
  sb: any,
  item: RecoverableVaultItem,
  download: (messageId: string) => Promise<{ data: Uint8Array; mime: string } | null>,
): Promise<{ storage_path: string; original_filename: string; mime_type: string } | null> {
  if (item.source !== "line" || item.kind === "note" || item.storage_path || item.drive_file_id || !item.line_message_id || !item.line_group_id) return null;
  const content = await download(item.line_message_id);
  if (!content || content.data.byteLength === 0) return null;
  const mime = content.mime.split(";")[0].trim() || "application/octet-stream";
  const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "video/mp4": "mp4", "audio/mpeg": "mp3" };
  const filename = item.original_filename || (item.title && /\.[a-z0-9]{1,10}$/i.test(item.title) ? item.title : `${item.line_message_id}.${extensions[mime] || "bin"}`);
  const ext = filename.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() || "bin";
  const date = new Date(item.created_at);
  if (!Number.isFinite(date.getTime())) throw new Error("invalid vault capture date");
  const path = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${item.line_group_id}/${item.line_message_id}.${ext}`;
  const bucket = sb.storage.from("line-vault");
  const { error: uploadError } = await bucket.upload(path, content.data, { contentType: mime, upsert: false });
  if (uploadError && !/already exists|duplicate|resource exists/i.test(String(uploadError.message))) throw uploadError;
  // Verify the durable bytes before attaching this path; never return temporary LINE bytes as saved success.
  const { data: saved, error: readError } = await bucket.download(path);
  if (readError || !saved) throw readError || new Error("vault recovery verification failed");
  const bytes = new Uint8Array(await saved.arrayBuffer());
  if (bytes.length !== content.data.length || bytes.some((byte, index) => byte !== content.data[index])) throw new Error("vault recovery byte mismatch");
  const patch = { storage_path: path, original_filename: filename, mime_type: mime, size_bytes: bytes.length };
  const { data: linked, error: updateError } = await sb.from("line_vault_items").update(patch)
    .eq("id", item.id).is("storage_path", null).is("drive_file_id", null).select("id").maybeSingle();
  if (updateError) throw updateError;
  if (!linked) throw new Error("vault item changed during recovery; retry");
  return patch;
}