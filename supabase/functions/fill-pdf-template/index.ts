// Fill a PDF template with provided data, draw text/checkmarks at AI-detected coordinates,
// upload the result to Storage, log to template_fill_history, and return a signed URL.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Font registry — Thai-capable fonts fetched from Google Fonts mirror.
const FONT_REGISTRY: Record<string, { url: string; boldUrl?: string }> = {
  sarabun: {
    url: "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf",
  },
  kanit: {
    url: "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Bold.ttf",
  },
  prompt: {
    url: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf",
  },
  mitr: {
    url: "https://github.com/google/fonts/raw/main/ofl/mitr/Mitr-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/mitr/Mitr-Bold.ttf",
  },
  noto: {
    url: "https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf",
  },
};
const fontBytesCache = new Map<string, Uint8Array>();
async function loadFontBytes(url: string): Promise<Uint8Array> {
  if (fontBytesCache.has(url)) return fontBytesCache.get(url)!;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`font fetch failed: ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  fontBytesCache.set(url, bytes);
  return bytes;
}
function hexToRgb(hex?: string): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!userToken) return json({ error: "Unauthorized" }, 401);

    const { template_id, data, student_id } = await req.json();
    if (!template_id) return json({ error: "template_id required" }, 400);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Require a valid authenticated user
    const { data: u, error: authErr } = await supa.auth.getUser(userToken);
    if (authErr || !u?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId: string = u.user.id;

    const { data: tpl, error: tplErr } = await supa
      .from("print_templates")
      .select("id, name, source_pdf_path, field_map")
      .eq("id", template_id)
      .single();
    if (tplErr || !tpl) return json({ error: "template not found" }, 404);
    if (!tpl.source_pdf_path) return json({ error: "no source pdf" }, 400);

    const { data: file, error: dlErr } = await supa.storage
      .from("print-templates")
      .download(tpl.source_pdf_path);
    if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message}`);
    const pdfBytes = new Uint8Array(await file.arrayBuffer());

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
    pdfDoc.registerFontkit(fontkit);
    const pages = pdfDoc.getPages();

    // Lazy-embed fonts as fields request them. Key: "<family>|<bold>"
    const embeddedFonts = new Map<string, any>();
    async function getFont(family: string, bold: boolean) {
      const key = `${family}|${bold ? "b" : "r"}`;
      if (embeddedFonts.has(key)) return embeddedFonts.get(key);
      const def = FONT_REGISTRY[family] || FONT_REGISTRY.sarabun;
      const url = bold && def.boldUrl ? def.boldUrl : def.url;
      const bytes = await loadFontBytes(url);
      const f = await pdfDoc.embedFont(bytes, { subset: true });
      embeddedFonts.set(key, f);
      return f;
    }

    const fields: any[] = Array.isArray(tpl.field_map) ? (tpl.field_map as any) : [];
    const values: Record<string, any> = data || {};
    const formFieldNames = await fillNativeAcroForm(pdfDoc, values, fields, getFont);

    for (const f of fields) {
      if (formFieldNames.has(String(f.key || "")) || formFieldNames.has(String(f.label || ""))) continue;
      const pageIdx = Math.max(0, Math.min(pages.length - 1, (f.page || 1) - 1));
      const page = pages[pageIdx];
      const box = getPageBox(page);
      const x = box.x + (f.x || 0) * box.width;
      const yTop = (f.y || 0) * box.height;
      const w = (f.w || 0) * box.width;
      const h = (f.h || 0) * box.height;
      const y = box.y + box.height - yTop - h;
      const v = values[f.key];

      if (f.type === "checkbox") {
        if (isCheckedValue(v, f)) drawCheck(page, x, y, w, h);
      } else if (f.type === "radio") {
        if (isCheckedValue(v, f)) {
          drawCheck(page, x, y, w, h);
        }
      } else if (f.type === "image" || f.type === "signature") {
        if (typeof v === "string" && v.startsWith("data:image")) {
          try {
            const m = v.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
            if (m) {
              const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
              const img = m[1].toLowerCase() === "png" ? await pdfDoc.embedPng(bin) : await pdfDoc.embedJpg(bin);
              page.drawImage(img, { x, y, width: w, height: h });
            }
          } catch (e) { console.warn("embed image failed", e); }
        }
      } else {
        if (v == null || v === "") continue;
        const text = Array.isArray(v) ? v.join(", ") : String(v);
        const fnt = await getFont(f.fontFamily || "sarabun", !!f.bold);
        const fontSize = fitFontSize(fnt, text, w - 4, h, f.type === "longtext", f.fontSize);
        const lines = f.type === "longtext" ? wrapText(fnt, text, fontSize, w - 4) : [fitSingleLine(fnt, text, fontSize, w - 4)];
        drawTextBox(page, fnt, lines, x, y, w, h, fontSize, f.align || "left", f.color);
      }
    }

    // ฝังค่า AcroForm ทั้งหมดลงในหน้ากระดาษ (flatten) ถ้ายังมีเหลือ
    try { pdfDoc.getForm()?.flatten?.(); } catch (_) {}


    const outBytes = await pdfDoc.save();
    const fileName = `${template_id}/${Date.now()}_${userId || "anon"}.pdf`;

    const { error: upErr } = await supa.storage
      .from("print-templates")
      .upload(`filled/${fileName}`, outBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    const { data: signed } = await supa.storage
      .from("print-templates")
      .createSignedUrl(`filled/${fileName}`, 3600);

    // Log history & bump counter
    await supa.from("template_fill_history").insert({
      template_id,
      student_id: student_id || null,
      filled_by: userId,
      data: values,
      output_pdf_path: `filled/${fileName}`,
    });
    // Bump usage counter
    const { data: cur } = await supa.from("print_templates").select("fill_count").eq("id", template_id).single();
    await supa.from("print_templates")
      .update({ last_used_at: new Date().toISOString(), fill_count: (cur?.fill_count || 0) + 1 })
      .eq("id", template_id);

    return json({
      ok: true,
      output_path: `filled/${fileName}`,
      url: signed?.signedUrl,
      bytes: outBytes.length,
    });
  } catch (e: any) {
    console.error("fill-pdf-template error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function fillNativeAcroForm(pdfDoc: any, values: Record<string, any>, mappedFields: any[], getFont: (family: string, bold: boolean) => Promise<any>) {
  const handled = new Set<string>();
  try {
    const form = pdfDoc.getForm();
    const acroFields = form.getFields?.() || [];
    if (!acroFields.length) return handled;

    const byKey = new Map<string, any>();
    for (const f of mappedFields) {
      byKey.set(String(f.key || "").toLowerCase(), f);
      byKey.set(String(f.label || "").toLowerCase(), f);
    }

    for (const field of acroFields) {
      const name = field.getName?.() || "";
      const map = byKey.get(name.toLowerCase());
      const key = map?.key || name;
      const raw = values[key] ?? values[name] ?? values[map?.label];
      if (raw == null || raw === "") continue;

      try {
        const ctor = field.constructor?.name || "";
        if (ctor.includes("TextField")) {
          field.setText(String(raw));
          handled.add(name); handled.add(key);
        } else if (ctor.includes("CheckBox")) {
          if (isCheckedValue(raw, map)) field.check(); else field.uncheck?.();
          handled.add(name); handled.add(key);
        } else if (ctor.includes("RadioGroup")) {
          const option = selectRadioOption(field.getOptions?.() || [], raw);
          if (option) {
            field.select(option);
            handled.add(name); handled.add(key);
          }
        } else if (ctor.includes("Dropdown") || ctor.includes("OptionList")) {
          const option = selectRadioOption(field.getOptions?.() || [], raw);
          if (option) {
            field.select(option);
            handled.add(name); handled.add(key);
          }
        }
      } catch (e) {
        console.warn("AcroForm fill skipped", name, e);
      }
    }

    try {
      const sarabun = await getFont("sarabun", false);
      form.updateFieldAppearances(sarabun);
    } catch (e) {
      console.warn("AcroForm appearance update skipped", e);
    }
    try { form.flatten(); } catch (e) { console.warn("AcroForm flatten skipped", e); }
  } catch (_) {
    return handled;
  }
  return handled;
}

function isCheckedValue(value: any, field?: any) {
  if (value === true || value === 1 || value === "1") return true;
  const v = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "checked", "on", "เลือก", "ใช่", "✓", "✔"].includes(v)) return true;
  const candidates = [field?.value, field?.option, field?.label, ...(Array.isArray(field?.options) ? field.options : [])]
    .filter(Boolean).map((x: any) => String(x).trim().toLowerCase());
  return candidates.includes(v);
}

function selectRadioOption(options: string[], raw: any) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return options.find((o) => o === value)
    || options.find((o) => o.trim().toLowerCase() === value.toLowerCase())
    || options.find((o) => o.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(o.toLowerCase()))
    || "";
}

function fitFontSize(font: any, text: string, maxW: number, maxH: number, multiline = false, requestedSize?: number) {
  let size = Math.max(8, Math.min(requestedSize || 16, maxH * 0.72 || 12));
  while (size > 6) {
    const lines = multiline ? wrapText(font, text, size, maxW) : [text];
    const lineH = size * 1.15;
    const fitsH = lines.length * lineH <= Math.max(maxH, lineH);
    const fitsW = lines.every((line) => (font.widthOfTextAtSize?.(line, size) ?? 0) <= maxW);
    if (fitsH && fitsW) return size;
    size -= 0.5;
  }
  return 6;
}

function getPageBox(page: any) {
  try {
    const crop = page.getCropBox?.();
    if (crop && crop.width > 0 && crop.height > 0) return crop;
  } catch (_) {}
  const size = page.getSize();
  return { x: 0, y: 0, width: size.width, height: size.height };
}

function fitSingleLine(font: any, text: string, size: number, maxW: number) {
  let t = text;
  while (t.length > 1 && maxW && font.widthOfTextAtSize?.(t, size) > maxW) {
    t = t.slice(0, -1);
  }
  return t;
}

function wrapText(font: any, text: string, size: number, maxW: number) {
  const src = String(text || "").split(/\r?\n/);
  const out: string[] = [];
  for (const paragraph of src) {
    const tokens = paragraph.includes(" ") ? paragraph.split(/\s+/) : Array.from(paragraph);
    let line = "";
    for (const token of tokens) {
      const sep = paragraph.includes(" ") && line ? " " : "";
      const next = `${line}${sep}${token}`;
      if (line && font.widthOfTextAtSize?.(next, size) > maxW) {
        out.push(line);
        line = token;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function drawTextBox(page: any, font: any, lines: string[], x: number, y: number, w: number, h: number, size: number, align: string, colorHex?: string) {
  const c = hexToRgb(colorHex);
  const lineH = size * 1.15;
  const textBlockH = lines.length * lineH;
  const topY = y + h - Math.max(0, (h - textBlockH) / 2) - size;
  lines.forEach((line, i) => {
    let drawX = x + 2;
    const textW = font.widthOfTextAtSize?.(line, size) ?? 0;
    if (align === "center") drawX = x + Math.max(0, (w - textW) / 2);
    if (align === "right") drawX = x + Math.max(0, w - textW - 2);
    try {
      page.drawText(line, { x: drawX, y: topY - i * lineH, size, font, color: rgb(c.r, c.g, c.b) });
    } catch (e) {
      console.warn("drawText failed", e);
    }
  });
}


function drawCheck(page: any, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2.4;
  // Draw "✓" as two lines
  page.drawLine({
    start: { x: cx - r, y: cy },
    end: { x: cx - r / 3, y: cy - r * 0.8 },
    thickness: 1.6, color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: cx - r / 3, y: cy - r * 0.8 },
    end: { x: cx + r, y: cy + r },
    thickness: 1.6, color: rgb(0, 0, 0),
  });
}

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
