import { supabase } from "@/integrations/supabase/client";

export const PRINT_TEMPLATE_BUCKET = "print-templates";

export type PrintTemplatePdfSource =
  | { type: "bytes"; bytes: ArrayBuffer; path: string }
  | { type: "url"; url: string; path: string };

export function normalizePrintTemplatePath(path: string) {
  let value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  value = value.replace(/^\/+/, "");
  const bucketPrefix = `${PRINT_TEMPLATE_BUCKET}/`;
  if (value.startsWith(bucketPrefix)) value = value.slice(bucketPrefix.length);
  return value;
}

export async function loadPrintTemplatePdf(path: string): Promise<PrintTemplatePdfSource> {
  const normalized = normalizePrintTemplatePath(path);
  if (!normalized) throw new Error("ไม่พบ path ของ PDF");
  if (/^https?:\/\//i.test(normalized)) return { type: "url", url: normalized, path: normalized };

  const { data, error } = await supabase.storage.from(PRINT_TEMPLATE_BUCKET).download(normalized);
  if (data && !error) {
    const bytes = await data.arrayBuffer();
    if (bytes.byteLength > 0) return { type: "bytes", bytes, path: normalized };
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(PRINT_TEMPLATE_BUCKET)
    .createSignedUrl(normalized, 60 * 30);

  if (signed?.signedUrl && !signedError) return { type: "url", url: signed.signedUrl, path: normalized };

  throw new Error(error?.message || signedError?.message || "โหลด PDF ไม่สำเร็จ");
}