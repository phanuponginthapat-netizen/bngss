import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Table as TableIcon, Image as ImageIcon,
  Upload, ArrowLeft, Download, Link as LinkIcon, Printer, Highlighter, Superscript as SupIcon,
  Subscript as SubIcon, Quote, Minus, Code, FileText as PageIcon,
} from "lucide-react";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } from "docx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

const FONTS = ["Sarabun", "TH Sarabun New", "Kanit", "Prompt", "Noto Sans Thai", "Arial", "Times New Roman", "Georgia", "Courier New"];
const SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36", "48"];
const COLORS = ["#000000", "#374151", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function DocsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState<string>("เอกสารใหม่.docx");
  const [loading, setLoading] = useState(!!fileIdParam);
  const [zoom, setZoom] = useState(100);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Image.configure({ allowBase64: true, inline: false }),
      LinkExt.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Subscript,
      Superscript,
      CharacterCount,
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm md:prose-base max-w-none focus:outline-none",
        style: "font-family: Sarabun, 'TH Sarabun New', sans-serif;",
      },
    },
  });

  useEffect(() => {
    if (!fileIdParam || !editor) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
        editor.commands.setContent(value || "<p></p>");
      } catch (e: any) {
        swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [fileIdParam, editor]);

  const handleImportLocal = async (file: File) => {
    if (!editor) return;
    try {
      const buf = await file.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
      editor.commands.setContent(value);
      setFileName(file.name);
      setFileId(null);
    } catch (e: any) {
      swal.error("อ่านไฟล์ไม่ได้", String(e?.message ?? e));
    }
  };

  const insertImageFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => editor?.chain().focus().setImage({ src: String(reader.result) }).run();
    reader.readAsDataURL(file);
  };

  const buildDocx = async (): Promise<Blob> => {
    if (!editor) throw new Error("editor not ready");
    const json = editor.getJSON();
    const paragraphs: Paragraph[] = [];
    const HL = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
    const walk = (nodes: any[]) => {
      for (const n of nodes ?? []) {
        if (n.type === "heading") {
          paragraphs.push(new Paragraph({
            heading: HL[(n.attrs?.level ?? 1) - 1] ?? HeadingLevel.HEADING_1,
            alignment: mapAlign(n.attrs?.textAlign),
            children: renderRuns(n.content ?? []),
          }));
        } else if (n.type === "paragraph") {
          paragraphs.push(new Paragraph({
            alignment: mapAlign(n.attrs?.textAlign),
            children: renderRuns(n.content ?? []),
          }));
        } else if (n.type === "bulletList" || n.type === "orderedList") {
          const items = n.content ?? [];
          items.forEach((li: any) => {
            const inner = li.content?.[0]?.content ?? [];
            paragraphs.push(new Paragraph({
              bullet: n.type === "bulletList" ? { level: 0 } : undefined,
              numbering: n.type === "orderedList" ? { reference: "num", level: 0 } : undefined,
              children: renderRuns(inner),
            }));
          });
        } else if (n.type === "blockquote") {
          walk(n.content ?? []);
        } else if (n.type === "horizontalRule") {
          paragraphs.push(new Paragraph({ text: "―――――――――――" }));
        } else if (n.content) {
          walk(n.content);
        }
      }
    };
    walk(json.content ?? []);
    if (paragraphs.length === 0) paragraphs.push(new Paragraph(""));

    const doc = new Document({
      styles: { default: { document: { run: { font: "Sarabun", size: 28 } } } },
      numbering: {
        config: [{
          reference: "num",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        }],
      },
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        children: paragraphs,
      }],
    });
    return await Packer.toBlob(doc);
  };

  const download = async () => {
    try {
      const blob = await buildDocx();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
      a.click();
    } catch (e: any) {
      swal.error("Export ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const doPrint = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
      <style>
        @page { size: A4; margin: 2.54cm; }
        body { font-family: Sarabun, 'TH Sarabun New', sans-serif; font-size: 14pt; color: #111; line-height: 1.6; }
        h1{font-size:24pt}h2{font-size:20pt}h3{font-size:16pt}
        img{max-width:100%}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #999;padding:4px 8px}
      </style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  }, [editor, fileName]);

  if (!editor) return <div className="p-8">กำลังโหลด editor…</div>;

  const wordCount = editor.storage.characterCount?.words?.() ?? 0;
  const charCount = editor.storage.characterCount?.characters?.() ?? 0;

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".docx" className="hidden" onChange={e => e.target.files?.[0] && handleImportLocal(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด .docx</Button>
            <SaveToDriveButton
              fileId={fileId} fileName={fileName} defaultName="เอกสารใหม่.docx"
              mimeType={MIME.docx} getBlob={buildDocx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap border-t">
          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="ฟอนต์" /></SelectTrigger>
            <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v) => {
            const s = parseInt(v);
            editor.chain().focus().setMark("textStyle", { fontSize: `${s}pt` }).run();
            // Fallback: use CSS via textStyle attribute won't render live without extension; workaround: wrap
            const el = document.querySelector<HTMLElement>(".ProseMirror");
            if (el) el.style.fontSize = `${s}pt`;
          }}>
            <SelectTrigger className="h-8 w-16 text-xs"><SelectValue placeholder="ขนาด" /></SelectTrigger>
            <SelectContent>{SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Separator orientation="vertical" className="h-6" />

          <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("superscript")} onPressedChange={() => editor.chain().focus().toggleSuperscript().run()}><SupIcon className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("subscript")} onPressedChange={() => editor.chain().focus().toggleSubscript().run()}><SubIcon className="w-4 h-4" /></Toggle>

          {/* Color palette */}
          <div className="flex items-center gap-0.5 ml-1">
            {COLORS.map(c => (
              <button key={c} title={c} onClick={() => editor.chain().focus().setColor(c).run()}
                className="w-5 h-5 rounded border" style={{ background: c }} />
            ))}
            <button title="ล้างสี" onClick={() => editor.chain().focus().unsetColor().run()} className="w-5 h-5 rounded border text-xs">✕</button>
          </div>
          <Toggle size="sm" pressed={editor.isActive("highlight")} onPressedChange={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}><Highlighter className="w-4 h-4" /></Toggle>

          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="w-4 h-4" /></Toggle>

          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Toggle>

          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="w-4 h-4" /></Toggle>

          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="w-4 h-4" /></Button>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && insertImageFile(e.target.files[0])} />
            <Button variant="ghost" size="sm" asChild><span><ImageIcon className="w-4 h-4" /></span></Button>
          </label>
          <Button variant="ghost" size="sm" onClick={() => {
            const url = prompt("URL ลิงก์");
            if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}><LinkIcon className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" title="ขึ้นหน้าใหม่" onClick={() => editor.chain().focus().insertContent('<div style="page-break-after: always;"></div><p></p>').run()}><PageIcon className="w-4 h-4" /></Button>

          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></Button>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(50, z - 10))}>−</Button>
            <span className="w-10 text-center">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(200, z + 10))}>+</Button>
          </div>
        </div>
      </div>

      {/* A4 page canvas */}
      <div className="flex-1 overflow-auto py-8 px-4">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">กำลังโหลดเอกสาร…</div>
        ) : (
          <div className="mx-auto" style={{ width: `${(21 * zoom / 100).toFixed(2)}cm` }}>
            <div className="bg-white text-black shadow-xl mx-auto"
              style={{ width: "21cm", minHeight: "29.7cm", padding: "2.54cm", transform: `scale(${zoom / 100})`, transformOrigin: "top center", marginBottom: `${(29.7 * (zoom - 100) / 100)}cm` }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t bg-background/95 px-3 py-1 text-xs text-muted-foreground flex items-center gap-4">
        <span>คำ: {wordCount}</span>
        <span>อักษร: {charCount}</span>
        <span className="ml-auto">A4 · 21 × 29.7 ซม.</span>
      </div>
    </div>
  );
}

function mapAlign(a?: string): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

function renderRuns(nodes: any[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const n of nodes ?? []) {
    if (n.type === "text") {
      const marks = n.marks ?? [];
      const style = marks.find((m: any) => m.type === "textStyle")?.attrs ?? {};
      runs.push(new TextRun({
        text: n.text ?? "",
        bold: marks.some((m: any) => m.type === "bold"),
        italics: marks.some((m: any) => m.type === "italic"),
        underline: marks.some((m: any) => m.type === "underline") ? {} : undefined,
        strike: marks.some((m: any) => m.type === "strike"),
        superScript: marks.some((m: any) => m.type === "superscript"),
        subScript: marks.some((m: any) => m.type === "subscript"),
        color: style.color?.replace("#", ""),
      }));
    } else if (n.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
    }
  }
  return runs;
}
