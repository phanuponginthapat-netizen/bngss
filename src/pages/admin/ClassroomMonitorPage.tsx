import { swal } from "@/lib/swal";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MonitorPlay, Lock, Unlock, MessageSquare, Users, RefreshCw,
  Power, Link2, LogOut, RotateCw, Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  createMonitorChannel, sendMonitorEvent, readMonitorEvent,
  type MonitorEvent, type AgentPresence, type CommandAction,
} from "@/lib/monitorSignal";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { KioskDevicesLiveCard } from "@/components/kiosk/KioskDevicesLiveCard";

/** viaExtension = หน้า Agent ไม่ได้เชื่อมต่อ แต่ส่วนขยายในเครื่องยังส่งสถานะอยู่ */
interface AgentCard extends AgentPresence { viaExtension?: boolean }

/** เว็บที่นักเรียนกำลังเปิดอยู่ รายงานจากส่วนขยายผ่านสถานะเครื่อง */
interface ActiveTab { title: string; url: string; at: string }

const EXT_ONLINE_MS = 3 * 60 * 1000;

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

  const channelRef = useRef<RealtimeChannel | null>(null);
  const agentsRef = useRef<Record<string, AgentCard>>({});
  // นักเรียนที่ส่วนขยายยังออนไลน์ แม้หน้า Agent จะถูก Chrome พักไว้
  const [extAgents, setExtAgents] = useState<Record<string, AgentCard>>({});
  // เว็บที่แต่ละเครื่องกำลังเปิดอยู่ (จากสถานะเครื่อง)
  const [activeTabs, setActiveTabs] = useState<Record<string, ActiveTab>>({});

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
        next[p.user_id] = { ...p };
      }
      setAgents(next);
    });

    ch.on("broadcast", { event: "monitor" }, async ({ payload: raw }) => {
      const payload = await readMonitorEvent(raw).catch(() => null);
      if (!payload) return;
      // ส่วนขยาย/หน้า Agent แจ้งข้อผิดพลาดของคำสั่งกลับมาทางช่องนี้
      if (payload.type === "command-error") {
        if (payload.to === me.id && payload.error) {
          toast.error(`${agentsRef.current[payload.from]?.name || "นักเรียน"}: ${payload.error}`, { duration: 8000 });
        }
        return;
      }
    });

    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        await ch.track({ user_id: me.id, name: me.name, role: "admin", online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // เครื่องนักเรียนที่ส่วนขยายส่งสถานะภายใน 3 นาที — แสดงการ์ดได้แม้หน้า Agent หลับ
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const load = async () => {
      const since = new Date(Date.now() - EXT_ONLINE_MS).toISOString();
      const { data: devs, error } = await supabase.from("kiosk_devices")
        .select("user_id, extension_version, agent_version, last_seen_at, meta")
        .eq("kiosk_mode", "student").gte("last_seen_at", since).not("user_id", "is", null);
      if (error || !alive) return;
      const latest = new Map<string, any>();
      for (const d of (devs as any[]) ?? []) {
        const cur = latest.get(d.user_id);
        if (!cur || d.last_seen_at > cur.last_seen_at) latest.set(d.user_id, d);
      }
      const ids = Array.from(latest.keys());
      if (ids.length === 0) { setExtAgents({}); return; }
      const [{ data: profs }, { data: studs }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", ids),
        supabase.from("students").select("auth_user_id, classrooms!students_classroom_id_fkey(name)").in("auth_user_id", ids),
      ]);
      if (!alive) return;
      const names = new Map(((profs as any[]) ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
      const rooms = new Map(((studs as any[]) ?? []).map((s) => [s.auth_user_id, s.classrooms?.name ?? null]));
      const next: Record<string, AgentCard> = {};
      const tabs: Record<string, ActiveTab> = {};
      latest.forEach((d, id) => {
        next[id] = {
          user_id: id, name: names.get(id) || "นักเรียน", classroom: rooms.get(id) ?? null,
          room: (d.meta as any)?.room ?? null, role: "student", online_at: d.last_seen_at,
          ext_version: d.extension_version, app_version: d.agent_version, viaExtension: true,
        };
        const at = (d.meta as any)?.active_tab;
        if (at && typeof at.url === "string" && at.url) {
          tabs[id] = { title: String(at.title ?? ""), url: at.url, at: String(at.at ?? "") };
        }
      });
      setExtAgents(next);
      setActiveTabs(tabs);
    };
    load();
    const iv = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [me?.id]);

  const allAgents = useMemo(() => ({ ...extAgents, ...agents }), [extAgents, agents]);
  const liveUserIds = useMemo(() => new Set(Object.keys(allAgents)), [allAgents]);

  function send(ev: MonitorEvent) {
    sendMonitorEvent(channelRef.current, ev).catch(e => toast.error(e.message));
  }

  function cmd(agentId: string, action: CommandAction, payload?: any) {
    if (!me) return;
    send({ type: "command", from: me.id, to: agentId, action, payload });
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

  async function shutdownAll() {
    if (!(await swal.confirm({ title: `ยืนยันปิดเครื่องนักเรียนทั้งหมด ${filtered.length} เครื่อง?` }))) return;
    bulk("shutdown", { sec: 15 }, "สั่งปิดเครื่อง ");
  }
  async function rebootAll() {
    if (!(await swal.confirm({ title: `ยืนยันรีสตาร์ทเครื่องนักเรียนทั้งหมด ${filtered.length} เครื่อง?` }))) return;
    bulk("reboot", { sec: 15 }, "สั่งรีสตาร์ท ");
  }
  async function logoutAll() {
    if (!(await swal.confirm({ title: `ยืนยัน logout นักเรียนทั้งหมด${classFilter !== "all" ? ` ห้อง ${classFilter}` : ""}?\n(ครอบคลุมทั้งนักเรียนที่เปิดหน้า Agent และที่ค้าง session อยู่)` }))) return;
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
      await sendMonitorEvent(ch, {
          type: "force-logout", from: me?.id, to: "*",
          classroom: classFilter === "all" ? "*" : classFilter,
          role: "student",
          reason: "ครูสั่งออกจากระบบ",
      }, "force-logout");
      toast.success("ส่งคำสั่ง logout ไปยังนักเรียนทั้งหมดแล้ว");
    } catch (e) {
      toast.error("ส่ง broadcast ไม่สำเร็จ");
    } finally {
      setTimeout(() => supabase.removeChannel(ch), 1500);
    }
  }

  const list = useMemo(() => Object.values(allAgents), [allAgents]);
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
            <h1 className="text-2xl font-bold flex items-center gap-2"><MonitorPlay className="w-6 h-6 text-primary" /> ระบบเฝ้าดูนักเรียน (Classroom Monitor)</h1>
            <p className="text-sm text-muted-foreground mt-1">คุมทั้งห้อง: ล็อก / ส่งลิงก์ / ปิดเครื่อง / ส่งข้อความ — และดูเว็บที่นักเรียนกำลังเปิดอยู่</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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

      <KioskDevicesLiveCard liveUserIds={liveUserIds} />

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
              <div className="bg-muted/40 border-b px-3 py-2.5 min-h-[64px] flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
                {activeTabs[a.user_id] ? (
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" title={activeTabs[a.user_id].title}>
                      {activeTabs[a.user_id].title || activeTabs[a.user_id].url}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate" title={activeTabs[a.user_id].url}>
                      {(() => { try { return new URL(activeTabs[a.user_id].url).hostname; } catch { return activeTabs[a.user_id].url; } })()}
                      {activeTabs[a.user_id].at && ` · ${new Date(activeTabs[a.user_id].at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลเว็บที่เปิด — ส่วนขยายจะรายงานอัตโนมัติ</p>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{a.classroom || "—"}</span>
                    {(a as any).room && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">📍 {(a as any).room}</Badge>}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex gap-1 flex-wrap">
                    <span title="รุ่นส่วนขยาย">🧩 {a.ext_version ? `v${a.ext_version}` : "รุ่นเก่ากว่า 1.15.1 หรือไม่พบ"}</span>
                    <span>·</span>
                    <span title="รุ่นโปรแกรม Safe Browser">🖥️ {a.app_version ? `Safe Browser v${a.app_version}` : "Chrome ปกติ"}</span>
                    {a.viaExtension && <><span>·</span><span title="ควบคุมผ่านส่วนขยายโดยตรง: ข้อความ ล็อก เปิดเว็บ ปิดเครื่อง">ผ่านส่วนขยาย</span></>}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Button size="sm" variant="outline" onClick={() => setMsgTarget(a)} className="gap-1" title="ส่งข้อความ"><MessageSquare className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => cmd(a.user_id, "lock", { message: "อยู่ในโหมดตั้งใจฟังครู" })} className="gap-1" title="ล็อกจอ"><Lock className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => cmd(a.user_id, "unlock")} className="gap-1" title="ปลดล็อก"><Unlock className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="destructive" onClick={async () => { if ((await swal.confirm({ title: `ปิดเครื่อง ${a.name}?` }))) cmd(a.user_id, "shutdown", { sec: 15 }); }} className="gap-1" title="ปิดเครื่อง"><Power className="w-3.5 h-3.5" /></Button>
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

    </div>
  );
}
