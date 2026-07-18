import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Save, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Superscript as SupIcon, Subscript as SubIcon, Highlighter, Palette,
  Search, ZoomIn, ZoomOut, Quote, Minus, FileDown,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import { downloadHomeworkBlob, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  open: boolean;
  attachment: Attachment | null;
  onClose: () => void;
  onSave: (blob: Blob, filename: string) => Promise<void> | void;
}

const FONT_FAMILIES = [
  { label: "TH Sarabun", value: "'TH Sarabun New', 'Sarabun', sans-serif" },
  { label: "IBM Plex Sans Thai", value: "'IBM Plex Sans Thai', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
];
const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "60", "72"];

export default function DocxEditor({ open, attachment, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [fontSize, setFontSize] = useState("16");
  const [color, setColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#fff59d");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveKey = attachment ? `docx-draft:${attachment.id}` : "";

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Subscript,
      Superscript,
      Table.configure({ resizable: true, HTMLAttributes: { class: "docx-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[55vh] focus:outline-none px-16 py-12 bg-white shadow-inner",
        style: "font-family: 'IBM Plex Sans Thai', Inter, sans-serif; font-size: 16px;",
      },
    },
  });

  // load doc
  useEffect(() => {
    if (!open || !attachment || !editor) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Try restore draft first
        const draft = localStorage.getItem(autoSaveKey);
        if (draft) {
          editor.commands.setContent(draft);
          setLoading(false);
          toast.info("กู้คืนฉบับร่างอัตโนมัติแล้ว");
          return;
        }
        const blob = await downloadHomeworkBlob(attachment.path);
        const buf = await blob.arrayBuffer();
        const mammoth: any = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) editor.commands.setContent(result.value || "<p></p>");
      } catch (e: any) {
        console.error(e);
        toast.error("เปิดไฟล์ Word ไม่สำเร็จ: " + (e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, attachment?.id, editor]);

  // Auto-save every 30s
  useEffect(() => {
    if (!editor || !autoSaveKey) return;
    const id = setInterval(() => {
      try { localStorage.setItem(autoSaveKey, editor.getHTML()); } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [editor, autoSaveKey]);

  // Keyboard: Ctrl+H → find/replace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowFind((v) => !v);
      }
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stats = useMemo(() => {
    if (!editor) return { words: 0, chars: 0 };
    return {
      words: editor.storage.characterCount?.words?.() ?? 0,
      chars: editor.storage.characterCount?.characters?.() ?? 0,
    };
  }, [editor, editor?.state]);

  const handleSave = async () => {
    if (!attachment || !editor) return;
    setSaving(true);
    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'IBM Plex Sans Thai','TH Sarabun New',sans-serif;font-size:14pt;}
        h1{font-size:20pt;} h2{font-size:16pt;} h3{font-size:14pt;}
        table{border-collapse:collapse;} td,th{border:1px solid #888;padding:4px;}
        img{max-width:100%;}
      </style></head><body>${editor.getHTML()}</body></html>`;
      const { asBlob } = await import("html-docx-js-typescript");
      const out = await asBlob(html);
      const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const baseName = attachment.name.replace(/\.[^.]+$/, "");
      await onSave(blob, `${baseName}_edited.docx`);
      try { localStorage.removeItem(autoSaveKey); } catch {}
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!editor) return;
    try {
      const html2pdf: any = (await import("html2pdf.js" as any)).default;
      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "'IBM Plex Sans Thai','TH Sarabun New',sans-serif";
      container.innerHTML = editor.getHTML();
      await html2pdf().from(container).set({
        margin: 10, filename: `${attachment?.name?.replace(/\.[^.]+$/, "") || "document"}.pdf`,
        html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4" },
      }).save();
    } catch (e: any) {
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + (e?.message || e));
    }
  };

  const applyFontSize = (size: string) => {
    if (!editor) return;
    setFontSize(size);
    // Wrap selection in span with font-size via TextStyle
    editor.chain().focus().setMark("textStyle", { style: `font-size: ${size}px` } as any).run();
  };

  const insertLink = () => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = () => fileInputRef.current?.click();
  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !editor) return;
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: String(reader.result) }).run();
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const insertHr = () => editor?.chain().focus().setHorizontalRule().run();

  const findNext = () => {
    if (!findText) return;
    const dom = document.querySelector(".ProseMirror") as HTMLElement | null;
    if (!dom) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const idx = (node.textContent || "").toLowerCase().indexOf(findText.toLowerCase());
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + findText.length);
        sel?.addRange(range);
        (dom.parentElement || dom).scrollTo({ top: (range.getBoundingClientRect().top || 0) - 200, behavior: "smooth" });
        return;
      }
    }
    toast.info("ไม่พบข้อความ");
  };
  const replaceAll = () => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    editor.commands.setContent(html.replace(re, replaceText));
    toast.success("แทนที่ทั้งหมดแล้ว");
  };

  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: any) => (
    <Button size="sm" type="button" variant={active ? "default" : "outline"} onClick={onClick} title={title} className="h-8 w-8 p-0">
      {children}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="truncate">แก้ไข Word: {attachment?.name}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="border-y bg-muted/30 px-2 py-1.5 flex flex-wrap gap-1 items-center text-sm">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 className="w-4 h-4" /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 className="w-4 h-4" /></Btn>
          <div className="w-px h-6 bg-border mx-1" />

          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Font" /></SelectTrigger>
            <SelectContent>{FONT_FAMILIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>

          <Select value={fontSize} onValueChange={applyFontSize}>
            <SelectTrigger className="h-8 w-16 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike"><Strikethrough className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Sup"><SupIcon className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Sub"><SubIcon className="w-4 h-4" /></Btn>

          <label className="inline-flex items-center gap-1 border rounded h-8 px-1.5 cursor-pointer" title="สีตัวอักษร">
            <Palette className="w-4 h-4" />
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); editor.chain().focus().setColor(e.target.value).run(); }} className="w-5 h-5 border-0 bg-transparent p-0" />
          </label>
          <label className="inline-flex items-center gap-1 border rounded h-8 px-1.5 cursor-pointer" title="ไฮไลต์">
            <Highlighter className="w-4 h-4" />
            <input type="color" value={highlightColor} onChange={(e) => { setHighlightColor(e.target.value); editor.chain().focus().toggleHighlight({ color: e.target.value }).run(); }} className="w-5 h-5 border-0 bg-transparent p-0" />
          </label>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="w-4 h-4" /></Btn>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Left"><AlignLeft className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center"><AlignCenter className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Right"><AlignRight className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify"><AlignJustify className="w-4 h-4" /></Btn>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet"><List className="w-4 h-4" /></Btn>
          <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered"><ListOrdered className="w-4 h-4" /></Btn>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn onClick={insertLink} title="Link"><LinkIcon className="w-4 h-4" /></Btn>
          <Btn onClick={insertImage} title="Image"><ImageIcon className="w-4 h-4" /></Btn>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageFile} />
          <Btn onClick={insertTable} title="Table"><TableIcon className="w-4 h-4" /></Btn>
          <Btn onClick={insertHr} title="เส้นคั่น"><Minus className="w-4 h-4" /></Btn>

          <div className="w-px h-6 bg-border mx-1" />
          <Btn onClick={() => setShowFind((v) => !v)} title="Find & Replace (Ctrl+H)"><Search className="w-4 h-4" /></Btn>
          <Btn onClick={() => setZoom((z) => Math.max(50, z - 10))} title="Zoom out"><ZoomOut className="w-4 h-4" /></Btn>
          <span className="text-xs w-10 text-center tabular-nums">{zoom}%</span>
          <Btn onClick={() => setZoom((z) => Math.min(200, z + 10))} title="Zoom in"><ZoomIn className="w-4 h-4" /></Btn>

          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" onClick={exportPdf} className="h-8"><FileDown className="w-4 h-4 mr-1" />PDF</Button>
          </div>
        </div>

        {/* Table sub-menu */}
        {editor.isActive("table") && (
          <div className="border-b bg-accent/20 px-2 py-1 flex flex-wrap gap-1 text-xs">
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().addRowAfter().run()}>+ แถว</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ คอลัมน์</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteRow().run()}>ลบแถว</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteColumn().run()}>ลบคอลัมน์</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().mergeCells().run()}>รวมช่อง</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().splitCell().run()}>แยกช่อง</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>สลับหัวตาราง</Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteTable().run()} className="text-destructive">ลบตาราง</Button>
          </div>
        )}

        {/* Find & Replace */}
        {showFind && (
          <div className="border-b bg-background px-2 py-2 flex flex-wrap gap-2 items-center">
            <Input value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="ค้นหา..." className="h-8 w-48" />
            <Input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="แทนที่ด้วย..." className="h-8 w-48" />
            <Button size="sm" variant="outline" onClick={findNext}>ค้นหาถัดไป</Button>
            <Button size="sm" variant="outline" onClick={replaceAll}>แทนที่ทั้งหมด</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowFind(false)}>ปิด</Button>
          </div>
        )}

        {/* Editor area */}
        <div className="overflow-auto flex-1 bg-muted/40 p-4" style={{ minHeight: "50vh" }}>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด...</div>
          ) : (
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", width: "210mm", margin: "0 auto" }}>
              <EditorContent editor={editor} />
            </div>
          )}
        </div>

        {/* Status + save */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
          <div>คำ: <b>{stats.words}</b> · ตัวอักษร: <b>{stats.chars}</b> · บันทึกร่างอัตโนมัติทุก 30 วิ</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>ยกเลิก</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              บันทึก & แนบกลับ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
