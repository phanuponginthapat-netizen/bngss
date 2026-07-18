import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Upload, Loader2, FileText, ZoomIn, ZoomOut, Maximize2, PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PdfBoxesView, { type AnswerBox } from "./PdfBoxesView";
import { useIsMobile } from "@/hooks/use-mobile";

export type WSQuestion = {
  id: string;
  type: "box" | "choice" | "tick";
  prompt: string;
  answer?: string;
  options?: string[];
  points?: number;
  box: AnswerBox;
};

export interface WSMeta {
  title: string;
  description: string | null;
  grade_level: string | null;
}

interface Props {
  sourceUrl: string | null;
  sourceType: string | null;
  questions: WSQuestion[];
  onChange: (q: WSQuestion[]) => void;
  onSourceChange: (info: { url: string; type: string; pageCount?: number } | null) => void;
  meta?: WSMeta;
  onMetaChange?: (m: WSMeta) => void;
}

type ToolId = "text" | "choice" | "tick";

const GRADES = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

export default function WorksheetBuilder({ sourceUrl, sourceType, questions, onChange, onSourceChange, meta, onMetaChange }: Props) {
  const isMobile = useIsMobile();
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolId>("text");
  const [zoom, setZoom] = useState(125);
  const [showInspector, setShowInspector] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-close inspector on mobile by default
  useEffect(() => {
    if (isMobile) setShowInspector(false);
  }, [isMobile]);

  const boxes = useMemo(() => questions.map((q) => q.box), [questions]);

  const upload = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(lower)) {
      toast.error("รองรับเฉพาะไฟล์ PDF หรือรูปภาพ — สำหรับ Word กรุณาบันทึกเป็น PDF ก่อน");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const ext = lower.split(".").pop();
      const path = `${u.user?.id || "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("worksheet-files").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("worksheet-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl || "";
      const type = ext === "pdf" ? "pdf" : "image";
      onSourceChange({ url, type });
      toast.success("อัปโหลดต้นแบบใบงานเรียบร้อย");
    } catch (e: any) {
      toast.error("อัปโหลดไม่สำเร็จ: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const addBox = (b: AnswerBox) => {
    let q: WSQuestion;
    if (tool === "choice") {
      q = { id: b.id, type: "choice", prompt: "", options: ["ตัวเลือก 1", "ตัวเลือก 2"], answer: "0", points: 1, box: b };
    } else if (tool === "tick") {
      q = { id: b.id, type: "tick", prompt: "", answer: "true", points: 1, box: b };
    } else {
      q = { id: b.id, type: "box", prompt: "", answer: "", points: 1, box: b };
    }
    onChange([...questions, q]);
    setSelectedId(b.id);
  };
  const update = (id: string, patch: Partial<WSQuestion>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));
  const setClampedZoom = (next: number) => setZoom(Math.max(70, Math.min(220, next)));
  const setMeta = (patch: Partial<WSMeta>) => onMetaChange?.({ ...(meta || { title: "", description: "", grade_level: "" }), ...patch });

  if (!sourceUrl) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-xl border-2 border-dashed p-8 text-center shadow-sm">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">อัปโหลดต้นแบบใบงานก่อน</h3>
          <p className="text-sm text-muted-foreground mb-5">
            รองรับไฟล์ <strong>PDF</strong> หรือรูปภาพ (PNG/JPG) — Word ให้บันทึกเป็น PDF ก่อนอัปโหลด<br/>
            จากนั้นลากกล่องบนกระดาษเพื่อสร้างช่องให้นักเรียนตอบ
          </p>
          <input
            ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
          <Button size="lg" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            เลือกไฟล์ต้นแบบ
          </Button>
        </Card>
      </div>
    );
  }

  const tools: { id: ToolId; label: string; icon: string }[] = [
    { id: "text", label: "ช่องตอบ", icon: "✎" },
    { id: "choice", label: "เลือกตอบ", icon: "◉" },
    { id: "tick", label: "ถูก/ผิด", icon: "✓" },
  ];

  return (
    <div className="flex h-full min-h-0 bg-background relative">
      {/* Floating toggle when inspector hidden */}
      {!showInspector && (
        <Button
          type="button" size="sm" variant="outline"
          className="absolute top-2 right-2 z-10"
          onClick={() => setShowInspector(true)}
        >
          <PanelRightOpen className="mr-1 h-4 w-4" /> เปิดเมนู
        </Button>
      )}

      {/* PDF canvas — left, full height */}
      <div className="flex-1 min-w-0 min-h-0 overflow-auto bg-muted/40">
        <div className="min-h-full p-5">
          <div className="mx-auto transition-[width] duration-150" style={{ width: `${zoom}%`, minWidth: zoom >= 100 ? "780px" : "560px" }}>
            <PdfBoxesView
              fileUrl={sourceUrl}
              fileType={sourceType || "pdf"}
              boxes={boxes}
              editable
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreateBox={addBox}
              scale={2}
              renderBox={(b) => {
                const i = questions.findIndex((q) => q.id === b.id);
                const q = questions[i];
                const badge = q?.type === "choice" ? "◉" : q?.type === "tick" ? "✓" : "✎";
                return <span className="absolute -top-6 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">#{i + 1} {badge}</span>;
              }}
            />
          </div>
        </div>
      </div>

      {/* Right panel — Photoshop-style consolidated menu (overlay on mobile) */}
      {showInspector && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={() => setShowInspector(false)}
              aria-hidden
            />
          )}
          <aside
            className={
              isMobile
                ? "fixed right-0 top-0 bottom-0 z-40 w-[88vw] max-w-[360px] min-h-0 border-l bg-card flex flex-col shadow-2xl"
                : "w-[340px] shrink-0 min-h-0 border-l bg-card flex flex-col"
            }
            style={isMobile ? { paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
          >
          <div className="shrink-0 flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-semibold">เมนูเครื่องมือ</div>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => setShowInspector(false)} title="ซ่อนเมนู">
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            {/* Meta */}
            {meta && onMetaChange && (
              <section className="border-b p-3 space-y-2">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">ข้อมูลใบงาน</div>
                <div>
                  <label className="text-xs">ชื่อใบงาน</label>
                  <Input className="h-8" value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs">ระดับชั้น</label>
                  <Select value={meta.grade_level || ""} onValueChange={(v) => setMeta({ grade_level: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs">คำชี้แจง</label>
                  <Textarea className="min-h-[60px] text-sm" rows={2} value={meta.description || ""} onChange={(e) => setMeta({ description: e.target.value })} />
                </div>
              </section>
            )}

            {/* Tools */}
            <section className="border-b p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">เครื่องมือ (ลากบนกระดาษ)</div>
              <div className="grid grid-cols-3 gap-1">
                {tools.map((t) => (
                  <button
                    key={t.id} type="button" onClick={() => setTool(t.id)}
                    className={`h-14 rounded-md border text-foreground transition ${tool === t.id ? "border-primary bg-primary/15 shadow-sm" : "border-input hover:bg-muted"}`}
                  >
                    <div className="text-xl leading-none">{t.icon}</div>
                    <div className="text-[10px] font-semibold mt-0.5">{t.label}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* View / Zoom */}
            <section className="border-b p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">มุมมอง</div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setClampedZoom(zoom - 15)}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center text-sm font-semibold tabular-nums">{zoom}%</div>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setClampedZoom(zoom + 15)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setZoom(100)}>
                  <Maximize2 className="mr-1 h-4 w-4" /> 100%
                </Button>
              </div>
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => onSourceChange(null)}>
                <RefreshCw className="mr-1 h-4 w-4" /> เปลี่ยนต้นแบบ
              </Button>
            </section>

            {/* Questions list */}
            <section className="p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">รายการช่องคำตอบ ({questions.length})</div>
              {questions.length === 0 && (
                <div className="text-xs text-muted-foreground border-2 border-dashed rounded p-4 text-center">
                  ลากบนกระดาษทางซ้ายเพื่อสร้างกล่อง
                </div>
              )}
              {questions.map((q, i) => (
                <Card key={q.id} className={`p-2 space-y-1 cursor-pointer ${selectedId === q.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedId(q.id)}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">#{i + 1} · หน้า {q.box.page} · {q.type === "choice" ? "เลือกตอบ" : q.type === "tick" ? "ถูก/ผิด" : "ช่องตอบ"}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); remove(q.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Input className="h-8 text-xs" placeholder="คำใบ้/ป้ายชื่อช่อง (ไม่บังคับ)"
                    value={q.prompt} onChange={(e) => update(q.id, { prompt: e.target.value })} />

                  {q.type === "box" && (
                    <Input className="h-8 text-xs" placeholder="เฉลย (เว้นว่างถ้าไม่ตรวจอัตโนมัติ)"
                      value={q.answer || ""} onChange={(e) => update(q.id, { answer: e.target.value })} />
                  )}

                  {q.type === "tick" && (
                    <select className="h-8 text-xs border rounded px-1 bg-background w-full"
                      value={q.answer || "true"} onChange={(e) => update(q.id, { answer: e.target.value })}>
                      <option value="true">เฉลย: ถูก ✓</option>
                      <option value="false">เฉลย: ผิด ✗</option>
                    </select>
                  )}

                  {q.type === "choice" && (
                    <div className="space-y-1">
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-1">
                          <input type="radio" name={`ans-${q.id}`} checked={q.answer === String(oi)}
                            onChange={() => update(q.id, { answer: String(oi) })} />
                          <Input className="h-7 text-xs" value={opt}
                            onChange={(e) => {
                              const opts = [...(q.options || [])]; opts[oi] = e.target.value;
                              update(q.id, { options: opts });
                            }} />
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                            onClick={(e) => { e.stopPropagation(); update(q.id, { options: (q.options || []).filter((_, x) => x !== oi) }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="h-7 text-xs w-full"
                        onClick={(e) => { e.stopPropagation(); update(q.id, { options: [...(q.options || []), `ตัวเลือก ${(q.options?.length || 0) + 1}`] }); }}>
                        + เพิ่มตัวเลือก
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs">
                    <span>คะแนน</span>
                    <Input type="number" min={0} className="h-7 w-16" value={q.points || 1}
                      onChange={(e) => update(q.id, { points: Number(e.target.value) || 0 })} />
                  </div>
                </Card>
              ))}
            </section>
          </div>
        </aside>
        </>
      )}
    </div>
  );
}
