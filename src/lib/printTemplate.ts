import Handlebars from "handlebars";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { openPrintWindow } from "@/lib/printUtils";
import { BE_OFFSET } from "./dateBE";

export interface PrintTemplate {
  id: string;
  code: string;
  name: string;
  paper: string;
  orientation: string;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  header_html: string | null;
  body_html: string;
  footer_html: string | null;
  css: string | null;
  variables: any;
  sample_data: any;
  is_default: boolean;
  is_active: boolean;
  version: number;
  background_url?: string | null;
  overlay_mode?: boolean;
}

// ───── Handlebars helpers ─────
const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

Handlebars.registerHelper("thaiDate", (date: any) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + BE_OFFSET}`;
});

Handlebars.registerHelper("beYear", (year: any) => {
  const y = Number(year);
  if (!y) return "";
  return y > 2400 ? y : y + BE_OFFSET;
});

Handlebars.registerHelper("eq", (a: any, b: any) => a === b);
Handlebars.registerHelper("ne", (a: any, b: any) => a !== b);
Handlebars.registerHelper("gt", (a: any, b: any) => a > b);
Handlebars.registerHelper("lt", (a: any, b: any) => a < b);
Handlebars.registerHelper("add", (a: any, b: any) => Number(a) + Number(b));
Handlebars.registerHelper("inc", (a: any) => Number(a) + 1);
Handlebars.registerHelper("default", (v: any, d: any) => (v == null || v === "" ? d : v));

const PAPER_SIZES: Record<string, string> = {
  A4: "210mm 297mm",
  A5: "148mm 210mm",
  letter: "216mm 279mm",
  A6: "105mm 148mm",
};

export function buildPageCss(tpl: PrintTemplate): string {
  const size = PAPER_SIZES[tpl.paper] || PAPER_SIZES.A4;
  const orient = tpl.orientation === "landscape" ? " landscape" : "";
  const overlayCss = tpl.overlay_mode && tpl.background_url
    ? `
@page { size: ${size}${orient}; margin: 0; }
html, body { margin:0; padding:0; }
.pt-page { position:relative; width:100%; min-height:100vh; background:url('${tpl.background_url}') no-repeat center/contain; }
.pt-body, .pt-header, .pt-footer { position:relative; z-index:2; }
.pt-field { position:absolute; }`
    : `
@page { size: ${size}${orient}; margin: ${tpl.margin_top}mm ${tpl.margin_right}mm ${tpl.margin_bottom}mm ${tpl.margin_left}mm; }
.pt-header { margin-bottom: 11px; }
.pt-footer { margin-top: 11px; font-size: 16px; color:#666; text-align:center; }`;
  return `
body { font-family: 'Sarabun', sans-serif; font-size: 21px; color:#000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
${overlayCss}
${tpl.css || ""}
  `.trim();
}

export function renderTemplate(tpl: PrintTemplate, data: any): string {
  try {
    const header = Handlebars.compile(tpl.header_html || "")(data);
    const body = Handlebars.compile(tpl.body_html || "")(data);
    const footer = Handlebars.compile(tpl.footer_html || "")(data);
    // Sanitize to block scripts/onclick etc.
    const safe = (h: string) =>
      DOMPurify.sanitize(h, { ADD_TAGS: ["style"], ADD_ATTR: ["style", "colspan", "rowspan"] });
    const inner = `${safe(header && `<div class="pt-header">${header}</div>`)}
      ${safe(`<div class="pt-body">${body}</div>`)}
      ${safe(footer && `<div class="pt-footer">${footer}</div>`)}`;
    return tpl.overlay_mode ? `<div class="pt-page">${inner}</div>` : inner;
  } catch (e: any) {
    return `<pre style="color:#c00;">Template error: ${e.message}</pre>`;
  }
}

export async function getActiveTemplate(code: string): Promise<PrintTemplate | null> {
  const { data } = await supabase
    .from("print_templates" as any)
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();
  return (data as any) || null;
}

export async function printWithTemplate(tpl: PrintTemplate, data: any) {
  const html = renderTemplate(tpl, data);
  const pageCss = buildPageCss(tpl);
  const full = `<style>${pageCss}</style>${html}`;
  openPrintWindow(full, {
    title: tpl.name,
    landscape: tpl.orientation === "landscape",
  });
}

/** Try template; if none active, run legacy fallback. */
export async function printByCode(
  code: string,
  data: any,
  fallback?: () => void,
): Promise<boolean> {
  const tpl = await getActiveTemplate(code);
  if (tpl) {
    await printWithTemplate(tpl, data);
    return true;
  }
  if (fallback) fallback();
  return false;
}

// ───── Template linter ─────
export interface LintIssue {
  level: "error" | "warn" | "info";
  message: string;
  field?: "header" | "body" | "footer" | "css" | "sample_data";
}

const KNOWN_HELPERS = new Set([
  "thaiDate", "beYear", "eq", "ne", "gt", "lt", "add", "inc", "default",
  "if", "unless", "each", "with", "lookup", "log",
]);

export function lintTemplate(tpl: Partial<PrintTemplate>): LintIssue[] {
  const issues: LintIssue[] = [];
  const sections: Array<["header" | "body" | "footer", string]> = [
    ["header", tpl.header_html || ""],
    ["body", tpl.body_html || ""],
    ["footer", tpl.footer_html || ""],
  ];

  for (const [field, src] of sections) {
    // Balance {{ vs }}
    const open = (src.match(/\{\{/g) || []).length;
    const close = (src.match(/\}\}/g) || []).length;
    if (open !== close) {
      issues.push({ level: "error", field, message: `วงเล็บ {{ }} ไม่สมดุล (${open} เปิด / ${close} ปิด)` });
    }
    // Balance {{#each}} {{/each}}, {{#if}} {{/if}}
    for (const block of ["each", "if", "unless", "with"]) {
      const o = (src.match(new RegExp(`\\{\\{\\s*#\\s*${block}\\b`, "g")) || []).length;
      const c = (src.match(new RegExp(`\\{\\{\\s*/\\s*${block}\\b`, "g")) || []).length;
      if (o !== c) issues.push({ level: "error", field, message: `บล็อก {{#${block}}} ไม่ปิด (${o} เปิด / ${c} ปิด)` });
    }
    // Try compile
    try {
      Handlebars.precompile(src);
    } catch (e: any) {
      issues.push({ level: "error", field, message: `Handlebars: ${e.message}` });
    }
    // Unknown helpers (heuristic: first token after {{ is a helper if followed by space)
    const helperUse = [...src.matchAll(/\{\{\s*#?\s*(\w+)\s+[^}]+\}\}/g)];
    for (const m of helperUse) {
      const name = m[1];
      if (KNOWN_HELPERS.has(name)) continue;
      // skip variable paths (e.g. school.name)
      if (m[0].includes(".")) continue;
      // skip if it's clearly a path with no space (already filtered by regex)
      issues.push({ level: "warn", field, message: `อาจเป็น helper ที่ไม่รู้จัก: ${name}` });
    }
    // Overlay sanity
    if (tpl.overlay_mode && field === "body" && src && !/class=["']pt-field/.test(src)) {
      issues.push({ level: "warn", field, message: "โหมด Overlay แต่ยังไม่มี <span class=\"pt-field\"> ในเนื้อหา" });
    }
  }

  if (tpl.overlay_mode && !tpl.background_url) {
    issues.push({ level: "error", field: "body", message: "โหมด Overlay เปิดอยู่ แต่ยังไม่ได้กำหนด URL พื้นหลัง" });
  }

  // Sample data
  try {
    if (typeof tpl.sample_data === "string") JSON.parse(tpl.sample_data);
  } catch (e: any) {
    issues.push({ level: "error", field: "sample_data", message: `Sample JSON ไม่ถูกต้อง: ${e.message}` });
  }

  // CSS quick check
  if (tpl.css) {
    const ob = (tpl.css.match(/\{/g) || []).length;
    const cb = (tpl.css.match(/\}/g) || []).length;
    if (ob !== cb) issues.push({ level: "warn", field: "css", message: `CSS วงเล็บปีกกาไม่สมดุล (${ob}/${cb})` });
  }

  return issues;
}

/** Flatten an object into dot-paths for autocomplete suggestions. */
export function extractVariables(sample: any, prefix = "", out: string[] = []): string[] {
  if (!sample || typeof sample !== "object") return out;
  if (Array.isArray(sample)) {
    if (sample.length) extractVariables(sample[0], `${prefix}.[0]`, out);
    return out;
  }
  for (const k of Object.keys(sample)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = sample[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      extractVariables(v, path, out);
    } else if (Array.isArray(v)) {
      out.push(`#each ${path}`);
      extractVariables(v, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}
