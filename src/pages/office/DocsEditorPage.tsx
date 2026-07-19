import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import LinkExt from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Table as TableIcon, Image as ImageIcon,
  Upload, ArrowLeft, Download
} from "lucide-react";
import mammoth from "mammoth";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

export default function DocsEditorPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState<string>("เอกสารใหม่.docx");
  const [loading, setLoading] = useState(!!fileIdParam);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      LinkExt.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow, TableCell, TableHeader,
    ],
    content: "<p>เริ่มพิมพ์เอกสารที่นี่…</p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm md:prose-base max-w-none min-h-[500px] p-8 focus:outline-none bg-white text-black rounded-lg shadow-inner",
      },
    },
  });

  // Load file from Drive
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

  const buildDocx = async (): Promise<Blob> => {
    if (!editor) throw new Error("editor not ready");
    // Simple HTML → docx conversion: iterate top-level nodes
    const json = editor.getJSON();
    const paragraphs: Paragraph[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes ?? []) {
        if (n.type === "heading") {
          const level = n.attrs?.level ?? 1;
          paragraphs.push(new Paragraph({
            heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1] ?? HeadingLevel.HEADING_1,
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
          items.forEach((li: any, idx: number) => {
            const inner = li.content?.[0]?.content ?? [];
            paragraphs.push(new Paragraph({
              bullet: n.type === "bulletList" ? { level: 0 } : undefined,
              numbering: n.type === "orderedList" ? { reference: "num", level: 0 } : undefined,
              children: renderRuns(inner),
            }));
          });
        } else if (n.content) {
          walk(n.content);
        }
      }
    };
    walk(json.content ?? []);
    if (paragraphs.length === 0) paragraphs.push(new Paragraph(""));

    const doc = new Document({
      styles: { default: { document: { run: { font: "TH Sarabun New", size: 32 } } } },
      numbering: {
        config: [{
          reference: "num",
          levels: [{ level: 0, format: "decimal" as any, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        }],
      },
      sections: [{ children: paragraphs }],
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

  if (!editor) return <div className="p-8">กำลังโหลด editor…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-4 h-4" /></Toggle>
          <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-4 h-4" /></Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const url = prompt("URL รูป");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}><ImageIcon className="w-4 h-4" /></Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></Button>
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".docx" className="hidden" onChange={e => e.target.files?.[0] && handleImportLocal(e.target.files[0])} />
              <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />นำเข้า</span></Button>
            </label>
            <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด</Button>
            <SaveToDriveButton
              fileId={fileId}
              fileName={fileName}
              defaultName="เอกสารใหม่.docx"
              mimeType={MIME.docx}
              getBlob={buildDocx}
              onSaved={(id, name) => { setFileId(id); setFileName(name); }}
            />
          </div>
        </div>
      </div>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {loading ? <div className="text-center py-16 text-muted-foreground">กำลังโหลดเอกสาร…</div> : <EditorContent editor={editor} />}
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
      runs.push(new TextRun({
        text: n.text ?? "",
        bold: marks.some((m: any) => m.type === "bold"),
        italics: marks.some((m: any) => m.type === "italic"),
        underline: marks.some((m: any) => m.type === "underline") ? {} : undefined,
      }));
    } else if (n.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
    }
  }
  return runs;
}
