// Shared types + renderer for custom E-Form templates designed by admin
import { replaceSchoolAssetTokens } from "./eformSchoolAssets";
import { BE_OFFSET } from "./dateBE";
export type EFormFieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "select"
  | "checkbox"
  | "radio"
  | "signature"
  | "autofill";

export type EFormAutofillSource =
  | "user.name"
  | "user.position"
  | "school.name"
  | "school.address"
  | "school.phone"
  | "director.name"
  | "director.title"
  | "today"
  | "today_thai";

export interface EFormField {
  key: string;
  label: string;
  type: EFormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  autofillSource?: EFormAutofillSource;
  half?: boolean;
  defaultValue?: string;
}

export interface EFormTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  content_html: string;
  fields: EFormField[];
  page_size: string;
  font_family: string;
  font_size_pt: number;
  is_active: boolean;
  school_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // PDF overlay mode (added Phase 2)
  template_mode?: "html" | "pdf";
  pdf_url?: string | null; // storage path within eform-pdfs bucket
  pdf_overlay_fields?: any[]; // PdfOverlayField[] — typed in eformPdf.ts
}

export interface EFormRenderContext {
  user?: { name?: string; position?: string };
  school?: { name?: string; address?: string; phone?: string };
  director?: { name?: string; title?: string };
  assets?: { garuda_emblem?: string; school_seal?: string; school_logo?: string };
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function thaiDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + BE_OFFSET}`;
}

export function resolveAutofill(source: EFormAutofillSource | undefined, ctx: EFormRenderContext): string {
  if (!source) return "";
  const map: Record<EFormAutofillSource, string> = {
    "user.name": ctx.user?.name ?? "",
    "user.position": ctx.user?.position ?? "",
    "school.name": ctx.school?.name ?? "",
    "school.address": ctx.school?.address ?? "",
    "school.phone": ctx.school?.phone ?? "",
    "director.name": ctx.director?.name ?? "",
    "director.title": ctx.director?.title ?? "",
    "today": new Date().toISOString().slice(0, 10),
    "today_thai": thaiDate(new Date()),
  };
  return map[source] ?? "";
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldValue(field: EFormField, raw: string, ctx: EFormRenderContext): string {
  if (field.type === "autofill") return resolveAutofill(field.autofillSource, ctx);
  if (raw == null || raw === "") return "";
  if (field.type === "checkbox") return raw === "true" || raw === "1" ? "☑" : "☐";
  if (field.type === "date") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : thaiDate(d);
  }
  if (field.type === "signature") {
    if (raw.startsWith("data:image")) {
      return `<img src="${raw}" style="height:54pt;object-fit:contain;" alt="ลายเซ็น" />`;
    }
    return raw;
  }
  if (field.type === "textarea") {
    return raw.replace(/\n/g, "<br/>");
  }
  return raw;
}

const preserveTokenLayoutStyle = (attrs: string, hasValue: boolean): string => {
  const styleMatch = /style=["']([^"']*)["']/i.exec(attrs);
  const kept: string[] = [];
  if (styleMatch) {
    for (const part of styleMatch[1].split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [rawName] = trimmed.split(":");
      const name = rawName.trim().toLowerCase();
      if (
        name.startsWith("background") ||
        name === "color" ||
        name === "font-weight" ||
        name === "border" ||
        name === "border-radius"
      ) continue;
      kept.push(trimmed);
    }
  }
  kept.push(`color:${hasValue ? "#000" : "#9ca3af"}`);
  return kept.join(";");
};

const renderFieldSpan = (field: EFormField, value: string, attrs: string, showPlaceholder: boolean) => {
  const hasValue = value !== "";
  const style = preserveTokenLayoutStyle(attrs, hasValue);
  const content = hasValue ? value : (showPlaceholder ? `[${field.label}]` : "&nbsp;");
  return `<span style="${style}">${content}</span>`;
};

/**
 * Render a custom template's HTML by substituting field tokens.
 * Tokens supported:
 *   - {{key}}  — plain mustache style
 *   - <span data-eform-field="key">…</span>  — editor-inserted token
 */
export function renderEFormTemplate(
  html: string,
  fields: EFormField[],
  values: Record<string, string>,
  ctx: EFormRenderContext,
  opts?: { placeholderOnEmpty?: boolean },
): string {
  let out = html || "";
  const showPlaceholder = opts?.placeholderOnEmpty ?? false;
  for (const f of fields) {
    const raw = values[f.key] ?? f.defaultValue ?? "";
    const v = fieldValue(f, raw, ctx);
    // mustache token
    out = out.split(`{{${f.key}}}`).join(v || (showPlaceholder ? `[${f.label}]` : ""));
    // span token (editor inserts this)
    const spanRe = new RegExp(
      `<span([^>]*data-eform-field=["']${escapeRegex(f.key)}["'][^>]*)>[\\s\\S]*?</span>`,
      "gi",
    );
    out = out.replace(spanRe, (_match, attrs: string) => renderFieldSpan(f, v, attrs, showPlaceholder));
  }
  // แปลง placeholder ของตราโรงเรียน/ครุฑ/โลโก้ ให้เป็น <img> จาก CMS อัตโนมัติ
  // ทุก template ใช้ค่าเดียวกัน ไม่ต้องไปแก้ทีละไฟล์
  out = replaceSchoolAssetTokens(out, ctx.assets);
  return out;
}
