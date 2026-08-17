import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Thermometer, ShieldAlert, DoorOpen, RefreshCw, Users } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/**
 * รายงาน Smart Gate — สรุปเหตุการณ์จากจุดคัดกรองหน้าประตู (micro:bit)
 * ไข้สูง / พบวัตถุต้องสงสัย / ผ่านปกติ พร้อมกราฟอุณหภูมิย้อนหลัง
 */

type GateEvent = {
  id: string;
  occurred_at: string;
  device_label: string | null;
  subject_kind: string;
  subject_id: string | null;
  subject_name: string | null;
  event_type: string;
  temperature_c: number | null;
  metal_level: number | null;
  detail: string | null;
  allowed: boolean;
  gate_opened: boolean;
};

const RANGES = [
  { value: "1", label: "วันนี้" },
  { value: "7", label: "7 วันล่าสุด" },
  { value: "30", label: "30 วันล่าสุด" },
];

const timeTH = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { hour12: false, dateStyle: "short", timeStyle: "short" });

export default function SmartGateReportPage() {
  const [range, setRange] = useState("7");
  const [type, setType] = useState("all");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (Number(range) - 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [range]);

  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["smart-gate-events", since, type],
    queryFn: async () => {
      let q = (supabase as any)
        .from("smart_gate_events")
        .select("*")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(1000);
      if (type !== "all") q = q.eq("event_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GateEvent[];
    },
  });

  const stats = useMemo(() => {
    const fever = events.filter((e) => e.event_type === "fever");
    const weapon = events.filter((e) => e.event_type === "weapon");
    const temps = events.map((e) => e.temperature_c).filter((t): t is number => t != null);
    return {
      total: events.length,
      fever: fever.length,
      weapon: weapon.length,
      opened: events.filter((e) => e.gate_opened).length,
      maxTemp: temps.length ? Math.max(...temps) : null,
      people: new Set(events.map((e) => e.subject_id || e.subject_name)).size,
    };
  }, [events]);

  const chart = useMemo(() => {
    const byDay = new Map<string, { day: string; max: number; sum: number; n: number; fever: number }>();
    for (const e of events) {
      const day = new Date(e.occurred_at).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      const row = byDay.get(day) || { day, max: 0, sum: 0, n: 0, fever: 0 };
      if (e.temperature_c != null) {
        row.max = Math.max(row.max, e.temperature_c);
        row.sum += e.temperature_c;
        row.n += 1;
      }
      if (e.event_type === "fever") row.fever += 1;
      byDay.set(day, row);
    }
    return [...byDay.values()]
      .reverse()
      .map((r) => ({ day: r.day, สูงสุด: r.max || null, เฉลี่ย: r.n ? +(r.sum / r.n).toFixed(1) : null, ไข้สูง: r.fever }));
  }, [events]);

  const badge = (e: GateEvent) => {
    if (e.event_type === "weapon") return <Badge variant="destructive">พบวัตถุต้องสงสัย</Badge>;
    if (e.event_type === "fever") return <Badge className="bg-amber-500 text-white hover:bg-amber-500">ไข้สูง</Badge>;
    return <Badge variant="secondary">ผ่านปกติ</Badge>;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายงาน Smart Gate</h1>
          <p className="text-sm text-muted-foreground">สรุปการคัดกรองอุณหภูมิและวัตถุต้องสงสัยที่จุดสแกนใบหน้า</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเหตุการณ์</SelectItem>
              <SelectItem value="fever">ไข้สูง</SelectItem>
              <SelectItem value="weapon">พบวัตถุต้องสงสัย</SelectItem>
              <SelectItem value="pass">ผ่านปกติ</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="รีเฟรช">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ไข้สูง</CardTitle>
            <Thermometer className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.fever}</div>
            <p className="text-xs text-muted-foreground">
              {stats.maxTemp != null ? `สูงสุด ${stats.maxTemp.toFixed(1)}°C` : "ยังไม่มีข้อมูลอุณหภูมิ"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">พบวัตถุต้องสงสัย</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weapon}</div>
            <p className="text-xs text-muted-foreground">ประตูถูกล็อกอัตโนมัติ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">เปิดประตู</CardTitle>
            <DoorOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.opened}</div>
            <p className="text-xs text-muted-foreground">จากทั้งหมด {stats.total} เหตุการณ์</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">จำนวนคน</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.people}</div>
            <p className="text-xs text-muted-foreground">ผู้ผ่านจุดคัดกรอง (ไม่ซ้ำ)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">กราฟอุณหภูมิรายวัน</CardTitle>
          <CardDescription>ค่าสูงสุด/เฉลี่ยที่วัดได้จากเซนเซอร์ micro:bit</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {chart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis domain={["auto", "auto"]} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="สูงสุด" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="เฉลี่ย" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการเหตุการณ์ล่าสุด</CardTitle>
          <CardDescription>สูงสุด 1,000 รายการตามช่วงเวลาที่เลือก</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">เวลา</th>
                <th className="p-3 font-medium">ชื่อ</th>
                <th className="p-3 font-medium">ประเภท</th>
                <th className="p-3 font-medium">เหตุการณ์</th>
                <th className="p-3 font-medium">อุณหภูมิ</th>
                <th className="p-3 font-medium">ค่าโลหะ</th>
                <th className="p-3 font-medium">ประตู</th>
                <th className="p-3 font-medium">เครื่อง</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">กำลังโหลด…</td></tr>
              )}
              {!isLoading && events.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">ไม่พบเหตุการณ์ในช่วงเวลานี้</td></tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="whitespace-nowrap p-3">{timeTH(e.occurred_at)}</td>
                  <td className="p-3">{e.subject_name || "-"}</td>
                  <td className="p-3">{e.subject_kind === "personnel" ? "บุคลากร" : "นักเรียน"}</td>
                  <td className="p-3">{badge(e)}</td>
                  <td className="p-3">{e.temperature_c != null ? `${e.temperature_c}°C` : "-"}</td>
                  <td className="p-3">{e.metal_level ?? "-"}</td>
                  <td className="p-3">{e.gate_opened ? "เปิด" : "ปิด"}</td>
                  <td className="p-3 text-muted-foreground">{e.device_label || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
