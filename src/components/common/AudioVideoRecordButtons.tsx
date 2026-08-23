import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Video, Square } from "lucide-react";

interface Props {
  onCaptured: (file: File) => void | Promise<void>;
  maxSizeMB?: number;
  disabled?: boolean;
  compact?: boolean;
}

/** Reusable audio/video record buttons + live recording UI. Attach captured file via onCaptured. */
export default function AudioVideoRecordButtons({ onCaptured, maxSizeMB = 25, disabled = false, compact = false }: Props) {
  const [kind, setKind] = useState<"audio" | "video" | null>(null);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (kind) {
      timerRef.current = window.setInterval(() => setSecs(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [kind]);

  const cleanupPreview = () => {
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  const start = async (k: "audio" | "video") => {
    try {
      const constraints = k === "audio" ? { audio: true } : { video: { facingMode: "environment" }, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
      if (k === "video") {
        streamRef.current = stream;
        requestAnimationFrame(() => { if (previewRef.current){ previewRef.current.srcObject = stream; previewRef.current.play().catch(()=>{}); }});
      }
      const mime = k === "audio" ? "audio/webm" : "video/webm";
      const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        cleanupPreview();
        const blob = new Blob(chunksRef.current, { type: mime });
        const file = new File([blob], `rec_${k}_${Date.now()}.webm`, { type: mime });
        if (file.size > maxSizeMB * 1024 * 1024) return;
        await onCaptured(file);
      };
      rec.start(100);
      recRef.current = rec;
      setSecs(0);
      setKind(k);
    } catch (e: any) {
      console.warn("[record] failed", e?.message || e);
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setKind(null);
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (kind) {
    return (
      <div className={`rounded-xl border p-3 space-y-2 animate-pulse-soft sticky top-0 z-10 shadow-lg ${kind === "video" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-primary bg-primary/5"} ${compact ? "" : "w-full"}`}>
        <div className="flex items-center gap-2">
          {kind === "video" ? <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse inline-block" /> : <span className="flex gap-1"><span className="w-1 h-4 bg-primary animate-pulse" style={{animationDelay:"0ms"}}/><span className="w-1 h-6 bg-primary animate-pulse" style={{animationDelay:"150ms"}}/><span className="w-1 h-3 bg-primary animate-pulse" style={{animationDelay:"300ms"}}/></span>}
          <span className="text-sm font-semibold">{kind === "video" ? "กำลังอัดวีดีโอ..." : "กำลังอัดเสียง..."}</span>
          <span className="ml-auto font-mono font-bold tabular-nums">{mmss(secs)}</span>
        </div>
        {kind === "audio" && <div className="flex items-center justify-center gap-1 py-1"><span className="w-2 h-2 rounded-full bg-primary animate-ping"/><span className="text-xs">ไมค์กำลังอัด...</span></div>}
        {kind === "video" && (
          <div className="rounded-lg overflow-hidden bg-black aspect-video w-full max-h-64 mx-auto border-2 border-red-500">
            <video ref={previewRef} muted playsInline autoPlay className="w-full h-full object-cover" />
          </div>
        )}
        <Button type="button" size="sm" variant="destructive" className="w-full gap-2" onClick={stop}>
          <Square className="w-3.5 h-3.5" /> หยุดและแนบไฟล์
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => start("audio")} disabled={disabled} title="อัดเสียง">
        <Mic className="w-4 h-4 mr-1" /> {!compact && "อัดเสียง"}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => start("video")} disabled={disabled} title="อัดวีดีโอ">
        <Video className="w-4 h-4 mr-1" /> {!compact && "อัดวีดีโอ"}
      </Button>
    </div>
  );
}
