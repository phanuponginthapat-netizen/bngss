import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Video, Square } from "lucide-react";
import { toast } from "sonner";

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

  useEffect(() => () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    try { streamRef.current?.getTracks().forEach((track) => track.stop()); } catch {}
  }, []);

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
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`ไฟล์บันทึกใหญ่เกิน ${maxSizeMB}MB`);
          return;
        }
        try {
          await onCaptured(file);
          toast.success(k === "audio" ? "แนบไฟล์เสียงแล้ว" : "แนบไฟล์วิดีโอแล้ว");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "แนบไฟล์ที่บันทึกไม่สำเร็จ");
        }
      };
      rec.start(100);
      recRef.current = rec;
      setSecs(0);
      setKind(k);
    } catch (error) {
      cleanupPreview();
      toast.error(error instanceof Error
        ? `ไม่สามารถเริ่มบันทึกได้: ${error.message}`
        : "ไม่สามารถเข้าถึงไมโครโฟนหรือกล้องได้");
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
      <div className={`rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2 sticky top-0 z-10 shadow-elevated ${compact ? "" : "w-full"}`} role="status" aria-live="polite">
        <div className="flex items-center gap-2">
          {kind === "video" ? <span className="w-3 h-3 rounded-full bg-destructive animate-pulse inline-block" /> : <Mic className="h-4 w-4 text-destructive animate-pulse" />}
          <span className="text-sm font-semibold">{kind === "video" ? "กำลังอัดวีดีโอ..." : "กำลังอัดเสียง..."}</span>
          <span className="ml-auto font-mono font-bold tabular-nums">{mmss(secs)}</span>
        </div>
        {kind === "audio" && <div className="flex items-center justify-center gap-1 py-1 text-destructive"><span className="w-2 h-2 rounded-full bg-destructive animate-ping"/><span className="text-xs">ไมค์กำลังบันทึก</span></div>}
        {kind === "video" && (
          <div className="rounded-md overflow-hidden bg-foreground aspect-video w-full max-h-64 mx-auto border-2 border-destructive/70">
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
      <Button type="button" size="sm" variant="secondary" onClick={() => start("audio")} disabled={disabled} aria-label="เริ่มอัดเสียง" title="อัดเสียง">
        <Mic className="w-4 h-4 mr-1" /> {!compact && "อัดเสียง"}
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => start("video")} disabled={disabled} aria-label="เริ่มอัดวิดีโอ" title="อัดวิดีโอ">
        <Video className="w-4 h-4 mr-1" /> {!compact && "อัดวีดีโอ"}
      </Button>
    </div>
  );
}
