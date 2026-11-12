export const OCR_MAX_BYTES = 8 * 1024 * 1024;
export const OCR_MAX_PAGES = 50;
export const OCR_MAX_TEXT = 20000;
export const OCR_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/bmp"];

export function validateOcrResult(value: unknown, expectedPages: number) {
  const result = value as { markdown?: unknown; pages?: { page?: unknown; markdown?: unknown; truncated?: unknown }[]; iapp?: { page?: unknown } } | null;
  if (!result || !Array.isArray(result.pages) || result.pages.length !== expectedPages || result.iapp?.page !== expectedPages) throw new Error("อ่านเอกสารไม่ครบทุกหน้า กรุณาลองใหม่ ไม่ใช้ผลลัพธ์บางส่วน");
  result.pages.forEach((page, index) => {
    if (page.page !== index + 1 || page.truncated !== false || typeof page.markdown !== "string" || !page.markdown.trim()) throw new Error(`หน้า ${index + 1} อ่านไม่ครบ กรุณาลองใหม่`);
  });
  if (typeof result.markdown !== "string" || !result.markdown.trim()) throw new Error("ไม่พบข้อความในเอกสาร");
  if (result.markdown.length > OCR_MAX_TEXT) throw new Error("เนื้อหาเกิน 20,000 ตัวอักษร กรุณาแบ่งไฟล์ ไม่ตัดข้อความอัตโนมัติ");
  return { text: result.markdown, pages: expectedPages };
}