import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, Trash2, Type, AlignLeft, ListChecks, CheckSquare, Pencil, Mic, MousePointer2, Copy, Undo2, Redo2, Eye, ArrowDownUp, Link2, Hash, ChevronDown } from "lucide-react";
import { renderPdfToImages, newField, isWorksheetGradable, type WorksheetField, type WorksheetFieldType, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { toast } from "sonner";
import { saveErrorMessage } from "@/lib/saveError";
import PdfWorksheetPlayer from "./PdfWorksheetPlayer";

interface Props {
  initialPdfUrl?: string | null;
  initialFields: WorksheetField[];
  onPdfChange: (file: File | null) => void;
  onFieldsChange: (fields: WorksheetField[]) => void;
}

const TOOLS: { type: WorksheetFieldType; label: string; Icon: any }[] = [
  { type: "text", label: "เติมคำ", Icon: Type },
  { type: "textarea", label: "ตอบยาว", Icon: AlignLeft },
  { type: "mc", label: "หลายข้อ", Icon: ListChecks },
  { type: "checkbox", label: "ติ๊ก", Icon: CheckSquare },
  { type: "draw", label: "วาดรูป", Icon: Pencil },
  { type: "audio", label: "อัดเสียง", Icon: Mic },
  { type: "select", label: "เลือกจากรายการ", Icon: ChevronDown },
  { type: "multiselect", label: "เลือกหลายคำตอบ", Icon: ListChecks },
  { type: "match", label: "จับคู่", Icon: Link2 },
  { type: "order", label: "เรียงลำดับ", Icon: ArrowDownUp },
  { type: "number", label: "ตัวเลข", Icon: Hash },
];

export default function PdfWorksheetDesigner({ initialPdfUrl, initialFields, onPdfChange, onFieldsChange }: Props) {
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [retryPdf, setRetryPdf] = useState(0);
  const renderVersion = useRef(0);
  const [fields, setFields] = useState<WorksheetField[]>(initialFields || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<WorksheetFieldType | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [past, setPast] = useState<WorksheetField[][]>([]);
  const [future, setFuture] = useState<WorksheetField[][]>([]);
  const snapshot = () => { setPast(arr => [...arr.slice(-29), structuredClone(fields)]); setFuture([]); };
  const undo = () => { const previous = past.at(-1); if (!previous) return; setFuture(arr => [structuredClone(fields), ...arr]); setFields(previous); setPast(arr => arr.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setPast(arr => [...arr, structuredClone(fields)]); setFields(next); setFuture(arr => arr.slice(1)); };
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // กันมี listener ค้างถ้าผู้ใช้ปิด dialog กลางทาง drag
  useEffect(() => () => { dragCleanupRef.current?.(); dragCleanupRef.current = null; }, []);

  useEffect(() => { onFieldsChange(fields); }, [fields, onFieldsChange]);

  useEffect(() => {
    if (!initialPdfUrl) return;
    const version = ++renderVersion.current;
    setLoading(true);
    setPdfError(null);
    renderPdfToImages(initialPdfUrl)
      .then(pages => { if (renderVersion.current === version) setPages(pages); })
      .catch(e => { if (renderVersion.current === version) setPdfError(saveErrorMessage(e)); })
      .finally(() => { if (renderVersion.current === version) setLoading(false); });
    return () => { renderVersion.current += 1; };
  }, [initialPdfUrl, retryPdf]);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") { toast.error("กรุณาเลือกไฟล์ PDF"); return; }
    const version = ++renderVersion.current;
    setLoading(true);
    setPdfError(null);
    try {
      const imgs = await renderPdfToImages(file);
      if (renderVersion.current !== version) return;
      setPages(imgs);
      onPdfChange(file);
    } catch (e: any) { if (renderVersion.current === version) setPdfError(saveErrorMessage(e)); }
    finally { if (renderVersion.current === version) setLoading(false); }
  };

  const handlePageClick = (page: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const template = newField(activeTool, page);
    const f = newField(activeTool, page, {
      x: Math.max(0, Math.min(100 - template.w, x - 5)),
      y: Math.max(0, Math.min(100 - template.h, y - 2)),
    });
    snapshot(); setFields(arr => [...arr, f]);
    setSelectedId(f.id);
    setActiveTool(null);
  };

  const updateField = (id: string, patch: Partial<WorksheetField>, record = true) => {
    if (record) snapshot();
    setFields(arr => arr.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const removeField = (id: string) => {
    snapshot();
    setFields(arr => arr.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onFieldPointerDown = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    // ให้ pointer drag ทำงานทั้ง mouse/touch/pen บน mobile & desktop
    e.stopPropagation();
    setSelectedId(id);
    const target = e.currentTarget as HTMLDivElement;
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const parent = target.parentElement as HTMLDivElement;
    const startX = e.clientX, startY = e.clientY;
    const startField = fields.find(f => f.id === id);
    if (!startField) return;
    snapshot();
    const parentRect = parent.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      const dx = ((ev.clientX - startX) / parentRect.width) * 100;
      const dy = ((ev.clientY - startY) / parentRect.height) * 100;
      updateField(id, {
        x: Math.max(0, Math.min(100 - startField.w, startField.x + dx)),
        y: Math.max(0, Math.min(100 - startField.h, startField.y + dy)),
      }, false);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      dragCleanupRef.current = null;
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    dragCleanupRef.current = cleanup;
  };

  const onResize = (id: string, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const parent = handle.closest(".pdf-page") as HTMLDivElement;
    const startX = e.clientX, startY = e.clientY;
    const startField = fields.find(f => f.id === id);
    if (!startField) return;
    snapshot();
    const parentRect = parent.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      const dw = ((ev.clientX - startX) / parentRect.width) * 100;
      const dh = ((ev.clientY - startY) / parentRect.height) * 100;
      const maxW = 100 - startField.x;
      const maxH = 100 - startField.y;
      updateField(id, {
        w: Math.max(Math.min(3, maxW), Math.min(maxW, startField.w + dw)),
        h: Math.max(Math.min(2, maxH), Math.min(maxH, startField.h + dh)),
      }, false);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      dragCleanupRef.current = null;
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    dragCleanupRef.current = cleanup;
  };

  const selected = fields.find(f => f.id === selectedId) || null;

  if (preview && initialPdfUrl) return <div className="h-full min-h-0 flex flex-col"><div className="flex items-center justify-between border-b p-2"><h3 className="font-semibold">ทดลองทำใบงาน</h3><Button variant="outline" onClick={() => setPreview(false)}>กลับไปแก้ไข</Button></div><PdfWorksheetPlayer pdfUrl={initialPdfUrl} fields={fields} answers={previewAnswers} onAnswersChange={setPreviewAnswers} workspace /></div>;
  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-[70dvh] md:min-h-0">
      {/* LEFT: toolbar + pages */}
      <div className="flex-1 min-w-0 overflow-auto bg-muted rounded-md p-3 space-y-3 max-h-[62dvh] md:max-h-none">
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = ""; }} />
        {!pages.length && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 bg-background">
            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
            <Button type="button" variant="outline" disabled={loading} onClick={() => fileInputRef.current?.click()}>เลือก PDF ต้นแบบ</Button>
          </div>
        )}
        {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {pdfError && <div className="space-y-2"><p className="text-destructive">{pdfError}</p>{initialPdfUrl && <Button variant="outline" onClick={() => setRetryPdf(v => v + 1)}>ลองใหม่</Button>}</div>}

        {pages.length > 0 && (
          <div className="sticky top-0 z-10 bg-background border rounded-md p-2 flex flex-wrap gap-1 items-center">
            <Button size="sm" variant={activeTool === null ? "default" : "outline"} onClick={() => setActiveTool(null)}>
              <MousePointer2 className="w-3.5 h-3.5 mr-1" /> เลือก
            </Button>
            {TOOLS.map(t => (
              <Button key={t.type} size="sm" variant={activeTool === t.type ? "default" : "outline"} aria-pressed={activeTool === t.type} title={t.label} onClick={() => setActiveTool(t.type)}>
                <t.Icon className="w-3.5 h-3.5 mr-1" />{t.label}
              </Button>
            ))}
            <Button type="button" size="icon" variant="ghost" aria-label="ย้อนกลับ" title="ย้อนกลับ" disabled={!past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" aria-label="ทำซ้ำ" title="ทำซ้ำ" disabled={!future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
            <Button type="button" size="sm" variant="outline" disabled={!initialPdfUrl} onClick={() => setPreview(true)}><Eye className="h-4 w-4" />ทดลองทำ</Button>
            <Button type="button" size="sm" variant="ghost" className="ml-auto" disabled={loading} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />เปลี่ยน PDF</Button>
          </div>
        )}

        {pages.map(p => (
          <div key={p.page} className="space-y-1">
            <div className="text-xs text-muted-foreground">หน้า {p.page}</div>
            <div
              className={`pdf-page relative bg-card shadow-sm border mx-auto ${activeTool ? "touch-none" : "touch-pan-y"}`}
              style={{ width: "100%", maxWidth: p.width, aspectRatio: `${p.width} / ${p.height}`, cursor: activeTool ? "crosshair" : "default" }}
              onClick={(e) => handlePageClick(p.page, e)}
            >
              <img src={p.dataUrl} alt={`page ${p.page}`} className="absolute inset-0 w-full h-full select-none pointer-events-none" draggable={false} />
              {fields.filter(f => f.page === p.page).map(f => (
                <div
                  key={f.id}
                  onPointerDown={(e) => onFieldPointerDown(f.id, e)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(f.id); }}
                  className={`absolute border-2 ${selectedId === f.id ? "border-primary bg-primary/10" : "border-warning/70 bg-warning/10"} rounded cursor-move flex items-center justify-center text-[10px] font-medium text-foreground touch-none`}
                  style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
                >
                  <span className="px-1 truncate">{TOOLS.find(t => t.type === f.type)?.label}{f.label ? `: ${f.label}` : ""}</span>
                  <span
                    onPointerDown={(e) => onResize(f.id, e)}
                    className="absolute -right-1 -bottom-1 w-5 h-5 bg-primary rounded-sm cursor-se-resize touch-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT: properties — bottom sheet on mobile */}
      <div className="w-full md:w-72 md:shrink-0 border-t md:border-t-0 md:border-l p-3 overflow-auto space-y-2 max-h-[38dvh] md:max-h-none bg-background">
        <div className="font-semibold text-sm">คุณสมบัติกล่อง</div>
        {!selected && <p className="text-xs text-muted-foreground">แตะกล่องบน PDF เพื่อตั้งค่า</p>}
        {selected && (
          <>
            <div className="text-xs text-muted-foreground">ชนิด: {TOOLS.find(t => t.type === selected.type)?.label} · หน้า {selected.page}</div>
            <label className="flex gap-2 items-center text-xs"><Checkbox checked={!!selected.required} onCheckedChange={c => updateField(selected.id, { required: !!c })} />ต้องตอบก่อนส่ง</label>
            <div>
              <Label className="text-xs">ป้ายชื่อ</Label>
              <Input className="h-8 text-sm" value={selected.label || ""} onChange={(e) => updateField(selected.id, { label: e.target.value })} />
            </div>
            {(selected.type === "text" || selected.type === "textarea") && (
              <>
                <div>
                  <Label className="text-xs">Placeholder</Label>
                  <Input className="h-8 text-sm" value={selected.placeholder || ""} onChange={(e) => updateField(selected.id, { placeholder: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">เฉลย (แยกหลายคำตอบด้วย |)</Label>
                  <Textarea rows={2} value={selected.correct || ""} onChange={(e) => updateField(selected.id, { correct: e.target.value })} />
                </div>
                <div className="flex gap-2 items-center">
                  <Checkbox checked={!!selected.caseSensitive} onCheckedChange={(c) => updateField(selected.id, { caseSensitive: !!c })} />
                  <Label className="text-xs">ตรงตัวพิมพ์</Label>
                </div>
              </>
            )}
            {["mc", "select", "multiselect", "order"].includes(selected.type) && (
              <>
                <Label className="text-xs">ตัวเลือก</Label>
                {(selected.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Input className="h-8 text-sm" value={opt} onChange={(e) => {
                      const next = [...(selected.options || [])]; next[i] = e.target.value;
                      updateField(selected.id, { options: next, correct: undefined });
                    }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const next = (selected.options || []).filter((_, idx) => idx !== i);
                      updateField(selected.id, { options: next });
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => updateField(selected.id, { options: [...(selected.options || []), "ตัวเลือกใหม่"] })}>เพิ่มตัวเลือก</Button>
                {selected.type === "multiselect" ? <div className="space-y-2"><Label className="text-xs">เฉลย (เลือกได้หลายข้อ)</Label>{(selected.options || []).map((opt, i) => <label key={i} className="flex gap-2 text-xs items-center"><Checkbox checked={Array.isArray(selected.correct) && selected.correct.includes(i)} onCheckedChange={checked => updateField(selected.id, { correct: checked ? [...(Array.isArray(selected.correct) ? selected.correct : []), i] : (Array.isArray(selected.correct) ? selected.correct : []).filter((v: number) => v !== i) })} />{opt}</label>)}</div> : selected.type === "order" ? <p className="text-xs text-muted-foreground">เฉลยเรียงตามรายการด้านบน</p> : <div>
                  <Label className="text-xs">เฉลย</Label>
                  <Select value={String(selected.correct ?? "")} onValueChange={(v) => updateField(selected.id, { correct: Number(v) })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกข้อถูก" /></SelectTrigger>
                    <SelectContent>
                      {(selected.options || []).map((o, i) => <SelectItem key={i} value={String(i)}>{i + 1}. {o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}
              </>
            )}
            {selected.type === "match" && <div className="space-y-2"><Label className="text-xs">คู่คำถาม — คำตอบ</Label>{(selected.pairs || []).map((pair, i) => <div key={i} className="flex gap-1"><Input aria-label={`คำถามคู่ ${i + 1}`} value={pair.left} onChange={e => updateField(selected.id, { pairs: selected.pairs?.map((p, index) => index === i ? { ...p, left: e.target.value } : p) })} /><Input aria-label={`คำตอบคู่ ${i + 1}`} value={pair.right} onChange={e => updateField(selected.id, { pairs: selected.pairs?.map((p, index) => index === i ? { ...p, right: e.target.value } : p) })} /><Button size="icon" variant="ghost" title="ลบคู่" aria-label="ลบคู่" onClick={() => updateField(selected.id, { pairs: selected.pairs?.filter((_, index) => index !== i) })}><Trash2 className="h-3 w-3" /></Button></div>)}<Button size="sm" variant="outline" onClick={() => updateField(selected.id, { pairs: [...(selected.pairs || []), { left: "คำถาม", right: "คำตอบ" }] })}>เพิ่มคู่</Button></div>}
            {selected.type === "number" && <div className="space-y-2"><Label className="text-xs">เฉลยตัวเลข</Label><Input aria-label="เฉลยตัวเลข" type="number" step="any" value={selected.correct ?? ""} onChange={e => updateField(selected.id, { correct: e.target.value })} /><Label className="text-xs">ค่าคลาดเคลื่อนที่ยอมรับ</Label><Input aria-label="ค่าคลาดเคลื่อน" type="number" min="0" step="any" value={selected.tolerance ?? 0} onChange={e => updateField(selected.id, { tolerance: Math.max(0, Number(e.target.value)) })} /></div>}
            {selected.type === "checkbox" && (
              <div className="flex items-center gap-2">
                <Checkbox checked={!!selected.correct} onCheckedChange={(c) => updateField(selected.id, { correct: !!c })} />
                <Label className="text-xs">เฉลย: ต้องติ๊ก</Label>
              </div>
            )}
            <div>
              <Label className="text-xs">คะแนน</Label>
              <Input type="number" className="h-8 text-sm" value={selected.score ?? 1}
                onChange={(e) => updateField(selected.id, { score: Number(e.target.value) || 0 })} />
            </div>
            <Button size="sm" variant="destructive" onClick={() => removeField(selected.id)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />ลบกล่อง
            </Button>
            <Button size="sm" variant="outline" onClick={() => { snapshot(); const next = { ...structuredClone(selected), id: crypto.randomUUID(), x: Math.min(100 - selected.w, selected.x + 3), y: Math.min(100 - selected.h, selected.y + 3) }; setFields(arr => [...arr, next]); setSelectedId(next.id); }}><Copy className="h-4 w-4" />ทำสำเนากล่อง</Button>
          </>
        )}
        {fields.length > 0 && (
          <div className="pt-2 border-t text-xs text-muted-foreground">รวม {fields.length} กล่อง · คะแนนตรวจอัตโนมัติ {fields.reduce((s, f) => s + (isWorksheetGradable(f) ? f.score ?? 1 : 0), 0)}</div>
        )}
      </div>
    </div>
  );
}
