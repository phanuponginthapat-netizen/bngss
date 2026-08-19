// Client-side filled-PDF generator for PDF-mode e-forms.
// Downloads the template PDF, draws overlay values (text/signature/checkbox)
// onto the correct page using pdf-lib + a Thai font, and returns a Blob.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getEformPdfUrl, type PdfOverlayField } from "./eformPdf";
import { thaiDate, resolveAutofill, type EFormRenderContext } from "./eformTemplate";

const FONT_URL = "/fonts/thsarabunnew.ttf";

function displayValue(f: PdfOverlayField, raw: string, ctx: EFormRenderContext): string {
  if (f.type === "autofill") return resolveAutofill(f.autofillSource as any, ctx);
  if (!raw) return "";
  if (f.type === "checkbox") return raw === "true" || raw === "1" ? "☑" : "";
  if (f.type === "date") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : thaiDate(d);
  }
  return raw;
}

export interface FilledEformPdf {
  blob: Blob;
  name: string;
}

/** Generate a filled PDF (overlay values baked in) for a PDF-mode template. */
export async function generateFilledEformPdf(
  templateName: string,
  pdfPath: string,
  overlays: PdfOverlayField[],
  values: Record<string, string>,
  ctx: EFormRenderContext,
): Promise<FilledEformPdf> {
  const url = await getEformPdfUrl(pdfPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดาวน์โหลด PDF ต้นแบบไม่สำเร็จ (${res.status})`);
  const pdfBytes = new Uint8Array(await res.arrayBuffer());

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  pdfDoc.registerFontkit(fontkit);

  const fontRes = await fetch(FONT_URL);
  if (!fontRes.ok) throw new Error("โหลดฟอนต์ไม่สำเร็จ");
  const font = await pdfDoc.embedFont(await fontRes.arrayBuffer());

  const pages = pdfDoc.getPages();

  for (const f of overlays) {
    const pageIdx = Math.max(0, Math.min(pages.length - 1, (f.page || 1) - 1));
    const page = pages[pageIdx];
    const { width, height } = page.getSize();
    const x = (f.xPct || 0) / 100 * width;
    const yTop = (f.yPct || 0) / 100 * height;
    const w = (f.widthPct || 0) / 100 * width;
    const h = (f.heightPct || 0) / 100 * height;
    const y = height - yTop - h;
    const raw = values[f.key] ?? f.defaultValue ?? "";
    const v = displayValue(f, raw, ctx);

    if (f.type === "checkbox") {
      if (raw === "true" || raw === "1") drawCheck(page, x, y, w, h);
      continue;
    }
    if (f.type === "signature" && raw.startsWith("data:image")) {
      try {
        const m = raw.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
        if (m) {
          const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          const img = m[1].toLowerCase() === "png" ? await pdfDoc.embedPng(bin) : await pdfDoc.embedJpg(bin);
          page.drawImage(img, { x, y, width: w, height: h });
        }
      } catch (e) {
        console.warn("embed signature failed", e);
      }
      continue;
    }
    if (!v) continue;

    let size = (f.fontSizePt || 12) * 4 / 3;
    let text = v;
    const maxW = w - 2;
    while (size > 6 && font.widthOfTextAtSize(text, size) > maxW) {
      size -= 0.5;
    }
    if (font.widthOfTextAtSize(text, size) > maxW) {
      while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxW) text = text.slice(0, -1);
    }
    const lineH = size * 1.15;
    const lines = text.split(/\r?\n/);
    const blockH = lines.length * lineH;
    const topY = y + h - Math.max(0, (h - blockH) / 2) - size;
    lines.forEach((line, i) => {
      const textW = font.widthOfTextAtSize(line, size);
      let drawX = x + 1;
      if (f.type === "date") drawX = x + Math.max(0, (w - textW) / 2);
      try {
        page.drawText(line, { x: drawX, y: topY - i * lineH, size, font, color: rgb(0, 0, 0) });
      } catch (e) {
        console.warn("drawText failed", e);
      }
    });
  }

  const outBytes = await pdfDoc.save();
  const name = `${(templateName || "eform").replace(/[^\u0E00-\u0E7Fa-zA-Z0-9._-]/g, "_").slice(0, 60)}_filled.pdf`;
  return { blob: new Blob([outBytes], { type: "application/pdf" }), name };
}

function drawCheck(page: any, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2.4;
  page.drawLine({ start: { x: cx - r, y: cy }, end: { x: cx - r / 3, y: cy - r * 0.8 }, thickness: 1.6, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: cx - r / 3, y: cy - r * 0.8 }, end: { x: cx + r, y: cy + r }, thickness: 1.6, color: rgb(0, 0, 0) });
}