// PDF overlay designer: upload a PDF, render pages, click to drop field markers,
// drag to reposition / resize, edit metadata in side panel.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, Plus, Trash2, MousePointer2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { uploadEformPdf, type PdfOverlayField } from "@/lib/eformPdf";
import { EFormPdfRenderer } from "./EFormPdfRenderer";

interface Props {
  pdfPath: string;
  overlays: PdfOverlayField[];
  onChange: (pdfPath: string, overlays: PdfOverlayField[]) => void;
}

const NO_AUTOFILL_VALUE = "__none__";

const AUTOFILL_OPTIONS = [
  { v: NO_AUTOFILL_VALUE, label: "— (ไม่ใช้ autofill)" },
  { v: "user.name", label: "ชื่อผู้ใช้" },
  { v: "user.position", label: "ตำแหน่งผู้ใช้" },
  { v: "school.name", label: "ชื่อโรงเรียน" },
  { v: "school.address", label: "ที่อยู่โรงเรียน" },
  { v: "school.phone", label: "โทรศัพท์โรงเรียน" },
  { v: "director.name", label: "ชื่อ ผอ." },
  { v: "director.title", label: "ตำแหน่ง ผอ." },
  { v: "today", label: "วันที่ (YYYY-MM-DD)" },
  { v: "today_thai", label: "วันที่ไทย" },
];

const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[^\w\s\u0E00-\u0E7F]/g, "").trim().replace(/\s+/g, "_").toLowerCase() || `f_${Date.now()}`;

export function EFormPdfDesigner({ pdfPath, overlays, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 20MB"); return; }
    setUploading(true);
    try {
      const path = await uploadEformPdf(file);
      onChange(path, []);
      toast.success("อัพโหลด PDF แล้ว");
    } catch (e: any) {
      toast.error(e.message || "อัพโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const addFieldAt = (page: number, xPct: number, yPct: number) => {
    const maxNum = overlays.reduce((m, o) => {
      const n = /^field_(\d+)$/.exec(o.key)?.[1];
      return n ? Math.max(m, Number(n)) : m;
    }, 0);
    const idx = maxNum + 1;
    const f: PdfOverlayField = {
      key: `field_${idx}`,
      label: `ช่อง ${idx}`,
      type: "text",
      page,
      xPct: Math.max(0, xPct - 6),
      yPct: Math.max(0, yPct - 1.2),
      widthPct: 18,
      heightPct: 2.6,
      fontSizePt: 12,
    };
    onChange(pdfPath, [...overlays, f]);
    setSelectedKey(f.key);
    setPlaceMode(false);
  };

  const updateField = (key: string, patch: Partial<PdfOverlayField>) => {
    onChange(pdfPath, overlays.map(o => o.key === key ? { ...o, ...patch } : o));
  };

  const removeField = (key: string) => {
    onChange(pdfPath, overlays.filter(o => o.key !== key));
    if (selectedKey === key) setSelectedKey(null);
  };

  // Drag-to-move on overlay
  const dragStateRef = useRef<{ key: string; mode: "move" | "resize"; startX: number; startY: number; orig: PdfOverlayField; pageW: number; pageH: number } | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = dragStateRef.current; if (!st) return;
      const dx = ((e.clientX - st.startX) / st.pageW) * 100;
      const dy = ((e.clientY - st.startY) / st.pageH) * 100;
      if (st.mode === "move") {
        updateField(st.key, {
          xPct: Math.max(0, Math.min(100 - st.orig.widthPct, st.orig.xPct + dx)),
          yPct: Math.max(0, Math.min(100 - st.orig.heightPct, st.orig.yPct + dy)),
        });
      } else {
        updateField(st.key, {
          widthPct: Math.max(3, Math.min(100 - st.orig.xPct, st.orig.widthPct + dx)),
          heightPct: Math.max(1.5, Math.min(100 - st.orig.yPct, st.orig.heightPct + dy)),
        });
      }
    };
    const onUp = () => { dragStateRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays]);

  const selected = overlays.find(o => o.key === selectedKey);

  if (!pdfPath) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold">อัพโหลดเอกสาร PDF</h3>
            <p className="text-xs text-muted-foreground">รองรับฟอร์มราชการที่มีอยู่แล้ว (สพฐ., ปพ., หนังสือ) ไม่เกิน 20MB</p>
          </div>
          <label className="inline-flex">
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <Button asChild disabled={uploading}>
              <span>{uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} เลือกไฟล์ PDF</span>
            </Button>
          </label>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 h-full min-h-0">
      {/* Canvas area */}
      <Card className="overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30 shrink-0 flex-wrap">
          <Button size="sm" variant={placeMode ? "default" : "outline"} onClick={() => setPlaceMode(p => !p)}>
            <Plus className="w-4 h-4 mr-1" /> {placeMode ? "คลิกบน PDF เพื่อวาง" : "เพิ่มช่อง"}
          </Button>
          <Badge variant="outline">{overlays.length} ช่อง</Badge>
          <label className="ml-auto inline-flex">
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <Button asChild size="sm" variant="ghost"><span><Upload className="w-3.5 h-3.5 mr-1" /> เปลี่ยน PDF</span></Button>
          </label>
        </div>
        <div className={`flex-1 min-h-0 overflow-auto bg-slate-100 p-3 ${placeMode ? "cursor-crosshair" : ""}`}>
          <EFormPdfRenderer
            pdfPath={pdfPath}
            scale={1.4}
            overlays={overlays}
            pageRefs={pageRefs}
            onPageClick={placeMode ? addFieldAt : undefined}
            renderOverlay={(f) => {
              const isSel = f.key === selectedKey;
              return (
                <div
                  className={`w-full h-full border-2 ${isSel ? "border-primary bg-primary/10" : "border-blue-400/60 bg-blue-100/30"} cursor-move touch-none text-[10px] font-medium text-blue-900 flex items-center px-1 overflow-hidden`}
                  title={f.label}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedKey(f.key);
                    const wrapper = pageRefs.current[f.page];
                    if (!wrapper) return;
                    const r = wrapper.getBoundingClientRect();
                    dragStateRef.current = { key: f.key, mode: "move", startX: e.clientX, startY: e.clientY, orig: f, pageW: r.width, pageH: r.height };
                  }}
                >
                  <span className="truncate">{f.label}</span>
                  {isSel && (
                    <div
                      className="absolute right-0 bottom-0 w-5 h-5 bg-primary cursor-se-resize touch-none"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const wrapper = pageRefs.current[f.page];
                        if (!wrapper) return;
                        const r = wrapper.getBoundingClientRect();
                        dragStateRef.current = { key: f.key, mode: "resize", startX: e.clientX, startY: e.clientY, orig: f, pageW: r.width, pageH: r.height };
                      }}
                    />
                  )}
                </div>
              );
            }}
          />
        </div>
      </Card>

      {/* Side panel */}
      <Card className="overflow-hidden flex flex-col min-h-0">
        <div className="p-2 border-b bg-muted/30 text-sm font-medium shrink-0">รายละเอียดช่อง</div>
        <div className="p-3 overflow-auto flex-1 space-y-3 text-sm">
          {!selected ? (
            <div className="text-xs text-muted-foreground text-center py-6">
              <MousePointer2 className="w-6 h-6 mx-auto mb-2" />
              คลิกบนช่องเพื่อแก้ไข<br/>หรือกด "เพิ่มช่อง" แล้ววางบน PDF
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">ป้ายชื่อ</Label>
                <Input value={selected.label} onChange={(e) => {
                  const label = e.target.value;
                  updateField(selected.key, { label, key: selected.key.startsWith("field_") ? slugify(label) : selected.key });
                }} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Key</Label>
                <Input value={selected.key} onChange={(e) => {
                  const newKey = slugify(e.target.value);
                  onChange(pdfPath, overlays.map(o => o.key === selected.key ? { ...o, key: newKey } : o));
                  setSelectedKey(newKey);
                }} className="h-8 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs">ประเภท</Label>
                <Select value={selected.type} onValueChange={(v) => updateField(selected.key, { type: v as any })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">ข้อความ</SelectItem>
                    <SelectItem value="date">วันที่</SelectItem>
                    <SelectItem value="number">ตัวเลข</SelectItem>
                    <SelectItem value="checkbox">เครื่องหมายถูก ☑</SelectItem>
                    <SelectItem value="signature">ลายเซ็น</SelectItem>
                    <SelectItem value="autofill">เติมอัตโนมัติ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selected.type === "autofill" && (
                <div>
                  <Label className="text-xs">แหล่งข้อมูล</Label>
                  <Select
                    value={selected.autofillSource || NO_AUTOFILL_VALUE}
                    onValueChange={(v) => updateField(selected.key, { autofillSource: v === NO_AUTOFILL_VALUE ? undefined : v as any })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTOFILL_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">ขนาดฟอนต์ (px)</Label>
                  <Input type="number" min={6} max={48} value={selected.fontSizePt || 12}
                    onChange={(e) => updateField(selected.key, { fontSizePt: Number(e.target.value) })}
                    className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">หน้า</Label>
                  <Input type="number" min={1} value={selected.page}
                    onChange={(e) => updateField(selected.key, { page: Math.max(1, Number(e.target.value)) })}
                    className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><Label className="text-xs">X %</Label><Input type="number" value={selected.xPct.toFixed(1)} onChange={(e) => updateField(selected.key, { xPct: Number(e.target.value) })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Y %</Label><Input type="number" value={selected.yPct.toFixed(1)} onChange={(e) => updateField(selected.key, { yPct: Number(e.target.value) })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">กว้าง %</Label><Input type="number" value={selected.widthPct.toFixed(1)} onChange={(e) => updateField(selected.key, { widthPct: Number(e.target.value) })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">สูง %</Label><Input type="number" value={selected.heightPct.toFixed(1)} onChange={(e) => updateField(selected.key, { heightPct: Number(e.target.value) })} className="h-8 text-xs" /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="req" checked={!!selected.required} onCheckedChange={(c) => updateField(selected.key, { required: c })} />
                <Label htmlFor="req" className="text-xs">บังคับกรอก</Label>
              </div>
              <Button variant="destructive" size="sm" className="w-full" onClick={() => removeField(selected.key)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> ลบช่องนี้
              </Button>
            </>
          )}

          {overlays.length > 0 && (
            <div className="pt-3 border-t space-y-1">
              <div className="text-xs font-medium text-muted-foreground">ช่องทั้งหมด</div>
              {overlays.map(o => (
                <button
                  key={o.key}
                  onClick={() => setSelectedKey(o.key)}
                  className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-muted ${selectedKey === o.key ? "bg-primary/10 text-primary" : ""}`}
                >
                  หน้า {o.page} · {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
