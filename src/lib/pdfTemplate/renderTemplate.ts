import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { supabase } from "@/integrations/supabase/client";
import type { PdfTemplateRecord, PdfField } from "./types";
import { resolveBinding } from "./bindings";

let cachedFont: ArrayBuffer | null = null;
let cachedFontBold: ArrayBuffer | null = null;

async function loadThaiFont(bold = false): Promise<ArrayBuffer> {
  if (bold && cachedFontBold) return cachedFontBold;
  if (!bold && cachedFont) return cachedFont;
  const url = bold ? "/fonts/thsarabunnew_bold.ttf" : "/fonts/thsarabunnew.ttf";
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  if (bold) cachedFontBold = buf;
  else cachedFont = buf;
  return buf;
}

function hexToRgb(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

async function fetchPdfBytes(template: PdfTemplateRecord): Promise<ArrayBuffer> {
  // Try storage path first (private bucket via signed download)
  if (template.source_pdf_path) {
    const { data, error } = await supabase.storage
      .from("pdf-templates")
      .download(template.source_pdf_path);
    if (!error && data) return await data.arrayBuffer();
  }
  const res = await fetch(template.source_pdf_url);
  return await res.arrayBuffer();
}

async function fetchImageBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

/**
 * Render filled PDF from template + data. Returns Blob.
 * Field coords are stored as (x, y) from page TOP-LEFT in pt — we convert to pdf-lib (bottom-left).
 */
export async function renderPdfTemplate(
  template: PdfTemplateRecord,
  data: Record<string, any>,
): Promise<Blob> {
  const srcBytes = await fetchPdfBytes(template);
  const pdf = await PDFDocument.load(srcBytes);
  pdf.registerFontkit(fontkit);

  const [regular, bold] = await Promise.all([loadThaiFont(false), loadThaiFont(true)]);
  const fontRegular = await pdf.embedFont(regular, { subset: true });
  const fontBold = await pdf.embedFont(bold, { subset: true });
  const fontSymbol = await pdf.embedFont(StandardFonts.ZapfDingbats);

  const pages = pdf.getPages();

  for (const f of template.fields as PdfField[]) {
    const page = pages[f.page - 1];
    if (!page) continue;
    const { height: ph } = page.getSize();
    const fontSize = f.style?.fontSize ?? 14;
    const useBold = !!f.style?.bold;
    const font = useBold ? fontBold : fontRegular;
    const color = hexToRgb(f.style?.color);
    const align = f.style?.align ?? "left";

    // convert top-left → bottom-left
    const yBottom = ph - f.y - f.h;

    if (f.type === "checkbox") {
      const val = resolveBinding(f.binding, data).trim().toLowerCase();
      const checked = ["true", "1", "yes", "y", "✓", "x"].includes(val);
      // box
      page.drawRectangle({
        x: f.x, y: yBottom, width: f.w, height: f.h,
        borderColor: rgb(0, 0, 0), borderWidth: 0.8,
      });
      if (checked) {
        const cw = fontSymbol.widthOfTextAtSize("4", f.h * 0.8);
        page.drawText("4", {
          x: f.x + (f.w - cw) / 2,
          y: yBottom + f.h * 0.15,
          size: f.h * 0.8,
          font: fontSymbol,
          color,
        });
      }
      continue;
    }

    if (f.type === "image" || f.type === "signature") {
      const url = resolveBinding(f.binding, data);
      if (!url) continue;
      const bytes = await fetchImageBytes(url);
      if (!bytes) continue;
      let img;
      try {
        img = url.toLowerCase().includes(".png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      } catch {
        try { img = await pdf.embedPng(bytes); } catch { continue; }
      }
      page.drawImage(img, { x: f.x, y: yBottom, width: f.w, height: f.h });
      continue;
    }

    // text-ish
    let value = resolveBinding(f.binding, data);
    if (f.type === "currency") {
      const n = Number(value);
      if (!isNaN(n)) value = n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (f.type === "number") {
      const n = Number(value);
      if (!isNaN(n)) value = n.toLocaleString("th-TH");
    }
    if (f.maxLength) value = value.slice(0, f.maxLength);

    const drawLine = (line: string, lineY: number) => {
      let x = f.x;
      const tw = font.widthOfTextAtSize(line, fontSize);
      if (align === "center") x = f.x + (f.w - tw) / 2;
      else if (align === "right") x = f.x + f.w - tw;
      page.drawText(line, { x, y: lineY, size: fontSize, font, color });
    };

    if (f.multiline) {
      // simple word-wrap
      const words = value.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (font.widthOfTextAtSize(test, fontSize) > f.w && cur) {
          lines.push(cur); cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      const lineH = fontSize * 1.15;
      lines.forEach((ln, i) => drawLine(ln, yBottom + f.h - (i + 1) * lineH));
    } else {
      // vertical center
      drawLine(value, yBottom + (f.h - fontSize) / 2);
    }
  }

  const out = await pdf.save();
  // Avoid TS BlobPart ArrayBufferLike issue with strict targets
  return new Blob([out as unknown as ArrayBuffer], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
