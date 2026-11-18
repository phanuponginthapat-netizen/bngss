import JSZip from "jszip";

const ENTRY = "school-office/editable.json";
export async function attachEditableSource(blob: Blob, kind: "docs" | "slides", content: unknown): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  zip.file(ENTRY, JSON.stringify({ version: 1, kind, content }));
  return zip.generateAsync({ type: "blob", mimeType: blob.type });
}
export async function readEditableSource(buffer: ArrayBuffer, kind: "docs" | "slides"): Promise<unknown | null> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(ENTRY);
  if (!file) return null;
  const data = JSON.parse(await file.async("string"));
  if (data.version !== 1 || data.kind !== kind) throw new Error("รูปแบบไฟล์แก้ไขไม่รองรับ");
  return data.content;
}