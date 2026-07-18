import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Bell, RefreshCw, Send, AlertCircle, CheckCircle2, Clock } from "lucide-react";

type LogRow = {
  id: string;
  user_id: string | null;
  channel: string;
  status: string;
  reason: string | null;
  notification_type: string | null;
  title: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-success-soft text-success border-success/30",
  failed: "bg-danger-soft text-danger border-danger/30",
  dlq: "bg-danger-soft text-danger border-danger/30",
  gone: "bg-neutral-soft text-neutral border-neutral/30",
  skipped: "bg-warning-soft text-warning border-warning/30",
};

const CHANNEL_LABEL: Record<string, string> = {
  in_app: "In-App",
  push: "PWA Push",
  line: "LINE",
  gchat: "Google Chat",
  system: "System",
};

const RANGE_OPTIONS = [
  { value: "24h", label: "24 ชม.", hours: 24 },
  { value: "7d", label: "7 วัน", hours: 24 * 7 },
  { value: "30d", label: "30 วัน", hours: 24 * 30 },
];

export default function NotificationDeliveryDashboard() {
  const [range, setRange] = useState("24h");
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState(false);

  const hours = RANGE_OPTIONS.find((r) => r.value === range)?.hours ?? 24;
  const since = useMemo(() => new Date(Date.now() - hours * 3600_000).toISOString(), [hours]);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["notif_delivery_log", since, channel, status, type],
    queryFn: async () => {
      let q = supabase
        .from("notification_delivery_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (channel !== "all") q = q.eq("channel", channel);
      if (status !== "all") q = q.eq("status", status);
      if (type !== "all") q = q.eq("notification_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.title?.toLowerCase().includes(s) ||
        r.notification_type?.toLowerCase().includes(s) ||
        r.user_id?.toLowerCase().includes(s) ||
        r.reason?.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed" || r.status === "dlq").length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const byChannel: Record<string, { sent: number; failed: number }> = {};
    rows.forEach((r) => {
      byChannel[r.channel] = byChannel[r.channel] || { sent: 0, failed: 0 };
      if (r.status === "sent") byChannel[r.channel].sent++;
      else if (r.status === "failed" || r.status === "dlq") byChannel[r.channel].failed++;
    });
    return { total, sent, failed, skipped, successRate, byChannel };
  }, [rows]);

  const distinctTypes = useMemo(() => {
    return [...new Set(rows.map((r) => r.notification_type).filter(Boolean))] as string[];
  }, [rows]);

  const runRetry = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-retry");
      if (error) throw error;
      toast.success(`Retry: ${data?.success ?? 0}/${data?.retried ?? 0} ส่งสำเร็จ`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            แดชบอร์ดการแจ้งเตือน
          </h1>
          <p className="text-sm text-muted-foreground">
            ติดตามการส่งแจ้งเตือนทุกช่องทาง (In-App, PWA Push, LINE, Google Chat)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
          </Button>
          <Button size="sm" onClick={runRetry} disabled={retrying}>
            <Send className="w-4 h-4 mr-1" />
            {retrying ? "กำลังลองใหม่..." : "ลองส่ง Push ที่ล้มเหลวอีกครั้ง"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">รวมทั้งหมด</div>
            <div className="text-3xl font-bold">{stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-success" /> ส่งสำเร็จ
            </div>
            <div className="text-3xl font-bold text-success">{stats.sent.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.successRate}% ของทั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-danger" /> ล้มเหลว
            </div>
            <div className="text-3xl font-bold text-danger">{stats.failed.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 text-warning" /> ข้าม (Quiet Hours/Pref)
            </div>
            <div className="text-3xl font-bold text-warning">{stats.skipped.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* By channel */}
      <Card>
        <CardHeader><CardTitle className="text-base">สรุปตามช่องทาง</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(stats.byChannel).map(([ch, v]) => {
              const total = v.sent + v.failed;
              const rate = total > 0 ? Math.round((v.sent / total) * 100) : 0;
              return (
                <div key={ch} className="border rounded-lg p-3 bg-card">
                  <div className="text-xs text-muted-foreground">{CHANNEL_LABEL[ch] || ch}</div>
                  <div className="text-lg font-semibold">{v.sent} / {total}</div>
                  <div className="text-xs text-muted-foreground">{rate}% สำเร็จ</div>
                </div>
              );
            })}
            {Object.keys(stats.byChannel).length === 0 && (
              <div className="col-span-5 text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">ช่วงเวลา</label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ช่องทาง</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="in_app">In-App</SelectItem>
                  <SelectItem value="push">PWA Push</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                  <SelectItem value="gchat">Google Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">สถานะ</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="sent">สำเร็จ</SelectItem>
                  <SelectItem value="failed">ล้มเหลว</SelectItem>
                  <SelectItem value="dlq">DLQ</SelectItem>
                  <SelectItem value="skipped">ข้าม</SelectItem>
                  <SelectItem value="gone">Subscription หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ประเภท</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {distinctTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ค้นหา</label>
              <Input
                placeholder="หัวข้อ / user / เหตุผล..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการล่าสุด ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เวลา</TableHead>
                  <TableHead>ช่องทาง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หัวข้อ</TableHead>
                  <TableHead>ผู้รับ</TableHead>
                  <TableHead>เหตุผล</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                )}
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CHANNEL_LABEL[r.channel] || r.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[r.status] || ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.notification_type || "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm">{r.title || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.user_id ? r.user_id.slice(0, 8) : "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">{r.reason || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 200 && (
            <div className="text-xs text-muted-foreground text-center py-3">
              แสดง 200 แถวแรก จากทั้งหมด {filtered.length} แถว — กรองเพิ่มเพื่อดูรายการที่ต้องการ
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
