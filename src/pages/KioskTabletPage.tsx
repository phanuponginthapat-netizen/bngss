/**
 * หน้าสแกนสำหรับแท็บเล็ต (ใช้ในแอป APK)
 * ---------------------------------------------------------------
 * แท็บเล็ตทำหน้าที่แค่ "จอ + กล้อง" เท่านั้น
 * ภาพจากกล้องจะถูกส่งผ่าน Wi-Fi ไปให้เครื่อง PC แม่ข่าย (FaceGate Agent)
 * ที่ทำการตรวจจับใบหน้า จับคู่ตัวตน เปิดประตู และบันทึกเวลามาเรียนให้ทั้งหมด
 * จึงได้ความแม่นยำเท่ากับการสแกนบน PC แม้แท็บเล็ตจะเป็นรุ่นเก่า
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings, Wifi, WifiOff, Camera, CheckCircle2, XCircle, ScanFace } from "lucide-react";

const HUB_KEY = "kiosk_tablet_hub_url";
const CAM_KEY = "kiosk_tablet_camera_id";

type ScanResult = {
  result?: string;
  name?: string;
  message?: string;
  speak?: string;
  next_delay_seconds?: number;
  status?: string;
};

const normalizeHub = (value: string) => {
  let v = value.trim().replace(/\/+$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  if (!/:\d+$/.test(v.replace(/^https?:\/\//i, ""))) v = `${v}:8899`;
  return v;
};

export default function KioskTabletPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const busyRef = useRef(false);
  const pauseUntilRef = useRef(0);

  const [hub, setHub] = useState(() => localStorage.getItem(HUB_KEY) || "");
  const [hubDraft, setHubDraft] = useState(hub);
  const [cameraId, setCameraId] = useState(() => localStorage.getItem(CAM_KEY) || "");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [hubInfo, setHubInfo] = useState<{ students?: number; pending_uploads?: number; stale?: boolean } | null>(null);
  const [showSetup, setShowSetup] = useState(!hub);
  const [camError, setCamError] = useState<string | null>(null);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  /* ── กล้อง ─────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameras(list.filter((d) => d.kind === "videoinput"));
    } catch (e: any) {
      setCamError(e?.message || "เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง");
    }
  }, [cameraId]);

  useEffect(() => {
    void startCamera();
    return () => {
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  /* ── ตรวจการเชื่อมต่อเครื่องแม่ข่าย ─────────────────────── */
  useEffect(() => {
    if (!hub) return;
    let stop = false;
    const ping = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${hub}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        const data = res.ok ? await res.json() : null;
        if (!stop) {
          setOnline(!!data?.ok);
          setHubInfo(data || null);
        }
      } catch {
        if (!stop) setOnline(false);
      }
    };
    void ping();
    const id = window.setInterval(ping, 10_000);
    return () => { stop = true; window.clearInterval(id); };
  }, [hub]);

  /* ── ลูปส่งภาพให้เครื่องแม่ข่ายประมวลผล ───────────────── */
  useEffect(() => {
    if (!hub || !online) return;
    let stop = false;

    const tick = async () => {
      if (stop || busyRef.current || Date.now() < pauseUntilRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      busyRef.current = true;
      setScanning(true);
      try {
        canvas.width = 640;
        canvas.height = Math.round((video.videoHeight / video.videoWidth) * 640) || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL("image/jpeg", 0.8);

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${hub}/scan`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) return;
        const data = (await res.json()) as ScanResult;
        if (data?.result && data.result !== "no_face") {
          setLast(data);
          const delay = Number(data.next_delay_seconds || 0);
          if (delay > 0) pauseUntilRef.current = Date.now() + delay * 1000;
          if (data.speak) {
            // ให้เครื่องแม่ข่ายพูด (ลำโพงที่ประตู) — ถ้าไม่ได้ก็ใช้เสียงของแท็บเล็ต
            fetch(`${hub}/local/kiosk-api/tts`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text: data.speak }),
            }).catch(() => {
              try {
                const u = new SpeechSynthesisUtterance(data.speak);
                u.lang = "th-TH";
                speechSynthesis.speak(u);
              } catch { /* ไม่มีเสียงก็ไม่เป็นไร */ }
            });
          }
        }
      } catch {
        setOnline(false);
      } finally {
        busyRef.current = false;
        setScanning(false);
      }
    };

    const id = window.setInterval(() => void tick(), 700);
    return () => { stop = true; window.clearInterval(id); };
  }, [hub, online]);

  const saveHub = () => {
    const v = normalizeHub(hubDraft);
    setHub(v);
    localStorage.setItem(HUB_KEY, v);
    setShowSetup(false);
  };

  const ok = last?.result === "ok";
  const bad = last && last.result !== "ok" && last.result !== "duplicate";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanFace className="h-6 w-6 text-primary" />
          <div>
            <p className="text-sm font-semibold">สแกนใบหน้าเข้าโรงเรียน (แท็บเล็ต)</p>
            <p className="text-[11px] text-muted-foreground">
              ประมวลผลที่เครื่อง PC แม่ข่าย {hub ? `• ${hub.replace(/^https?:\/\//, "")}` : "• ยังไม่ได้ตั้งค่า"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${online ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online ? "เชื่อมต่อแล้ว" : "ไม่พบเครื่องแม่ข่าย"}
          </span>
          <Button size="icon" variant="outline" onClick={() => setShowSetup((v) => !v)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {showSetup && (
        <Card className="m-4">
          <CardHeader>
            <CardTitle className="text-base">ตั้งค่าเครื่อง</CardTitle>
            <CardDescription>
              ใส่หมายเลขเครื่อง PC ที่ลงโปรแกรม FaceGate ไว้ (ดูได้ที่หน้าจอโปรแกรมบน PC) แล้วกดบันทึก
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">ที่อยู่เครื่องแม่ข่าย</Label>
              <Input
                value={hubDraft}
                onChange={(e) => setHubDraft(e.target.value)}
                placeholder="เช่น 192.168.1.50"
                inputMode="url"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">กล้องที่ใช้ (รองรับกล้อง USB ต่อภายนอก)</Label>
              <Select
                value={cameraId || "default"}
                onValueChange={(v) => {
                  const id = v === "default" ? "" : v;
                  setCameraId(id);
                  localStorage.setItem(CAM_KEY, id);
                }}
              >
                <SelectTrigger><SelectValue placeholder="กล้องเริ่มต้น" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">กล้องเริ่มต้นของเครื่อง</SelectItem>
                  {cameras.map((c, i) => (
                    <SelectItem key={c.deviceId || i} value={c.deviceId}>
                      {c.label || `กล้องที่ ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveHub}>บันทึกและเริ่มสแกน</Button>
              <Button variant="outline" onClick={() => void startCamera()}>
                <Camera className="mr-2 h-4 w-4" /> เปิดกล้องใหม่
              </Button>
            </div>
            {hubInfo && (
              <p className="text-[11px] text-muted-foreground">
                รายชื่อในเครื่องแม่ข่าย {hubInfo.students ?? 0} คน • รอส่งขึ้นระบบ {hubInfo.pending_uploads ?? 0} รายการ
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <main className="relative mx-auto max-w-3xl p-4">
        <div className="relative overflow-hidden rounded-2xl border bg-muted">
          <video ref={videoRef} playsInline muted className="h-auto w-full" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[70%] w-[55%] rounded-[50%] border-4 border-primary/70" />
          </div>
          {scanning && (
            <span className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </span>
          )}
        </div>

        {camError && <p className="mt-3 text-sm text-destructive">{camError}</p>}

        <div className="mt-4 min-h-[88px] rounded-2xl border p-4 text-center">
          {!last && <p className="text-muted-foreground">กรุณาจัดใบหน้าให้อยู่ในกรอบ</p>}
          {last && (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                {ok ? <CheckCircle2 className="h-6 w-6 text-primary" /> : bad ? <XCircle className="h-6 w-6 text-destructive" /> : null}
                <p className="text-xl font-bold">{last.name || (ok ? "บันทึกแล้ว" : "ไม่สำเร็จ")}</p>
              </div>
              {last.message && <p className="text-sm text-muted-foreground">{last.message}</p>}
            </div>
          )}
        </div>

        {!online && hub && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            ติดต่อเครื่อง PC แม่ข่ายไม่ได้ — ตรวจว่าเปิดเครื่อง เปิดโปรแกรม FaceGate และอยู่ใน Wi-Fi วงเดียวกัน
          </p>
        )}
      </main>
    </div>
  );
}
