import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, RefreshCw, Wifi, WifiOff, AlertCircle, Cpu, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { IOT_CATEGORIES, getCategory } from "@/lib/iotCategories";

interface IoTDevice {
  id: string;
  name: string;
  description: string | null;
  device_type: string;
  unit: string | null;
  source_type: string;
  location: string | null;
  dashboard_group: string;
  system_category: string;
  last_value: string | null;
  last_value_numeric: number | null;
  last_status: string | null;
  last_error: string | null;
  last_fetched_at: string | null;
  is_active: boolean;
}

interface Reading {
  device_id: string;
  value_numeric: number | null;
  value: string | null;
  recorded_at: string;
}

export default function IoTDashboardPage() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<string>("all");

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["iot-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iot_devices")
        .select("id,name,description,device_type,icon,unit,source_type,base_url,entity_id,request_path,json_path,poll_interval_seconds,location,dashboard_group,display_order,is_active,last_value,last_value_numeric,last_status,last_error,last_fetched_at,meta,system_category,color,created_by,created_at,updated_at")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as IoTDevice[];
    },
    refetchInterval: 15000,
  });

  // Recent readings (last 2h) for sparklines
  const { data: readings = [] } = useQuery({
    queryKey: ["iot-readings-recent"],
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("iot_readings")
        .select("device_id, value_numeric, value, recorded_at")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data as Reading[];
    },
    refetchInterval: 30000,
  });

  const readingsByDevice = useMemo(() => {
    const m = new Map<string, Reading[]>();
    for (const r of readings) {
      if (!m.has(r.device_id)) m.set(r.device_id, []);
      m.get(r.device_id)!.push(r);
    }
    return m;
  }, [readings]);

  // Realtime: devices and new readings
  useEffect(() => {
    const ch = supabase
      .channel("iot-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "iot_devices" },
        () => qc.invalidateQueries({ queryKey: ["iot-devices"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "iot_readings" },
        () => qc.invalidateQueries({ queryKey: ["iot-readings-recent"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("iot-fetch", {
        body: { record_history: true },
      });
      if (error) throw error;
      toast.success(`อัปเดตแล้ว ${data?.count ?? 0} อุปกรณ์`);
      qc.invalidateQueries({ queryKey: ["iot-devices"] });
      qc.invalidateQueries({ queryKey: ["iot-readings-recent"] });
    } catch (e: any) {
      toast.error("ไม่สามารถอัปเดตได้: " + (e.message ?? String(e)));
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(
    () => (tab === "all" ? devices : devices.filter((d) => (d.system_category || "other") === tab)),
    [devices, tab]
  );

  const stats = (list: IoTDevice[]) => ({
    total: list.length,
    online: list.filter((d) => d.last_status === "online").length,
    error: list.filter((d) => d.last_status === "error").length,
    offline: list.filter((d) => d.last_status !== "online" && d.last_status !== "error").length,
  });

  const overall = stats(devices);

  // Available category tabs (only ones with devices)
  const tabs = useMemo(() => {
    const set = new Set(devices.map((d) => d.system_category || "other"));
    return IOT_CATEGORIES.filter((c) => set.has(c.value));
  }, [devices]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Cpu className="h-7 w-7 text-primary" /> IoT Realtime Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            รวมอุปกรณ์ IoT แยกตามระบบ — ประปา · โซลาร์เซลล์ · CCTV · พลังงาน · สิ่งแวดล้อม
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAll} disabled={refreshing} variant="default">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            รีเฟรชค่า
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/iot/devices">
              <Plus className="h-4 w-4 mr-2" /> จัดการอุปกรณ์
            </Link>
          </Button>
        </div>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="ทั้งหมด" value={overall.total} icon={<Activity className="h-5 w-5" />} />
        <SummaryCard label="ออนไลน์" value={overall.online} icon={<Wifi className="h-5 w-5 text-success" />} />
        <SummaryCard label="ข้อผิดพลาด" value={overall.error} icon={<AlertCircle className="h-5 w-5 text-danger" />} />
        <SummaryCard label="ออฟไลน์" value={overall.offline} icon={<WifiOff className="h-5 w-5 text-muted-foreground" />} />
      </div>

      {/* Per-system KPI strip */}
      {tabs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {tabs.map((c) => {
            const list = devices.filter((d) => (d.system_category || "other") === c.value);
            const s = stats(list);
            const Icon = c.icon;
            return (
              <button
                key={c.value}
                onClick={() => setTab(c.value)}
                className={`text-left rounded-xl border p-3 transition hover:shadow-md ${c.ring} ${tab === c.value ? "ring-2 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${c.color}`} />
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <Badge variant="secondary">{s.total}</Badge>
                </div>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span className="text-success">● {s.online}</span>
                  <span className="text-danger">● {s.error}</span>
                  <span>● {s.offline}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs filter */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">ทั้งหมด ({devices.length})</TabsTrigger>
          {tabs.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">กำลังโหลด...</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <Cpu className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">ยังไม่มีอุปกรณ์ในหมวดนี้</p>
                <Button asChild>
                  <Link to="/dashboard/iot/devices">เพิ่มอุปกรณ์</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((d) => (
                <DeviceCard key={d.id} device={d} history={readingsByDevice.get(d.id) || []} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function DeviceCard({ device, history }: { device: IoTDevice; history: Reading[] }) {
  const status = device.last_status || "unknown";
  const cat = getCategory(device.system_category);
  const Icon = cat.icon;
  const statusColor =
    status === "online" ? "bg-success/15 text-success border-success/30"
    : status === "error" ? "bg-danger/15 text-danger border-danger/30"
    : "bg-muted text-muted-foreground";

  const chartData = history
    .filter((r) => r.value_numeric != null)
    .map((r) => ({
      t: new Date(r.recorded_at).getTime(),
      v: Number(r.value_numeric),
    }));

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition border-l-4 ${cat.ring}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-4 w-4 shrink-0 ${cat.color}`} />
            <CardTitle className="text-sm font-medium line-clamp-2">{device.name}</CardTitle>
          </div>
          <Badge variant="outline" className={statusColor}>{status}</Badge>
        </div>
        {device.location && (
          <p className="text-xs text-muted-foreground">{device.location}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{device.last_value ?? "—"}</span>
          {device.unit && <span className="text-sm text-muted-foreground">{device.unit}</span>}
        </div>

        {chartData.length > 1 && (
          <div className="h-16 mt-2 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`g-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: 4, borderRadius: 6 }}
                  labelFormatter={(t) => new Date(t as number).toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  formatter={(v: any) => [`${v}${device.unit ? " " + device.unit : ""}`, "ค่า"]}
                />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" fill={`url(#g-${device.id})`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-2 text-xs text-muted-foreground">
          {device.last_fetched_at
            ? `อัปเดต ${formatDistanceToNow(new Date(device.last_fetched_at), { addSuffix: true, locale: th })}`
            : "ยังไม่เคยอ่านค่า"}
        </div>
        {device.last_error && (
          <p className="text-xs text-danger mt-1 line-clamp-2">{device.last_error}</p>
        )}
      </CardContent>
    </Card>
  );
}
