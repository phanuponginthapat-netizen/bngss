import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onRecorded: (file: File, durationSec: number) => void | Promise<void>;
  maxSeconds?: number;
  label?: string;
  className?: string;
}

/**
 * Voice recorder ใช้ MediaRecorder — บันทึก webm/opus
 * คืนค่าเป็น File ให้ผู้เรียกเอาไปอัปโหลด (เช่นเข้า storage แล้วแนบเป็น attachment)
 */
export default function VoiceRecorder({ onRecorded, maxSeconds = 180, label = "อัดเสียง", className }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => () => stopAll(), []);

  const stopAll = () => {
    try { mediaRef.current?.state !== "inactive" && mediaRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const ext = (rec.mimeType || "").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });
        stopAll();
        setRecording(false);
        setElapsed(0);
        if (file.size < 1024) { toast.error("เสียงสั้นเกินไป กรุณาลองใหม่"); return; }
        setBusy(true);
        try { await onRecorded(file, dur); } finally { setBusy(false); }
      };
      mediaRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch (e: any) {
      toast.error("ไม่สามารถเข้าถึงไมโครโฟน: " + (e?.message || e));
    }
  };

  const stop = () => { try { mediaRef.current?.stop(); } catch {} };

  const cancel = () => {
    try { mediaRef.current && (mediaRef.current.onstop = null as any); mediaRef.current?.stop(); } catch {}
    stopAll();
    setRecording(false);
    setElapsed(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className || ""}`}>
      {!recording && !busy && (
        <Button type="button" size="sm" variant="outline" onClick={start}>
          <Mic className="w-4 h-4 mr-1" /> {label}
        </Button>
      )}
      {recording && (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-danger-soft text-danger text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" /> {fmt(elapsed)} / {fmt(maxSeconds)}
          </span>
          <Button type="button" size="sm" variant="destructive" onClick={stop}>
            <Square className="w-3.5 h-3.5 mr-1" /> หยุด
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={cancel} title="ยกเลิก">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
      {busy && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> กำลังอัปโหลด...
        </span>
      )}
    </div>
  );
}
