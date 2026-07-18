/**
 * Form Field Token system
 * --------------------------------------------------
 * รองรับ "ช่องกรอก" ในเทมเพลตที่แก้ไขผ่าน Word editor
 *
 * รูปแบบ:
 *   ในเอกสารจะเก็บเป็น:
 *     <span data-field="key" data-label="label" data-type="text">{{label}}</span>
 *   หรือ token แบบข้อความล้วน (กรณี copy/paste จากที่อื่น):
 *     {{key:label:type}}
 *
 * type ที่รองรับ: text | textarea | date | number | select
 *   - select รองรับ options คั่นด้วย "|" เช่น {{gender:เพศ:select:ชาย|หญิง}}
 */
import { Node, mergeAttributes } from "@tiptap/core";

export type FieldType = "text" | "textarea" | "date" | "number" | "select";

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

// ---- Regex สำหรับ token แบบข้อความ {{key:label:type[:opt1|opt2]}} ----
const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*:\s*([^:}]+?)\s*:\s*(text|textarea|date|number|select)\s*(?::\s*([^}]+?))?\s*\}\}/g;

/** แตก fields ทั้งหมดจาก HTML (รวมทั้ง <span data-field> และ token ข้อความ) */
export function parseFields(html: string): FormField[] {
  const out = new Map<string, FormField>();
  if (!html) return [];

  // 1) จาก span tag
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
    const key = el.getAttribute("data-field") || "";
    if (!key || out.has(key)) return;
    out.set(key, {
      key,
      label: el.getAttribute("data-label") || key,
      type: (el.getAttribute("data-type") as FieldType) || "text",
      options: (el.getAttribute("data-options") || "").split("|").filter(Boolean),
    });
  });

  // 2) จาก token text
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(html)) !== null) {
    const [, key, label, type, opts] = m;
    if (out.has(key)) continue;
    out.set(key, {
      key, label, type: type as FieldType,
      options: opts ? opts.split("|").map(s => s.trim()).filter(Boolean) : undefined,
    });
  }

  return Array.from(out.values());
}

/** แทนค่าที่กรอกลงไปใน template HTML แล้วคืน HTML สำหรับ preview/print */
export function fillTemplate(html: string, values: Record<string, string>): string {
  if (!html) return "";
  let out = html;

  // 1) แทน span — เปลี่ยน innerHTML เป็นค่าจริง (หรือเส้นไข่ปลา)
  const div = document.createElement("div");
  div.innerHTML = out;
  div.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
    const key = el.getAttribute("data-field") || "";
    const v = (values[key] ?? "").toString().trim();
    el.removeAttribute("contenteditable");
    el.classList.remove("field-token");
    el.style.background = "transparent";
    el.style.border = "0";
    el.style.padding = "0";
    el.textContent = v || "..............................";
  });
  out = div.innerHTML;

  // 2) แทน token ข้อความ
  out = out.replace(TOKEN_RE, (_full, key: string) => {
    const v = (values[key] ?? "").toString().trim();
    return v || "..............................";
  });

  return out;
}

/* ============================================================
 * Tiptap Node — "FieldToken"
 *   แสดงเป็น chip สีฟ้าใน editor เพื่อให้ผู้แก้เทมเพลตเห็นชัด
 * ============================================================ */
export const FieldToken = Node.create({
  name: "fieldToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fieldKey: { default: "", parseHTML: (el) => el.getAttribute("data-field") },
      label:    { default: "",  parseHTML: (el) => el.getAttribute("data-label") },
      type:     { default: "text", parseHTML: (el) => el.getAttribute("data-type") },
      options:  { default: "",  parseHTML: (el) => el.getAttribute("data-options") || "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-field]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes({
      "data-field":   HTMLAttributes.fieldKey,
      "data-label":   HTMLAttributes.label,
      "data-type":    HTMLAttributes.type,
      "data-options": HTMLAttributes.options,
      class: "field-token",
      contenteditable: "false",
    });
    return ["span", attrs, `{{${HTMLAttributes.label || HTMLAttributes.fieldKey}}}`];
  },

  addCommands(): any {
    return {
      insertFieldToken:
        (attrs: { fieldKey: string; label: string; type: FieldType; options?: string }) =>
        ({ commands }: any) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              fieldKey: attrs.fieldKey,
              label: attrs.label,
              type: attrs.type,
              options: attrs.options || "",
            },
          }),
    };
  },
}) as any;

export const FIELD_TOKEN_CSS = `
  .field-token {
    display: inline-block;
    padding: 0 6px;
    margin: 0 1px;
    background: #dbeafe;
    color: #1e40af;
    border: 1px dashed #60a5fa;
    border-radius: 4px;
    font-size: 0.95em;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    user-select: all;
  }
  .field-token:hover { background: #bfdbfe; }
  @media print { .field-token { display: none; } }
`;

/* ============================================================
 * Auto-detect fields from imported HTML
 *  - <input>, <textarea>, <select> ของ HTML form
 *  - placeholder แบบ "label ........" / "label _____" / "label : ___"
 *  - {{ชื่อ}} หรือ [ชื่อ] แบบเปล่าๆ
 * คืน HTML ใหม่ที่แทนที่ pattern ด้วย <span data-field=...>
 * ============================================================ */
const slug = (s: string) => {
  const map: Record<string, string> = {
    "ชื่อ": "name", "นามสกุล": "lastname", "ชื่อ-นามสกุล": "fullname",
    "วันที่": "date", "เดือน": "month", "ปี": "year", "พ.ศ.": "year_be",
    "ที่อยู่": "address", "เบอร์": "phone", "โทร": "phone", "โทรศัพท์": "phone",
    "อีเมล": "email", "ตำแหน่ง": "position", "หน่วยงาน": "department",
    "เลขที่": "no", "ห้อง": "room", "ชั้น": "grade", "เรื่อง": "subject",
    "เรียน": "to", "อายุ": "age", "เพศ": "gender", "เหตุผล": "reason",
    "หมายเหตุ": "note",
  };
  const t = s.trim().replace(/[:：]\s*$/, "");
  if (map[t]) return map[t];
  return "f_" + t.toLowerCase()
    .replace(/[^\w\u0E00-\u0E7F]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "field";
};

const guessType = (label: string): FieldType => {
  if (/วันที่|date/i.test(label)) return "date";
  if (/อายุ|จำนวน|ปี|number|count/i.test(label)) return "number";
  if (/เหตุผล|รายละเอียด|หมายเหตุ|address|ที่อยู่/i.test(label)) return "textarea";
  if (/เพศ|gender|สถานภาพ/i.test(label)) return "select";
  return "text";
};

export function autoDetectFields(html: string): { html: string; count: number } {
  if (!html) return { html: "", count: 0 };
  const div = document.createElement("div");
  div.innerHTML = html;
  let count = 0;
  const used = new Set<string>();
  const uniqKey = (base: string) => {
    let k = base, i = 2;
    while (used.has(k)) { k = `${base}_${i++}`; }
    used.add(k);
    return k;
  };
  const tokenSpan = (key: string, label: string, type: FieldType) =>
    `<span data-field="${key}" data-label="${label.replace(/"/g, "&quot;")}" data-type="${type}" class="field-token" contenteditable="false">{{${label}}}</span>`;

  // 1) HTML form elements → token
  div.querySelectorAll<HTMLElement>("input, textarea, select").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const labelText =
      el.getAttribute("placeholder") ||
      el.getAttribute("name") ||
      el.getAttribute("aria-label") ||
      (el.previousElementSibling?.textContent || "").trim().replace(/[:：]$/, "") ||
      "field";
    const type: FieldType =
      tag === "textarea" ? "textarea" :
      tag === "select" ? "select" :
      (el.getAttribute("type") === "date" ? "date" :
       el.getAttribute("type") === "number" ? "number" : "text");
    const key = uniqKey(el.getAttribute("name") || slug(labelText));
    const span = document.createElement("span");
    span.innerHTML = tokenSpan(key, labelText, type);
    el.replaceWith(span.firstChild!);
    count++;
  });

  // 2) สแกนข้อความใน text node หา pattern "label ........" / "label ____"
  //    รองรับ . _ ─ – —  ความยาว >= 4
  const FILL = /([^\s\.\_\-–—:：]{1,40}?)\s*[:：]?\s*([\.\_\-–—]{4,}|\s*\.{2,}\s*\.{2,}(?:\s*\.{2,})*)/g;
  const walk = (node: globalThis.Node) => {
    if (node.nodeType === 3) {
      const txt = node.nodeValue || "";
      if (!/[\.\_\-–—]{4,}/.test(txt)) return;
      const frag = document.createDocumentFragment();
      let last = 0; let m: RegExpExecArray | null;
      FILL.lastIndex = 0;
      while ((m = FILL.exec(txt)) !== null) {
        const [full, rawLabel] = m;
        const label = rawLabel.trim().replace(/[:：]$/, "");
        if (!label || label.length < 1) continue;
        const start = m.index;
        if (start > last) frag.appendChild(document.createTextNode(txt.slice(last, start)));
        frag.appendChild(document.createTextNode(label + " "));
        const tmp = document.createElement("span");
        tmp.innerHTML = tokenSpan(uniqKey(slug(label)), label, guessType(label));
        frag.appendChild(tmp.firstChild!);
        count++;
        last = start + full.length;
      }
      if (last > 0) {
        if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
        (node as ChildNode).replaceWith(frag);
      }
    } else if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return;
      if (el.hasAttribute?.("data-field")) return;
      Array.from(el.childNodes).forEach(walk);
    }
  };
  walk(div as unknown as globalThis.Node);

  return { html: div.innerHTML, count };
}


