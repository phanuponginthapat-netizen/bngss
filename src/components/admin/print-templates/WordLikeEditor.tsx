import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Image as ImageIcon, Table as TableIcon, Undo, Redo,
  Plus, Minus, Trash2, Highlighter, Tag,
} from "lucide-react";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { toast } from "sonner";
import { tokenThaiLabel } from "@/lib/print-template-tokens";
import EFormPageCanvas from "@/components/eform/EFormPageCanvas";
import { escapeCurrentTable } from "@/lib/eformInsertHelpers";
import { fitImageAttrs, paperContentMaxPx } from "@/lib/fitImageAttrs";

interface Props {
  content: string;
  onChange: (html: string) => void;
  paper: "A4" | "A5" | "A6" | "letter";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  variableSuggestions?: string[];
  disabled?: boolean;
  fullHeight?: boolean;
}

const PAPER: Record<string, [number, number]> = {
  A4: [210, 297], A5: [148, 210], A6: [105, 148], letter: [216, 279],
};

const FONTS = [
  "Sarabun",
  "IBM Plex Sans Thai", "Prompt", "Kanit", "Mitr", "Noto Sans Thai",
  "Arial", "Times New Roman",
];

const SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "21px", "24px", "28px", "32px", "36px", "42px", "48px"];

const Tb = ({ onClick, active, children, title, disabled }: any) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40 ${
      active ? "bg-primary/10 text-primary" : "text-foreground"
    }`}
  >
    {children}
  </button>
);

// Custom Image with width + alignment (float / center) attributes
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs) => (attrs.width ? { style: `width:${attrs.width}${String(attrs.width).match(/[a-z%]/i) ? "" : "px"}` } : {}),
      },
      align: {
        default: "none",
        parseHTML: (el) => el.getAttribute("data-align") || "none",
        renderHTML: (attrs) => {
          const a = attrs.align;
          if (a === "left") return { "data-align": "left", style: "float:left;margin:4px 12px 4px 0;" };
          if (a === "right") return { "data-align": "right", style: "float:right;margin:4px 0 4px 12px;" };
          if (a === "center") return { "data-align": "center", style: "display:block;margin:8px auto;" };
          return { "data-align": "none" };
        },
      },
    };
  },
});

const WordLikeEditor = ({
  content, onChange, paper, orientation, margins, variableSuggestions = [], disabled, fullHeight,
}: Props) => {
  const [imgWidth, setImgWidth] = useState<string>("");
  const editor = useEditor({
    editable: !disabled,
    parseOptions: { preserveWhitespace: "full" },
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      FontSize.configure({ types: ["textStyle"] }),
      Color,
      FontFamily.configure({ types: ["textStyle"] }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "pt-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          view.dispatch(view.state.tr.insertText("\u00A0\u00A0\u00A0\u00A0"));
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      editor.commands.setContent(content || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  const imageSelected = editor?.isActive("image");
  const setImageAttr = (attrs: Record<string, any>) => editor?.chain().focus().updateAttributes("image", attrs).run();

  const [pw, ph] = PAPER[paper] || PAPER.A4;
  const [w, h] = orientation === "landscape" ? [ph, pw] : [pw, ph];
  const pageScale = useMemo(() => {
    // scale to fit container width ~ assume 800px max
    return 1;
  }, []);

  const uploadImage = async (file: File) => {
    try {
      const path = `print-templates/inline/${Date.now()}-${file.name}`;
      const { publicUrl } = await uploadPublicFileWithFallback("cms-images", path, file);
      if (editor) escapeCurrentTable(editor);
      const maxPx = paperContentMaxPx(w, margins.left, margins.right);
      const attrs = await fitImageAttrs(publicUrl, maxPx);
      editor?.chain().focus().setImage(attrs as any).run();
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดไม่สำเร็จ");
    }
  };

  const insertVar = (token: string) => editor?.chain().focus().insertContent(token).run();

  // Field insert dialog state
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldFont, setFieldFont] = useState<string>("");
  const [fieldSize, setFieldSize] = useState<string>("");
  const [fieldBold, setFieldBold] = useState(false);
  const [fieldUnderline, setFieldUnderline] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const insertField = () => {
    if (!editor || !fieldKey) return;
    // Allow only safe chars in font/size to prevent style-attribute injection
    const safeFont = (fieldFont || "").replace(/[^\w\s\-]/g, "");
    const safeSize = (fieldSize || "").replace(/[^\w%.\-]/g, "");
    const safeKey = fieldKey.replace(/[^\w.\-]/g, "");
    const styles: string[] = [];
    if (safeFont) styles.push(`font-family:'${safeFont}'`);
    if (safeSize) styles.push(`font-size:${safeSize}`);
    if (fieldBold) styles.push("font-weight:bold");
    if (fieldUnderline) styles.push("text-decoration:underline");
    const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
    const labelHtml = fieldLabel ? `${escapeHtml(fieldLabel)} ` : "";
    const html = `${labelHtml}<span${styleAttr}>{{${safeKey}}}</span>&nbsp;`;
    editor.chain().focus().insertContent(html).run();
    setFieldOpen(false);
    setFieldKey(""); setFieldLabel("");
  };

  const setFontSize = (size: string) => {
    if (!editor) return;
    const safeSize = size.replace(/[^\w%.\-]/g, "");
    // ใช้ FontSize extension เพื่อให้ปรับเฉพาะส่วนที่คลุมดำ (ไม่กระทบทั้งหน้าเหมือนสมัยใช้ setMark+style)
    (editor.chain().focus() as any).setFontSize(safeSize).run();
  };

  if (!editor) return null;

  return (
    <div className={`border rounded-lg bg-background flex flex-col overflow-hidden ${fullHeight ? "h-full min-h-0 overscroll-contain" : ""}`}>
      {/* Toolbar — Word-style */}
      <div className="border-b bg-muted/40 p-1.5 flex flex-wrap items-center gap-1">
        <Tb onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="w-4 h-4" /></Tb>
        <div className="w-px h-5 bg-border mx-1" />

        <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="ฟอนต์" /></SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select onValueChange={setFontSize}>
          <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue placeholder="ขนาด" /></SelectTrigger>
          <SelectContent>
            {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="w-px h-5 bg-border mx-1" />
        <Tb onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="ตัวหนา"><Bold className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="ตัวเอียง"><Italic className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="ขีดเส้นใต้"><UnderlineIcon className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="ขีดทับ"><Strikethrough className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="ไฮไลท์"><Highlighter className="w-4 h-4" /></Tb>
        <input type="color" title="สีตัวอักษร" className="w-7 h-7 rounded border cursor-pointer p-0.5"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />

        <div className="w-px h-5 bg-border mx-1" />
        <Tb onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="H1"><Heading1 className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="H2"><Heading2 className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3"><Heading3 className="w-4 h-4" /></Tb>

        <div className="w-px h-5 bg-border mx-1" />
        <Tb onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="ชิดซ้าย"><AlignLeft className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="กึ่งกลาง"><AlignCenter className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="ชิดขวา"><AlignRight className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="ชิดขอบ"><AlignJustify className="w-4 h-4" /></Tb>

        <div className="w-px h-5 bg-border mx-1" />
        <Tb onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="รายการ"><List className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="ลำดับ"><ListOrdered className="w-4 h-4" /></Tb>

        <div className="w-px h-5 bg-border mx-1" />
        <Tb onClick={() => { escapeCurrentTable(editor); editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }} title="แทรกตาราง"><TableIcon className="w-4 h-4" /></Tb>
        <Tb onClick={() => editor.chain().focus().addRowAfter().run()} title="เพิ่มแถว"><Plus className="w-3 h-3" />R</Tb>
        <Tb onClick={() => editor.chain().focus().addColumnAfter().run()} title="เพิ่มคอลัมน์"><Plus className="w-3 h-3" />C</Tb>
        <Tb onClick={() => editor.chain().focus().deleteRow().run()} title="ลบแถว"><Minus className="w-3 h-3" />R</Tb>
        <Tb onClick={() => editor.chain().focus().deleteColumn().run()} title="ลบคอลัมน์"><Minus className="w-3 h-3" />C</Tb>
        <Tb onClick={() => editor.chain().focus().deleteTable().run()} title="ลบตาราง"><Trash2 className="w-4 h-4" /></Tb>

        <div className="w-px h-5 bg-border mx-1" />
        <label className="cursor-pointer p-1.5 rounded hover:bg-muted" title="แทรกรูป">
          <ImageIcon className="w-4 h-4" />
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        </label>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => { setFieldFont(""); setFieldSize(""); setFieldBold(false); setFieldUnderline(false); setFieldOpen(true); }}
          title="แทรกฟิลด์ข้อมูลพร้อมกำหนดฟอนต์/ขนาด"
        >
          <Tag className="w-3 h-3" /> แทรกฟิลด์
        </Button>
      </div>

      {/* Variable palette */}
      {variableSuggestions.length > 0 && (
        <div className="border-b bg-muted/20 p-1.5 flex flex-wrap items-center gap-1 max-h-20 overflow-auto">
          <span className="text-[10px] text-muted-foreground mr-1">แทรกตัวแปร:</span>
          {variableSuggestions.slice(0, 30).map((v) => (
            <Button key={v} type="button" variant="outline" size="sm" className="h-6 text-[10px] px-1.5"
              title={`{{${v}}}`}
              onClick={() => insertVar(`{{${v}}}`)}>
              {tokenThaiLabel(v)}
              <span className="ml-1 text-muted-foreground font-mono">{`{{${v}}}`}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Image controls — appear when image selected */}
      {imageSelected && (
        <div className="border-b bg-primary/5 p-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">รูปภาพ:</span>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setImageAttr({ align: "left" })}>ลอยซ้าย</Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setImageAttr({ align: "center" })}>กึ่งกลาง</Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setImageAttr({ align: "right" })}>ลอยขวา</Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setImageAttr({ align: "none" })}>ไม่ลอย</Button>
          <span className="mx-1">|</span>
          <span>กว้าง:</span>
          {["25%", "50%", "75%", "100%"].map((wv) => (
            <Button key={wv} size="sm" variant="outline" className="h-7" onClick={() => setImageAttr({ width: wv })}>{wv}</Button>
          ))}
          <input
            type="text"
            placeholder="เช่น 300px"
            value={imgWidth}
            onChange={(e) => setImgWidth(e.target.value)}
            onBlur={() => imgWidth && setImageAttr({ width: imgWidth })}
            className="h-7 px-2 border rounded text-xs w-24"
          />
        </div>
      )}

      {/* Paper canvas — ใช้ ruler/scale ชุดเดียวกันกับ EForm */}
      <EFormPageCanvas
        paperWidthMm={w}
        paperHeightMm={h}
        margins={margins}
        className={`overflow-auto overscroll-contain bg-muted/30 p-4 flex justify-center ${fullHeight ? "flex-1 min-h-0 items-start" : ""}`}
        pageClassName="bg-white shadow-lg"
        pageStyle={{
          padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
          boxSizing: "border-box",
        }}
      >
        <EditorContent
          editor={editor}
          className="prose max-w-none focus:outline-none
            [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]
            [&_.ProseMirror]:whitespace-pre-wrap
            [&_.ProseMirror_p]:my-1
            [&_table]:border-collapse [&_table]:w-full
            [&_table_td]:border [&_table_td]:border-gray-400 [&_table_td]:p-1
            [&_table_th]:border [&_table_th]:border-gray-400 [&_table_th]:p-1 [&_table_th]:bg-gray-100
            [&_img]:max-w-full [&_img.ProseMirror-selectednode]:outline [&_img.ProseMirror-selectednode]:outline-2 [&_img.ProseMirror-selectednode]:outline-primary"
        />
      </EFormPageCanvas>
      <div className="border-t bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground">
        เคล็ดลับ: <b>Tab</b> = ย่อหน้ายาว · <b>Shift+Enter</b> = ขึ้นบรรทัดใหม่ไม่เว้นวรรค · คลิกรูปเพื่อปรับขนาด/จัดวาง (ลอยซ้าย-ขวา-กึ่งกลาง) · Space เคาะเว้นวรรคได้อิสระ
      </div>

      {/* Insert Field Dialog */}
      <Dialog open={fieldOpen} onOpenChange={setFieldOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> แทรกฟิลด์ข้อมูล</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">เลือกฟิลด์</Label>
              <Input placeholder="ค้นหา…" value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} className="h-8" />
              <div className="border rounded max-h-64 overflow-auto">
                {variableSuggestions
                  .filter((v) => !fieldSearch || v.toLowerCase().includes(fieldSearch.toLowerCase()))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFieldKey(v)}
                      className={`block w-full text-left px-2 py-1 text-xs font-mono hover:bg-muted ${fieldKey === v ? "bg-primary/10 text-primary" : ""}`}
                    >
                      {v}
                    </button>
                  ))}
                {variableSuggestions.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground italic">ยังไม่มีฟิลด์ใน Sample data</div>
                )}
              </div>
              <div>
                <Label className="text-xs">หรือพิมพ์ชื่อฟิลด์เอง</Label>
                <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="student.full_name" className="h-8 font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">ป้ายข้อความนำหน้า (ไม่บังคับ)</Label>
                <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="เช่น ชื่อ:" className="h-8" />
              </div>
              <div>
                <Label className="text-xs">ฟอนต์</Label>
                <Select value={fieldFont} onValueChange={setFieldFont}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="(ใช้ฟอนต์ปัจจุบัน)" /></SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ขนาดฟอนต์</Label>
                <Select value={fieldSize} onValueChange={setFieldSize}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="(ค่าเริ่มต้น)" /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-2"><Switch checked={fieldBold} onCheckedChange={setFieldBold} /><Label className="text-xs">ตัวหนา</Label></div>
                <div className="flex items-center gap-2"><Switch checked={fieldUnderline} onCheckedChange={setFieldUnderline} /><Label className="text-xs">ขีดเส้นใต้</Label></div>
              </div>
              <div className="border rounded p-2 bg-muted/20 text-sm min-h-[60px]">
                <div className="text-[10px] text-muted-foreground mb-1">ตัวอย่าง:</div>
                {fieldLabel && <span>{fieldLabel} </span>}
                <span style={{
                  fontFamily: fieldFont || undefined,
                  fontSize: fieldSize || undefined,
                  fontWeight: fieldBold ? "bold" : undefined,
                  textDecoration: fieldUnderline ? "underline" : undefined,
                }}>{fieldKey ? `{{${fieldKey}}}` : "—"}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldOpen(false)}>ยกเลิก</Button>
            <Button onClick={insertField} disabled={!fieldKey}>แทรก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WordLikeEditor;
