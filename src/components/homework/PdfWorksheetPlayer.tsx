import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Square, Eraser, Check, X } from "lucide-react";
import { renderPdfToImages, gradeField, type WorksheetField, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  pdfUrl: string;
  fields: WorksheetField[];
  answers: Record<string, any>;
  onAnswersChange: (a: Record<string, any>) => void;
  readOnly?: boolean;
  showResults?: boolean; // overlay ✓/✗
  studentId?: string | null;
  compact?: boolean;
}

export default function PdfWorksheetPlayer({ pdfUrl, fields, answers, onAnswersChange, readOnly, showResults, studentId, compact }: Props) {
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    renderPdfToImages(pdfUrl)
      .then(setPages)
      .catch((e: any) => setError(String(e?.message ?? e) || "เปิด PDF ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [pdfUrl]);

  const set = (id: string, v: any) => onAnswersChange({ ...answers, [id]: v });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return (
    <div className="p-6 text-center space-y-2">
      <p className="text-sm text-destructive">โหลด PDF ไม่สำเร็จ: {error}</p>
      <Button size="sm" variant="outline" onClick={() => { setLoading(true); setError(null); renderPdfToImages(pdfUrl).then(setPages).catch((e: any) => setError(String(e?.message ?? e))).finally(() => setLoading(false)); }}>
        ลองใหม่
      </Button>
    </div>
  );

  return (
    <div className={`${compact ? "space-y-2 p-2" : "space-y-3 p-3"} bg-slate-100 rounded overflow-x-auto`}>
      {pages.map(p => (
        <div key={p.page} className="space-y-1">
          <div className="text-xs text-muted-foreground">หน้า {p.page}</div>
          <div className="relative bg-white shadow border mx-auto min-w-[280px]" style={{ width: "100%", maxWidth: p.width, aspectRatio: `${p.width} / ${p.height}` }}>
            <img src={p.dataUrl} alt={`page ${p.page}`} className="absolute inset-0 w-full h-full select-none pointer-events-none" draggable={false} />
            {fields.filter(f => f.page === p.page).map(f => {
              const result = showResults && f.correct !== undefined ? gradeField(f, answers[f.id]) : null;
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
                    <div className={`absolute -top-2 -right-2 rounded-full p-0.5 ${result.correct ? "bg-emerald-500" : "bg-rose-500"} text-white shadow`}>
                      {result.correct ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldControl({ field, value, onChange, readOnly, studentId }: {
  field: WorksheetField; value: any; onChange: (v: any) => void; readOnly?: boolean; studentId?: string | null;
}) {
  if (field.type === "text") {
    return <Input className="w-full h-full text-sm bg-white/95 border-amber-400" disabled={readOnly}
      placeholder={field.placeholder || field.label} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "textarea") {
    return <Textarea className="w-full h-full text-sm bg-white/95 border-amber-400 resize-none" disabled={readOnly}
      placeholder={field.placeholder || field.label} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "checkbox") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white/80 border border-amber-400 rounded">
        <Checkbox checked={!!value} disabled={readOnly} onCheckedChange={(c) => onChange(!!c)} className="w-5 h-5" />
      </div>
    );
  }
  if (field.type === "mc") {
    return (
      <div className="w-full h-full bg-white/95 border border-amber-400 rounded p-1 overflow-auto text-xs space-y-0.5">
        {(field.options || []).map((opt, i) => (
          <label key={i} className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name={field.id} disabled={readOnly} checked={Number(value) === i} onChange={() => onChange(i)} />
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
    <div className="w-full h-full bg-white/95 border border-amber-400 rounded relative">
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
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setUrl(null); return; }
    (async () => {
      const { data } = await supabase.storage.from("homework-files").createSignedUrl(value, 3600);
      if (data?.signedUrl) setUrl(data.signedUrl);
      else setError("โหลดไฟล์เสียงไม่สำเร็จ");
    })();
  }, [value]);

  const start = async () => {
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setError("ไม่อนุญาตใช้ไมโครโฟน — เปิดสิทธิ์ในเบราว์เซอร์แล้วลองใหม่");
      return;
    }
    const rec = new MediaRecorder(stream);
    chunksRef.current = [];
    rec.ondataavailable = (e) => chunksRef.current.push(e.data);
    rec.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const path = `worksheet-audio/${studentId || "anon"}/${Date.now()}.webm`;
        const { error } = await supabase.storage.from("homework-files").upload(path, blob, { contentType: "audio/webm", upsert: false });
        if (error) setError("อัปโหลดเสียงไม่สำเร็จ: " + error.message);
        else onChange(path);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        stream?.getTracks().forEach(t => t.stop());
      }
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };
  const stop = () => { recRef.current?.stop(); setRecording(false); };

  return (
    <div className="w-full h-full flex items-center gap-1 bg-white/95 border border-amber-400 rounded px-1">
      {!readOnly && (
        recording
          ? <Button size="icon" variant="destructive" className="h-6 w-6" onClick={stop}><Square className="w-3 h-3" /></Button>
          : <Button size="icon" variant="outline" className="h-6 w-6" onClick={start}><Mic className="w-3 h-3" /></Button>
      )}
      {url && <audio src={url} controls className="h-6 flex-1" />}
      {!url && !recording && <span className="text-[10px] text-muted-foreground">ยังไม่มีเสียง</span>}
      {error && <span className="text-[10px] text-destructive truncate" title={error}>{error}</span>}
    </div>
  );
}
