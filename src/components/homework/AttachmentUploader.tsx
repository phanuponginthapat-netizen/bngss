import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Mic, Video, Square, Circle } from "lucide-react";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  folder: string;
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
}

export default function AttachmentUploader({
  folder, value, onChange, maxFiles = 5, maxSizeMB = 25, accept, label = "แนบไฟล์",
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (recordingAudio || recordingVideo) {
      timerRef.current = window.setInterval(() => setRecordingSecs(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recordingAudio, recordingVideo]);

  const cleanupPreview = () => {
    try { previewStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    previewStreamRef.current = null;
    if (videoElRef.current) videoElRef.current.srcObject = null;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (value.length + files.length > maxFiles) {
      toast.error(`แนบได้สูงสุด ${maxFiles} ไฟล์`);
      return;
    }
    setBusy(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} ใหญ่เกิน ${maxSizeMB}MB`);
        continue;
      }
      try {
        const att = await uploadHomeworkFile(file, folder);
        next.push(att);
      } catch (e: any) {
        toast.error(`อัปโหลด ${file.name} ล้มเหลว: ${e?.message || e}`);
      }
    }
    onChange(next);
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };

  const startRecord = async (kind: "audio" | "video") => {
    try {
      const constraints = kind === "audio"
        ? { audio: true }
        : { video: { facingMode: "environment" }, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints as any);
      if (kind === "video") {
        previewStreamRef.current = stream;
        requestAnimationFrame(() => { if (videoElRef.current){ videoElRef.current.srcObject = stream; videoElRef.current.play().catch(()=>{}); }});
      }
      const mime = kind === "audio" ? "audio/webm" : "video/webm";
      const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mime) ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        cleanupPreview();
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = kind === "audio" ? "webm" : "webm";
        const file = new File([blob], `rec_${kind}_${Date.now()}.${ext}`, { type: mime });
        setBusy(true);
        try {
          if (file.size > maxSizeMB * 1024 * 1024) throw new Error(`ใหญ่เกิน ${maxSizeMB}MB`);
          const att = await uploadHomeworkFile(file, folder);
          onChange([...value, att]);
          toast.success(`อัด${kind === "audio" ? "เสียง" : "วีดีโอ"}และแนบแล้ว (${Math.round(file.size/1024)} KB)`);
        } catch (e: any) {
          toast.error(`แนบไฟล์อัดล้มเหลว: ${e?.message || e}`);
        }
        setBusy(false);
      };
      rec.start(100);
      if (kind === "audio") audioRecorderRef.current = rec; else videoRecorderRef.current = rec;
      setRecordingSecs(0);
      if (kind === "audio") setRecordingAudio(true); else setRecordingVideo(true);
    } catch (e: any) {
      toast.error(`ไม่สามารถเข้าถึง${kind === "audio" ? "ไมค์" : "กล้อง"}ได้: ${e?.message || e}`);
    }
  };

  const stopRecord = () => {
    try { audioRecorderRef.current?.stop(); } catch {}
    try { videoRecorderRef.current?.stop(); } catch {}
    audioRecorderRef.current = null;
    videoRecorderRef.current = null;
    setRecordingAudio(false);
    setRecordingVideo(false);
  };

  const remove = (id: string) => onChange(value.filter((v) => v.id !== id));

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {(recordingAudio || recordingVideo) && (
        <div className={`rounded-xl border p-3 space-y-2 animate-pulse-soft sticky top-0 z-10 shadow-lg ${recordingVideo ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-primary bg-primary/5"}`}>
          <div className="flex items-center gap-2">
            {recordingVideo
              ? <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse inline-block" />
              : <span className="flex gap-1"><span className="w-1 h-4 bg-primary animate-pulse" style={{animationDelay:"0ms"}}/><span className="w-1 h-6 bg-primary animate-pulse" style={{animationDelay:"150ms"}}/><span className="w-1 h-3 bg-primary animate-pulse" style={{animationDelay:"300ms"}}/></span>}
            <span className="text-sm font-semibold">
              {recordingVideo ? "กำลังอัดวีดีโอ..." : "กำลังอัดเสียง..."}
            </span>
            <span className="ml-auto font-mono font-bold tabular-nums">{mmss(recordingSecs)}</span>
          </div>
          {recordingAudio && <div className="flex items-center justify-center gap-1 py-1"><span className="w-2 h-2 rounded-full bg-primary animate-ping"/><span className="text-xs">ไมค์กำลังอัด...</span></div>}
          {recordingVideo && (
            <div className="rounded-lg overflow-hidden bg-black aspect-video w-full max-h-64 mx-auto border-2 border-red-500">
              <video ref={videoElRef} muted playsInline autoPlay className="w-full h-full object-cover" />
            </div>
          )}
          <Button type="button" size="sm" variant="destructive" className="w-full gap-2" onClick={stopRecord}>
            <Square className="w-3.5 h-3.5" /> หยุดและแนบไฟล์
          </Button>
        </div>
      )}

      {!recordingAudio && !recordingVideo && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={ref}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Paperclip className="w-4 h-4 mr-1" />}
            {label}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => startRecord("audio")} disabled={busy} title="อัดเสียงจากไมค์">
            <Mic className="w-4 h-4 mr-1" /> อัดเสียง
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => startRecord("video")} disabled={busy} title="อัดวีดีโอจากกล้อง">
            <Video className="w-4 h-4 mr-1" /> อัดวีดีโอ
          </Button>
          <span className="text-xs text-muted-foreground">PDF/รูป/ไฟล์ ไม่เกิน {maxSizeMB}MB · สูงสุด {maxFiles} ไฟล์</span>
        </div>
      )}
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1 bg-muted/30">
              <span className="truncate flex items-center gap-1">
                {a.type?.startsWith("audio/") && <Mic className="w-3 h-3 text-primary shrink-0" />}
                {a.type?.startsWith("video/") && <Video className="w-3 h-3 text-primary shrink-0" />}
                {a.name} <span className="text-muted-foreground">({Math.round(a.size / 1024)} KB)</span>
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(a.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
