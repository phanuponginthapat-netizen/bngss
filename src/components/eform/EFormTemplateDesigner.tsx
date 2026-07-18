import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import ResizableImage from "./ResizableImage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, Type, CalendarIcon,
  CheckSquare, Circle, PenLine, Hash, Sparkles, MoveUp, MoveDown,
  List,
} from "lucide-react";
import { toast } from "sonner";
import type { EFormField, EFormFieldType, EFormAutofillSource } from "@/lib/eformTemplate";
import { EFORM_PAGE_STYLE } from "@/lib/eformLayout";
import EFormWordToolbar from "./EFormWordToolbar";
import EFormPageCanvas from "./EFormPageCanvas";
import { escapeCurrentTable } from "@/lib/eformInsertHelpers";
import {
  EFormTable, EFormTableCell, EFormTableHeader, EFormTableRow,
  EFormParagraph, EFormHeading, EFormTextStyle, EFormFontSize, normalizeFontSizes, useEFormTableResize,
  getEFormPaperMm, useEFormVisualPagination, EFormFieldToken, EFormDiv,
} from "./EFormRichEditor";
import { handleEFormTableDelete } from "@/lib/eformTableSelection";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { buildSchoolAssetOverlayCSS } from "@/lib/eformSchoolAssets";
import { fitImageAttrs, paperContentMaxPx } from "@/lib/fitImageAttrs";

const FIELD_ICON: Record<EFormFieldType, React.ComponentType<{ className?: string }>> = {
  text: Type, textarea: Type, date: CalendarIcon, number: Hash,
  select: List, checkbox: CheckSquare, radio: Circle,
  signature: PenLine, autofill: Sparkles,
};


const AUTOFILL_LABELS: Record<EFormAutofillSource, string> = {
  "user.name": "ชื่อผู้ใช้ปัจจุบัน",
  "user.position": "ตำแหน่งผู้ใช้",
  "school.name": "ชื่อโรงเรียน",
  "school.address": "ที่อยู่โรงเรียน",
  "school.phone": "โทรศัพท์โรงเรียน",
  "director.name": "ชื่อ ผอ.",
  "director.title": "ตำแหน่ง ผอ.",
  "today": "วันที่วันนี้ (YYYY-MM-DD)",
  "today_thai": "วันที่ไทย (พ.ศ.)",
};

interface Props {
  initialHtml: string;
  initialFields: EFormField[];
  onChange: (html: string, fields: EFormField[]) => void;
  headerExtra?: React.ReactNode;
}

const MenuBtn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) => (
  <button type="button" title={title} onClick={onClick}
    className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${active ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}>
    {children}
  </button>
);

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[^\w\s\u0E00-\u0E7F]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || `field_${Date.now()}`;

const getActiveTextStyleAttrs = (editor: any) => {
  const stored = editor?.state?.storedMarks?.find((mark: any) => mark.type.name === "textStyle")?.attrs;
  if (stored && Object.values(stored).some(Boolean)) return stored;
  return editor?.getAttributes?.("textStyle") || {};
};

const EFormTemplateDesigner = ({ initialHtml, initialFields, onChange, headerExtra }: Props) => {
  const { info: schoolInfo } = useSchoolReport();
  const schoolAssetCSS = useMemo(() => buildSchoolAssetOverlayCSS(schoolInfo), [schoolInfo]);
  const [fields, setFields] = useState<EFormField[]>(initialFields);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<EFormFieldType>("text");
  const [fontSizePt, setFontSizePt] = useState<number>(16);
  const [pages, setPages] = useState<number>(1);
  const [margins, setMargins] = useState<{ top: number; right: number; bottom: number; left: number }>({ top: 25, right: 20, bottom: 20, left: 30 });
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "Letter" | "Legal">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [zoom, setZoom] = useState<number>(0);



  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const lastSelectionRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      EFormParagraph,
      EFormHeading,
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-blue-600 underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      EFormTextStyle,
      EFormFontSize,
      FontFamily,
      Color,
      ResizableImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { style: "max-width:100%;height:auto;" } }),
      EFormTable.configure({ resizable: true, renderWrapper: true, handleWidth: 6, cellMinWidth: 25, HTMLAttributes: { class: "eform-table", style: "border-collapse:collapse;" } }),
      EFormTableRow,
      EFormTableHeader,
      EFormTableCell.configure({ HTMLAttributes: { style: "border:1px solid #333;padding:6px;min-width:40px;vertical-align:top;" } }),
      EFormFieldToken,
      EFormDiv,
    ],
    content: normalizeFontSizes(initialHtml),
    editorProps: {
      attributes: {
        class: "eform-editor max-w-none focus:outline-none bg-white text-black",
        style: `position:relative;font-family:'Sarabun', sans-serif;font-size:16px;line-height:1.4;min-height:252mm;overflow-wrap:break-word;`,
      },
      handleKeyDown: (_view, event) => {
        if ((event.key === "Delete" || event.key === "Backspace") && handleEFormTableDelete(editorRef.current, true)) {
          event.preventDefault();
          return true;
        }
        if (event.key !== "Tab") return false;
        const ed = editorRef.current;
        if (!ed) return false;
        if (ed.isActive("table")) return false;
        if (ed.isActive("listItem") || ed.isActive("taskItem")) {
          event.preventDefault();
          if (event.shiftKey) ed.chain().focus().liftListItem("listItem").run();
          else ed.chain().focus().sinkListItem("listItem").run();
          return true;
        }
        event.preventDefault();
        if (event.shiftKey) return true;
        ed.chain().focus().insertContent("\u00a0\u00a0\u00a0\u00a0").run();
        return true;
      },
    },

    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), fields);
    },
  });
  editorRef.current = editor;
  const paginationStyleRef = useEFormVisualPagination(editor, paperSize, orientation, margins, setPages);

  useEFormTableResize(editor, (nextHtml) => onChange(nextHtml, fields));

  // Push field changes upward
  useEffect(() => {
    if (editor) onChange(editor.getHTML(), fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);




  // ตั้งฟอนต์ default ของหน้าเอกสารครั้งแรกเท่านั้น — การเปลี่ยนจาก toolbar ต้องกระทบเฉพาะข้อความที่คลุมดำ
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.style.fontSize = `16px`;
  }, [editor]);

  // จำ selection ล่าสุดไว้ เพื่อให้การพิมพ์เลขขนาดฟอนต์ใน toolbar ยังปรับเฉพาะข้อความที่คลุมดำเหมือน Word/Docs
  useEffect(() => {
    if (!editor) return;
    const remember = () => { lastSelectionRef.current = editor.state.selection; };
    remember();
    editor.on("selectionUpdate", remember);
    editor.on("focus", remember);
    return () => {
      editor.off("selectionUpdate", remember);
      editor.off("focus", remember);
    };
  }, [editor]);

  const applyFontSize = (size: number) => {
    setFontSizePt(size);
    if (!editor) return;
    const remembered = lastSelectionRef.current;
    if (!editor.isFocused && remembered) {
      try {
        if (remembered.from >= 0 && remembered.to <= editor.state.doc.content.size) {
          editor.view.dispatch(editor.state.tr.setSelection(remembered));
        }
      } catch {
        // ถ้า selection เก่าถูกเปลี่ยนระหว่างแก้เอกสาร ให้ใช้ selection ปัจจุบันแทน
      }
    }
    (editor.chain().focus() as any).setFontSize(`${size}px`).run();
  };

  const applyFontFamily = (nextFontFamily: string) => {
    if (!editor) return;
    const remembered = lastSelectionRef.current;
    if (!editor.isFocused && remembered) {
      try {
        if (remembered.from >= 0 && remembered.to <= editor.state.doc.content.size) {
          editor.view.dispatch(editor.state.tr.setSelection(remembered));
        }
      } catch {
        // ถ้า selection เก่าถูกเปลี่ยนระหว่างแก้เอกสาร ให้ใช้ selection ปัจจุบันแทน
      }
    }
    editor.chain().focus().setFontFamily(nextFontFamily).run();
  };

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const raw: string | undefined = getActiveTextStyleAttrs(editor)?.fontSize;
      if (!raw) return;
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && Math.round(n) !== fontSizePt) setFontSizePt(Math.round(n));
    };
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => { editor.off("selectionUpdate", sync); editor.off("transaction", sync); };
  }, [editor, fontSizePt]);

  const usedKeys = useMemo(() => new Set(fields.map(f => f.key)), [fields]);

  const insertFieldToken = (f: EFormField) => {
    if (!editor) return;
    const html = `<span data-eform-field="${f.key}" style="background:#fef3c7;border:1px dashed #d97706;padding:0 4px;border-radius:3px;color:#92400e;font-weight:600;">[${f.label}]</span>&nbsp;`;
    editor.chain().focus().insertContent(html).run();
  };

  const insertImageFromFile = (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("รูปต้องไม่เกิน 5MB"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || "");
      if (!src) return;
      const { width: pwMm } = getEFormPaperMm(paperSize, orientation);
      const maxPx = paperContentMaxPx(pwMm, margins.left, margins.right);
      const attrs = await fitImageAttrs(src, maxPx);
      escapeCurrentTable(editor);
      editor.chain().focus().setImage(attrs as any).run();
    };
    reader.readAsDataURL(file);
  };

  const insertImageFromUrl = async () => {
    if (!editor) return;
    const url = prompt("วาง URL รูปภาพ");
    if (!url) return;
    const { width: pwMm } = getEFormPaperMm(paperSize, orientation);
    const maxPx = paperContentMaxPx(pwMm, margins.left, margins.right);
    const attrs = await fitImageAttrs(url, maxPx);
    escapeCurrentTable(editor);
    editor.chain().focus().setImage(attrs as any).run();
  };

  const insertTextBox = () => {
    if (!editor) return;
    escapeCurrentTable(editor);
    const html = `<table style="border-collapse:collapse;width:60%;margin:11px 0;"><tbody><tr><td style="border:1.5px solid #333;padding:10px;min-height:40px;vertical-align:top;">กล่องข้อความ — พิมพ์ที่นี่</td></tr></tbody></table><p></p>`;
    editor.chain().focus().insertContent(html).run();
  };

  const insertTable = () => {
    if (!editor) return;
    escapeCurrentTable(editor);
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
  };


  const addField = () => {
    const label = newLabel.trim();
    if (!label) { toast.error("กรอกชื่อช่องก่อน"); return; }
    let key = slugify(label);
    let i = 2;
    while (usedKeys.has(key)) key = `${slugify(label)}_${i++}`;
    const f: EFormField = { key, label, type: newType };
    if (newType === "select" || newType === "radio") f.options = ["ตัวเลือก 1", "ตัวเลือก 2"];
    if (newType === "autofill") f.autofillSource = "user.name";
    setFields(prev => [...prev, f]);
    setNewLabel("");
  };

  const updateField = (key: string, patch: Partial<EFormField>) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f));
  };

  const removeField = (key: string) => {
    setFields(prev => prev.filter(f => f.key !== key));
  };

  const moveField = (key: string, dir: -1 | 1) => {
    setFields(prev => {
      const i = prev.findIndex(f => f.key === key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  if (!editor) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-2 h-full min-h-[70dvh] lg:min-h-0">
      {/* ===== Editor canvas ===== */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <EFormWordToolbar
            editor={editor}
            fontSizePt={fontSizePt}
            onFontSizeChange={applyFontSize}
            onFontFamilyChange={applyFontFamily}
            onInsertImage={insertImageFromFile}
            onInsertImageUrl={insertImageFromUrl}
            onInsertTextBox={insertTextBox}
            onInsertTable={insertTable}
            margins={margins}
            onMarginsChange={setMargins}
            paperSize={paperSize}
            onPaperSizeChange={setPaperSize}
            orientation={orientation}
            onOrientationChange={setOrientation}
            zoom={zoom}
            onZoomChange={setZoom}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImageFromFile(f); e.target.value = ""; }}
          />

          {(() => {
            const { width: pw, height: ph } = getEFormPaperMm(paperSize, orientation);
            return (
              <EFormPageCanvas
                pages={pages}
                margins={margins}
                paperWidthMm={pw}
                paperHeightMm={ph}
                zoom={zoom > 0 ? zoom : undefined}
                className="bg-slate-400/40 px-3 sm:px-4 pt-4 sm:pt-8 pb-10 overflow-auto max-h-[58dvh] lg:max-h-[78vh] flex justify-start sm:justify-center"
                pageStyle={{ ...(EFORM_PAGE_STYLE as any), padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm` }}
              >
                {schoolAssetCSS && <style>{schoolAssetCSS}</style>}
                <style ref={paginationStyleRef} />
                <EditorContent editor={editor} />
              </EFormPageCanvas>
            );
          })()}
        </CardContent>
      </Card>

      {/* ===== Fields panel ===== */}
      <Card className="lg:sticky lg:top-4 self-start max-h-[42dvh] lg:max-h-[80vh] overflow-hidden flex flex-col">
        <CardContent className="p-3 space-y-3 overflow-auto">
          {headerExtra && (<><div className="space-y-2">{headerExtra}</div><Separator /></>)}
          <div>
            <div className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> ช่องกรอก (Fields)
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              เพิ่มช่อง → กดปุ่ม <b>แทรก</b> เพื่อวางลงในเอกสาร ค่าจะถูกแทนที่ตอนกรอกฟอร์ม
            </p>
            <div className="flex gap-1.5">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ชื่อช่อง เช่น ชื่อ-สกุล"
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
              />
              <Select value={newType} onValueChange={(v) => setNewType(v as EFormFieldType)}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">ข้อความ</SelectItem>
                  <SelectItem value="textarea">หลายบรรทัด</SelectItem>
                  <SelectItem value="date">วันที่</SelectItem>
                  <SelectItem value="number">ตัวเลข</SelectItem>
                  <SelectItem value="select">ดรอปดาวน์</SelectItem>
                  <SelectItem value="checkbox">เช็คบ็อกซ์</SelectItem>
                  <SelectItem value="radio">ตัวเลือก</SelectItem>
                  <SelectItem value="signature">ลายเซ็น</SelectItem>
                  <SelectItem value="autofill">Auto-fill</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={addField}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            {fields.length === 0 && (
              <div className="text-xs text-center text-muted-foreground py-6 border border-dashed rounded">
                ยังไม่มีช่อง — เพิ่มช่องด้านบนเพื่อเริ่ม
              </div>
            )}
            {fields.map((f, i) => {
              const Icon = FIELD_ICON[f.type];
              return (
                <div key={f.key} className="border rounded-md p-2 space-y-1.5 bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <Input
                      value={f.label}
                      onChange={(e) => updateField(f.key, { label: e.target.value })}
                      className="h-7 text-sm font-medium flex-1"
                    />
                    <Badge variant="outline" className="text-[10px] font-mono">{f.key}</Badge>
                  </div>

                  {(f.type === "select" || f.type === "radio") && (
                    <Textarea
                      value={(f.options || []).join("\n")}
                      onChange={(e) => updateField(f.key, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                      placeholder="ตัวเลือก (บรรทัดละ 1)"
                      rows={2}
                      className="text-xs"
                    />
                  )}

                  {f.type === "autofill" && (
                    <Select value={f.autofillSource} onValueChange={(v) => updateField(f.key, { autofillSource: v as EFormAutofillSource })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="แหล่งข้อมูล" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(AUTOFILL_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {(f.type === "text" || f.type === "textarea" || f.type === "number") && (
                    <Input
                      value={f.placeholder || ""}
                      onChange={(e) => updateField(f.key, { placeholder: e.target.value })}
                      placeholder="คำแนะนำ (placeholder)"
                      className="h-7 text-xs"
                    />
                  )}

                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={() => insertFieldToken(f)}>
                      แทรกลงเอกสาร
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(f.key, -1)} disabled={i === 0}>
                      <MoveUp className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(f.key, 1)} disabled={i === fields.length - 1}>
                      <MoveDown className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeField(f.key)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EFormTemplateDesigner;
