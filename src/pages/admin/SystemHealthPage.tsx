import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Users, KeyRound, AlertTriangle, Database,
  Zap, ShieldCheck, RefreshCw, CheckCircle2, XCircle, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { swal } from "@/lib/swal";
import { ScrollArea } from "@/components/ui/scroll-area";

type HealthStat = {
  label: string;
  value: string | number;
  status: "ok" | "warn" | "error";
  hint?: string;
};

function StatCard({ icon: Icon, title, stats, loading }: {
  icon: any;
  title: string;
  stats: HealthStat[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : (
          stats.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {s.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                {s.status === "warn" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                {s.status === "error" && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                <span className="truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-semibold">{s.value}</span>
                {s.hint && <span className="text-xs text-muted-foreground">{s.hint}</span>}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemHealthPage() {
  // AI key pool health
  const keys = useQuery({
    queryKey: ["health-keys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_provider_keys_meta" as any)
        .select("provider_type,status,used_today");
      return (data || []) as any[];
    },
    refetchInterval: 30_000,
  });

  // Users active in the last 15 min (distinct users in audit_logs)
  const activeUsers = useQuery({
    queryKey: ["health-active-users"],
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data } = await supabase
        .from("audit_logs")
        .select("user_id")
        .gte("created_at", since)
        .not("user_id", "is", null);
      const set = new Set((data || []).map((r: any) => r.user_id));
      return set.size;
    },
    refetchInterval: 30_000,
  });

  // Recent errors (24h)
  const errors = useQuery({
    queryKey: ["health-errors"],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const { count } = await supabase
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Audit activity (24h)
  const audits = useQuery({
    queryKey: ["health-audits"],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Row counts
  const rowCounts = useQuery({
    queryKey: ["health-rowcounts"],
    queryFn: async () => {
      const [students, personnel, attendance, notifications] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("personnel").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }),
      ]);
      return {
        students: students.count ?? 0,
        personnel: personnel.count ?? 0,
        attendance: attendance.count ?? 0,
        notifications: notifications.count ?? 0,
      };
    },
    refetchInterval: 5 * 60_000,
  });

  // AI pool aggregation
  const poolStats = (() => {
    const list = keys.data || [];
    const byProvider = new Map<string, { total: number; active: number; cooldown: number }>();
    for (const k of list) {
      const p = k.provider_type;
      const row = byProvider.get(p) || { total: 0, active: 0, cooldown: 0 };
      row.total++;
      if (k.status === "active") row.active++;
      if (k.status === "cooldown") row.cooldown++;
      byProvider.set(p, row);
    }
    return Array.from(byProvider.entries()).map(([p, r]) => ({
      label: p,
      value: `${r.active}/${r.total}`,
      status: (r.active === 0 ? "error" : r.cooldown > 0 ? "warn" : "ok") as "ok" | "warn" | "error",
      hint: r.cooldown ? `${r.cooldown} cooldown` : undefined,
    }));
  })();

  const refreshAll = () => {
    keys.refetch();
    activeUsers.refetch();
    errors.refetch();
    audits.refetch();
    rowCounts.refetch();
  };

  const errorCount = errors.data ?? 0;
  const criticalAlert = errorCount > 50 || (poolStats.length > 0 && poolStats.every(p => p.status === "error"));

  // --- Realtime alerts ---
  type LiveEvent = { id: string; ts: string; severity: "warn" | "error"; title: string; detail?: string };
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const lastAdminNotifyRef = useRef<number>(0);

  const pushEvent = (ev: LiveEvent) => {
    setLiveEvents((prev) => [ev, ...prev].slice(0, 25));
  };

  const notifyAdminsThrottled = async (title: string, message: string, type = "system_alert") => {
    const now = Date.now();
    // Throttle DB notify: max 1 per 60 sec per session
    if (now - lastAdminNotifyRef.current < 60_000) return;
    lastAdminNotifyRef.current = now;
    try {
      await supabase.rpc("notify_admins" as any, {
        _title: title,
        _message: message,
        _type: type,
      });
    } catch (err) {
      console.warn("notify_admins failed:", err);
    }
  };

  useEffect(() => {
    const errorChan = supabase
      .channel("health-error-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "error_logs" },
        (payload) => {
          const row: any = payload.new;
          const key = `err-${row.id}`;
          if (notifiedRef.current.has(key)) return;
          notifiedRef.current.add(key);
          const title = row.error_type || row.source || "Error ใหม่";
          const detail = (row.message || row.error_message || "").slice(0, 160);
          pushEvent({
            id: key,
            ts: new Date().toISOString(),
            severity: "error",
            title,
            detail,
          });
          swal.toast.error(`🚨 ${title}`);
          notifyAdminsThrottled(`ระบบพบ Error: ${title}`, detail || "ตรวจสอบใน System Health", "system_error");
          errors.refetch();
        }
      )
      .subscribe();

    const keyChan = supabase
      .channel("health-ai-keys")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_provider_keys" },
        (payload) => {
          const row: any = payload.new;
          const prev: any = payload.old;
          if (prev?.status === row?.status) return;
          const key = `key-${row.id}-${row.status}`;
          if (notifiedRef.current.has(key)) return;
          notifiedRef.current.add(key);
          if (row.status === "error" || row.status === "cooldown") {
            const label = `${row.provider_type} — ${row.label || row.id.slice(0, 6)}`;
            const msg = row.status === "error"
              ? `AI Key ล้มเหลว: ${label}`
              : `AI Key เข้าสู่ cooldown: ${label}`;
            pushEvent({
              id: key,
              ts: new Date().toISOString(),
              severity: row.status === "error" ? "error" : "warn",
              title: msg,
            });
            (row.status === "error" ? swal.toast.error : swal.toast.warning)(msg);
            if (row.status === "error") {
              notifyAdminsThrottled(msg, "ตรวจสอบ AI Key Pool ทันที", "ai_key_down");
            }
          }
          keys.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(errorChan);
      supabase.removeChannel(keyChan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Threshold-based alerts (active users near cap, all providers down)
  const alertedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const au = activeUsers.data ?? 0;
    if (au > 250 && !alertedRef.current.has("au-high")) {
      alertedRef.current.add("au-high");
      swal.toast.warning(`⚠️ ผู้ใช้งาน active ${au} คน ใกล้ขีดจำกัด 300`);
      notifyAdminsThrottled("ผู้ใช้งาน active ใกล้เต็ม", `ขณะนี้มี active ${au} คน`, "capacity_warning");
    }
    if (au <= 200) alertedRef.current.delete("au-high");
  }, [activeUsers.data]);

  useEffect(() => {
    const allDown = poolStats.length > 0 && poolStats.every(p => p.status === "error");
    if (allDown && !alertedRef.current.has("ai-all-down")) {
      alertedRef.current.add("ai-all-down");
      swal.toast.error("🚨 AI provider ทั้งหมดหยุดทำงาน");
      notifyAdminsThrottled("AI provider ทั้งหมดหยุดทำงาน", "ไม่มี key ที่ active ในทุก provider", "ai_pool_down");
    }
    if (!allDown) alertedRef.current.delete("ai-all-down");
  }, [poolStats]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-sm text-muted-foreground">
              ภาพรวมสุขภาพระบบ — รีเฟรชอัตโนมัติทุก 30 วินาที
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
        </Button>
      </div>

      {criticalAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>ต้องดูแลด่วน</AlertTitle>
          <AlertDescription>
            ระบบมีปัญหาสำคัญ — ตรวจสอบ AI Key Pool และ Error Logs ทันที
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          title="ผู้ใช้งาน active (15 นาทีล่าสุด)"
          loading={activeUsers.isLoading}
          stats={[
            {
              label: "Active users",
              value: activeUsers.data ?? 0,
              status: (activeUsers.data ?? 0) > 250 ? "warn" : "ok",
              hint: (activeUsers.data ?? 0) > 250 ? "ใกล้เกิน 300" : undefined,
            },
          ]}
        />

        <StatCard
          icon={AlertTriangle}
          title="Error Logs (24 ชม.)"
          loading={errors.isLoading}
          stats={[
            {
              label: "จำนวน error",
              value: errorCount,
              status: errorCount > 50 ? "error" : errorCount > 10 ? "warn" : "ok",
            },
          ]}
        />

        <StatCard
          icon={ShieldCheck}
          title="Audit Activity (24 ชม.)"
          loading={audits.isLoading}
          stats={[
            {
              label: "การเปลี่ยนแปลงข้อมูล",
              value: audits.data ?? 0,
              status: "ok",
            },
          ]}
        />

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="w-4 h-4 text-primary" />
              AI Key Pool — {poolStats.length} providers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keys.isLoading ? (
              <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
            ) : poolStats.length === 0 ? (
              <div className="text-sm text-muted-foreground">ยังไม่ได้เพิ่ม API key</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {poolStats.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{p.label}</span>
                      <Badge
                        className={
                          p.status === "ok"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.status === "warn"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {p.value}
                      </Badge>
                    </div>
                    {p.hint && <div className="text-xs text-muted-foreground">{p.hint}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <StatCard
          icon={Database}
          title="ปริมาณข้อมูลหลัก"
          loading={rowCounts.isLoading}
          stats={[
            { label: "นักเรียน", value: rowCounts.data?.students ?? 0, status: "ok" },
            { label: "บุคลากร", value: rowCounts.data?.personnel ?? 0, status: "ok" },
            { label: "การเข้าเรียน", value: rowCounts.data?.attendance ?? 0, status: "ok" },
            { label: "แจ้งเตือน", value: rowCounts.data?.notifications ?? 0, status: "ok" },
          ]}
        />
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 text-sm space-y-2">
          <div className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            เกณฑ์แจ้งเตือน
          </div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            <li>Active users &gt; 250 = ⚠️ ใกล้ขีดจำกัด 300 คน</li>
            <li>Error &gt; 50/วัน = 🚨 ต้องตรวจสอบทันที</li>
            <li>AI provider ที่ active = 0 = 🚨 หยุดทำงาน (เพิ่ม key ใหม่)</li>
            <li>Cooldown key = ⚠️ ถูก rate limit ชั่วคราว</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
