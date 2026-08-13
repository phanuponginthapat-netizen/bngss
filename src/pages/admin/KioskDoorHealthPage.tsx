import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  BatteryFull,
  BatteryLow,
  BatteryCharging,
  Cpu,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/**
 * หน้าเช็คสถานะการทำงานของ Kiosk โหมด "door" (ตู้สแกนหน้าประตูโรงเรียน)
 * - Online / Offline (last_seen_at < 90 วิ)
 * - สถานะการทำงาน OK / เตือน / ผิดพลาด
 * - แบตเตอรี่ + กราฟย้อนหลัง (จากตาราง kiosk_health_samples ที่เครื่องส่งมาทุก 3 นาที)
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

type Sample = {
  device_id: string;
  sampled_at: string;
  status: string | null;
  uptime_sec: number | null;
  battery_percent: number | null;
  battery_charging: boolean | null;
  battery_status: string | null;
  memory_used_mb: number | null;
  latency_ms: number | null;
};

const ONLINE_MS = 90_000;
const WARN_MS = 5 * 60_000;
const RANGES = [
  { key: "6h", label: "6 ชม.", hours: 6 },
  { key: "24h", label: "24 ชม.", hours: 24 },
  { key: "7d", label: "7 วัน", hours: 24 * 7 },
] as const;

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

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

type Health = "healthy" | "warning" | "error" | "offline";

function healthOf(d: Device, cfgUpdated: string | null, batt?: Sample | null): { level: Health; reasons: string[] } {
  const ms = Date.now() - new Date(d.last_seen_at).getTime();
  const reasons: string[] = [];
  if (ms > WARN_MS || d.status === "offline") return { level: "error", reasons: [`ออฟไลน์เกิน ${Math.floor(ms / 60000)} นาที`] };
  if (ms > ONLINE_MS) reasons.push(`ไม่พบสัญญาณ ${Math.floor(ms / 1000)} วิ`);
  if (!d.extension_installed) reasons.push("ยังไม่ได้ติดตั้ง Extension");
  if (cfgUpdated && d.config_updated_at && d.config_updated_at !== cfgUpdated) reasons.push("Config ยังไม่ sync");
  if (batt && typeof batt.battery_percent === "number" && batt.battery_percent <= 20 && !batt.battery_charging) {
    reasons.push(`แบตเตอรี่เหลือ ${batt.battery_percent}% (ไม่ได้เสียบไฟ)`);
  }
  if (reasons.length === 0) return { level: "healthy", reasons: ["ทำงานปกติ"] };
  return { level: "warning", reasons };
}

const CHART_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#a855f7", "#f43f5e", "#eab308"];

export default function KioskDoorHealthPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [configUpdatedAt, setConfigUpdatedAt] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24h");
  const [, setTick] = useState(0);

  const hours = RANGES.find((r) => r.key === range)?.hours ?? 24;

  const load = async () => {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const [{ data: rows, error }, { data: cfg }, { data: hist }] = await Promise.all([
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
      (supabase as any)
        .from("kiosk_health_samples")
        .select("device_id,sampled_at,status,uptime_sec,battery_percent,battery_charging,battery_status,memory_used_mb,latency_ms")
        .eq("kiosk_mode", "door")
        .gte("sampled_at", since)
        .order("sampled_at", { ascending: true })
        .limit(5000),
    ]);
    if (error) {
      toast.error(`โหลดรายการ Kiosk ไม่สำเร็จ: ${error.message}`);
    } else {
      setDevices((rows || []) as Device[]);
    }
    setSamples(((hist as Sample[]) || []));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  /** sample ล่าสุดของแต่ละเครื่อง */
  const latestByDevice = useMemo(() => {
    const m = new Map<string, Sample>();
    samples.forEach((s) => m.set(s.device_id, s));
    return m;
  }, [samples]);

  const labelOf = (deviceId: string) => {
    const d = devices.find((x) => x.device_id === deviceId);
    return (d?.meta?.room as string) || d?.hostname || deviceId.slice(0, 10);
  };

  /** ข้อมูลกราฟ: จัดกลุ่มตามช่วงเวลา (bucket 10 นาที) แต่ละเครื่องเป็น 1 เส้น */
  const chartData = useMemo(() => {
    const bucketMs = hours <= 6 ? 5 * 60_000 : hours <= 24 ? 15 * 60_000 : 60 * 60_000;
    const buckets = new Map<number, any>();
    samples.forEach((s) => {
      const t = Math.floor(new Date(s.sampled_at).getTime() / bucketMs) * bucketMs;
      const row = buckets.get(t) || { t, label: fmtClock(new Date(t).toISOString()) };
      row[`b_${s.device_id}`] = s.battery_percent;
      row[`u_${s.device_id}`] = s.uptime_sec ? +(s.uptime_sec / 3600).toFixed(2) : 0;
      row[`m_${s.device_id}`] = s.memory_used_mb;
      row.online = (row.online || 0) + 1;
      buckets.set(t, row);
    });
    return Array.from(buckets.values()).sort((a, b) => a.t - b.t);
  }, [samples, hours]);

  const deviceIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.device_id))).slice(0, 6),
    [samples],
  );

  const summary = useMemo(() => {
    let online = 0, warn = 0, err = 0, healthy = 0;
    devices.forEach((d) => {
      const h = healthOf(d, configUpdatedAt, latestByDevice.get(d.device_id));
      if (h.level === "error") err += 1;
      else {
        online += 1;
        if (h.level === "warning") warn += 1;
        else healthy += 1;
      }
    });
    return { total: devices.length, online, offline: devices.length - online, warn, err, healthy };
  }, [devices, configUpdatedAt, latestByDevice]);

  const removeDevice = async (id: string, name: string) => {
    if (!confirm(`ลบเครื่อง "${name}" ออกจากรายการ?`)) return;
    const { error } = await supabase.from("kiosk_devices").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("ลบแล้ว"); load(); }
  };

  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  } as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-cyan-500" />
            สถานะตู้ Kiosk หน้าประตู
          </h1>
          <p className="text-sm text-muted-foreground">
            เช็คสถานะการทำงาน · Online / Offline · แบตเตอรี่ · กราฟย้อนหลัง · อัปเดตอัตโนมัติทุก 30 วิ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1">
            <RefreshCw className="h-4 w-4" /> รีเฟรช
          </Button>
        </div>
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

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BatteryFull className="h-4 w-4 text-emerald-500" /> แบตเตอรี่ (%)
            </CardTitle>
            <CardDescription>ระดับแบตเตอรี่ย้อนหลัง {RANGES.find((r) => r.key === range)?.label}</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {chartData.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลย้อนหลัง</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {deviceIds.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={`b_${id}`}
                      name={labelOf(id)}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChartIcon className="h-4 w-4 text-cyan-500" /> ชั่วโมงการทำงานต่อเนื่อง (uptime)
            </CardTitle>
            <CardDescription>จำนวนชั่วโมงที่เครื่องเปิดใช้งานต่อเนื่อง</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {chartData.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลย้อนหลัง</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {deviceIds.map((id, i) => (
                    <Area
                      key={id}
                      type="monotone"
                      dataKey={`u_${id}`}
                      name={labelOf(id)}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
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
                const batt = latestByDevice.get(d.device_id) || null;
                const h = healthOf(d, configUpdatedAt, batt);
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
                const pct = batt?.battery_percent ?? null;
                const BattIcon = batt?.battery_charging ? BatteryCharging : (pct ?? 100) <= 20 ? BatteryLow : BatteryFull;
                const battColor = batt?.battery_charging
                  ? "text-cyan-500"
                  : pct == null ? "text-muted-foreground"
                  : pct <= 20 ? "text-rose-500"
                  : pct <= 50 ? "text-amber-500"
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
                          {batt?.memory_used_mb != null && (
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="h-3 w-3" /> RAM {batt.memory_used_mb} MB
                            </span>
                          )}
                        </div>

                        {/* แบตเตอรี่ */}
                        <div className="mt-2 flex items-center gap-2">
                          <BattIcon className={`h-4 w-4 shrink-0 ${battColor}`} />
                          {pct == null ? (
                            <span className="text-xs text-muted-foreground">ไม่มีข้อมูลแบตเตอรี่ (เครื่องต่อไฟบ้าน/ยังไม่ส่งข้อมูล)</span>
                          ) : (
                            <>
                              <Progress value={pct} className="h-2 max-w-[180px] flex-1" />
                              <span className={`text-xs font-semibold ${battColor}`}>
                                {pct}%{batt?.battery_charging ? " · กำลังชาร์จ" : ""}
                              </span>
                            </>
                          )}
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
