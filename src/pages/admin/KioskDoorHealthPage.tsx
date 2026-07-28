import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DoorOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Puzzle,
  Clock,
  Monitor,
  Trash2,
  Activity,
} from "lucide-react";

/**
 * หน้าเช็คสถานะการทำงานของ Kiosk โหมด "door" (ตู้สแกนหน้าประตูโรงเรียน)
 * - Online / Offline (last_seen_at < 90 วิ)
 * - สถานะการทำงาน: OK / เตือน / ผิดพลาด
 *   - offline > 5 นาที        → error
 *   - offline 90 วิ – 5 นาที   → warning
 *   - extension ยังไม่ติดตั้ง  → warning
 *   - config ยังไม่ sync       → warning
 *   - อื่นๆ                    → healthy
 * - Realtime + refresh อัตโนมัติทุก 30 วิ
 */

type Device = {
  id: string;
  device_id: string;
  hostname: string | null;
  status: string;
  kiosk_mode: string | null;
  config_updated_at: string | null;
  last_seen_at: string;
  extension_installed: boolean;
  screen_resolution: string | null;
  uptime_sec: number | null;
  user_agent: string | null;
  meta: any;
};

const ONLINE_MS = 90_000;
const WARN_MS = 5 * 60_000;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} วินาที`;
  if (s < 3600) return `${Math.floor(s / 60)} นาที`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมง`;
  return `${Math.floor(s / 86400)} วัน`;
}

function fmtUptime(sec: number | null) {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

type Health = "healthy" | "warning" | "error" | "offline";

function healthOf(d: Device, cfgUpdated: string | null): { level: Health; reasons: string[] } {
  const ms = Date.now() - new Date(d.last_seen_at).getTime();
  const reasons: string[] = [];
  if (ms > WARN_MS || d.status === "offline") return { level: "error", reasons: [`ออฟไลน์เกิน ${Math.floor(ms / 60000)} นาที`] };
  if (ms > ONLINE_MS) reasons.push(`ไม่พบสัญญาณ ${Math.floor(ms / 1000)} วิ`);
  if (!d.extension_installed) reasons.push("ยังไม่ได้ติดตั้ง Extension");
  if (cfgUpdated && d.config_updated_at && d.config_updated_at !== cfgUpdated) reasons.push("Config ยังไม่ sync");
  if (reasons.length === 0) return { level: "healthy", reasons: ["ทำงานปกติ"] };
  return { level: "warning", reasons };
}

export default function KioskDoorHealthPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = async () => {
    const [{ data: rows, error }, { data: cfg }] = await Promise.all([
      supabase
        .from("kiosk_devices")
        .select(
          "id,device_id,hostname,status,kiosk_mode,config_updated_at,last_seen_at,extension_installed,screen_resolution,uptime_sec,user_agent,meta",
        )
        .eq("kiosk_mode", "door")
        .order("last_seen_at", { ascending: false })
        .limit(100),
      supabase
        .from("school_settings")
        .select("setting_value,updated_at")
        .eq("setting_key", "kiosk_config")
        .maybeSingle(),
    ]);
    if (error) {
      toast.error(`โหลดรายการ Kiosk ไม่สำเร็จ: ${error.message}`);
    } else {
      setDevices((rows || []) as Device[]);
    }
    const raw = (cfg as any)?.setting_value;
    const parsed = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    setConfigUpdatedAt(parsed?.updated_at || (cfg as any)?.updated_at || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("kiosk-door-health")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kiosk_devices", filter: "kiosk_mode=eq.door" },
        () => load(),
      )
      .subscribe();
    const iv = window.setInterval(load, 30_000);
    const tickIv = window.setInterval(() => setTick((n) => n + 1), 10_000); // refresh time-ago
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(iv);
      window.clearInterval(tickIv);
    };
  }, []);

  const summary = useMemo(() => {
    let online = 0, warn = 0, err = 0, healthy = 0;
    devices.forEach((d) => {
      const h = healthOf(d, configUpdatedAt);
      if (h.level === "error") err += 1;
      else {
        online += 1;
        if (h.level === "warning") warn += 1;
        else healthy += 1;
      }
    });
    return { total: devices.length, online, offline: devices.length - online, warn, err, healthy };
  }, [devices, configUpdatedAt]);

  const removeDevice = async (id: string, name: string) => {
    if (!confirm(`ลบเครื่อง "${name}" ออกจากรายการ?`)) return;
    const { error } = await supabase.from("kiosk_devices").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("ลบแล้ว"); load(); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-cyan-500" />
            สถานะตู้ Kiosk หน้าประตู
          </h1>
          <p className="text-sm text-muted-foreground">
            เช็คสถานะการทำงาน · Online / Offline · แจ้งเตือนเมื่อผิดปกติ · อัปเดตอัตโนมัติทุก 30 วิ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1">
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ออนไลน์</p>
                <p className="text-2xl font-bold text-emerald-600">{summary.online}</p>
              </div>
              <Wifi className="h-6 w-6 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-400/30 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ออฟไลน์</p>
                <p className="text-2xl font-bold text-slate-600">{summary.offline}</p>
              </div>
              <WifiOff className="h-6 w-6 text-slate-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">มีข้อสังเกต</p>
                <p className="text-2xl font-bold text-amber-600">{summary.warn}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ผิดพลาด</p>
                <p className="text-2xl font-bold text-rose-600">{summary.err}</p>
              </div>
              <Activity className="h-6 w-6 text-rose-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4" />
            รายการเครื่อง Kiosk (door) — {devices.length} เครื่อง
          </CardTitle>
          <CardDescription>
            เครื่องจะถือว่า "ออนไลน์" หากส่ง heartbeat ใน 90 วิที่ผ่านมา · ถ้าเงียบเกิน 5 นาที = ผิดพลาด
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : devices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <DoorOpen className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                ยังไม่พบเครื่อง Kiosk โหมด door — ติดตั้งสคริปต์ที่หน้า{" "}
                <a href="/dashboard/admin/kiosk-setup" className="text-primary underline">
                  ตั้งค่า Kiosk
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => {
                const h = healthOf(d, configUpdatedAt);
                const label = (d.meta?.room as string) || d.hostname || d.device_id.slice(0, 12);
                const border =
                  h.level === "error" ? "border-rose-500/40 bg-rose-500/5"
                  : h.level === "warning" ? "border-amber-500/40 bg-amber-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5";
                const Icon =
                  h.level === "error" ? Activity
                  : h.level === "warning" ? AlertTriangle
                  : CheckCircle2;
                const iconColor =
                  h.level === "error" ? "text-rose-500"
                  : h.level === "warning" ? "text-amber-500"
                  : "text-emerald-500";
                return (
                  <div key={d.id} className={`rounded-lg border p-3 ${border}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
                          <span className="truncate font-semibold">{label}</span>
                          <Badge
                            variant="outline"
                            className={
                              h.level === "error" ? "border-rose-500/40 text-rose-600"
                              : h.level === "warning" ? "border-amber-500/40 text-amber-600"
                              : "border-emerald-500/40 text-emerald-600"
                            }
                          >
                            {h.level === "error" ? "ผิดพลาด" : h.level === "warning" ? "เตือน" : "ปกติ"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> ล่าสุด {timeAgo(d.last_seen_at)} ที่แล้ว
                          </span>
                          <span>· uptime {fmtUptime(d.uptime_sec)}</span>
                          {d.screen_resolution && <span>· {d.screen_resolution}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Puzzle className="h-3 w-3" /> Extension: {d.extension_installed ? "ติดตั้ง" : "ยังไม่ติด"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-mono text-muted-foreground/70 truncate">
                          {d.device_id}
                        </p>
                        {h.reasons.length > 0 && (
                          <ul className="mt-1 text-xs">
                            {h.reasons.map((r, i) => (
                              <li key={i} className={iconColor}>• {r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="ลบ"
                        onClick={() => removeDevice(d.id, label)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
