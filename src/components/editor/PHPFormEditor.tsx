import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save, FileUp, Wand2, Type, Calendar, Hash, AlignLeft, ChevronDown,
  CheckSquare, ListChecks, Eye, Printer, Trash2, Bold, Italic, Underline as UIcon,
  AlignLeft as ALL, AlignCenter, AlignRight, Image as ImageIcon, Undo, Redo,
} from "lucide-react";
import { OBEC_PRINT_CSS } from "@/lib/printUtils";

/**
 * PHPFormEditor — WYSIWYG editor that produces plain HTML with REAL <input>/<textarea>/<select>
 * elements (PHP-style). Supports .docx and .html import (Word-exported HTML included).
 *
 * Output HTML is saved as-is to form_templates.content_html and rendered identically on the fill page.
 */
export interface PHPFormEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  onSave?: (html: string) => void;
  title?: string;
}

const PHP_FORM_CSS = `
  .php-page input[type="text"],
  .php-page input[type="date"],
  .php-page input[type="number"],
  .php-page input[type="email"],
  .php-page input[type="tel"],
  .php-page select,
  .php-page textarea {
    display: inline-block;
    border: 0;
    border-bottom: 1px dotted #1e40af;
    background: #f0f9ff;
    padding: 0 4px;
    font: inherit;
    color: inherit;
    min-width: 80px;
    outline: none;
    border-radius: 2px;
  }
  .php-page input[type="text"]:hover,
  .php-page select:hover,
  .php-page textarea:hover { background: #dbeafe; }
  .php-page input:focus, .php-page select:focus, .php-page textarea:focus {
    background: #fef9c3; border-bottom-color: #ca8a04;
  }
  .php-page input[data-selected="1"],
  .php-page select[data-selected="1"],
  .php-page textarea[data-selected="1"] {
    outline: 2px solid #2563eb; outline-offset: 1px;
  }
  .php-page textarea { vertical-align: top; min-height: 1.6em; resize: vertical; }
  .php-page input[type="checkbox"] { transform: scale(1.2); margin: 0 4px; }
  @media print {
    .php-page input, .php-page select, .php-page textarea {
      background: transparent !important; border-bottom: 1px solid #000 !important;
    }
  }
`;

const A4_STYLE: React.CSSProperties = {
  width: "21cm",
  minHeight: "29.7cm",
  padding: "2.54cm",
  margin: "0 auto",
  background: "white",
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
  boxSizing: "border-box",
  fontFamily: "'TH Sarabun New','Sarabun','IBM Plex Sans Thai',sans-serif",
  fontSize: "16pt",
  lineHeight: 1.5,
  color: "#000",
};

const FILL_RE = /([^\s\.\_\-–—:：]{1,40}?)\s*[:：]?\s*([\.\_\-–—]{4,}|(?:\.{2,}\s*){2,})/g;

function slugKey(label: string, used: Set<string>): string {
  const map: Record<string, string> = {
    "ชื่อ": "name", "นามสกุล": "lastname", "ชื่อ-นามสกุล": "fullname",
    "วันที่": "date", "ที่อยู่": "address", "เบอร์": "phone", "โทร": "phone",
    "อีเมล": "email", "ตำแหน่ง": "position", "ห้อง": "room", "ชั้น": "grade",
    "เรื่อง": "subject", "เรียน": "to", "อายุ": "age", "เพศ": "gender",
    "เหตุผล": "reason", "หมายเหตุ": "note",
  };
  const t = label.trim().replace(/[:：]\s*$/, "");
  let base = map[t] || ("f_" + t.toLowerCase().replace(/[^\w\u0E00-\u0E7F]+/g, "_").replace(/^_|_$/g, "")).slice(0, 30);
  if (!base || base === "f_") base = "field";
  let k = base, i = 2;
  while (used.has(k)) k = `${base}_${i++}`;
  used.add(k);
  return k;
}
function guessType(label: string): string {
  if (/วันที่|date/i.test(label)) return "date";
  if (/อายุ|จำนวน|number|count/i.test(label)) return "number";
  if (/เหตุผล|รายละเอียด|หมายเหตุ|address|ที่อยู่/i.test(label)) return "textarea";
  if (/เพศ|gender|สถานภาพ/i.test(label)) return "select";
  return "text";
}

function buildField(label: string, type: string, key: string, width = "180px"): string {
  const l = label.replace(/"/g, "&quot;");
  if (type === "textarea")
    return ` <textarea name="${key}" placeholder="${l}" rows="2" style="width:${width}"></textarea> `;
  if (type === "select")
    return ` <select name="${key}"><option value="">-- ${l} --</option><option>ชาย</option><option>หญิง</option></select> `;
  if (type === "checkbox")
    return ` <input type="checkbox" name="${key}" /> `;
  return ` <input type="${type}" name="${key}" placeholder="${l}" style="width:${width}" /> `;
}

/** สแกน HTML แล้วแทน "หัวข้อ ........" / "หัวข้อ ___" ด้วย <input>/<textarea>/<select> ของจริง */
function autoConvertFillsToInputs(root: HTMLElement): number {
  let count = 0;
  const used = new Set<string>();
  root.querySelectorAll<HTMLElement>("[name]").forEach((el) => used.add(el.getAttribute("name")!));

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const txt = node.nodeValue || "";
      if (!/[\.\_\-–—]{4,}/.test(txt)) return;
      const frag = document.createDocumentFragment();
      let last = 0; let m: RegExpExecArray | null;
      FILL_RE.lastIndex = 0;
      while ((m = FILL_RE.exec(txt)) !== null) {
        const [full, rawLabel] = m;
        const label = rawLabel.trim().replace(/[:：]$/, "");
        if (!label) continue;
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        frag.appendChild(document.createTextNode(label + " "));
        const type = guessType(label);
        const key = slugKey(label, used);
        const tmp = document.createElement("span");
        tmp.innerHTML = buildField(label, type, key);
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        count++;
        last = m.index + full.length;
      }
      if (last > 0) {
        if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
        (node as ChildNode).replaceWith(frag);
      }
    } else if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      Array.from(el.childNodes).forEach(walk);
    }
  };
  walk(root);
  return count;
}

/** Sanitize HTML from Word/HTML import (strip msoNormal noise, fix images) */
function cleanWordHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<o:p>[\s\S]*?<\/o:p>/g, "")
    .replace(/<o:p\s*\/?>/g, "")
    .replace(/\s(class|lang|xml:lang|style)="[^"]*mso[^"]*"/gi, "")
    .replace(/\sstyle="mso[^"]*"/gi, "");
}

export default function PHPFormEditor({ value = "", onChange, onSave, title }: PHPFormEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [, forceTick] = useState(0);
  const tick = () => forceTick((n) => n + 1);

  // Inject CSS
  useEffect(() => {
    const id = "php-form-editor-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = PHP_FORM_CSS + "\n" + OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin);
      document.head.appendChild(s);
    }
  }, []);

  // Load initial HTML
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || `<h1 style="text-align:center">${title || ""}</h1><p></p>`;
    }
  }, [value]);

  const emit = useCallback(() => {
    if (!editorRef.current) return;
    onChange?.(editorRef.current.innerHTML);
  }, [onChange]);

  // Prevent typing inside form controls from being intercepted
  const onInput = () => emit();

  // Click handler: select form fields for editing/deleting
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const tag = t.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      e.preventDefault();
      selected?.removeAttribute("data-selected");
      t.setAttribute("data-selected", "1");
      setSelected(t);
      tick();
    } else {
      if (selected) { selected.removeAttribute("data-selected"); setSelected(null); }
    }
  };

  // Insert helpers
  const insertAtCursor = (html: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editorRef.current!.insertAdjacentHTML("beforeend", html);
    } else {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
      sel.collapseToEnd();
    }
    emit();
  };

  const used = () => {
    const u = new Set<string>();
    editorRef.current?.querySelectorAll<HTMLElement>("[name]").forEach((el) => u.add(el.getAttribute("name")!));
    return u;
  };

  const addField = (type: string) => {
    const label = window.prompt(`ป้ายกำกับช่องนี้ (เช่น "ชื่อ-นามสกุล")`, "field");
    if (label === null) return;
    const key = slugKey(label || "field", used());
    insertAtCursor(buildField(label || key, type, key));
  };

  const autoDetect = () => {
    if (!editorRef.current) return;
    const n = autoConvertFillsToInputs(editorRef.current);
    emit();
    if (n === 0) toast.info("ไม่พบรูปแบบ ___ หรือ .......... ในเอกสาร");
    else toast.success(`แปลง ${n} ช่องเป็น <input> สำเร็จ`);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editorRef.current) return;
    const name = f.name.toLowerCase();
    try {
      let html = "";
      if (name.endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser");
        const buf = await f.arrayBuffer();
        const res = await (mammoth as any).convertToHtml(
          { arrayBuffer: buf },
          { convertImage: (mammoth as any).images.imgElement((img: any) =>
              img.read("base64").then((data: string) => ({ src: `data:${img.contentType};base64,${data}` }))) }
        );
        html = res.value || "";
      } else if (name.endsWith(".html") || name.endsWith(".htm")) {
        const text = await f.text();
        const m = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        html = cleanWordHtml(m ? m[1] : text);
      } else {
        toast.error("รองรับเฉพาะไฟล์ .docx และ .html");
        return;
      }
      if (!html.trim()) { toast.error("ไม่พบเนื้อหา"); return; }
      const replace = !editorRef.current.innerText.trim() ||
        window.confirm("แทนที่เนื้อหาปัจจุบันด้วยไฟล์ที่นำเข้าหรือไม่?\n(Cancel = แทรกต่อท้าย)");
      if (replace) editorRef.current.innerHTML = html;
      else editorRef.current.insertAdjacentHTML("beforeend", html);

      if (window.confirm("ตรวจจับ ___ / .......... แล้วแปลงเป็น <input> อัตโนมัติ?")) {
        const n = autoConvertFillsToInputs(editorRef.current);
        if (n) toast.success(`แปลง ${n} ช่องสำเร็จ`);
      }
      emit();
      toast.success(`นำเข้า ${f.name} สำเร็จ`);
    } catch (err: any) {
      console.error(err); toast.error("นำเข้าไม่สำเร็จ: " + (err?.message || err));
    } finally { e.target.value = ""; }
  };

  // Cmd toolbar (rich text basics)
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };

  const onPreview = () => {
    const w = window.open("", "_blank", "width=900,height=1200"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title>
      <style>${PHP_FORM_CSS}${OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin)}
      @page{size:A4;margin:1.5cm} body{margin:0;font-family:'TH Sarabun New',serif;font-size:16pt}
      .obec-a4-page{padding:0}</style></head><body class="php-page">
      <div class="obec-a4-page">${editorRef.current?.innerHTML || ""}</div></body></html>`);
    w.document.close();
  };

  // Field-attribute panel for selected element
  const updateAttr = (k: string, v: string) => {
    if (!selected) return;
    if (v === "") selected.removeAttribute(k); else selected.setAttribute(k, v);
    emit(); tick();
  };
  const updateStyle = (k: string, v: string) => {
    if (!selected) return;
    (selected.style as any)[k] = v;
    emit(); tick();
  };
  const deleteSelected = () => {
    if (!selected) return;
    selected.remove();
    setSelected(null); emit();
  };

  return (
    <div className="flex h-full flex-col bg-editor-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b bg-white">
        <div className="flex flex-wrap items-center gap-1 p-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp className="w-4 h-4 mr-1" />นำเข้า Word / HTML
          </Button>
          <input ref={fileRef} type="file" accept=".docx,.html,.htm" className="hidden" onChange={onPickFile} />
          <Button size="sm" variant="outline" onClick={autoDetect} className="bg-warning-soft hover:bg-warning/20">
            <Wand2 className="w-4 h-4 mr-1" />แปลง ___/...... เป็น input
          </Button>
          <div className="mx-2 h-6 w-px bg-border" />

          <Button size="sm" variant="ghost" onClick={() => exec("undo")} title="Undo"><Undo className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("redo")} title="Redo"><Redo className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("bold")} title="Bold"><Bold className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("italic")} title="Italic"><Italic className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("underline")} title="Underline"><UIcon className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("justifyLeft")}><ALL className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("justifyCenter")}><AlignCenter className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => exec("justifyRight")}><AlignRight className="w-4 h-4" /></Button>

          <div className="mx-2 h-6 w-px bg-border" />
          <span className="text-xs text-muted-foreground">แทรกช่อง:</span>
          <Button size="sm" variant="outline" onClick={() => addField("text")}><Type className="w-4 h-4 mr-1" />Text</Button>
          <Button size="sm" variant="outline" onClick={() => addField("date")}><Calendar className="w-4 h-4 mr-1" />Date</Button>
          <Button size="sm" variant="outline" onClick={() => addField("number")}><Hash className="w-4 h-4 mr-1" />Number</Button>
          <Button size="sm" variant="outline" onClick={() => addField("textarea")}><AlignLeft className="w-4 h-4 mr-1" />Textarea</Button>
          <Button size="sm" variant="outline" onClick={() => addField("select")}><ListChecks className="w-4 h-4 mr-1" />Select</Button>
          <Button size="sm" variant="outline" onClick={() => addField("checkbox")}><CheckSquare className="w-4 h-4 mr-1" />Checkbox</Button>

          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={onPreview}><Eye className="w-4 h-4 mr-1" />ดูตัวอย่าง</Button>
            <Button size="sm" onClick={() => onSave?.(editorRef.current?.innerHTML || "")}>
              <Save className="w-4 h-4 mr-1" />บันทึก
            </Button>
          </div>
        </div>

        {/* Selected-field attribute bar */}
        {selected && (
          <div className="flex flex-wrap items-end gap-2 border-t bg-info-soft px-3 py-2 text-xs">
            <span className="font-semibold text-info">
              {selected.tagName.toLowerCase()} ที่เลือก:
            </span>
            <div>
              <Label className="text-[10px]">name</Label>
              <Input value={selected.getAttribute("name") || ""} onChange={(e) => updateAttr("name", e.target.value)} className="h-7 w-40 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">placeholder/label</Label>
              <Input value={selected.getAttribute("placeholder") || ""} onChange={(e) => updateAttr("placeholder", e.target.value)} className="h-7 w-48 text-xs" />
            </div>
            {selected.tagName === "INPUT" && (
              <div>
                <Label className="text-[10px]">type</Label>
                <Select value={selected.getAttribute("type") || "text"} onValueChange={(v) => updateAttr("type", v)}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["text","date","number","email","tel","checkbox"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[10px]">width</Label>
              <Input value={selected.style.width || ""} onChange={(e) => updateStyle("width", e.target.value)} className="h-7 w-24 text-xs" placeholder="180px" />
            </div>
            {selected.tagName === "SELECT" && (
              <div className="flex-1">
                <Label className="text-[10px]">options (คั่นด้วย |)</Label>
                <Input
                  defaultValue={Array.from(selected.querySelectorAll("option")).slice(1).map(o => o.textContent).join("|")}
                  onBlur={(e) => {
                    const ph = selected.querySelector("option")?.textContent || "";
                    selected.innerHTML = `<option value="">${ph}</option>` +
                      e.target.value.split("|").map(s => `<option>${s.trim()}</option>`).join("");
                    emit();
                  }}
                  className="h-7 text-xs"
                  placeholder="ชาย|หญิง|อื่นๆ"
                />
              </div>
            )}
            <Button size="sm" variant="destructive" onClick={deleteSelected} className="h-7">
              <Trash2 className="w-3 h-3 mr-1" />ลบช่องนี้
            </Button>
          </div>
        )}
      </div>

      {/* Editor canvas */}
      <div className="flex-1 overflow-auto p-6 php-page">
        <div
          ref={editorRef}
          className="obec-a4-page"
          style={A4_STYLE}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
