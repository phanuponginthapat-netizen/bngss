import { swal } from "@/lib/swal";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrowserShortcuts } from "@/hooks/useBrowserShortcuts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MonitorPlay, ShieldCheck, Lock, MessageSquare, Power, LogOut,
  Puzzle, CheckCircle2, XCircle, Wifi, Clock, GraduationCap, Radio, Download,
  Globe,
} from "lucide-react";
import BrowserUrlBar from "@/components/browser/BrowserUrlBar";
import BrowserShortcutsGrid from "@/components/browser/BrowserShortcutsGrid";
import { toast } from "sonner";
import {
  createMonitorChannel,
  callLocalCtl,
  sendMonitorEvent, readMonitorEvent,
  type MonitorEvent,
  type AgentPresence,
} from "@/lib/monitorSignal";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useKioskRuntimeConfig } from "@/hooks/useKioskRuntimeConfig";
import { useKioskHeartbeat, fetchDeviceRoom } from "@/hooks/useKioskHeartbeat";
import { getDeviceId } from "@/lib/deviceId";

/**
 * นักเรียน / เครื่องปลายทาง เปิดหน้านี้แล้วอยู่เบื้องหลัง — คล้าย NetSupport Client
 * - บันทึกสถานะออนไลน์ผ่าน Presence
 * - รับคำสั่ง lock / unlock / message / open-url / shutdown / reboot / logout
 * - ครูเห็น "เว็บที่กำลังเปิด" จากส่วนขยาย ไม่มีการจับภาพหน้าจอ
 */
export default function StudentAgentPage() {
  useBrowserShortcuts(); // รับการเปลี่ยนทางลัดแบบสด → ส่งต่อให้รายการโปรดของส่วนขยาย
  const [status, setStatus] = useState<"idle" | "locked">("idle");
  const [locked, setLocked] = useState<{ msg: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ action: string; sec: number } | null>(null);
  const [me, setMe] = useState<{ id: string; name: string; classroom: string | null; role: string; photo: string | null; email: string | null } | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [extInstalled, setExtInstalled] = useState<boolean>(false);
  const [extVersion, setExtVersion] = useState<string | null>(null);
  const [launcherVersion, setLauncherVersion] = useState<string | null>(null);
  const [onlineSince] = useState<Date>(() => new Date());
  const [now, setNow] = useState<Date>(new Date());
  const kioskConfig = useKioskRuntimeConfig(true);
  const uptimeSecRef = useRef(0);
  const [pinPrompt, setPinPrompt] = useState<null | { reason: string; onOk: () => void }>(null);
  const [pinInput, setPinInput] = useState("");
  

  const channelRef = useRef<RealtimeChannel | null>(null);
  const versionsRef = useRef<{ ext_version: string | null; app_version: string | null }>({ ext_version: null, app_version: null });
  const presenceRef = useRef<AgentPresence | null>(null);

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Detect extension (session-sync sets data-school-safe-browser="1" on <html>)
  useEffect(() => {
    const check = () => {
      const root = document.documentElement;
      setExtInstalled(root.getAttribute("data-school-safe-browser") === "1");
      setExtVersion(root.getAttribute("data-school-safe-browser-version"));
    };
    check();
    const iv = setInterval(check, 1500);
    return () => clearInterval(iv);
  }, []);

  // รุ่นโปรแกรม Safe Browser (ถ้ามี) — ถามผ่านส่วนขยายทุก 5 นาที
  useEffect(() => {
    if (!extInstalled) { setLauncherVersion(null); return; }
    let alive = true;
    const ask = () => extCall("KIOSK_STATUS").then((r) => { if (alive) setLauncherVersion(r?.ok && typeof r.version === "string" ? r.version : null); });
    ask();
    const iv = setInterval(ask, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [extInstalled]);

  // ส่งรุ่นส่วนขยาย/โปรแกรมให้หน้าครูเห็นบนการ์ด
  useEffect(() => {
    versionsRef.current = { ext_version: extVersion, app_version: launcherVersion };
    const ch = channelRef.current, p = presenceRef.current;
    if (ch && p) { presenceRef.current = { ...p, ...versionsRef.current }; ch.track(presenceRef.current).catch(() => {}); }
  }, [extVersion, launcherVersion]);

  // ==== Heartbeat → ตาราง kiosk_devices ทุก 30 วิ ====
  useKioskHeartbeat({
    enabled: !!me,
    status: status === "locked" ? "locked" : "online",
    kioskMode: "student",
    configUpdatedAt: kioskConfig?.updated_at ?? null,
    extensionInstalled: extInstalled,
    extensionVersion: extVersion,
    agentVersion: launcherVersion,
    uptimeSec: Math.floor((now.getTime() - onlineSince.getTime()) / 1000),
  });

  // ==== Screen Wake Lock — ป้องกันจอดับ ====
  useEffect(() => {
    let lock: any = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        // @ts-ignore
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          // @ts-ignore
          lock = await navigator.wakeLock.request("screen");
        }
      } catch { /* ignore */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      try { lock?.release?.(); } catch { /* ignore */ }
    };
  }, []);

  // ==== Keyboard escape guard — ป้องกัน Alt+Tab / Alt+F4 / Win / F11 / ปิดแท็บ ====
  // ใช้ Keyboard Lock API (Chromium) + preventDefault + beforeunload
  useEffect(() => {
    if (!me) return; // ทำงานเฉพาะเมื่อ login แล้ว
    const effectivePin = (kioskConfig?.exitPin?.trim() || "bng521987");

    const requestKeyboardLock = async () => {
      try {
        // ต้องอยู่ใน fullscreen ก่อน จึงจะ lock keyboard ได้
        if (!document.fullscreenElement) {
          await (document.documentElement as any).requestFullscreen?.();
        }
        // @ts-ignore navigator.keyboard เป็น API ของ Chromium
        if (navigator.keyboard?.lock) {
          // @ts-ignore
          await navigator.keyboard.lock([
            "Escape", "F11", "AltLeft", "AltRight",
            "MetaLeft", "MetaRight", "Tab",
          ]);
        }
      } catch { /* ignore */ }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = e.code;
      // จับ combos ที่พยายามออก kiosk
      const isEscape =
        (e.altKey && (code === "Tab" || key === "Tab")) ||         // Alt+Tab
        (e.altKey && (code === "F4" || key === "F4")) ||           // Alt+F4
        (e.ctrlKey && (key === "w" || key === "W")) ||             // Ctrl+W
        (e.ctrlKey && e.shiftKey && (key === "w" || key === "W")) ||
        (e.ctrlKey && (key === "n" || key === "N")) ||             // Ctrl+N
        (e.ctrlKey && (key === "t" || key === "T")) ||             // Ctrl+T
        (e.ctrlKey && e.shiftKey && (key === "t" || key === "T")) ||
        code === "MetaLeft" || code === "MetaRight" ||             // Win key
        key === "Meta" ||
        key === "F11" ||
        (e.altKey && key === "F4");
      if (!isEscape) return;
      e.preventDefault();
      e.stopPropagation();
      setPinPrompt({
        reason: `ตรวจพบการพยายามออกจาก Kiosk (${key})`,
        onOk: () => { /* ผู้ใช้ใส่ PIN ถูก — อนุญาต */ },
      });
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // อนุญาตให้ออกเมื่อครูสั่ง หรือ user กด logout ผ่านปุ่มในระบบ
      if ((window as any).__kioskAllowUnload) return;
      e.preventDefault();
      e.returnValue = "ต้องใส่รหัสเพื่อออกจากโหมด Kiosk";
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    // ขอ keyboard lock ตอน mount + ทุกครั้งที่ user ทำ interaction (บาง browser ต้อง user gesture)
    requestKeyboardLock();
    const onFirstClick = () => { requestKeyboardLock(); };
    window.addEventListener("click", onFirstClick, { once: false });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("click", onFirstClick);
      window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("contextmenu", onContextMenu);
      try {
        // @ts-ignore
        navigator.keyboard?.unlock?.();
      } catch { /* ignore */ }
    };
  }, [me?.id, kioskConfig?.exitPin]);





  // Load identity
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: role }, { data: stu }] = await Promise.all([
        supabase.from("profiles").select("first_name, last_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("students").select("photo_url, classrooms!students_classroom_id_fkey(name)").eq("auth_user_id", user.id).maybeSingle(),
      ]);
      const name = profile ? `${(profile as any).first_name ?? ""} ${(profile as any).last_name ?? ""}`.trim() || user.email! : user.email!;
      const photo = (stu as any)?.photo_url || (profile as any)?.avatar_url || null;
      setMe({
        id: user.id,
        name,
        classroom: (stu as any)?.classrooms?.name ?? null,
        role: (role as any)?.role ?? "student",
        photo,
        email: user.email ?? null,
      });
    })();
  }, []);

  // Fetch room label admin ตั้งให้เครื่องนี้ + subscribe realtime เผื่อ admin เปลี่ยน
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchDeviceRoom();
      if (!cancelled) setRoom(r);
    })();
    const deviceId = getDeviceId();
    const ch = supabase
      .channel(`kiosk-room-${deviceId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kiosk_devices", filter: `device_id=eq.${deviceId}` },
        (payload: any) => {
          const r = payload?.new?.meta?.room;
          setRoom(typeof r === "string" && r.trim() ? r.trim() : null);
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);


  // Join realtime + wire handlers
  useEffect(() => {
    if (!me) return;
    const ch = createMonitorChannel(me.id);
    channelRef.current = ch;

    const seen = new Set<string>();
    const onBroadcast = async ({ payload: raw }: { payload: any }) => {
      if (!raw?.receipt || seen.has(raw.receipt)) return;
      seen.add(raw.receipt);
      if (seen.size > 500) seen.delete(seen.values().next().value as string);
      const payload = await readMonitorEvent(raw).catch(() => null);
      if (!payload) return;
      if (payload.to !== me.id && payload.to !== "*") return;
      // แจ้งระบบว่าหน้า Agent รับคำสั่งแล้ว ส่วนขยายจะได้ไม่ทำซ้ำ
      if (payload.to === me.id && payload.type === "command") {
        supabase.rpc("ack_monitor_event", { _id: raw.receipt }).then(() => {}, () => {});
      }
      if (payload.type === "command") handleCommand(payload.from, payload.action, payload.payload);
    };

    ch.on("broadcast", { event: "monitor" }, onBroadcast);
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        const p: AgentPresence = { user_id: me.id, name: me.name, classroom: me.classroom, room, role: me.role, online_at: new Date().toISOString(), ...versionsRef.current };
        presenceRef.current = p;
        await ch.track(p);
        checkPending();
      }
    });

    // คำสั่งที่ส่งมาตอนแท็บนี้ถูก Chrome พักไว้ (ไม่ได้รับ broadcast) — รับต่อเมื่อแท็บตื่น
    const checkPending = async () => {
      const { data } = await supabase.rpc("pending_monitor_events");
      for (const row of (data as { id: string; event: any }[] | null) ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        await supabase.rpc("ack_monitor_event", { _id: row.id });
        if (row.event?.type === "command" && row.event?.from) handleCommand(row.event.from, row.event.action, row.event.payload);
      }
    };
    const onWake = () => { if (document.visibilityState !== "hidden") checkPending().catch(() => {}); };
    document.addEventListener("resume", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      document.removeEventListener("resume", onWake);
      document.removeEventListener("visibilitychange", onWake);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [me?.id, room]);

  async function handleCommand(from: string, action: string, payload: any) {
    switch (action) {
      case "lock":
        setLocked({ msg: payload?.message || "ครูล็อกจอชั่วคราว" });
        setStatus("locked");
        // สั่งให้ extension ล็อกทุกแท็บด้วย
        window.postMessage({ type: "SB_LOCK_ALL", message: payload?.message || "ครูล็อกจอ" }, "*");
        try { await (document.documentElement as any).requestFullscreen?.(); } catch { /* ignore */ }
        break;
      case "unlock":
        setLocked(null);
        setStatus((s) => (s === "locked" ? "idle" : s));
        window.postMessage({ type: "SB_UNLOCK_ALL" }, "*");
        try { await document.exitFullscreen?.(); } catch { /* ignore */ }
        break;
      case "message":
        setMessage(payload?.message || "");
        setTimeout(() => setMessage(null), 8000);
        // หน้า agent อยู่เบื้องหลัง → ให้ส่วนขยายแสดงข้อความบนแท็บที่นักเรียนกำลังดู
        window.postMessage({ type: "SB_MESSAGE", message: payload?.message || "" }, window.location.origin);
        break;
      case "open-url": {
        const url = String(payload?.url || "");
        if (!/^https?:\/\//i.test(url)) return;
        toast(`ครูเปิดลิงก์: ${url}`);
        // แจ้ง extension เพื่อเปิด tab ใหม่ใน chromium หลัก (นักเรียน)
        if (document.documentElement.getAttribute("data-school-safe-browser") === "1") {
          window.postMessage({ type: "SB_OPEN_URL", url }, window.location.origin);
        } else window.open(url, "_blank", "noopener");
        break;
      }
      case "shutdown": {
        const sec = Math.max(3, Number(payload?.sec) || 10);
        startCountdown("shutdown", sec, async () => {
          const ok = (await extCall("SB_POWER", { action: "shutdown" })).ok || (await callLocalCtl("/shutdown"));
          if (!ok) { toast.error("สั่งปิดเครื่องไม่สำเร็จ"); if (me) send({ type: "command-error", from: me.id, to: from, error: "สั่งปิดเครื่องไม่สำเร็จ: เครื่องนี้ไม่มีโปรแกรม BNG Safe Browser ที่ทำงานอยู่" }); }
        });
        break;
      }
      case "reboot": {
        const sec = Math.max(3, Number(payload?.sec) || 10);
        startCountdown("reboot", sec, async () => {
          const ok = (await extCall("SB_POWER", { action: "reboot" })).ok || (await callLocalCtl("/reboot"));
          if (!ok) { toast.error("สั่งรีสตาร์ทไม่สำเร็จ"); if (me) send({ type: "command-error", from: me.id, to: from, error: "สั่งรีสตาร์ทไม่สำเร็จ: เครื่องนี้ไม่มีโปรแกรม BNG Safe Browser ที่ทำงานอยู่" }); }
        });
        break;
      }
      // ไม่มีการดูหรือจับภาพหน้าจอ
      case "logout": {
        toast("ครูสั่ง logout — กำลังออกจากระบบ");
        await supabase.auth.signOut().catch(() => {});
        // และให้ daemon logout session Linux ด้วย (ถ้ามี)
        extCall("SB_POWER", { action: "logout" }).catch(() => {});
        setTimeout(() => { (window as any).__kioskAllowUnload = true; window.location.href = "/"; }, 500);
        break;
      }
    }
  }

  function startCountdown(action: string, sec: number, onDone: () => void) {
    let n = sec;
    setCountdown({ action, sec: n });
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        setCountdown(null);
        onDone();
      } else {
        setCountdown({ action, sec: n });
      }
    }, 1000);
  }

  /** ขอให້ extension ของโปรแกรม Safe Browser ทำคำสั่ งแล้วรอคำตอบ (ไม่มี dialog เลือกจอ) */
  function extCall(type: string, extra: Record<string, unknown> = {}): Promise<any> {
    return new Promise((resolve) => {
      if (document.documentElement.getAttribute("data-school-safe-browser") !== "1") { resolve({ ok: false }); return; }
      const requestId = Math.random().toString(36).slice(2);
      const on = (ev: MessageEvent) => {
        if (ev.source !== window || ev.origin !== location.origin) return;
        if (ev.data?.type !== "SB_RESULT" || ev.data?.requestId !== requestId) return;
        window.removeEventListener("message", on);
        clearTimeout(timer);
        resolve(ev.data.result || { ok: false });
      };
      const timer = setTimeout(() => { window.removeEventListener("message", on); resolve({ ok: false, error: "หมดเวลา" }); }, 25000);
      window.addEventListener("message", on);
      window.postMessage({ type, requestId, ...extra }, location.origin);
    });
  }

  function send(ev: MonitorEvent) {
    sendMonitorEvent(channelRef.current, ev).catch(e => toast.error(e.message));
  }

  async function selfShutdown() {
    if (!(await swal.confirm({ title: "ปิดเครื่องเลย?" }))) return;
    const ok = (await extCall("SB_POWER", { action: "shutdown" })).ok || (await callLocalCtl("/shutdown"));
    if (!ok) toast.error("ไม่พบ local daemon (เครื่องนี้อาจไม่ใช่ Kiosk)");
  }

  async function selfSignOut() {
    await supabase.auth.signOut();
    (window as any).__kioskAllowUnload = true; window.location.href = "/";
  }


  // openBrowserUrl ย้ายไป @/hooks/useBrowserShortcuts (ใช้ร่วมทั้งระบบ)


  const initials = (me?.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase();

  const uptimeSec = Math.max(0, Math.floor((now.getTime() - onlineSince.getTime()) / 1000));
  const uptime = `${String(Math.floor(uptimeSec / 3600)).padStart(2, "0")}:${String(Math.floor((uptimeSec % 3600) / 60)).padStart(2, "0")}:${String(uptimeSec % 60).padStart(2, "0")}`;
  const clock = now.toLocaleTimeString("th-TH", { hour12: false });

  // 🔒 stealth: ไม่แสดง "กำลังแชร์จอ" ให้ นร เห็น — โชว์เป็น "ออนไลน์" เสมอ
  const statusColor =
    status === "locked" ? "bg-destructive" : "bg-emerald-500";
  const statusLabel =
    status === "locked" ? "ถูกล็อก" : "ออนไลน์ พร้อมใช้งาน";

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Hero card */}
        <Card className="overflow-hidden border-primary/20 shadow-lg">
          <div className="relative bg-gradient-to-r from-primary/15 via-primary/5 to-accent/15 p-6 md:p-8">
            <div className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.25), transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--accent)/0.25), transparent 45%)" }} />
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="relative">
                <Avatar className="w-24 h-24 md:w-28 md:h-28 ring-4 ring-background shadow-xl">
                  {me?.photo && <AvatarImage src={me.photo} alt={me.name} className="object-cover" />}
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-2 ring-background ${statusColor} ${status === "idle" ? "animate-pulse" : ""}`} />
              </div>
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1 border-primary/30 bg-background/60">
                    <MonitorPlay className="w-3 h-3" /> โหมด Agent
                  </Badge>
                  <Badge className={`gap-1 ${status === "locked" ? "" : "bg-emerald-500 hover:bg-emerald-500"}`}
                    variant={status === "locked" ? "destructive" : "default"}>
                    <ShieldCheck className="w-3 h-3" /> {statusLabel}
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-black leading-tight">{me?.name ?? "กำลังโหลด..."}</h1>
                <div className="flex items-center justify-center sm:justify-start gap-3 text-sm text-muted-foreground flex-wrap">
                  {me?.classroom && (
                    <span className="inline-flex items-center gap-1"><GraduationCap className="w-4 h-4" /> {me.classroom}</span>
                  )}
                  <span className="inline-flex items-center gap-1"><Radio className="w-4 h-4" /> {me?.role ?? "student"}</span>
                  {me?.email && <span className="hidden md:inline-flex items-center gap-1 opacity-75">· {me.email}</span>}
                </div>
              </div>
            </div>

            {/* Live stats strip */}
            <div className="relative mt-6 grid grid-cols-3 gap-2 md:gap-4">
              <div className="rounded-xl bg-background/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">เวลาปัจจุบัน</div>
                <div className="font-mono font-bold text-base md:text-xl mt-1 inline-flex items-center gap-1"><Clock className="w-4 h-4 text-primary" />{clock}</div>
              </div>
              <div className="rounded-xl bg-background/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ออนไลน์แล้ว</div>
                <div className="font-mono font-bold text-base md:text-xl mt-1 inline-flex items-center gap-1"><Wifi className="w-4 h-4 text-emerald-500" />{uptime}</div>
              </div>
              <div className="rounded-xl bg-background/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ส่วนขยาย</div>
                <div className={`font-bold text-base md:text-xl mt-1 inline-flex items-center gap-1 ${extInstalled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {extInstalled ? <><CheckCircle2 className="w-4 h-4" />เชื่อมต่อ</> : <><XCircle className="w-4 h-4" />ยังไม่พบ</>}
                </div>
              </div>
            </div>

            {kioskConfig && (
              <div className="relative mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="gap-1 bg-background/60">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> Kiosk sync
                </Badge>
                {typeof kioskConfig.idleLogoutMin === "number" && kioskConfig.idleLogoutMin > 0 && (
                  <span>Idle logout: <b>{kioskConfig.idleLogoutMin}</b> นาที</span>
                )}
                {kioskConfig.enableDailyReboot && kioskConfig.rebootTime && (
                  <span>· รีบูตอัตโนมัติ <b>{kioskConfig.rebootTime}</b></span>
                )}
                {kioskConfig.updated_at && (
                  <span className="opacity-70">· อัปเดต {new Date(kioskConfig.updated_at).toLocaleString("th-TH", { hour12: false })}</span>
                )}
              </div>
            )}
          </div>
        </Card>

        {message && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ข้อความจากครู</div>
                <p className="text-sm font-medium mt-0.5">{message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="browser" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="browser" className="gap-2"><Globe className="w-4 h-4" /> เปิดเว็บ</TabsTrigger>
            <TabsTrigger value="status" className="gap-2"><ShieldCheck className="w-4 h-4" /> สถานะ</TabsTrigger>
            <TabsTrigger value="extension" className="gap-2"><Puzzle className="w-4 h-4" /> ส่วนขยาย</TabsTrigger>
          </TabsList>

          <TabsContent value="browser" className="mt-4">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div>
                  <h2 className="font-bold text-base mb-1 inline-flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" /> เปิดเว็บไซต์
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    พิมพ์ URL หรือคำค้นหา แล้วกด Enter — ระบบจะเปิดในแท็บใหม่ (ส่วนขยายจะกรองและบันทึก log ให้ครู)
                  </p>
                </div>

                <BrowserUrlBar />

                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">ปุ่มลัด (จัดการโดย admin)</div>
                  <BrowserShortcutsGrid compact />
                </div>


                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>ทุกการเปิดเว็บจะถูกบันทึก log และผ่านตัวกรองของโรงเรียน · หากเว็บถูกบล็อก จะถูกปิดอัตโนมัติและแจ้งครู</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="status" className="mt-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="font-bold text-base mb-1">พร้อมรับคำสั่งจากครู</h2>
                  <p className="text-sm text-muted-foreground">
                    เปิดหน้านี้ทิ้งไว้ระหว่างคาบเรียน ครูสามารถส่งข้อความ เปิดลิงก์ ล็อกจอ หรือปิดเครื่องได้จากแดชบอร์ด และเห็นชื่อเว็บที่คุณกำลังเปิดอยู่
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "รับข้อความ", ok: true },
                    { label: "รับล็อกจอ", ok: true },
                    { label: "รับเปิดลิงก์", ok: true },
                    { label: "แจ้งเว็บที่เปิด", ok: true },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border p-3 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {f.label}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={selfShutdown} className="gap-2">
                    <Power className="w-4 h-4" /> ปิดเครื่องนี้
                  </Button>
                  <Button variant="outline" size="sm" onClick={selfSignOut} className="gap-2">
                    <LogOut className="w-4 h-4" /> ออกจากระบบ
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extension" className="mt-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${extInstalled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    <Puzzle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-base">Safe Browser Extension</h2>
                      <Badge variant={extInstalled ? "default" : "secondary"} className={extInstalled ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                        {extInstalled ? "เชื่อมต่อแล้ว" : "ยังไม่พบ"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ส่วนขยายช่วยกรองโฆษณา/เว็บพนัน บันทึกการใช้งาน และให้ครูควบคุมแท็บได้จากระยะไกล
                    </p>
                  </div>
                </div>

                {!extInstalled && (
                  <div className="rounded-lg border border-dashed p-4 space-y-3">
                    <p className="text-sm">ยังไม่ได้ติดตั้งส่วนขยาย? ดาวน์โหลดและติดตั้งจาก Chrome:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal ml-4">
                      <li>ดาวน์โหลดไฟล์ ZIP แล้วแตกไฟล์</li>
                      <li>เปิด <code className="bg-muted px-1 rounded">chrome://extensions</code> → เปิด Developer mode</li>
                      <li>กด "Load unpacked" → เลือกโฟลเดอร์ที่แตกไว้</li>
                    </ol>
                    <Button size="sm" className="gap-2" onClick={() => {
                      fetch("/school-safe-browser.zip").then((r) => r.blob()).then((blob) => {
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = "school-safe-browser.zip";
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }).catch(() => toast.error("ดาวน์โหลดไม่สำเร็จ"));
                    }}>
                      <Download className="w-4 h-4" /> ดาวน์โหลดส่วนขยาย
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[
                    "กรองโฆษณา / เว็บพนัน",
                    "Toolbar ระบุตัวผู้ใช้",
                    "รายงานเว็บที่กำลังเปิด",
                    "Auto-open Agent Tab",
                  ].map((f) => (
                    <div key={f} className="rounded-lg border p-3 text-xs flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${extInstalled ? "text-emerald-500" : "text-muted-foreground"}`} />
                      {f}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


      {/* Countdown modal */}
      {countdown && (
        <div className="fixed inset-0 z-[9998] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
          <Power className="w-16 h-16 text-destructive mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2">
            ครูสั่ง{countdown.action === "shutdown" ? "ปิด" : "รีสตาร์ท"}เครื่อง
          </h2>
          <p className="text-4xl font-black text-destructive my-4">{countdown.sec}</p>
          <p className="text-muted-foreground">กรุณาบันทึกงานของคุณ</p>
          <Button variant="outline" className="mt-4" onClick={() => setCountdown(null)}>ยกเลิก</Button>
        </div>
      )}

      {/* Lock overlay */}
      {locked && (
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
          <Lock className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">หน้าจอถูกล็อกโดยครู</h2>
          <p className="text-muted-foreground max-w-md">{locked.msg}</p>
        </div>
      )}

      {/* PIN prompt */}
      {pinPrompt && (
        <div className="fixed inset-0 z-[10000] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
          <Lock className="w-16 h-16 text-primary mb-4" />
          <h2 className="text-xl font-bold mb-1">{pinPrompt.reason}</h2>
          <p className="text-sm text-muted-foreground mb-4">ต้องใส่ PIN ครูเพื่อดำเนินการต่อ</p>
          <input
            type="password"
            autoFocus
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (pinInput && pinInput === (kioskConfig?.exitPin?.trim() || "bng521987")) {
                  const fn = pinPrompt.onOk;
                  setPinPrompt(null); setPinInput("");
                  fn();
                } else {
                  toast.error("PIN ไม่ถูกต้อง");
                  setPinInput("");
                }
              }
            }}
            className="text-2xl font-mono tracking-widest text-center w-72 rounded-lg border-2 border-primary/50 bg-background px-4 py-3 mb-4"
            placeholder="ใส่รหัสครู"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setPinPrompt(null); setPinInput(""); }}>ยกเลิก</Button>
            <Button onClick={() => {
              if (pinInput && pinInput === (kioskConfig?.exitPin?.trim() || "bng521987")) {
                const fn = pinPrompt.onOk;
                setPinPrompt(null); setPinInput("");
                fn();
              } else {
                toast.error("PIN ไม่ถูกต้อง");
                setPinInput("");
              }
            }}>ยืนยัน</Button>
          </div>
        </div>
      )}
    </div>
  );
}
