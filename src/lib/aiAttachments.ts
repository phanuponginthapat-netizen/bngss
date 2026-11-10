export type AiAttachment = { name: string; text: string };
export const AI_FILE_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json";
export function validateAttachmentText(text: string) {
  if (!text.trim()) throw new Error("ไม่พบข้อความในไฟล์ หากเป็นเอกสารสแกน กรุณาแนบเป็นรูปภาพแทน");
  if (text.length > 20000) throw new Error("เนื้อหาไฟล์ยาวเกิน 20,000 ตัวอักษร กรุณาแบ่งไฟล์ก่อนแนบ");
  return text;
}
export async function readAiAttachment(file: File): Promise<AiAttachment> {
  if (file.size > 8 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 8MB");
  const ext = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  if (["txt", "md", "csv", "json"].includes(ext || "")) text = await file.text();
  else if (ext === "docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    text = book.SheetNames.map(name => `แผ่นงาน: ${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join("\n\n");
  } else if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    try {
      if (pdf.numPages > 50) throw new Error("PDF เกิน 50 หน้า กรุณาแบ่งไฟล์ก่อนแนบ");
      const pages: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
        if (!pageText.trim()) throw new Error(`หน้า ${n} ไม่มีข้อความที่อ่านได้ กรุณาแนบหน้าสแกนเป็นรูปภาพแทน`);
        pages.push(`หน้า ${n}\n${pageText}`);
      }
      text = pages.join("\n\n");
    } finally { await pdf.destroy(); }
  } else throw new Error("รองรับ PDF, DOCX, Excel, CSV, TXT, MD และ JSON");
  return { name: file.name, text: validateAttachmentText(text) };
}