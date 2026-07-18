import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, Trash2, Type, AlignLeft, ListChecks, CheckSquare, Pencil, Mic, MousePointer2 } from "lucide-react";
import { renderPdfToImages, newField, type WorksheetField, type WorksheetFieldType, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { toast } from "sonner";

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
];

export default function PdfWorksheetDesigner({ initialPdfUrl, initialFields, onPdfChange, onFieldsChange }: Props) {
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<WorksheetField[]>(initialFields || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<WorksheetFieldType | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // กันมี listener ค้างถ้าผู้ใช้ปิด dialog กลางทาง drag
  useEffect(() => () => { dragCleanupRef.current?.(); dragCleanupRef.current = null; }, []);

  useEffect(() => { onFieldsChange(fields); }, [fields, onFieldsChange]);

  useEffect(() => {
    if (!initialPdfUrl) return;
    setLoading(true);
    renderPdfToImages(initialPdfUrl).then(setPages).catch(e => toast.error(e.message)).finally(() => setLoading(false));
  }, [initialPdfUrl]);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") { toast.error("กรุณาเลือกไฟล์ PDF"); return; }
    setLoading(true);
    try {
      const imgs = await renderPdfToImages(file);
      setPages(imgs);
      onPdfChange(file);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const handlePageClick = (page: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const f = newField(activeTool, page, { x: Math.max(0, x - 5), y: Math.max(0, y - 2) });
    setFields(arr => [...arr, f]);
    setSelectedId(f.id);
    setActiveTool(null);
  };

  const updateField = (id: string, patch: Partial<WorksheetField>) =>
    setFields(arr => arr.map(f => f.id === id ? { ...f, ...patch } : f));
  const removeField = (id: string) => {
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
    const startField = fields.find(f => f.id === id)!;
    const parentRect = parent.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      const dx = ((ev.clientX - startX) / parentRect.width) * 100;
      const dy = ((ev.clientY - startY) / parentRect.height) * 100;
      updateField(id, {
        x: Math.max(0, Math.min(100 - startField.w, startField.x + dx)),
        y: Math.max(0, Math.min(100 - startField.h, startField.y + dy)),
      });
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
    const startField = fields.find(f => f.id === id)!;
    const parentRect = parent.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      const dw = ((ev.clientX - startX) / parentRect.width) * 100;
      const dh = ((ev.clientY - startY) / parentRect.height) * 100;
      updateField(id, {
        w: Math.max(3, Math.min(100 - startField.x, startField.w + dw)),
        h: Math.max(2, Math.min(100 - startField.y, startField.h + dh)),
      });
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

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-[70dvh] md:min-h-0">
      {/* LEFT: toolbar + pages */}
      <div className="flex-1 min-w-0 overflow-auto bg-slate-100 rounded p-3 space-y-3 max-h-[62dvh] md:max-h-none">
        {!pages.length && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 bg-white cursor-pointer hover:bg-muted">
            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
            <span className="text-sm font-medium">อัปโหลด PDF ต้นแบบ</span>
            <span className="text-xs text-muted-foreground">นำใบงานที่มีอยู่มาทำเป็นใบงานออนไลน์</span>
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          </label>
        )}
        {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>}

        {pages.length > 0 && (
          <div className="sticky top-0 z-10 bg-white border rounded p-2 flex flex-nowrap md:flex-wrap gap-1 items-center overflow-x-auto">
            <Button size="sm" variant={activeTool === null ? "default" : "outline"} onClick={() => setActiveTool(null)}>
              <MousePointer2 className="w-3.5 h-3.5 mr-1" /> เลือก
            </Button>
            {TOOLS.map(t => (
              <Button key={t.type} size="sm" variant={activeTool === t.type ? "default" : "outline"} onClick={() => setActiveTool(t.type)}>
                <t.Icon className="w-3.5 h-3.5 mr-1" />{t.label}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              {activeTool ? "แตะบนหน้า PDF เพื่อวาง" : "เลือกเครื่องมือ แล้วแตะ/คลิกบน PDF"}
            </span>
            <label className="ml-auto text-xs px-2 py-1 border rounded cursor-pointer hover:bg-muted">
              เปลี่ยน PDF
              <input type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
            </label>
          </div>
        )}

        {pages.map(p => (
          <div key={p.page} className="space-y-1">
            <div className="text-xs text-muted-foreground">หน้า {p.page}</div>
            <div
              ref={(el) => { pageRefs.current[p.page] = el; }}
              className={`pdf-page relative bg-white shadow border mx-auto ${activeTool ? "touch-none" : "touch-pan-y"}`}
              style={{ width: "100%", maxWidth: p.width, aspectRatio: `${p.width} / ${p.height}`, cursor: activeTool ? "crosshair" : "default" }}
              onClick={(e) => handlePageClick(p.page, e)}
            >
              <img src={p.dataUrl} alt={`page ${p.page}`} className="absolute inset-0 w-full h-full select-none pointer-events-none" draggable={false} />
              {fields.filter(f => f.page === p.page).map(f => (
                <div
                  key={f.id}
                  onPointerDown={(e) => onFieldPointerDown(f.id, e)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(f.id); }}
                  className={`absolute border-2 ${selectedId === f.id ? "border-primary bg-primary/10" : "border-amber-500/70 bg-amber-200/30"} rounded cursor-move flex items-center justify-center text-[10px] font-medium text-amber-900 touch-none`}
                  style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
                >
                  <span className="px-1 truncate">{f.type}{f.label ? `: ${f.label}` : ""}</span>
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
      <div className="w-full md:w-72 md:shrink-0 border rounded p-3 overflow-auto space-y-2 max-h-[38dvh] md:max-h-none bg-background">
        <div className="font-semibold text-sm">คุณสมบัติกล่อง</div>
        {!selected && <p className="text-xs text-muted-foreground">แตะกล่องบน PDF เพื่อตั้งค่า</p>}
        {selected && (
          <>
            <div className="text-xs text-muted-foreground">ชนิด: {selected.type} · หน้า {selected.page}</div>
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
            {selected.type === "mc" && (
              <>
                <Label className="text-xs">ตัวเลือก</Label>
                {(selected.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <Input className="h-8 text-sm" value={opt} onChange={(e) => {
                      const next = [...(selected.options || [])]; next[i] = e.target.value;
                      updateField(selected.id, { options: next });
                    }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      const next = (selected.options || []).filter((_, idx) => idx !== i);
                      updateField(selected.id, { options: next });
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => updateField(selected.id, { options: [...(selected.options || []), "ตัวเลือกใหม่"] })}>เพิ่มตัวเลือก</Button>
                <div>
                  <Label className="text-xs">เฉลย</Label>
                  <Select value={String(selected.correct ?? "")} onValueChange={(v) => updateField(selected.id, { correct: Number(v) })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกข้อถูก" /></SelectTrigger>
                    <SelectContent>
                      {(selected.options || []).map((o, i) => <SelectItem key={i} value={String(i)}>{i + 1}. {o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
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
          </>
        )}
        {fields.length > 0 && (
          <div className="pt-2 border-t text-xs text-muted-foreground">รวม {fields.length} กล่อง · คะแนนเต็ม {fields.reduce((s, f) => s + (f.score ?? 0), 0)}</div>
        )}
      </div>
    </div>
  );
}
