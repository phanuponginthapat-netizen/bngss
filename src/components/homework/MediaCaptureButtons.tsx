import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Video, Square, Pause, Play, RotateCcw, Check, Loader2, Download } from "lucide-react";
import { recordedFile, recordingMime, type RecordingKind } from "@/lib/recordedMedia";

interface Props {
  onCaptured: (file: File) => void | Promise<void>;
  disabled?: boolean;
  maxSizeMB?: number;
  audioOnly?: boolean;
  compact?: boolean;
}

/** Review before attaching; failed attachment keeps the local recording available. */
export default function MediaCaptureButtons({ onCaptured, disabled, maxSizeMB = 25, audioOnly, compact }: Props) {
  const [kind, setKind] = useState<RecordingKind | null>(null);
  const [phase, setPhase] = useState<"starting" | "recording" | "paused" | "review" | "saving">("starting");
  const [seconds, setSeconds] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mounted = useRef(true);
  const generation = useRef(0);
  const starting = useRef(false);

  const release = () => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  };
  const discard = () => {
    generation.current++;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    recorder.current = null;
    release();
    setFile(null);
    setKind(null);
    setError(null);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
    };
  }, []);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (kind === "video" && stream.current && video.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [kind, phase]);

  const start = async (nextKind: RecordingKind) => {
    if (starting.current) return;
    starting.current = true;
    const id = ++generation.current;
    setKind(nextKind); setPhase("starting"); setError(null); setFile(null); setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("อุปกรณ์นี้ไม่รองรับการอัดในหน้านี้ กรุณาใช้ปุ่มแนบไฟล์จากโทรศัพท์");
      }
      const next = await navigator.mediaDevices.getUserMedia(nextKind === "audio" ? { audio: true } : { audio: true, video: { facingMode: "user" } });
      if (!mounted.current || generation.current !== id) { next.getTracks().forEach(t => t.stop()); return; }
      stream.current = next;
      const mime = recordingMime(nextKind, type => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(next, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      chunks.current = [];
      let bytes = 0;
      rec.ondataavailable = event => {
        if (!event.data.size) return;
        chunks.current.push(event.data);
        bytes += event.data.size;
        if (bytes > maxSizeMB * 1024 * 1024 && rec.state !== "inactive") rec.stop();
      };
      rec.onstop = () => {
        release();
        if (!mounted.current || generation.current !== id) return;
        try {
          setFile(recordedFile(chunks.current, rec.mimeType || chunks.current[0]?.type || `${nextKind}/webm`, nextKind));
        } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
        setPhase("review");
      };
      rec.onerror = () => {
        setError("การบันทึกขัดข้อง กรุณาตรวจไฟล์ก่อนแนบหรืออัดใหม่");
        if (rec.state !== "inactive") rec.stop();
        else { release(); setPhase("review"); }
      };
      rec.start(250);
      setPhase("recording");
    } catch (e) {
      release();
      if (mounted.current && generation.current === id) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? "ไม่ได้รับอนุญาตใช้กล้องหรือไมโครโฟน กรุณาเปิดสิทธิ์แล้วลองใหม่" : e instanceof Error ? e.message : "เปิดกล้องหรือไมโครโฟนไม่สำเร็จ");
        setPhase("review");
      }
    } finally { starting.current = false; }
  };
  const save = async () => {
    if (!file || phase === "saving") return;
    if (file.size > maxSizeMB * 1024 * 1024) { setError(`ไฟล์เกิน ${maxSizeMB}MB กรุณาดาวน์โหลดเก็บไว้หรืออัดใหม่ให้สั้นลง`); return; }
    setPhase("saving"); setError(null);
    try { await onCaptured(file); discard(); }
    catch (e) { setError(e instanceof Error ? e.message : "แนบไม่สำเร็จ ลองอีกครั้งได้โดยไม่ต้องอัดใหม่"); setPhase("review"); }
  };
  const pause = () => {
    if (recorder.current?.state === "recording") { recorder.current.pause(); setPhase("paused"); }
    else if (recorder.current?.state === "paused") { recorder.current.resume(); setPhase("recording"); }
  };
  const live = phase === "recording" || phase === "paused";
  return <>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size={compact ? "icon" : "sm"} disabled={disabled || !!kind} title="อัดเสียง" aria-label="อัดเสียง" onClick={() => start("audio")}><Mic className="h-4 w-4" />{!compact && "อัดเสียง"}</Button>
      {!audioOnly && <Button type="button" variant="outline" size={compact ? "icon" : "sm"} disabled={disabled || !!kind} title="อัดวิดีโอ" aria-label="อัดวิดีโอ" onClick={() => start("video")}><Video className="h-4 w-4" />{!compact && "อัดวิดีโอ"}</Button>}
    </div>
    <Dialog open={!!kind} onOpenChange={open => { if (!open && phase !== "saving") discard(); }}>
      <DialogContent className="sm:max-w-lg flex flex-col gap-4" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (phase === "saving") e.preventDefault(); }} aria-describedby={undefined}>
        <DialogHeader className="pr-7"><DialogTitle>{kind === "video" ? "บันทึกวิดีโอ" : "บันทึกเสียง"}</DialogTitle></DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={live ? "text-destructive font-medium" : "text-muted-foreground"}>{phase === "starting" ? "กำลังเปิดอุปกรณ์…" : phase === "paused" ? "พักการบันทึก" : phase === "recording" ? "กำลังบันทึก" : phase === "saving" ? "กำลังแนบไฟล์…" : "ตรวจไฟล์ก่อนแนบ"}</span>
            <span className="font-mono tabular-nums text-lg">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
          </div>
          {kind === "video" && live && <video ref={video} muted autoPlay playsInline className="aspect-video w-full rounded-md bg-muted object-contain" />}
          {kind === "audio" && live && <div className="h-32 rounded-md bg-muted flex items-center justify-center"><Mic className={`h-12 w-12 text-destructive ${phase === "recording" ? "motion-safe:animate-pulse" : ""}`} /></div>}
          {phase === "starting" && <Loader2 className="h-8 w-8 animate-spin self-center" />}
          {url && !live && (kind === "video" ? <video src={url} controls playsInline className="aspect-video w-full rounded-md bg-muted object-contain" /> : <audio src={url} controls className="w-full min-w-0" />)}
          {file && <p className="text-xs text-muted-foreground break-all">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4 shrink-0">
          {live ? <>
            <Button type="button" variant="outline" onClick={pause}>{phase === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{phase === "paused" ? "อัดต่อ" : "พัก"}</Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={() => { if (recorder.current?.state !== "inactive") recorder.current?.stop(); }}><Square className="h-4 w-4" />หยุดบันทึก</Button>
          </> : phase !== "starting" && <>
            <Button type="button" variant="outline" disabled={phase === "saving"} onClick={() => { if (kind) start(kind); }}><RotateCcw className="h-4 w-4" />อัดใหม่</Button>
            {url && file && <Button asChild variant="outline" size="icon" title="ดาวน์โหลดไฟล์"><a href={url} download={file.name} aria-label="ดาวน์โหลดไฟล์"><Download className="h-4 w-4" /></a></Button>}
            <Button type="button" className="flex-1" onClick={save} disabled={!file || phase === "saving"}>{phase === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}แนบไฟล์นี้</Button>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}