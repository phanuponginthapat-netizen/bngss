import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MonitorPlay, Eye, EyeOff, Lock, Unlock, MessageSquare, Users, RefreshCw, Maximize2,
  Power, Link2, Camera, LogOut, RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  createMonitorChannel, RTC_CONFIG,
  type MonitorEvent, type AgentPresence, type CommandAction,
} from "@/lib/monitorSignal";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { KioskDevicesLiveCard } from "@/components/kiosk/KioskDevicesLiveCard";

interface AgentCard extends AgentPresence { streaming: boolean }

export default function ClassroomMonitorPage() {
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentCard>>({});
  const [classFilter, setClassFilter] = useState<string>("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [msgTarget, setMsgTarget] = useState<AgentCard | null>(null);
  const [msgText, setMsgText] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState("https://");
  const [fsAgent, setFsAgent] = useState<AgentCard | null>(null);
  const [shotDialog, setShotDialog] = useState<{ name: string; image: string } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const agentsRef = useRef<Record<string, AgentCard>>({});
  const [, forceRerender] = useState(0);
  const bump = () => forceRerender((n) => n + 1);

  // keep ref in sync so broadcast handler (registered once) sees latest names
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
      const name = profile ? `${(profile as any).first_name ?? ""} ${(profile as any).last_name ?? ""}`.trim() || user.email! : user.email!;
      setMe({ id: user.id, name });
    })();
  }, []);

  useEffect(() => {
    if (!me) return;
    const ch = createMonitorChannel(me.id);
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, AgentPresence[]>;
      const next: Record<string, AgentCard> = {};
      for (const key of Object.keys(state)) {
        const p = state[key]?.[0];
        if (!p || !p.user_id || p.user_id === me.id) continue;
        if (p.role && p.role !== "student" && p.role !== "teacher" && p.role !== "parent") continue;
        next[p.user_id] = { ...p, streaming: peersRef.current.has(p.user_id) };
      }
      setAgents(next);
    });

    ch.on("broadcast", { event: "monitor" }, ({ payload }: { payload: MonitorEvent }) => {
      if (payload.type === "screenshot-image") {
        // ครูขอ → to=me.id, นักเรียนส่งเอง → to="*"
        if (payload.to !== me.id && payload.to !== "*") return;
        const a = agentsRef.current[payload.from];
        const isUnsolicited = payload.to === "*";
        setShotDialog({ name: a?.name || "นักเรียน", image: payload.image });
        if (isUnsolicited) {
          toast.info(`📸 ${a?.name || "นักเรียน"} ส่งภาพหน้าจอให้คุณ`, { duration: 6000 });
        }
        return;
      }
      if (payload.to !== me.id) return;
      switch (payload.type) {
        case "offer": onOffer(payload.from, payload.sdp); break;
        case "ice":   onIce(payload.from, payload.candidate); break;
      }
    });

    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        await ch.track({ user_id: me.id, name: me.name, role: "admin", online_at: new Date().toISOString() });
      }
    });

    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      streamsRef.current.clear();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  function send(ev: MonitorEvent) {
    channelRef.current?.send({ type: "broadcast", event: "monitor", payload: ev });
  }

  function cmd(agentId: string, action: CommandAction, payload?: any) {
    if (!me) return;
    send({ type: "command", from: me.id, to: agentId, action, payload });
  }

  async function onOffer(agentId: string, sdp: RTCSessionDescriptionInit) {
    if (!me) return;
    peersRef.current.get(agentId)?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(agentId, pc);
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      streamsRef.current.set(agentId, stream);
      requestAnimationFrame(() => {
        const v = videoRefs.current.get(agentId);
        if (v) { v.srcObject = stream; v.play().catch(() => {}); }
      });
      bump();
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) send({ type: "ice", from: me.id, to: agentId, candidate: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        peersRef.current.delete(agentId);
        streamsRef.current.delete(agentId);
        setAgents((a) => ({ ...a, [agentId]: a[agentId] ? { ...a[agentId], streaming: false } : a[agentId] }));
      }
    };
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: "answer", from: me.id, to: agentId, sdp: answer });
    setAgents((a) => ({ ...a, [agentId]: a[agentId] ? { ...a[agentId], streaming: true } : a[agentId] }));
  }

  async function onIce(agentId: string, cand: RTCIceCandidateInit) {
    const pc = peersRef.current.get(agentId); if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
  }

  function view(agent: AgentCard) {
    if (!me) return;
    if (peersRef.current.has(agent.user_id)) { toast("กำลังดูอยู่แล้ว"); return; }
    send({ type: "request-stream", from: me.id, to: agent.user_id });
    toast(`ขอดูจอ ${agent.name}…`);
  }

  function viewById(userId: string, name: string) {
    if (!me) return;
    if (peersRef.current.has(userId)) { toast("กำลังดูอยู่แล้ว"); return; }
    if (!agentsRef.current[userId]) {
      toast.error(`${name} ยังไม่ได้เปิดหน้า Agent — สั่งดูจอไม่ได้`);
      return;
    }
    send({ type: "request-stream", from: me.id, to: userId });
    toast(`ขอดูจอ ${name}…`);
    // scroll to the card once streaming/placeholder renders
    setTimeout(() => {
      document.getElementById(`agent-card-${userId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }

  function stopView(agentId: string) {
    if (!me) return;
    send({ type: "stop-stream", from: me.id, to: agentId });
    peersRef.current.get(agentId)?.close();
    peersRef.current.delete(agentId);
    streamsRef.current.delete(agentId);
    setAgents((a) => ({ ...a, [agentId]: a[agentId] ? { ...a[agentId], streaming: false } : a[agentId] }));
  }

  function sendMessage() {
    if (!me || !msgTarget || !msgText.trim()) return;
    cmd(msgTarget.user_id, "message", { message: msgText.trim() });
    toast.success("ส่งข้อความแล้ว");
    setMsgTarget(null); setMsgText("");
  }

  function openUrlAll() {
    const url = urlText.trim();
    if (!url) return;
    filtered.forEach((a) => cmd(a.user_id, "open-url", { url }));
    toast.success(`เปิดลิงก์ให้ ${filtered.length} เครื่อง`);
    setUrlOpen(false);
  }

  function bulk(action: CommandAction, payload?: any, label = "") {
    filtered.forEach((a) => cmd(a.user_id, action, payload));
    toast.success(`${label}${filtered.length} เครื่อง`);
  }

  function shutdownAll() {
    if (!confirm(`ยืนยันปิดเครื่องนักเรียนทั้งหมด ${filtered.length} เครื่อง?`)) return;
    bulk("shutdown", { sec: 15 }, "สั่งปิดเครื่อง ");
  }
  function rebootAll() {
    if (!confirm(`ยืนยันรีสตาร์ทเครื่องนักเรียนทั้งหมด ${filtered.length} เครื่อง?`)) return;
    bulk("reboot", { sec: 15 }, "สั่งรีสตาร์ท ");
  }
  async function logoutAll() {
    if (!confirm(`ยืนยัน logout นักเรียนทั้งหมด${classFilter !== "all" ? ` ห้อง ${classFilter}` : ""}?\n(ครอบคลุมทั้งนักเรียนที่เปิดหน้า Agent และที่ค้าง session อยู่)`)) return;
    // 1) สั่งผ่าน monitor channel — สำหรับเครื่องที่เปิดหน้า Agent
    bulk("logout", null, "สั่ง logout ");
    // 2) Broadcast ช่องกลาง — สำหรับนักเรียนคนอื่นที่ login ค้างไว้แต่ไม่ได้เปิดหน้า Agent
    const ch = supabase.channel("classroom-broadcast");
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("subscribe timeout")), 5000);
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            clearTimeout(timer); reject(new Error(status));
          }
        });
      });
      await ch.send({
        type: "broadcast",
        event: "force-logout",
        payload: {
          classroom: classFilter === "all" ? "*" : classFilter,
          role: "student",
          reason: "ครูสั่งออกจากระบบ",
        },
      });
      toast.success("ส่งคำสั่ง logout ไปยังนักเรียนทั้งหมดแล้ว");
    } catch (e) {
      toast.error("ส่ง broadcast ไม่สำเร็จ");
    } finally {
      setTimeout(() => supabase.removeChannel(ch), 1500);
    }
  }

  const list = useMemo(() => Object.values(agents), [agents]);
  const classrooms = useMemo(() => {
    const set = new Set<string>();
    list.forEach((a) => { if (a.classroom) set.add(a.classroom); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [list]);
  const rooms = useMemo(() => {
    const set = new Set<string>();
    list.forEach((a) => { if ((a as any).room) set.add((a as any).room); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [list]);

  // 🎯 auto-detect ชั้นที่กำลังใช้งานมากสุดในแต่ละห้อง
  const roomActivity = useMemo(() => {
    const byRoom = new Map<string, Map<string, number>>();
    list.forEach((a) => {
      const room = ((a as any).room as string)?.trim();
      const cls = a.classroom?.trim();
      if (!room || !cls) return;
      if (!byRoom.has(room)) byRoom.set(room, new Map());
      const m = byRoom.get(room)!;
      m.set(cls, (m.get(cls) || 0) + 1);
    });
    return Array.from(byRoom.entries()).map(([room, m]) => {
      const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((s, [, n]) => s + n, 0);
      return { room, topClass: sorted[0]?.[0] ?? null, topCount: sorted[0]?.[1] ?? 0, total, all: sorted };
    }).sort((a, b) => b.total - a.total);
  }, [list]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((a) => {
      if (classFilter !== "all" && a.classroom !== classFilter) return false;
      if (roomFilter !== "all" && (a as any).room !== roomFilter) return false;
      if (s && !a.name.toLowerCase().includes(s)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [list, q, classFilter, roomFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><MonitorPlay className="w-6 h-6 text-primary" /> ระบบเฝ้าดูหน้าจอนักเรียน (Classroom Monitor)</h1>
            <p className="text-sm text-muted-foreground mt-1">Web-based WebRTC — คุมทั้งห้อง: ล็อก / ส่งลิงก์ / ปิดเครื่อง / screenshot</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => {
            if (!me) return;
            const targets = filtered.filter((a) => !peersRef.current.has(a.user_id));
            if (targets.length === 0) { toast("กำลังดูอยู่ครบทุกเครื่องแล้ว"); return; }
            targets.forEach((a) => send({ type: "request-stream", from: me.id, to: a.user_id }));
            toast.success(`ขอดูจอ ${targets.length} เครื่อง`);
          }} className="gap-1"><Eye className="w-4 h-4" /> ดูจอทุกเครื่อง ({filtered.length})</Button>
          <Button variant="outline" size="sm" onClick={() => bulk("screenshot", null, "ขอ Screenshot ")} className="gap-1"><Camera className="w-4 h-4" /> Screenshot ({filtered.length})</Button>
          <Button variant="destructive" size="sm" onClick={() => bulk("lock", { message: "ตั้งใจฟังครู" }, "ล็อก ")} className="gap-1"><Lock className="w-4 h-4" /> ล็อก ({filtered.length})</Button>
          <Button variant="outline" size="sm" onClick={() => bulk("unlock", null, "ปลดล็อก ")} className="gap-1"><Unlock className="w-4 h-4" /> ปลดล็อก ({filtered.length})</Button>
          <Button variant="outline" size="sm" onClick={() => setUrlOpen(true)} className="gap-1"><Link2 className="w-4 h-4" /> เปิดลิงก์ ({filtered.length})</Button>
          <Button variant="outline" size="sm" onClick={logoutAll} className="gap-1"><LogOut className="w-4 h-4" /> Logout ({filtered.length})</Button>
          <Button variant="outline" size="sm" onClick={rebootAll} className="gap-1"><RotateCw className="w-4 h-4" /> Restart ({filtered.length})</Button>
          <Button variant="destructive" size="sm" onClick={shutdownAll} className="gap-1"><Power className="w-4 h-4" /> ปิดเครื่อง ({filtered.length})</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1"><Users className="w-3 h-3" /> ออนไลน์ {list.length}</Badge>
          {(classFilter !== "all" || roomFilter !== "all") && (
            <Badge variant="outline" className="gap-1">
              กำลังสั่งเฉพาะ: {classFilter !== "all" && `ชั้น ${classFilter}`}{classFilter !== "all" && roomFilter !== "all" && " · "}{roomFilter !== "all" && `📍 ${roomFilter}`} ({filtered.length}/{list.length})
            </Badge>
          )}
          <span>· ปุ่มด้านบนสั่งเฉพาะเครื่องที่ผ่าน filter เท่านั้น</span>
        </div>
      </div>

      <KioskDevicesLiveCard onViewDevice={viewById} />

      {roomActivity.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2">
              🎯 ห้องที่กำลังมีการเรียน (Auto-detect จากชั้นของนักเรียนที่ login)
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roomActivity.map(({ room, topClass, topCount, total, all }) => {
                const isActive = roomFilter === room;
                return (
                  <button
                    key={room}
                    onClick={() => {
                      if (isActive) { setRoomFilter("all"); setClassFilter("all"); }
                      else { setRoomFilter(room); if (topClass) setClassFilter(topClass); }
                    }}
                    className={`text-left rounded-lg border p-3 transition ${isActive ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-background hover:border-primary/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">📍 {room}</span>
                      <Badge variant="secondary" className="text-[10px]">{total} เครื่อง</Badge>
                    </div>
                    {topClass && (
                      <div className="mt-1.5 text-xs">
                        <span className="text-muted-foreground">กำลังเรียน: </span>
                        <span className="font-semibold text-primary">{topClass}</span>
                        <span className="text-muted-foreground"> ({topCount} คน)</span>
                      </div>
                    )}
                    {all.length > 1 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        อื่นๆ: {all.slice(1).map(([c, n]) => `${c}(${n})`).join(", ")}
                      </div>
                    )}
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      {isActive ? "✓ กำลังกรอง — คลิกอีกครั้งเพื่อยกเลิก" : "คลิกเพื่อกรองและสั่งการเฉพาะห้องนี้"}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}





      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ชั้นเรียน (Homeroom)</label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกชั้น</SelectItem>
                {classrooms.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ห้องคอม/สถานที่</label>
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกห้อง</SelectItem>
                {rooms.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                {rooms.length === 0 && <SelectItem value="__none__" disabled>ยังไม่มีห้อง — ตั้งได้ที่ตารางเครื่องด้านบน</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ค้นหาชื่อ</label>
            <Input placeholder="ชื่อนักเรียน…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>


      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-40" />
          ยังไม่มีเครื่องออนไลน์ — ให้นักเรียนเปิดหน้า agent
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <Card key={a.user_id} id={`agent-card-${a.user_id}`} className="overflow-hidden scroll-mt-24">
              <div className="aspect-video bg-black relative">
                {a.streaming ? (
                  <video
                    ref={(el) => { videoRefs.current.set(a.user_id, el); const s = streamsRef.current.get(a.user_id); if (el && s && el.srcObject !== s) { el.srcObject = s; el.play().catch(() => {}); } }}
                    autoPlay playsInline muted className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">ยังไม่ได้ขอดูจอ</div>
                )}
                {a.streaming && (
                  <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-7 w-7" onClick={() => setFsAgent(a)}>
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{a.classroom || "—"}</span>
                    {(a as any).room && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">📍 {(a as any).room}</Badge>}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {a.streaming ? (
                    <Button size="sm" variant="outline" onClick={() => stopView(a.user_id)} className="gap-1 col-span-1"><EyeOff className="w-3.5 h-3.5" /></Button>
                  ) : (
                    <Button size="sm" onClick={() => view(a)} className="gap-1 col-span-1"><Eye className="w-3.5 h-3.5" /></Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => cmd(a.user_id, "screenshot")} className="gap-1"><Camera className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setMsgTarget(a)} className="gap-1"><MessageSquare className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => cmd(a.user_id, "lock", { message: "อยู่ในโหมดตั้งใจฟังครู" })} className="gap-1"><Lock className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => cmd(a.user_id, "unlock")} className="gap-1"><Unlock className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm(`ปิดเครื่อง ${a.name}?`)) cmd(a.user_id, "shutdown", { sec: 15 }); }} className="gap-1"><Power className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send message dialog */}
      <Dialog open={!!msgTarget} onOpenChange={(o) => !o && setMsgTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ส่งข้อความถึง {msgTarget?.name}</DialogTitle></DialogHeader>
          <Input placeholder="ข้อความ…" value={msgText} onChange={(e) => setMsgText(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgTarget(null)}>ยกเลิก</Button>
            <Button onClick={sendMessage}>ส่ง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open URL dialog */}
      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปิดลิงก์ให้นักเรียนทุกเครื่อง</DialogTitle>
            <DialogDescription>ลิงก์จะเปิดในแท็บใหม่ของเครื่องนักเรียนที่ออนไลน์ ({filtered.length} เครื่อง)</DialogDescription>
          </DialogHeader>
          <Input placeholder="https://…" value={urlText} onChange={(e) => setUrlText(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlOpen(false)}>ยกเลิก</Button>
            <Button onClick={openUrlAll}>ส่งลิงก์</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot preview */}
      <Dialog open={!!shotDialog} onOpenChange={(o) => !o && setShotDialog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Screenshot จาก {shotDialog?.name}</DialogTitle></DialogHeader>
          {shotDialog && (
            <>
              <img src={shotDialog.image} alt="screenshot" className="w-full rounded border" />
              <DialogFooter>
                <a href={shotDialog.image} download={`screenshot-${shotDialog.name}-${Date.now()}.jpg`}>
                  <Button variant="outline">ดาวน์โหลด</Button>
                </a>
                <Button onClick={() => setShotDialog(null)}>ปิด</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen viewer */}
      <Dialog open={!!fsAgent} onOpenChange={(o) => !o && setFsAgent(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>{fsAgent?.name} · {fsAgent?.classroom || "—"}</DialogTitle></DialogHeader>
          <div className="aspect-video bg-black">
            {fsAgent && (
              <video
                autoPlay playsInline muted className="w-full h-full object-contain"
                ref={(el) => { if (el && fsAgent) { const s = streamsRef.current.get(fsAgent.user_id); if (s) { el.srcObject = s; el.play().catch(() => {}); } } }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
