import { useEffect, useRef, useState, useCallback } from "react";
import { EditorContent, useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { FontFamily } from "@tiptap/extension-font-family";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OBEC_PRINT_CSS } from "@/lib/printUtils";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Subscript as SubIcon, Superscript as SupIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks, Quote, Minus, Link2, Image as ImageIcon, Table as TableIcon,
  Undo, Redo, Eraser, Printer, Download, Palette, Highlighter,
  ChevronDown, Plus, Trash2, Search, Save, FilePlus, Send, FileDown, ScrollText, ZoomIn, ZoomOut, Eye,
} from "lucide-react";
import { PageBreak } from "./PageBreak";
import { FieldToken, FIELD_TOKEN_CSS, FieldType, autoDetectFields } from "@/lib/formFieldToken";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SquareDashedBottomCode, FileUp } from "lucide-react";
import { toast } from "sonner";

const FONTS = [
  "TH Sarabun New", "Sarabun", "IBM Plex Sans Thai", "Inter", "Arial",
  "Times New Roman", "Tahoma", "Calibri", "Cordia New", "Angsana New",
];
const SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];
const COLORS = [
  "#000000", "#374151", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];
const HL_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];

const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => attributes.style ? { style: attributes.style } : {},
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes) => attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute("height"),
        renderHTML: (attributes) => attributes.height ? { height: attributes.height } : {},
      },
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => attributes.class ? { class: attributes.class } : {},
      },
    };
  },
});

// FontSize extension (TextStyle attribute)
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontSize?.replace("pt", "") || null,
        renderHTML: (attrs) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}pt` } : {},
      },
    };
  },
});

export interface RichDocEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  showToolbar?: boolean;
  pageStyle?: boolean; // render as A4 page
  fullscreen?: boolean; // fill parent (use inside a fullscreen dialog)
  onExportDocx?: (html: string) => void;
  onExportPdf?: (html: string) => void;
  onPrint?: (html: string) => void;
  onSave?: (html: string) => void;
  onNewDocument?: () => void;
  onSendInSystem?: (html: string) => void;
}

const Btn = ({ active, onClick, title, children, disabled }: any) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button" size="sm" variant={active ? "default" : "ghost"} disabled={disabled}
          onClick={onClick} className="h-8 w-8 p-0"
        >{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function RichDocEditor({
  value = "", onChange, placeholder = "พิมพ์เนื้อหา...", minHeight = "55vh",
  showToolbar = true, pageStyle = false, fullscreen = false,
  onExportDocx, onExportPdf, onPrint, onSave, onNewDocument, onSendInSystem,
}: RichDocEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const editorRoot = useRef<HTMLDivElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(100);
  const zoomIn = () => setZoom(z => Math.min(200, z + 10));
  const zoomOut = () => setZoom(z => Math.max(50, z - 10));
  const zoomReset = () => setZoom(100);

  // Insert-field dialog state
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fldKey, setFldKey] = useState("");
  const [fldLabel, setFldLabel] = useState("");
  const [fldType, setFldType] = useState<FieldType>("text");
  const [fldOpts, setFldOpts] = useState("");


  // Inject OBEC print/preview CSS so the editor renders identically to preview/print
  // (emblem 3cm, TH Sarabun, A4 sizing, signature blocks, etc.) — applies to every form.
  useEffect(() => {
    if (!pageStyle) return;
    const id = "obec-print-css-richdoc";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = OBEC_PRINT_CSS.replace(/__LOVABLE_ORIGIN__/g, window.location.origin);
    document.head.appendChild(style);
  }, [pageStyle]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, Subscript, Superscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontSize, FontFamily, Color, Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      RichImage.configure({ inline: false, allowBase64: true }),
      TaskList, TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "border-collapse w-full" } }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder }),
      PageBreak,
      FieldToken,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `${pageStyle ? "obec-a4-page word-page bg-white shadow-lg mx-auto focus:outline-none" : "prose prose-sm max-w-none focus:outline-none p-4"}`,
        style: `font-family: 'TH Sarabun New','Sarabun','IBM Plex Sans Thai',sans-serif; min-height:${minHeight}; ${pageStyle ? "width: 21cm; max-width: 21cm; min-height: 29.7cm; padding: 2.54cm 2.54cm 2.54cm 2.54cm; box-sizing: border-box;" : ""}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
      const breaks = editor.getHTML().split("page-break").length - 1;
      setPageCount(Math.max(1, Math.ceil(breaks / 2) + 1));
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const addImage = useCallback(() => fileRef.current?.click(), []);
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editor) return;
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: String(reader.result) }).run();
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  // ===== Import from .docx (Word) or .html =====
  const triggerImport = () => importRef.current?.click();
  const onPickImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editor) return;
    const name = f.name.toLowerCase();
    try {
      let html = "";
      if (name.endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser");
        const buf = await f.arrayBuffer();
        const res = await (mammoth as any).convertToHtml(
          { arrayBuffer: buf },
          {
            convertImage: (mammoth as any).images.imgElement((img: any) =>
              img.read("base64").then((data: string) => ({ src: `data:${img.contentType};base64,${data}` }))
            ),
          }
        );
        html = res.value || "";
        if (res.messages?.length) console.warn("mammoth messages:", res.messages);
      } else if (name.endsWith(".html") || name.endsWith(".htm")) {
        const text = await f.text();
        // ดึงเฉพาะเนื้อหาใน <body> ถ้าเป็นไฟล์เต็ม
        const m = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        html = m ? m[1] : text;
      } else {
        toast.error("รองรับเฉพาะไฟล์ .docx และ .html เท่านั้น");
        return;
      }
      if (!html.trim()) { toast.error("ไม่พบเนื้อหาในไฟล์"); return; }

      // === Auto-detect: หา "หัวข้อ + เส้นไข่ปลา/ขีดเส้น" → สร้าง field token ===
      const autoDetect = window.confirm(
        "ต้องการให้ระบบตรวจจับ \"หัวข้อที่ต้องกรอก\" อัตโนมัติหรือไม่?\n" +
        "(จะแปลงเส้นไข่ปลา ........... และ ___ หลังคำเป็นช่องกรอก)"
      );
      let toInsert = html;
      let detected = 0;
      if (autoDetect) {
        const r = autoDetectFields(html);
        toInsert = r.html; detected = r.count;
      }

      const ok = editor.isEmpty || window.confirm("แทนที่เนื้อหาปัจจุบันด้วยไฟล์ที่นำเข้าหรือไม่?\n(กด Cancel เพื่อแทรกต่อท้าย)");
      if (ok) editor.commands.setContent(toInsert);
      else editor.chain().focus().insertContent(toInsert).run();
      toast.success(`นำเข้า ${f.name} สำเร็จ${detected ? ` · ตรวจพบช่องกรอก ${detected} ช่อง` : ""}`);
    } catch (err: any) {
      console.error(err);
      toast.error("นำเข้าไม่สำเร็จ: " + (err?.message || err));
    } finally {
      e.target.value = "";
    }
  };

  const addLink = () => {
    const prev = editor?.getAttributes("link").href;
    const url = window.prompt("URL ลิงก์", prev || "https://");
    if (url === null) return;
    if (!url) { editor?.chain().focus().unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  const doFind = () => {
    if (!findText || !editor) return;
    const html = editor.getHTML();
    const idx = html.toLowerCase().indexOf(findText.toLowerCase());
    if (idx < 0) return;
    // simple replace-all path
  };
  const doReplaceAll = () => {
    if (!findText || !editor) return;
    const html = editor.getHTML().split(findText).join(replaceText);
    editor.commands.setContent(html);
  };

  if (!editor) return null;

  const starterKitChain = () => editor.chain().focus() as any;

  const exportHtml = () => editor.getHTML();
  const handlePrint = () => onPrint ? onPrint(exportHtml()) : defaultPrint(exportHtml());
  const handleDocx = () => onExportDocx ? onExportDocx(exportHtml()) : defaultDocx(exportHtml());
  const handlePdf = () => onExportPdf ? onExportPdf(exportHtml()) : defaultPdf(exportHtml());
  const handlePreview = () => defaultPreview(exportHtml());

  // === Word-style Ribbon groups ===
  const HomeRibbon = (
    <div className="flex flex-wrap items-end gap-3 px-3 py-2">
      {/* Clipboard / Undo */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></Btn>
          <Btn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></Btn>
        </div>
        <span className="text-[10px] text-muted-foreground">ย้อน/ทำซ้ำ</span>
      </div>
      <Separator orientation="vertical" className="h-12" />

      {/* Font */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1 items-center">
          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="แบบอักษร" /></SelectTrigger>
            <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v) => (editor.chain().focus() as any).setMark("textStyle", { fontSize: v }).run()}>
            <SelectTrigger className="h-7 w-[64px] text-xs"><SelectValue placeholder="ขนาด" /></SelectTrigger>
            <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-0.5">
          <Btn title="ตัวหนา (Ctrl+B)" active={editor.isActive("bold")} onClick={() => starterKitChain().toggleBold().run()}><Bold className="w-4 h-4" /></Btn>
          <Btn title="ตัวเอียง" active={editor.isActive("italic")} onClick={() => starterKitChain().toggleItalic().run()}><Italic className="w-4 h-4" /></Btn>
          <Btn title="ขีดเส้นใต้" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Btn>
          <Btn title="ขีดทับ" active={editor.isActive("strike")} onClick={() => starterKitChain().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Btn>
          <Btn title="ตัวห้อย" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}><SubIcon className="w-4 h-4" /></Btn>
          <Btn title="ตัวยก" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}><SupIcon className="w-4 h-4" /></Btn>
          <Popover>
            <PopoverTrigger asChild><Button size="sm" variant="ghost" className="h-8 px-1.5"><Palette className="w-4 h-4" /><ChevronDown className="w-3 h-3" /></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-2"><div className="grid grid-cols-6 gap-1">
              {COLORS.map(c => <button key={c} onClick={() => editor.chain().focus().setColor(c).run()} className="w-6 h-6 rounded border" style={{ background: c }} />)}
              <button onClick={() => editor.chain().focus().unsetColor().run()} className="col-span-6 text-xs py-1 hover:bg-muted rounded">ล้างสี</button>
            </div></PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild><Button size="sm" variant="ghost" className="h-8 px-1.5"><Highlighter className="w-4 h-4" /><ChevronDown className="w-3 h-3" /></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-2"><div className="grid grid-cols-6 gap-1">
              {HL_COLORS.map(c => <button key={c} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} className="w-6 h-6 rounded border" style={{ background: c }} />)}
              <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="col-span-6 text-xs py-1 hover:bg-muted rounded">ลบไฮไลต์</button>
            </div></PopoverContent>
          </Popover>
          <Btn title="ล้างรูปแบบ" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser className="w-4 h-4" /></Btn>
        </div>
        <span className="text-[10px] text-muted-foreground">แบบอักษร</span>
      </div>
      <Separator orientation="vertical" className="h-12" />

      {/* Paragraph */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-0.5">
          <Btn title="รายการ" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Btn>
          <Btn title="ลำดับเลข" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Btn>
          <Btn title="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="w-4 h-4" /></Btn>
          <Btn title="คำคม" active={editor.isActive("blockquote")} onClick={() => starterKitChain().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Btn>
        </div>
        <div className="flex gap-0.5">
          <Btn title="ชิดซ้าย" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-4 h-4" /></Btn>
          <Btn title="กึ่งกลาง" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-4 h-4" /></Btn>
          <Btn title="ชิดขวา" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-4 h-4" /></Btn>
          <Btn title="กระจาย" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="w-4 h-4" /></Btn>
        </div>
        <span className="text-[10px] text-muted-foreground">ย่อหน้า</span>
      </div>
      <Separator orientation="vertical" className="h-12" />

      {/* Styles */}
      <div className="flex flex-col items-center gap-1">
        <Select onValueChange={(v) => {
          const lvl = parseInt(v);
          if (lvl === 0) starterKitChain().setParagraph().run();
          else starterKitChain().toggleHeading({ level: lvl as any }).run();
        }}>
          <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="สไตล์" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">ปกติ</SelectItem>
            <SelectItem value="1">หัวข้อ 1</SelectItem>
            <SelectItem value="2">หัวข้อ 2</SelectItem>
            <SelectItem value="3">หัวข้อ 3</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">สไตล์</span>
      </div>
      <Separator orientation="vertical" className="h-12" />

      {/* Editing */}
      <div className="flex flex-col items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 gap-1 px-2"><Search className="w-4 h-4" />ค้นหา</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2">
            <div className="text-xs font-medium">ค้นหา & แทนที่</div>
            <Input placeholder="ค้นหา" value={findText} onChange={e => setFindText(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="แทนที่ด้วย" value={replaceText} onChange={e => setReplaceText(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" className="w-full h-7 text-xs" onClick={doReplaceAll}>แทนที่ทั้งหมด</Button>
          </PopoverContent>
        </Popover>
        <span className="text-[10px] text-muted-foreground">การแก้ไข</span>
      </div>
    </div>
  );

  const InsertRibbon = (
    <div className="flex flex-wrap items-end gap-3 px-3 py-2">
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={insertTable}>
            <TableIcon className="w-5 h-5" />
            <span className="text-[10px]">ตาราง</span>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1">
                <Plus className="w-4 h-4" />
                <span className="text-[10px]">แก้ไขตาราง</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 space-y-1">
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().addRowAfter().run()}>เพิ่มแถวด้านล่าง</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().addColumnAfter().run()}>เพิ่มคอลัมน์ด้านขวา</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().deleteRow().run()}>ลบแถว</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().deleteColumn().run()}>ลบคอลัมน์</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().mergeCells().run()}>ผสานเซลล์</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs" onClick={() => editor.chain().focus().splitCell().run()}>แยกเซลล์</Button>
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="w-3 h-3 mr-1" />ลบตาราง</Button>
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-[10px] text-muted-foreground">ตาราง</span>
      </div>
      <Separator orientation="vertical" className="h-16" />

      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={addImage}>
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px]">รูปภาพ</span>
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={addLink}>
            <Link2 className="w-5 h-5" />
            <span className="text-[10px]">ลิงก์</span>
          </Button>
        </div>
        <span className="text-[10px] text-muted-foreground">ภาพประกอบ/ลิงก์</span>
      </div>
      <Separator orientation="vertical" className="h-16" />

      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={() => starterKitChain().setHorizontalRule().run()}>
            <Minus className="w-5 h-5" />
            <span className="text-[10px]">เส้นคั่น</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={() => editor.commands.insertPageBreak()}>
            <ScrollText className="w-5 h-5" />
            <span className="text-[10px]">คั่นหน้า</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={() => starterKitChain().toggleCode().run()}>
            <Code className="w-5 h-5" />
            <span className="text-[10px]">โค้ด</span>
          </Button>
        </div>
        <span className="text-[10px] text-muted-foreground">สัญลักษณ์</span>
      </div>
      <Separator orientation="vertical" className="h-16" />

      {/* === Form Fields === */}
      <div className="flex flex-col items-center gap-1">
        <Button
          size="sm" variant="ghost"
          className="h-14 w-14 flex-col gap-1 text-info"
          onClick={() => { setFldKey(""); setFldLabel(""); setFldType("text"); setFldOpts(""); setFieldOpen(true); }}
          title="แทรกช่องกรอกข้อมูล (Field)"
        >
          <SquareDashedBottomCode className="w-5 h-5" />
          <span className="text-[10px]">แทรกช่องกรอก</span>
        </Button>
        <span className="text-[10px] text-muted-foreground">ฟอร์ม</span>
      </div>
      <Separator orientation="vertical" className="h-16" />

      {/* === Import from Word / HTML === */}
      <div className="flex flex-col items-center gap-1">
        <Button
          size="sm" variant="ghost"
          className="h-14 w-14 flex-col gap-1 text-success"
          onClick={triggerImport}
          title="นำเข้าจากไฟล์ Word (.docx) หรือ HTML (.html)"
        >
          <FileUp className="w-5 h-5" />
          <span className="text-[10px]">นำเข้า Word/HTML</span>
        </Button>
        <input ref={importRef} type="file" accept=".docx,.html,.htm" hidden onChange={onPickImport} />
        <span className="text-[10px] text-muted-foreground">นำเข้าไฟล์</span>
      </div>
    </div>
  );



  const LayoutRibbon = (
    <div className="flex flex-wrap items-end gap-3 px-3 py-2">
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-0.5">
          <Btn title="ชิดซ้าย" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-4 h-4" /></Btn>
          <Btn title="กึ่งกลาง" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-4 h-4" /></Btn>
          <Btn title="ชิดขวา" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-4 h-4" /></Btn>
          <Btn title="กระจาย" onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="w-4 h-4" /></Btn>
        </div>
        <span className="text-[10px] text-muted-foreground">การจัดวาง</span>
      </div>
      <Separator orientation="vertical" className="h-12" />
      <div className="flex flex-col items-center gap-1">
        <div className="text-xs text-muted-foreground px-2">A4 · 21 × 29.7 cm · ระยะขอบ 2.54 cm</div>
        <span className="text-[10px] text-muted-foreground">ตั้งค่าหน้ากระดาษ</span>
      </div>
    </div>
  );

  const ViewRibbon = (
    <div className="flex flex-wrap items-end gap-3 px-3 py-2">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={zoomOut}><ZoomOut className="w-4 h-4" /></Button>
          <button onClick={zoomReset} className="text-xs px-3 h-8 hover:bg-accent min-w-[56px]">{zoom}%</button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={zoomIn}><ZoomIn className="w-4 h-4" /></Button>
        </div>
        <span className="text-[10px] text-muted-foreground">ซูม</span>
      </div>
      <Separator orientation="vertical" className="h-12" />
      <div className="flex flex-col items-center gap-1">
        <Button size="sm" variant="ghost" className="h-14 w-14 flex-col gap-1" onClick={handlePreview}>
          <Eye className="w-5 h-5" />
          <span className="text-[10px]">ดูตัวอย่าง</span>
        </Button>
        <span className="text-[10px] text-muted-foreground">มุมมอง</span>
      </div>
    </div>
  );

  return (
    <div className={`${fullscreen ? "h-full flex flex-col" : "border rounded-md"} bg-background`}>
      {showToolbar && (
        <div className="border-b bg-white shrink-0">
          {/* Title strip / Quick Access */}
          <div className="flex items-center gap-2 px-3 py-1 bg-editor-chrome text-editor-chrome-foreground text-xs">
            {onNewDocument && (
              <button onClick={onNewDocument} className="hover:bg-white/10 px-2 py-0.5 rounded" title="สร้างเอกสารใหม่">
                <FilePlus className="w-3.5 h-3.5 inline mr-1" />ใหม่
              </button>
            )}
            {onSave && (
              <button onClick={() => onSave(exportHtml())} className="hover:bg-white/10 px-2 py-0.5 rounded">
                <Save className="w-3.5 h-3.5 inline mr-1" />บันทึก
              </button>
            )}
            <button onClick={handlePrint} className="hover:bg-white/10 px-2 py-0.5 rounded">
              <Printer className="w-3.5 h-3.5 inline mr-1" />พิมพ์
            </button>
            <button onClick={handleDocx} className="hover:bg-white/10 px-2 py-0.5 rounded">
              <FileDown className="w-3.5 h-3.5 inline mr-1" />Word
            </button>
            <button onClick={handlePdf} className="hover:bg-white/10 px-2 py-0.5 rounded">
              <Download className="w-3.5 h-3.5 inline mr-1" />PDF
            </button>
            {onSendInSystem && (
              <button onClick={() => onSendInSystem(exportHtml())} className="hover:bg-white/10 px-2 py-0.5 rounded ml-auto">
                <Send className="w-3.5 h-3.5 inline mr-1" />ส่งในระบบ
              </button>
            )}
          </div>

          {/* Ribbon tabs */}
          <Tabs defaultValue="home">
            <TabsList className="h-9 bg-editor-canvas rounded-none border-b w-full justify-start gap-1 px-2">
              <TabsTrigger value="home" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-none rounded-t-md rounded-b-none h-9">หน้าแรก</TabsTrigger>
              <TabsTrigger value="insert" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-none rounded-t-md rounded-b-none h-9">แทรก</TabsTrigger>
              <TabsTrigger value="layout" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-none rounded-t-md rounded-b-none h-9">เค้าโครง</TabsTrigger>
              <TabsTrigger value="view" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-none rounded-t-md rounded-b-none h-9">มุมมอง</TabsTrigger>
            </TabsList>
            <TabsContent value="home" className="m-0 bg-white">{HomeRibbon}</TabsContent>
            <TabsContent value="insert" className="m-0 bg-white">{InsertRibbon}</TabsContent>
            <TabsContent value="layout" className="m-0 bg-white">{LayoutRibbon}</TabsContent>
            <TabsContent value="view" className="m-0 bg-white">{ViewRibbon}</TabsContent>
          </Tabs>
        </div>
      )}

      <div
        ref={editorRoot}
        className={`overflow-auto relative ${pageStyle ? "bg-editor-canvas dark:bg-neutral" : ""} ${fullscreen ? "flex-1" : ""}`}
        style={fullscreen ? undefined : { maxHeight: "75vh" }}
      >
        <style>{`
          .ProseMirror table { border-collapse: collapse; }
          .ProseMirror table td, .ProseMirror table th { border: 1px solid hsl(var(--border)); padding: 6px 8px; min-width: 40px; }
          .ProseMirror table th { background: hsl(var(--muted)); font-weight: 600; }
          .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
          .ProseMirror ul[data-type="taskList"] li { display: flex; gap: 0.5rem; }
          .ProseMirror img { max-width: 100%; height: auto; }
          .ProseMirror img[src*="garuda.png"] { width: 3cm; height: 3cm; max-width: 3cm; object-fit: contain; display: block; margin: 0 auto 4pt; }
          .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: hsl(var(--muted-foreground)); pointer-events: none; height: 0; }
          .word-page { color: #000; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,.15); }
          .word-page .page-break::after { content: "— คั่นหน้า —"; position: absolute; left: 50%; top: -10px; transform: translateX(-50%); background: #eef2ff; color: #4338ca; font-size: 10px; padding: 1px 8px; border-radius: 9999px; }
          .ruler-h { height: 22px; background: repeating-linear-gradient(to right, transparent 0, transparent 37px, #94a3b8 37px, #94a3b8 38px), repeating-linear-gradient(to right, transparent 0, transparent 18.5px, #cbd5e1 18.5px, #cbd5e1 19px); border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 5; }
          @media print { .page-break { page-break-before: always; break-before: page; border: none !important; } .ruler-h { display: none !important; } }
          ${FIELD_TOKEN_CSS}
        `}</style>


        {pageStyle && (
          <div className="ruler-h flex items-end justify-center text-[9px] text-neutral select-none" style={{ width: "100%" }} title="ไม้บรรทัด (1 cm = 37.8 px)">
            <div className="flex" style={{ width: "21cm" }}>
              {Array.from({ length: 21 }).map((_, i) => (
                <div key={i} className="flex-1 border-l border-neutral/30 text-center leading-[20px]" style={{ height: 20 }}>{i}</div>
              ))}
            </div>
          </div>
        )}

        <div className={pageStyle ? "py-8 flex justify-center overflow-auto" : "overflow-auto"}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", transition: "transform .15s" }}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {pageStyle && (
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] bg-editor-chrome text-editor-chrome-foreground border-t">
            <span>📄 หน้า {pageCount}</span>
            <span className="opacity-90">
              {editor.storage?.characterCount?.characters?.() ?? editor.getText().length} ตัวอักษร · {editor.getText().trim().split(/\s+/).filter(Boolean).length} คำ
            </span>
            <span className="opacity-90">A4 · 21 × 29.7 cm · {zoom}%</span>
          </div>
        )}
      </div>

      {/* ===== Insert Field dialog ===== */}
      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แทรกช่องกรอกข้อมูล</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">รหัส field (ภาษาอังกฤษ/ตัวเลข, ไม่ซ้ำกัน)</Label>
              <Input value={fldKey} onChange={(e) => setFldKey(e.target.value.replace(/[^A-Za-z0-9_]/g, "_"))}
                placeholder="เช่น student_name" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">ป้ายชื่อ (ภาษาไทยได้)</Label>
              <Input value={fldLabel} onChange={(e) => setFldLabel(e.target.value)} placeholder="เช่น ชื่อ-นามสกุล" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">ชนิดข้อมูล</Label>
              <Select value={fldType} onValueChange={(v) => setFldType(v as FieldType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">ข้อความสั้น</SelectItem>
                  <SelectItem value="textarea">ข้อความยาว</SelectItem>
                  <SelectItem value="date">วันที่</SelectItem>
                  <SelectItem value="number">ตัวเลข</SelectItem>
                  <SelectItem value="select">ตัวเลือก (dropdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fldType === "select" && (
              <div>
                <Label className="text-xs">ตัวเลือก (คั่นด้วย | )</Label>
                <Input value={fldOpts} onChange={(e) => setFldOpts(e.target.value)} placeholder="ชาย|หญิง|อื่นๆ" className="h-9" />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              เมื่อแทรกแล้ว ระบบกรอกฟอร์มจะตรวจจับช่องเหล่านี้อัตโนมัติ และสร้างฟอร์มกรอกให้ผู้ใช้
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFieldOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={() => {
                if (!fldKey || !fldLabel) return;
                (editor.chain().focus() as any).insertFieldToken({
                  fieldKey: fldKey, label: fldLabel, type: fldType,
                  options: fldType === "select" ? fldOpts : "",
                }).run();
                setFieldOpen(false);
              }}
            >แทรก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}


// Default exporters
function wrapHtml(inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'TH Sarabun New','Sarabun',serif;font-size:16pt;color:#000;padding:1.5cm;}
    table{border-collapse:collapse;width:100%;} td,th{border:1px solid #333;padding:4px 6px;}
    th{background:#f0f0f0;} img{max-width:100%;} h1{font-size:24pt;} h2{font-size:20pt;} h3{font-size:18pt;}
    @page{size:A4;margin:1.5cm;}
  </style></head><body>${inner}</body></html>`;
}

function defaultPrint(html: string) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(wrapHtml(html) + `<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},400));</script>`);
  w.document.close();
}

function defaultPreview(html: string) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  const bar = `<div style="position:sticky;top:0;background:#1e3a8a;color:#fff;padding:8px 14px;display:flex;gap:8px;justify-content:flex-end;font-family:sans-serif;z-index:10">
    <button onclick="window.print()" style="padding:6px 14px;border:0;border-radius:6px;background:#fff;color:#1e3a8a;cursor:pointer;font-weight:600">🖨️ พิมพ์ / บันทึก PDF</button>
    <button onclick="window.close()" style="padding:6px 14px;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer;border:1px solid #fff">ปิด</button>
  </div>`;
  w.document.write(wrapHtml(bar + html));
  w.document.close();
}

async function defaultDocx(html: string) {
  const { asBlob } = await import("html-docx-js-typescript");
  const out = await asBlob(wrapHtml(html));
  const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  triggerDownload(blob, `document_${Date.now()}.docx`);
}

async function defaultPdf(html: string) {
  // Use print dialog -> save as PDF (browser native, best Thai support)
  defaultPrint(html);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
