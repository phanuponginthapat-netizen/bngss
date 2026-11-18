import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Eraser, Check, X, ZoomIn, ZoomOut, MoveHorizontal } from "lucide-react";
import { renderPdfToImages, gradeField, isWorksheetGradable, type WorksheetField, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { supabase } from "@/integrations/supabase/client";
import MediaCaptureButtons from "./MediaCaptureButtons";

interface Props {
  pdfUrl: string;
  fields: WorksheetField[];
  answers: Record<string, any>;
  onAnswersChange: (a: Record<string, any>) => void;
  readOnly?: boolean;
  showResults?: boolean; // overlay ✓/✗
  studentId?: string | null;
  compact?: boolean;
  workspace?: boolean;
}

export default function PdfWorksheetPlayer({ pdfUrl, fields, answers, onAnswersChange, readOnly, showResults, studentId, compact, workspace }: Props) {
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryPdf, setRetryPdf] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPages([]);
    renderPdfToImages(pdfUrl)
      .then(pages => { if (active) setPages(pages); })
      .catch((e: any) => { if (active) setError(String(e?.message ?? e) || "เปิด PDF ไม่สำเร็จ"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pdfUrl, retryPdf]);

  const set = (id: string, v: any) => onAnswersChange({ ...answers, [id]: v });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return (
    <div className="p-6 text-center space-y-2">
      <p className="text-sm text-destructive">โหลด PDF ไม่สำเร็จ: {error}</p>
      <Button size="sm" variant="outline" onClick={() => setRetryPdf(v => v + 1)}>
        ลองใหม่
      </Button>
    </div>
  );

  return (
    <div className={workspace ? "flex flex-col flex-1 min-h-0 min-w-0" : "space-y-2 min-w-0"}>
      <div className={`flex items-center justify-between gap-2 border-b shrink-0 ${workspace ? "px-4 py-1 bg-background" : "pb-2"}`}>
        <span className="text-xs text-muted-foreground">{pages.length} หน้า · {fields.length} ช่องตอบ</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" title="ย่อใบงาน" aria-label="ย่อใบงาน" disabled={zoom <= 50} onClick={() => setZoom(z => z - 25)}><ZoomOut className="h-4 w-4" /></Button>
          <span className="text-xs tabular-nums w-10 text-center">{zoom}%</span>
          <Button type="button" variant="ghost" size="icon" title="ขยายใบงาน" aria-label="ขยายใบงาน" disabled={zoom >= 300} onClick={() => setZoom(z => z + 25)}><ZoomIn className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" title="พอดีความกว้าง" aria-label="พอดีความกว้าง" onClick={() => setZoom(100)}><MoveHorizontal className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className={`${compact ? "p-2" : "p-3 sm:p-5"} bg-muted overflow-auto ${workspace ? "flex-1 min-h-0 overscroll-contain" : "rounded-md"}`}>
      <div className="space-y-3 mx-auto" style={{ width: `${zoom}%`, maxWidth: 960 * zoom / 100, minWidth: 280 }}>
      {pages.map(p => (
        <div key={p.page} className="space-y-1">
          <div className="text-xs text-muted-foreground">หน้า {p.page}</div>
          <div className="relative bg-card shadow-sm border mx-auto min-w-[280px]" style={{ width: "100%", aspectRatio: `${p.width} / ${p.height}` }}>
            <img src={p.dataUrl} alt={`page ${p.page}`} className="absolute inset-0 w-full h-full select-none pointer-events-none" draggable={false} />
            {fields.filter(f => f.page === p.page).map(f => {
              const result = showResults && isWorksheetGradable(f) ? gradeField(f, answers[f.id]) : null;
              return (
                <div key={f.id}
                  className="absolute"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
                >
                  <FieldControl
                    field={f}
                    value={answers[f.id]}
                    onChange={(v) => set(f.id, v)}
                    readOnly={readOnly}
                    studentId={studentId}
                  />
                  {result && (
                    <div className={`absolute -top-2 -right-2 rounded-full p-0.5 ${result.correct ? "bg-success" : "bg-destructive"} text-primary-foreground shadow`}>
                      {result.correct ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div></div>
    </div>
  );
}

function FieldControl({ field, value, onChange, readOnly, studentId }: {
  field: WorksheetField; value: any; onChange: (v: any) => void; readOnly?: boolean; studentId?: string | null;
}) {
  if (field.type === "text") {
    return <Input className="w-full h-full text-sm bg-background/95 border-primary/50" disabled={readOnly}
      placeholder={field.placeholder || field.label} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "textarea") {
    return <Textarea className="w-full h-full text-sm bg-background/95 border-primary/50 resize-none" disabled={readOnly}
      placeholder={field.placeholder || field.label} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "checkbox") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/80 border border-primary/50 rounded">
        <Checkbox checked={!!value} disabled={readOnly} onCheckedChange={(c) => onChange(!!c)} className="w-5 h-5" />
      </div>
    );
  }
  if (field.type === "mc") {
    return (
      <div className="w-full h-full bg-background/95 border border-primary/50 rounded p-1 overflow-auto text-xs space-y-0.5">
        {(field.options || []).map((opt, i) => (
          <label key={i} className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name={field.id} disabled={readOnly} checked={value !== undefined && value !== null && value !== "" && Number(value) === i} onChange={() => onChange(i)} />
            <span className="truncate">{opt}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "draw") {
    return <DrawCanvas value={value} onChange={onChange} readOnly={readOnly} />;
  }
  if (field.type === "audio") {
    return <AudioRecorder value={value} onChange={onChange} readOnly={readOnly} studentId={studentId} />;
  }
  return null;
}

function DrawCanvas({ value, onChange, readOnly }: { value: any; onChange: (v: string) => void; readOnly?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (value && typeof value === "string") {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.onerror = () => {};
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvasRef.current!.width,
      y: ((e.clientY - r.top) / r.height) * canvasRef.current!.height,
    };
  };

  const commit = () => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      onChange(canvasRef.current!.toDataURL("image/png"));
    } catch (e: any) {
      setDrawError(String(e?.message ?? e));
    }
  };

  return (
    <div className="w-full h-full bg-background/95 border border-primary/50 rounded relative">
      <canvas ref={canvasRef} width={600} height={300} className="w-full h-full touch-none"
        onPointerDown={(e) => {
          if (readOnly) return;
          e.preventDefault();
          canvasRef.current?.setPointerCapture?.(e.pointerId);
          drawing.current = true;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineWidth = 2; ctx.strokeStyle = "#111";
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
        }}
        onPointerUp={(e) => {
          if (canvasRef.current?.hasPointerCapture?.(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
          commit();
        }}
        onPointerCancel={(e) => {
          if (canvasRef.current?.hasPointerCapture?.(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
          commit();
        }}
      />
      {drawError && <p className="absolute top-1 left-1 text-[10px] text-destructive">{drawError}</p>}
      {!readOnly && (
        <button type="button" className="absolute top-1 right-1 p-1 rounded bg-white/80 border" onClick={() => {
          const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); onChange(""); setDrawError(null);
        }}><Eraser className="w-3 h-3" /></button>
      )}
    </div>
  );
}

function AudioRecorder({ value, onChange, readOnly, studentId }: { value: any; onChange: (v: string) => void; readOnly?: boolean; studentId?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setUrl(null); setError(null);
    if (!value) return;
    supabase.storage.from("homework-files").createSignedUrl(value, 3600).then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.signedUrl) setError("โหลดไฟล์เสียงไม่สำเร็จ");
      else setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [value, retry]);
  return <div className="w-full h-full overflow-auto bg-background/95 border border-primary/50 rounded p-1 space-y-1">
    <div className="flex flex-wrap items-center gap-1">
      {!readOnly && <MediaCaptureButtons compact audioOnly onCaptured={async file => {
        const path = `worksheet-audio/${studentId || "anon"}/${crypto.randomUUID()}_${file.name}`;
        const { error } = await supabase.storage.from("homework-files").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        onChange(path);
      }} />}
      {!value && <span className="text-xs text-muted-foreground">ยังไม่มีเสียง</span>}
    </div>
    {url && <audio src={url} controls className="w-full min-w-0 h-8" onError={() => setError("เล่นไฟล์เสียงไม่สำเร็จ")} />}
    {error && <div className="text-xs text-destructive"><p>{error}</p><Button type="button" size="sm" variant="ghost" onClick={() => setRetry(r => r + 1)}>ลองใหม่</Button></div>}
  </div>;
}
