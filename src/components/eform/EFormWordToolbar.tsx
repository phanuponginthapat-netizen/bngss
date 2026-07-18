import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image as ImageIcon, Square, Table as TableIcon,
  Undo2, Redo2, Minus, Plus, Highlighter, Link as LinkIcon,
  Subscript as SubIcon, Superscript as SupIcon, IndentDecrease, IndentIncrease,
  RemoveFormatting, Palette, Pilcrow, FileText, Search, SeparatorHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import EFormTableToolbar from "./EFormTableToolbar";
import { escapeCurrentTable } from "@/lib/eformInsertHelpers";

const FONT_OPTIONS = [
  { label: "Sarabun", value: "'Sarabun',sans-serif" },
  { label: "IBM Plex Sans Thai", value: "'IBM Plex Sans Thai',sans-serif" },
  { label: "Kanit", value: "'Kanit',sans-serif" },
  { label: "Prompt", value: "'Prompt',sans-serif" },
  { label: "Mitr", value: "'Mitr',sans-serif" },
  { label: "Noto Sans Thai", value: "'Noto Sans Thai',sans-serif" },
  { label: "Arial", value: "Arial,sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman',serif" },
  { label: "Courier New", value: "'Courier New',monospace" },
] as const;

const DEFAULT_FONT_VALUE = FONT_OPTIONS[0].value;

const normalizeFontName = (value?: string | null) =>
  (value || "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim()
    .toLowerCase();

const matchFontOption = (value?: string | null) => {
  const normalized = normalizeFontName(value);
  if (!normalized) return null;
  return FONT_OPTIONS.find((option) => normalizeFontName(option.value) === normalized) || null;
};

const getTextStyleAttrs = (editor: Editor) => {
  const stored = editor.state.storedMarks?.find((mark: any) => mark.type.name === "textStyle")?.attrs;
  if (stored && Object.values(stored).some(Boolean)) return stored as Record<string, any>;
  return editor.getAttributes("textStyle") as Record<string, any>;
};

const getComputedFontFamilyAtSelection = (editor: Editor) => {
  if (typeof window === "undefined") return null;
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  const el = (node?.nodeType === 1 ? node : node?.parentElement) as HTMLElement | null;
  if (!el || !editor.view.dom.contains(el)) return null;
  return window.getComputedStyle(el).fontFamily;
};

const getActiveFontFamilyValue = (editor: Editor) => {
  const attrs = getTextStyleAttrs(editor);
  return (
    matchFontOption(attrs?.fontFamily)?.value ||
    matchFontOption(getComputedFontFamilyAtSelection(editor))?.value ||
    DEFAULT_FONT_VALUE
  );
};

const Btn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) => (
  <button type="button" title={title} onClick={onClick}
    onMouseDown={(e) => e.preventDefault()}
    className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${active ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}>
    {children}
  </button>
);

const updateBlockStyle = (editor: Editor, patch: Record<string, string | null>) => {
  const { state } = editor;
  const { from, to } = state.selection;
  let tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
    const cur = (node.attrs.style as string) || "";
    const map = new Map<string, string>();
    cur.split(";").forEach((p) => {
      const [k, ...v] = p.split(":");
      const key = k?.trim().toLowerCase();
      const val = v.join(":").trim();
      if (key && val) map.set(key, val);
    });
    Object.entries(patch).forEach(([k, v]) => {
      const key = k.trim().toLowerCase();
      if (v === null) map.delete(key);
      else map.set(key, v);
    });
    const style = Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join("; ");
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, style: style || null });
    changed = true;
    return false;
  });
  if (changed) editor.view.dispatch(tr);
  editor.view.focus();
};

const getBlockStyleValue = (editor: Editor, prop: string): string | null => {
  const { state } = editor;
  const { from } = state.selection;
  const $pos = state.doc.resolve(from);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      const cur = (node.attrs.style as string) || "";
      const part = cur.split(";").map((p) => p.trim()).find((p) => p.toLowerCase().startsWith(`${prop}:`));
      return part ? part.split(":").slice(1).join(":").trim() : null;
    }
  }
  return null;
};

const adjustIndent = (editor: Editor, delta: number) => {
  const cur = getBlockStyleValue(editor, "margin-left");
  const px = cur ? parseFloat(cur) || 0 : 0;
  const next = Math.max(0, px + delta);
  updateBlockStyle(editor, { "margin-left": next === 0 ? null : `${next}px` });
};

const setLineHeight = (editor: Editor, value: string) => {
  updateBlockStyle(editor, { "line-height": value === "" ? null : value });
};

export type PageMargins = { top: number; right: number; bottom: number; left: number };
export type PaperSize = "A4" | "A5" | "Letter" | "Legal";
export const PAPER_SIZES: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
  Legal: { w: 216, h: 356 },
};
export type Orientation = "portrait" | "landscape";
export const MARGIN_PRESETS: { label: string; value: PageMargins }[] = [
  { label: "ปกติ", value: { top: 25, right: 25, bottom: 25, left: 25 } },
  { label: "แคบ", value: { top: 12, right: 12, bottom: 12, left: 12 } },
  { label: "ปานกลาง", value: { top: 25, right: 19, bottom: 25, left: 19 } },
  { label: "กว้าง", value: { top: 25, right: 50, bottom: 25, left: 50 } },
  { label: "ราชการไทย", value: { top: 25, right: 20, bottom: 20, left: 30 } },
];

interface Props {
  editor: Editor;
  fontSizePt: number;
  onFontSizeChange: (n: number) => void;
  onInsertImage?: (file: File) => void;
  onInsertImageUrl?: () => void;
  onInsertTextBox?: () => void;
  onInsertTable?: () => void;
  margins?: PageMargins;
  onMarginsChange?: (m: PageMargins) => void;
  paperSize?: PaperSize;
  onPaperSizeChange?: (s: PaperSize) => void;
  orientation?: Orientation;
  onOrientationChange?: (o: Orientation) => void;
  zoom?: number;
  onZoomChange?: (z: number) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
}

const EFormWordToolbar = ({
  editor, fontSizePt, onFontSizeChange,
  onInsertImage, onInsertImageUrl, onInsertTextBox, onInsertTable,
  margins, onMarginsChange,
  paperSize, onPaperSizeChange, orientation, onOrientationChange,
  zoom, onZoomChange, onFontFamilyChange,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => { editor.off("selectionUpdate", update); editor.off("transaction", update); };
  }, [editor]);

  const heading = editor.isActive("heading", { level: 1 }) ? "h1"
    : editor.isActive("heading", { level: 2 }) ? "h2"
    : editor.isActive("heading", { level: 3 }) ? "h3"
    : "p";

  const currentLineHeight = getBlockStyleValue(editor, "line-height") || "";
  const currentTextIndent = getBlockStyleValue(editor, "text-indent") || "";
  const currentMarginTop = getBlockStyleValue(editor, "margin-top") || "";
  const currentMarginBottom = getBlockStyleValue(editor, "margin-bottom") || "";
  const currentFontFamily = getActiveFontFamilyValue(editor);

  // Find & Replace (Word-like Ctrl+F / Ctrl+H)
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const findReplaceAll = () => {
    if (!findText) return;
    const html = editor.getHTML();
    const safe = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = html.replace(new RegExp(safe, "g"), replaceText);
    if (next !== html) editor.commands.setContent(next, { emitUpdate: true });
  };
  const findNext = () => {
    if (!findText) return;
    const dom = editor.view.dom as HTMLElement;
    const sel = window.getSelection();
    const range = document.createRange();
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    const startOffset = sel && sel.anchorNode && dom.contains(sel.anchorNode) ? sel.anchorOffset : 0;
    let node: Node | null;
    let passedAnchor = !sel?.anchorNode;
    while ((node = walker.nextNode())) {
      const text = node.textContent || "";
      const from = (!passedAnchor && node === sel?.anchorNode) ? startOffset : 0;
      const idx = text.toLowerCase().indexOf(findText.toLowerCase(), from);
      if (node === sel?.anchorNode) passedAnchor = true;
      if (idx >= 0) {
        range.setStart(node, idx);
        range.setEnd(node, idx + findText.length);
        sel?.removeAllRanges();
        sel?.addRange(range);
        (node.parentElement as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
    }
  };

  return (
    <div className="flex flex-nowrap sm:flex-wrap items-center gap-0.5 border-b bg-white px-3 py-1.5 sticky top-0 z-10 shadow-sm overflow-x-auto">
      <Btn title="ย้อนกลับ (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
      <Btn title="ทำซ้ำ (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></Btn>
      <Btn title="ล้างการจัดรูปแบบ" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Btn>
      <Btn title="แทรกตัวแบ่งหน้า (Page Break)" onClick={() => { escapeCurrentTable(editor); editor.chain().focus().setHardBreak().insertContent('<p style="page-break-before:always"></p>').run(); }}><SeparatorHorizontal className="w-4 h-4" /></Btn>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" title="ค้นหาและแทนที่ (Ctrl+F / Ctrl+H)" onMouseDown={(e) => e.preventDefault()}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
            <Search className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 space-y-2 text-sm" align="start">
          <div className="text-xs text-slate-600">ค้นหา</div>
          <input value={findText} onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") findNext(); }}
            className="h-8 w-full text-sm border border-slate-200 rounded px-2 bg-white" placeholder="คำที่ต้องการค้นหา" />
          <div className="text-xs text-slate-600">แทนที่ด้วย</div>
          <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
            className="h-8 w-full text-sm border border-slate-200 rounded px-2 bg-white" placeholder="คำที่จะแทนที่" />
          <div className="flex gap-1 justify-end pt-1">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={findNext}
              className="px-3 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50">ค้นหาถัดไป</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={findReplaceAll}
              className="px-3 py-1 text-xs rounded bg-slate-900 text-white hover:bg-slate-800">แทนที่ทั้งหมด</button>
          </div>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <select
        className="h-8 min-w-[120px] text-sm border border-slate-200 rounded-md bg-white px-2 hover:bg-slate-50 cursor-pointer"
        value={heading}
        onChange={(e) => {
          const v = e.target.value;
          const c = editor.chain().focus();
          if (v === "h1") c.setHeading({ level: 1 }).run();
          else if (v === "h2") c.setHeading({ level: 2 }).run();
          else if (v === "h3") c.setHeading({ level: 3 }).run();
          else c.setParagraph().run();
        }}
      >
        <option value="p">ข้อความปกติ</option>
        <option value="h1">หัวข้อ 1</option>
        <option value="h2">หัวข้อ 2</option>
        <option value="h3">หัวข้อ 3</option>
      </select>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <select
        className="h-8 min-w-[140px] text-sm border border-slate-200 rounded-md bg-white px-2 hover:bg-slate-50 cursor-pointer"
        value={currentFontFamily}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (onFontFamilyChange) onFontFamilyChange(v);
          else editor.chain().focus().setFontFamily(v).run();
          requestAnimationFrame(() => force((n) => n + 1));
        }}
      >
        {FONT_OPTIONS.map((font) => (
          <option key={font.value} value={font.value}>{font.label}</option>
        ))}
      </select>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <button type="button" title="ลดขนาด" onMouseDown={(e) => e.preventDefault()} onClick={() => onFontSizeChange(Math.max(8, fontSizePt - 1))}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={fontSizePt}
        min={8}
        max={96}
        onChange={(e) => onFontSizeChange(Math.max(8, Math.min(96, Number(e.target.value) || 16)))}
        className="h-8 w-12 text-center text-sm border border-slate-200 rounded-md bg-white"
      />
      <button type="button" title="เพิ่มขนาด" onMouseDown={(e) => e.preventDefault()} onClick={() => onFontSizeChange(Math.min(96, fontSizePt + 1))}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
        <Plus className="w-4 h-4" />
      </button>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <Btn title="ตัวหนา (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Btn>
      <Btn title="ตัวเอียง (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Btn>
      <Btn title="ขีดเส้นใต้ (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Btn>
      <Btn title="ขีดทับ" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Btn>
      <Btn title="ตัวห้อย" active={editor.isActive("subscript")} onClick={() => (editor.chain().focus() as any).toggleSubscript().run()}><SubIcon className="w-4 h-4" /></Btn>
      <Btn title="ตัวยก" active={editor.isActive("superscript")} onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()}><SupIcon className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <label title="สีตัวอักษร" className="h-8 inline-flex items-center justify-center px-1 rounded-md hover:bg-slate-100 cursor-pointer relative">
        <Palette className="w-4 h-4 text-slate-700" />
        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
      </label>
      <label title="ไฮไลท์" className="h-8 inline-flex items-center justify-center px-1 rounded-md hover:bg-slate-100 cursor-pointer relative">
        <Highlighter className="w-4 h-4 text-slate-700" />
        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => (editor.chain().focus() as any).toggleHighlight({ color: e.target.value }).run()} />
      </label>
      <Btn title="แทรกลิงก์" active={editor.isActive("link")} onClick={() => {
        const prev = editor.getAttributes("link").href || "";
        const url = prompt("ใส่ URL ลิงก์ (เว้นว่าง = ลบลิงก์)", prev);
        if (url === null) return;
        if (url === "") (editor.chain().focus().extendMarkRange("link") as any).unsetLink().run();
        else (editor.chain().focus().extendMarkRange("link") as any).setLink({ href: url }).run();
      }}><LinkIcon className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <Btn title="ชิดซ้าย" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-4 h-4" /></Btn>
      <Btn title="กึ่งกลาง" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-4 h-4" /></Btn>
      <Btn title="ชิดขวา" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-4 h-4" /></Btn>
      <Btn title="ชิดขอบ" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <select
        title="ระยะห่างบรรทัด"
        className="h-8 text-sm border border-slate-200 rounded-md bg-white px-2 hover:bg-slate-50 cursor-pointer"
        value={currentLineHeight}
        onChange={(e) => setLineHeight(editor, e.target.value)}
      >
        <option value="">บรรทัด</option>
        <option value="1">1.0</option>
        <option value="1.15">1.15</option>
        <option value="1.4">1.4</option>
        <option value="1.5">1.5</option>
        <option value="2">2.0</option>
      </select>
      <Btn title="ลดเยื้อง" onClick={() => adjustIndent(editor, -24)}><IndentDecrease className="w-4 h-4" /></Btn>
      <Btn title="เพิ่มเยื้อง" onClick={() => adjustIndent(editor, 24)}><IndentIncrease className="w-4 h-4" /></Btn>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" title="ย่อหน้า — เยื้องบรรทัดแรก / ระยะห่างก่อน-หลัง"
            onMouseDown={(e) => e.preventDefault()}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100">
            <Pilcrow className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3 text-sm" align="start">
          <div>
            <div className="text-xs text-slate-600 mb-1">เยื้องบรรทัดแรก (first-line indent)</div>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "ไม่มี", v: "" },
                { label: "1 ซม.", v: "1cm" },
                { label: "1.27 ซม.", v: "1.27cm" },
                { label: "2 ซม.", v: "2cm" },
                { label: "2.5 ซม.", v: "2.5cm" },
              ].map((o) => (
                <button key={o.label} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateBlockStyle(editor, { "text-indent": o.v === "" ? null : o.v })}
                  className={`px-2 py-1 text-xs rounded border ${currentTextIndent === o.v ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">ระยะห่างก่อนย่อหน้า</div>
            <div className="flex flex-wrap gap-1">
              {["", "0", "8px", "16px", "24px", "32px"].map((v) => (
                <button key={`mt-${v}`} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateBlockStyle(editor, { "margin-top": v === "" ? null : v })}
                  className={`px-2 py-1 text-xs rounded border ${currentMarginTop === v ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                  {v === "" ? "ค่าเริ่มต้น" : v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">ระยะห่างหลังย่อหน้า</div>
            <div className="flex flex-wrap gap-1">
              {["", "0", "8px", "16px", "24px", "32px"].map((v) => (
                <button key={`mb-${v}`} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateBlockStyle(editor, { "margin-bottom": v === "" ? null : v })}
                  className={`px-2 py-1 text-xs rounded border ${currentMarginBottom === v ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                  {v === "" ? "ค่าเริ่มต้น" : v}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" className="h-6 mx-2" />

      <Btn title="รายการ" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Btn>
      <Btn title="ลำดับเลข" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-2" />

      {onInsertImage && (
        <>
          <Btn title="แทรกรูปจากไฟล์" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-4 h-4" /></Btn>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onInsertImage(f); e.target.value = ""; }} />
        </>
      )}
      {onInsertImageUrl && <Btn title="แทรกรูปจาก URL" onClick={onInsertImageUrl}><span className="text-[10px] font-bold">URL</span></Btn>}
      {onInsertTextBox && <Btn title="แทรกกล่องข้อความ" onClick={onInsertTextBox}><Square className="w-4 h-4" /></Btn>}
      {onInsertTable && <Btn title="แทรกตาราง 3x3" onClick={onInsertTable}><TableIcon className="w-4 h-4" /></Btn>}

      {margins && onMarginsChange && (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" title="ระยะขอบกระดาษ (Page Margins)"
                onMouseDown={(e) => e.preventDefault()}
                className="h-8 px-2 inline-flex items-center gap-1 rounded-md text-slate-700 hover:bg-slate-100 text-xs">
                <FileText className="w-4 h-4" /> ขอบกระดาษ
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3 text-sm" align="start">
              <div>
                <div className="text-xs text-slate-600 mb-1">ค่าที่ตั้งไว้</div>
                <div className="grid grid-cols-2 gap-1">
                  {MARGIN_PRESETS.map((p) => {
                    const active = p.value.top === margins.top && p.value.right === margins.right && p.value.bottom === margins.bottom && p.value.left === margins.left;
                    return (
                      <button key={p.label} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onMarginsChange(p.value)}
                        className={`px-2 py-1.5 text-xs rounded border text-left ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                        <div className="font-medium">{p.label}</div>
                        <div className="text-[10px] opacity-70">บ{p.value.top} ล{p.value.bottom} ซ{p.value.left} ข{p.value.right} mm</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-1">กำหนดเอง (mm)</div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["บน", "top"], ["ล่าง", "bottom"], ["ซ้าย", "left"], ["ขวา", "right"],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="flex items-center gap-1">
                      <span className="text-xs w-8 text-slate-600">{label}</span>
                      <input type="number" min={0} max={80} step={1}
                        value={margins[key]}
                        onChange={(e) => onMarginsChange({ ...margins, [key]: Math.max(0, Math.min(80, Number(e.target.value) || 0)) })}
                        className="h-7 w-full text-xs border border-slate-200 rounded px-1 bg-white" />
                    </label>
                  ))}
                </div>
              </div>
              {paperSize && onPaperSizeChange && (
                <div>
                  <div className="text-xs text-slate-600 mb-1">ขนาดกระดาษ</div>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(PAPER_SIZES) as PaperSize[]).map((s) => (
                      <button key={s} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPaperSizeChange(s)}
                        className={`px-2 py-1 text-xs rounded border ${paperSize === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {orientation && onOrientationChange && (
                <div>
                  <div className="text-xs text-slate-600 mb-1">การวางแนว</div>
                  <div className="flex gap-1">
                    {(["portrait", "landscape"] as Orientation[]).map((o) => (
                      <button key={o} type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onOrientationChange(o)}
                        className={`px-2 py-1 text-xs rounded border flex-1 ${orientation === o ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                        {o === "portrait" ? "แนวตั้ง" : "แนวนอน"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </>
      )}

      {zoom !== undefined && onZoomChange && (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <button type="button" title="ซูมออก" onMouseDown={(e) => e.preventDefault()}
            onClick={() => onZoomChange(Math.max(0.3, Math.round((zoom - 0.1) * 10) / 10))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"><Minus className="w-4 h-4" /></button>
          <span className="text-xs text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" title="ซูมเข้า" onMouseDown={(e) => e.preventDefault()}
            onClick={() => onZoomChange(Math.min(2, Math.round((zoom + 0.1) * 10) / 10))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"><Plus className="w-4 h-4" /></button>
          <button type="button" title="พอดีหน้า" onMouseDown={(e) => e.preventDefault()}
            onClick={() => onZoomChange(0)}
            className="h-8 px-2 inline-flex items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 text-xs">พอดี</button>
        </>
      )}

      <EFormTableToolbar editor={editor} />
    </div>
  );
};

export default EFormWordToolbar;
