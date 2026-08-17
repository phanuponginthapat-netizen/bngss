import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Monitor, RefreshCw, Check, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { saveErrorMessage } from "@/lib/saveError";

type Device = {
  id: string;
  device_id: string;
  user_id: string | null;
  hostname: string | null;
  status: string;
  kiosk_mode: string | null;
  config_updated_at: string | null;
  last_seen_at: string;
  extension_installed: boolean;
  screen_resolution: string | null;
  meta: any;
};

type UserInfo = { name: string; classroom: string | null };

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} วิ`;
  if (s < 3600) return `${Math.floor(s / 60)} นาที`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.`;
  return `${Math.floor(s / 86400)} วัน`;
}

export function KioskDevicesLiveCard({ configUpdatedAt, onViewDevice }: { configUpdatedAt?: string | null; onViewDevice?: (userId: string, name: string) => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("kiosk_devices")
      .select("id,device_id,user_id,hostname,status,kiosk_mode,config_updated_at,last_seen_at,extension_installed,screen_resolution,meta")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(`โหลดรายการเครื่องไม่สำเร็จ: ${error.message}`);
      setLoading(false);
      return;
    }
    if (data) {
      setDevices(data as Device[]);
      // fetch user names + classrooms for logged-in devices
      const uids = Array.from(new Set((data as Device[]).map((d) => d.user_id).filter(Boolean))) as string[];
      if (uids.length) {
        const [{ data: profs }, { data: stus }] = await Promise.all([
          supabase.from("profiles").select("id, first_name, last_name").in("id", uids),
          supabase.from("students").select("auth_user_id, classrooms!students_classroom_id_fkey(name)").in("auth_user_id", uids),
        ]);
        const map: Record<string, UserInfo> = {};
        (profs || []).forEach((p: any) => {
          const nm = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
          map[p.id] = { name: nm || "—", classroom: null };
        });
        (stus || []).forEach((s: any) => {
          const cls = s.classrooms?.name ?? null;
          if (map[s.auth_user_id]) map[s.auth_user_id].classroom = cls;
          else map[s.auth_user_id] = { name: "—", classroom: cls };
        });
        setUsers(map);
      } else {
        setUsers({});
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("kiosk-devices-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "kiosk_devices" }, () => load())
      .subscribe();
    const iv = window.setInterval(load, 30_000);
    return () => { supabase.removeChannel(ch); window.clearInterval(iv); };
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    const online = devices.filter((d) => now - new Date(d.last_seen_at).getTime() < 90_000 && d.status !== "offline").length;
    const stale = devices.length - online;
    const outOfSync = configUpdatedAt
      ? devices.filter((d) => d.config_updated_at && d.config_updated_at !== configUpdatedAt).length
      : 0;
    const rooms = new Set<string>();
    devices.forEach((d) => { const r = d.meta?.room; if (typeof r === "string" && r.trim()) rooms.add(r.trim()); });
    return { total: devices.length, online, stale, outOfSync, rooms: rooms.size };
  }, [devices, configUpdatedAt]);

  // 🎯 auto-detect: ชั้นที่กำลังใช้งานมากสุดในแต่ละห้อง (จากคนที่ login อยู่)
  const roomActivity = useMemo(() => {
    const now = Date.now();
    const byRoom = new Map<string, Map<string, number>>();
    devices.forEach((d) => {
      const isOnline = now - new Date(d.last_seen_at).getTime() < 90_000 && d.status !== "offline";
      if (!isOnline) return;
      const room = (d.meta?.room as string)?.trim();
      if (!room) return;
      const cls = d.user_id ? users[d.user_id]?.classroom : null;
      if (!cls) return;
      if (!byRoom.has(room)) byRoom.set(room, new Map());
      const m = byRoom.get(room)!;
      m.set(cls, (m.get(cls) || 0) + 1);
    });
    return Array.from(byRoom.entries()).map(([room, m]) => {
      const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((s, [, n]) => s + n, 0);
      return { room, top: sorted[0], total, all: sorted };
    }).sort((a, b) => b.total - a.total);
  }, [devices, users]);


  const removeDevice = async (id: string) => {
    if (!confirm("ลบเครื่องนี้ออกจากรายการ?")) return;
    const { error } = await supabase.from("kiosk_devices").delete().eq("id", id);
    if (error) toast.error(saveErrorMessage(error)); else { toast.success("ลบแล้ว"); load(); }
  };

  const startEditRoom = (d: Device) => {
    setEditingId(d.id);
    setRoomInput((d.meta?.room as string) || "");
  };

  const saveRoom = async (d: Device) => {
    const room = roomInput.trim();
    const newMeta = { ...(d.meta || {}), room: room || null };
    const { error } = await supabase.from("kiosk_devices").update({ meta: newMeta }).eq("id", d.id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(room ? `ตั้งห้อง: ${room}` : "ล้างห้องแล้ว");
    setEditingId(null);
    setRoomInput("");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-primary" />
              เครื่องที่เชื่อมต่ออยู่ ({summary.online}/{summary.total})
            </CardTitle>
            <CardDescription>
              รายชื่อเครื่องที่เปิดหน้า Agent อยู่ · realtime · หายเกิน 90 วิ = offline · ตั้ง "ห้อง" ต่อเครื่องเพื่อสั่งการแยกห้อง
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Online {summary.online}</Badge>
          {summary.stale > 0 && <Badge variant="outline" className="bg-muted">Offline/Stale {summary.stale}</Badge>}
          {summary.rooms > 0 && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">ห้องที่ตั้งไว้ {summary.rooms}</Badge>}
          {summary.outOfSync > 0 && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Config ยังไม่ sync {summary.outOfSync}</Badge>}
        </div>

        {roomActivity.length > 0 && (
          <div className="mb-3 rounded-lg border bg-primary/5 p-3">
            <div className="text-xs font-semibold text-primary mb-2">🎯 ห้องที่กำลังมีการเรียน (ตรวจจับอัตโนมัติจากชั้นของนักเรียนที่ login)</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roomActivity.map(({ room, top, total, all }) => (
                <div key={room} className="rounded-md border bg-background p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">📍 {room}</span>
                    <Badge variant="secondary" className="text-[10px]">{total} เครื่อง</Badge>
                  </div>
                  {top && (
                    <div className="mt-1 text-muted-foreground">
                      กำลังเรียน: <span className="font-medium text-foreground">{top[0]}</span> ({top[1]} คน)
                      {all.length > 1 && <span className="text-[10px]"> · อื่นๆ: {all.slice(1).map(([c, n]) => `${c}(${n})`).join(", ")}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีเครื่องที่เชื่อมต่อ</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2">นักเรียน / เครื่อง</th>
                  <th className="p-2">ชั้น</th>
                  <th className="p-2">ห้อง</th>
                  <th className="p-2">Mode</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Ext</th>
                  <th className="p-2">Config</th>
                  <th className="p-2">Last seen</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const isOnline = Date.now() - new Date(d.last_seen_at).getTime() < 90_000 && d.status !== "offline";
                  const inSync = !configUpdatedAt || d.config_updated_at === configUpdatedAt;
                  const room = (d.meta?.room as string) || "";
                  const isEditing = editingId === d.id;
                  const u = d.user_id ? users[d.user_id] : null;
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="p-2">
                        <div className="font-semibold">{u?.name || <span className="text-muted-foreground italic">ยังไม่ได้ login</span>}</div>
                        <div className="text-muted-foreground text-[10px] font-mono truncate max-w-[180px]">{d.hostname || d.device_id.slice(0, 12)}</div>
                      </td>
                      <td className="p-2">
                        {u?.classroom ? <Badge variant="outline" className="font-normal">{u.classroom}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>

                      <td className="p-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              value={roomInput}
                              onChange={(e) => setRoomInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveRoom(d); if (e.key === "Escape") setEditingId(null); }}
                              placeholder="ห้องคอม 1"
                              className="h-7 w-28 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveRoom(d)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 hover:text-primary"
                            onClick={() => startEditRoom(d)}
                            title="คลิกเพื่อแก้ไข"
                          >
                            {room ? <Badge variant="secondary" className="font-normal">{room}</Badge> : <span className="text-muted-foreground italic">— ตั้งห้อง —</span>}
                            <Pencil className="h-3 w-3 opacity-40" />
                          </button>
                        )}
                      </td>
                      <td className="p-2">{d.kiosk_mode || "-"}</td>
                      <td className="p-2">
                        <Badge variant={isOnline ? "default" : "secondary"} className={isOnline ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                          {isOnline ? d.status : "offline"}
                        </Badge>
                      </td>
                      <td className="p-2">{d.extension_installed ? "✓" : "—"}</td>
                      <td className="p-2">
                        {inSync ? <span className="text-emerald-600">sync</span> : <span className="text-amber-600">out of sync</span>}
                      </td>
                      <td className="p-2 text-muted-foreground">{timeAgo(d.last_seen_at)} ที่แล้ว</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          {onViewDevice && d.user_id && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onViewDevice(d.user_id!, u?.name || "นักเรียน")}
                              title="ดูหน้าจอเครื่องนี้"
                              disabled={!isOnline}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => removeDevice(d.id)} title="ลบ">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
