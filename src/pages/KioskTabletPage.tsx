/**
 * หน้าสแกนสำหรับแท็บเล็ต (แอป BNG Scanner)
 * ---------------------------------------------------------------
 * ทำงานเหมือนหน้าจอโปรแกรม FaceGate บน PC ทุกอย่าง (หน้าตา เสียง ผลสแกน
 * รายชื่อล่าสุด สถิติวันนี้ ข่าววิ่ง ภาพกล้องสดให้หลังบ้าน หมุน/กลับภาพ)
 * แท็บเล็ตเป็นแค่ "จอ + กล้อง" — ส่งภาพให้ FaceGate บน PC ตรวจจับใบหน้า
 * จับคู่ตัวตน เปิดประตู และบันทึกเวลา จึงแม่นเท่าการสแกนบน PC
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Camera, WifiOff } from "lucide-react";

const HUB_KEY = "kiosk_tablet_hub_url";
const CAM_KEY = "kiosk_tablet_camera_id";
const TH_LOCALE = "th-TH-u-ca-buddhist-nu-latn";

type Student = { full_name?: string; person_type?: string; department?: string; position?: string; class_room?: string; student_code?: string };
type ScanResult = {
  result?: string; message?: string; speak?: string; next_delay_seconds?: number;
  student?: Student; avatar_url?: string; snapshot_url?: string; name?: string;
};
type Display = {
  mirror?: boolean; rotate?: number; voice_enabled?: boolean; voice_rate?: number; voice_volume?: number;
  next_delay_seconds?: number; news_enabled?: boolean; news_text?: string; show_recent?: boolean; live_view?: boolean;
};
type RecentItem = { name: string; detail?: string; scanned_at: string; direction?: string; snapshot_url?: string; avatar_url?: string };
type Content = Record<string, string | undefined>;
type Stats = {
  students_present?: number; staff_present?: number; total_students?: number; total_staff?: number;
  absent_students?: number; absent_staff?: number; school_name?: string; server_time?: string;
  idle_stats_minutes?: number; screensaver_mode?: string; windows_closed?: boolean;
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
  const busyRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const serverOffsetRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const hideTimerRef = useRef<number>();
  const clipCache = useRef(new Map<string, string>());
  const statusRef = useRef("");

  const [hub, setHub] = useState(() => localStorage.getItem(HUB_KEY) || "");
  const [hubDraft, setHubDraft] = useState(hub);
  const [cameraId, setCameraId] = useState(() => localStorage.getItem(CAM_KEY) || "");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(!hub);

  const [display, setDisplay] = useState<Display>({ mirror: true, rotate: 0, voice_enabled: true, show_recent: true });
  const displayRef = useRef(display);
  displayRef.current = display;
  const [content, setContent] = useState<Content>({});
  const [stats, setStats] = useState<Stats>({});
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [banner, setBanner] = useState<{ text: string; kind?: "ok" | "bad" }>({ text: "กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ" });
  const [profile, setProfile] = useState<(ScanResult & { time: string }) | null>(null);
  const [now, setNow] = useState(new Date());
  const [saver, setSaver] = useState(false);

  const url = useCallback((p?: string) => (!p ? "" : /^(https?:|data:)/.test(p) ? p : `${hub}${p.startsWith("/") ? "" : "/"}${p}`), [hub]);
  const serverNow = () => new Date(Date.now() + serverOffsetRef.current);
  const say = (text: string, kind?: "ok" | "bad") => { statusRef.current = text; setBanner({ text, kind }); };
  const bump = () => { lastActivityRef.current = Date.now(); setSaver(false); };

  /* ── กล้อง ── */
  const startCamera = useCallback(async () => {
    try {
      const old = videoRef.current?.srcObject as MediaStream | null;
      old?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId }, width: { ideal: 640 }, height: { ideal: 480 } } : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameras(list.filter((d) => d.kind === "videoinput"));
    } catch {
      say("ไม่พบกล้อง กรุณาอนุญาตการใช้กล้องหรือตรวจสายกล้อง", "bad");
    }
  }, [cameraId]);

  useEffect(() => {
    void startCamera();
    return () => (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  /* ── ภาพที่หมุนให้ตั้งตรงก่อนส่งให้ AI (เหมือน FaceGate) ── */
  const grab = (w: number, quality: number) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const h = Math.round((w * v.videoHeight) / v.videoWidth);
    const rot = (((Number(displayRef.current.rotate) || 0) % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const c = document.createElement("canvas");
    c.width = swap ? h : w; c.height = swap ? w : h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(v, -w / 2, -h / 2, w, h);
    return c.toDataURL("image/jpeg", quality);
  };

  /* ── เสียง: เสียงไทยของเครื่อง → เสียงจาก FaceGate เล่นบนแท็บเล็ต → เสียงติ๊ง ── */
  const chime = () => {
    try {
      const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.12; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.18);
    } catch { /* ไม่มีเสียง */ }
  };
  const speak = async (text?: string) => {
    const d = displayRef.current;
    if (d.voice_enabled === false || !text) return;
    const thai = window.speechSynthesis?.getVoices().find((v) => v.lang.toLowerCase().startsWith("th"));
    if (thai) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "th-TH"; u.voice = thai; u.rate = Number(d.voice_rate || 1); u.volume = Number(d.voice_volume || 1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      return;
    }
    try {
      let clip = clipCache.current.get(text);
      if (!clip) {
        const res = await fetch(`${hub}/local/kiosk-api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok) throw new Error();
        clip = URL.createObjectURL(await res.blob());
        if (clipCache.current.size > 60) clipCache.current.clear();
        clipCache.current.set(text, clip);
      }
      const a = new Audio(clip);
      a.volume = Math.min(Math.max(Number(d.voice_volume || 1), 0), 1);
      await a.play();
    } catch { chime(); }
  };

  /* ── ข้อมูลหน้าจอจาก FaceGate ── */
  const loadBrand = useCallback(async () => {
    try { setContent(await (await fetch(`${hub}/local/kiosk-api/content`)).json()); } catch { /* ใช้ค่าเดิม */ }
  }, [hub]);
  const loadRecent = useCallback(async () => {
    try {
      const d = await (await fetch(`${hub}/local/kiosk-api/recent`)).json();
      if (d.display) setDisplay(d.display);
      setRecent(d.items || []);
    } catch { /* ใช้ค่าเดิม */ }
  }, [hub]);
  const loadStats = useCallback(async () => {
    try {
      const s: Stats = await (await fetch(`${hub}/local/kiosk-api/today-stats`)).json();
      if (s.server_time) { const t = Date.parse(s.server_time); if (!isNaN(t)) serverOffsetRef.current = t - Date.now(); }
      setStats(s);
    } catch { /* ใช้ค่าเดิม */ }
  }, [hub]);

  /* ── ตรวจการเชื่อมต่อ ── */
  useEffect(() => {
    if (!hub) return;
    let stop = false;
    const ping = async () => {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`${hub}/health`, { signal: ctrl.signal }); clearTimeout(t);
        const d = res.ok ? await res.json() : null;
        if (!stop) setOnline(!!d?.ok);
      } catch { if (!stop) setOnline(false); }
    };
    void ping();
    const id = window.setInterval(ping, 10_000);
    return () => { stop = true; clearInterval(id); };
  }, [hub]);

  useEffect(() => {
    if (!hub || !online) return;
    void loadBrand(); void loadRecent(); void loadStats();
    const a = setInterval(loadRecent, 15_000), b = setInterval(loadStats, 60_000), c = setInterval(loadBrand, 120_000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, [hub, online, loadBrand, loadRecent, loadStats]);

  /* ── นาฬิกา + พักหน้าจอแสดงสถิติ ── */
  useEffect(() => {
    const id = setInterval(() => {
      setNow(serverNow());
      const idle = Number(stats.idle_stats_minutes || 0);
      const idleNow = idle > 0 && Date.now() - lastActivityRef.current > idle * 60_000;
      setSaver(stats.screensaver_mode === "stats" && (!!stats.windows_closed || idleNow));
    }, 1000);
    return () => clearInterval(id);
  }, [stats]);

  /* ── ส่งภาพกล้องสดให้หน้าหลังบ้านของ FaceGate ── */
  useEffect(() => {
    if (!hub || !online) return;
    let stop = false; let delay = 2000;
    const loop = async () => {
      while (!stop) {
        if (displayRef.current.live_view !== false) {
          const image = grab(delay < 500 ? 480 : 320, delay < 500 ? 0.6 : 0.5);
          if (image) {
            try {
              const r = await fetch(`${hub}/local/kiosk-api/live`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image, status: statusRef.current }) });
              const d = await r.json();
              delay = Math.min(Math.max(Number(d.interval_ms) || 2000, 100), 5000);
            } catch { delay = 2000; }
          }
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    };
    void loop();
    return () => { stop = true; };
  }, [hub, online]);

  /* ── ลูปสแกน (เหมือน FaceGate: ทุก 0.9 วินาที) ── */
  useEffect(() => {
    if (!hub || !online) return;
    const showResult = (d: ScanResult) => {
      setProfile({ ...d, time: serverNow().toLocaleTimeString(TH_LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " น." });
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setProfile(null), (d.next_delay_seconds || 5) * 1000);
    };
    const tick = async () => {
      if (busyRef.current || Date.now() < pauseUntilRef.current) return;
      const shot = grab(640, 0.82);
      if (!shot) return;
      busyRef.current = true;
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${hub}/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: shot.split(",")[1] }), signal: ctrl.signal });
        clearTimeout(t);
        const d: ScanResult = await res.json();
        if (d.result !== "no_face") bump();
        if (d.result === "ok") {
          say(d.message || "บันทึกสำเร็จ", "ok"); showResult(d); void speak(d.speak); void loadRecent(); void loadStats();
          pauseUntilRef.current = Date.now() + (d.next_delay_seconds || 5) * 1000;
        } else if (d.result === "duplicate" || d.result === "denied") {
          say(d.message || "", "bad"); showResult(d); void speak(d.speak);
          pauseUntilRef.current = Date.now() + 3000;
        } else if (d.message && d.result !== "no_face") say(d.message);
        else say(content.kiosk_subtitle || "กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ");
      } catch {
        setOnline(false);
      } finally { busyRef.current = false; }
    };
    const id = setInterval(() => void tick(), 900);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, online, content.kiosk_subtitle]);

  const saveHub = () => { const v = normalizeHub(hubDraft); setHub(v); localStorage.setItem(HUB_KEY, v); setShowSetup(false); };

  const rot = (((Number(display.rotate) || 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const videoStyle: CSSProperties = {
    width: swap ? "100cqh" : "100%", height: swap ? "100cqw" : "100%",
    transform: `translate(-50%,-50%) rotate(${rot}deg)${display.mirror !== false ? " scaleX(-1)" : ""}`,
  };
  const school = content.school_name || content.brand_name || stats.school_name || "โรงเรียนของเรา";
  let welcome = content.kiosk_welcome || "ยินดีต้อนรับเข้าสู่";
  welcome = welcome.includes("{school}") ? welcome.split("{school}").join(school) : welcome + school;
  const st = profile?.student || {};
  const ok = profile?.result === "ok";
  const timeOf = (s: string) => new Date(s).toLocaleTimeString(TH_LOCALE, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground" onPointerDown={bump}>
      {/* แถบบน */}
      <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {content.logo_url
            ? <img src={url(content.logo_url)} alt="" className="h-12 w-12 rounded-xl object-contain" />
            : <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-xl text-primary-foreground">✦</div>}
          <div className="min-w-0">
            <b className="block truncate text-lg">{content.school_name || content.brand_name || "FaceGate"}</b>
            <span className="block truncate text-xs text-muted-foreground">{content.kiosk_title || "ระบบสแกนใบหน้าเข้า-ออกโรงเรียน"}</span>
          </div>
        </div>
        <div className="hidden whitespace-nowrap rounded-full border bg-muted px-4 py-2 text-sm font-bold md:block">
          วันนี้ · นักเรียน <b className="text-primary">{stats.students_present || 0}</b> คน · บุคลากร <b className="text-primary">{stats.staff_present || 0}</b> คน
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-2xl font-extrabold leading-none tabular-nums">{now.toLocaleTimeString(TH_LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</div>
            <div className="mt-1 text-[11px] font-semibold text-muted-foreground">{now.toLocaleDateString(TH_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
          <Button size="icon" variant="secondary" onClick={() => setShowSetup((v) => !v)} aria-label="ตั้งค่าเครื่อง"><Settings className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,55%)_minmax(0,45%)] landscape:grid-cols-[3fr_2fr] landscape:grid-rows-1">
        {/* กล้อง */}
        <div className="relative overflow-hidden bg-foreground" style={{ containerType: "size" }}>
          <video ref={videoRef} playsInline muted autoPlay className="absolute left-1/2 top-1/2 object-cover" style={videoStyle} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/40 via-transparent to-foreground/50" />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-foreground/70 px-3 py-1.5 text-xs font-extrabold text-background">
            <i className="h-2 w-2 animate-pulse rounded-full bg-destructive" />{content.kiosk_live_label || "กล้องสด"}
          </div>
          <div className="absolute left-1/2 top-[47%] aspect-square w-[min(38vh,44%)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-background/20 text-primary">
            <i className="absolute -left-1 -top-1 h-11 w-11 rounded-tl-2xl border-l-4 border-t-4 border-current" />
            <i className="absolute -right-1 -top-1 h-11 w-11 rounded-tr-2xl border-r-4 border-t-4 border-current" />
            <i className="absolute -bottom-1 -left-1 h-11 w-11 rounded-bl-2xl border-b-4 border-l-4 border-current" />
            <i className="absolute -bottom-1 -right-1 h-11 w-11 rounded-br-2xl border-b-4 border-r-4 border-current" />
          </div>
          <div className={`absolute bottom-5 left-1/2 max-w-[96%] -translate-x-1/2 truncate rounded-xl px-4 py-2.5 text-center text-sm font-bold text-background backdrop-blur ${banner.kind === "ok" ? "bg-primary/90" : banner.kind === "bad" ? "bg-destructive/90" : "bg-foreground/75"}`}>
            {banner.text}
          </div>
          {hub && online === false && (
            <div className="absolute inset-x-4 top-14 flex items-center justify-center gap-2 rounded-xl bg-destructive/90 px-3 py-2 text-sm font-bold text-destructive-foreground">
              <WifiOff className="h-4 w-4" /> ติดต่อเครื่อง FaceGate ไม่ได้ — ตรวจว่าเปิดโปรแกรมและอยู่ใน Wi-Fi วงเดียวกัน
            </div>
          )}
        </div>

        {/* ฝั่งข้อมูล */}
        <aside className="flex min-h-0 flex-col border-t bg-card p-5 landscape:border-l landscape:border-t-0">
          <div className="flex items-center gap-3 text-xl font-extrabold">
            <i className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 not-italic text-primary">✦</i>
            <span className="truncate">{welcome}</span>
          </div>

          {profile ? (
            <div className="flex min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-3 flex-col items-center pt-4">
              <img src={url(profile.avatar_url || profile.snapshot_url)} alt="" className="h-28 w-28 rounded-full border-[6px] border-card bg-muted object-cover shadow-lg ring-4 ring-border" />
              <h2 className="mt-3 text-center text-2xl font-extrabold">{st.full_name || profile.name || profile.message || "ไม่พบข้อมูล"}</h2>
              <div className="font-bold text-primary">
                {st.person_type === "staff"
                  ? ["บุคลากร", st.department, st.position].filter(Boolean).join(" • ")
                  : ["นักเรียน", st.class_room ? `ชั้น ${st.class_room}` : ""].filter(Boolean).join(" • ")}
              </div>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                <div className="rounded-xl border bg-muted/50 p-3"><small className="block font-bold text-muted-foreground">{content.kiosk_class_label || "ชั้นเรียน"}</small><b className="text-lg">{st.class_room || st.department || "—"}</b></div>
                <div className="rounded-xl border bg-muted/50 p-3"><small className="block font-bold text-muted-foreground">{content.kiosk_id_label || "รหัส"}</small><b className="text-lg">{st.student_code || "—"}</b></div>
              </div>
              <div className="mt-auto flex w-full justify-between rounded-xl bg-primary/10 p-3"><span>{content.kiosk_time_label || "เวลาเข้า-ออก"}</span><b>{profile.time}</b></div>
              <div className={`mt-2 w-full rounded-xl p-3 text-center text-lg font-extrabold ${ok ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                {ok ? content.kiosk_success_label || "บันทึกสำเร็จ" : profile.message}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                <small>FACEGATE READY</small>
                <h2 className="my-1 truncate text-lg font-extrabold">{content.device_name ? `${content.device_name} • ` : ""}{content.kiosk_subtitle || "กรุณายืนให้ใบหน้าตรงกับกรอบใบหน้าบนหน้าจอ"}</h2>
                <p className="text-sm opacity-80">{online ? "ระบบพร้อมสำหรับการสแกน" : "กำลังเชื่อมต่อเครื่อง FaceGate..."}</p>
              </div>
              <div className="mb-2 mt-4 flex justify-between font-extrabold"><span>สแกนเข้าล่าสุด</span><small className="text-muted-foreground">วันนี้</small></div>
              <div className="flex min-h-0 flex-col gap-2 overflow-auto">
                {(display.show_recent === false ? [] : recent).map((i, k) => (
                  <div key={k} className="flex items-center gap-2 rounded-xl border p-2">
                    <img src={url(i.snapshot_url || i.avatar_url)} alt="" className="h-10 w-10 rounded-lg bg-muted object-cover" />
                    <div className="min-w-0 flex-1"><b className="block truncate">{i.name}</b><span className="block truncate text-xs text-muted-foreground">{i.detail || ""} • {timeOf(i.scanned_at)}</span></div>
                    <span className="text-xs font-extrabold text-primary">{i.direction === "out" ? "ออก" : "เข้า"}</span>
                  </div>
                ))}
                {(display.show_recent === false || recent.length === 0) && <div className="text-sm text-muted-foreground">ยังไม่มีการสแกนวันนี้</div>}
              </div>
            </div>
          )}
        </aside>
      </div>

      {display.news_enabled && display.news_text && (
        <div className="fixed inset-x-5 bottom-2 z-10 overflow-hidden whitespace-nowrap rounded-xl bg-primary p-2 font-bold text-primary-foreground">
          <div className="inline-block animate-[marquee_30s_linear_infinite]">{`${display.news_text}   •   `.repeat(8)}</div>
        </div>
      )}

      {saver && (
        <div className="fixed inset-0 z-50 flex flex-col justify-center gap-6 bg-foreground p-10 text-background" onClick={bump}>
          <div><small className="opacity-60">สรุปการมาโรงเรียนวันนี้</small><h1 className="text-3xl font-extrabold">{school}</h1><span className="opacity-60">{now.toLocaleDateString(TH_LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>
          {([["นักเรียน", stats.total_students, stats.students_present, stats.absent_students], ["บุคลากร", stats.total_staff, stats.staff_present, stats.absent_staff]] as const).map(([label, total, present, absent]) => (
            <div key={label} className="border-t border-background/20 pt-4">
              <div className="flex justify-between"><b>{label}</b><span>ในระบบ <b>{total || 0}</b> คน</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background/10 p-4">มาวันนี้<b className="block text-5xl text-primary">{present || 0}</b></div>
                <div className="rounded-lg bg-background/10 p-4">ขาด<b className="block text-5xl text-primary">{absent || 0}</b></div>
              </div>
            </div>
          ))}
          <div className="opacity-60">กล้องพร้อมสแกนตลอดเวลา — แตะหน้าจอเพื่อกลับ</div>
        </div>
      )}

      {showSetup && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-foreground/60 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold">ตั้งค่าเครื่อง</h2>
            <p className="text-sm text-muted-foreground">ใส่หมายเลขเครื่อง PC ที่ลงโปรแกรม FaceGate ไว้ (ดูได้ที่หน้าจอโปรแกรมบน PC) แล้วกดบันทึก</p>
            <div className="space-y-1">
              <Label className="text-xs">ที่อยู่เครื่อง FaceGate</Label>
              <Input value={hubDraft} onChange={(e) => setHubDraft(e.target.value)} placeholder="เช่น 192.168.1.50" inputMode="url" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">กล้องที่ใช้ (รองรับกล้อง USB ต่อภายนอก)</Label>
              <Select value={cameraId || "default"} onValueChange={(v) => { const id = v === "default" ? "" : v; setCameraId(id); localStorage.setItem(CAM_KEY, id); }}>
                <SelectTrigger><SelectValue placeholder="กล้องเริ่มต้น" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">กล้องเริ่มต้นของเครื่อง</SelectItem>
                  {cameras.map((c, i) => c.deviceId && <SelectItem key={c.deviceId} value={c.deviceId}>{c.label || `กล้องที่ ${i + 1}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveHub} disabled={!hubDraft.trim()}>บันทึกและเริ่มสแกน</Button>
              <Button variant="outline" onClick={() => void startCamera()}><Camera className="mr-2 h-4 w-4" /> เปิดกล้องใหม่</Button>
              {hub && <Button variant="ghost" onClick={() => setShowSetup(false)}>ปิด</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
