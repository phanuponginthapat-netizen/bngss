import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatThaiLongTime } from "@/lib/dateBE";
import { swal } from "@/lib/swal";
const showError = (m: string) => swal.error("ผิดพลาด", m);
const showSuccess = (m: string) => swal.success(m);
const formatThaiDateTime = formatThaiLongTime;
import { RefreshCw, Play, Eye, RotateCw } from "lucide-react";

type Run = {
  id: string; status: string; started_at: string; finished_at: string | null;
  duration_ms: number | null; schools_processed: number | null; schools_failed: number | null;
  results: any; error: string | null; triggered_by: string | null;
};

type Outbox = {
  id: string; endpoint: string; status: string; attempts: number; max_attempts: number;
  next_attempt_at: string; last_attempt_at: string | null; last_status_code: number | null;
  last_error: string | null; response_body: string | null; payload: any; created_at: string;
};

const statusColor = (s: string) => ({
  success: "bg-emerald-500", running: "bg-sky-500", partial: "bg-amber-500",
  failed: "bg-rose-500", dead: "bg-zinc-800", pending: "bg-slate-400", sending: "bg-sky-500",
}[s] ?? "bg-slate-400");

export default function DistrictSyncPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [outbox, setOutbox] = useState<Outbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ title: string; data: any } | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: o }] = await Promise.all([
      supabase.from("district_snapshot_runs").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("district_feed_outbox").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setRuns((r as any) ?? []);
    setOutbox((o as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runSnapshot = async () => {
    try {
      const { error } = await supabase.functions.invoke("district-nightly-snapshot", { body: {} });
      if (error) throw error;
      showSuccess("เริ่มสร้าง snapshot แล้ว");
      setTimeout(load, 2000);
    } catch (e: any) { showError(e?.message ?? "รันไม่สำเร็จ"); }
  };
  const runWorker = async (id?: string) => {
    try {
      const { error } = await supabase.functions.invoke("district-outbox-worker", { body: id ? { id } : {} });
      if (error) throw error;
      showSuccess(id ? "ลองส่งใหม่แล้ว" : "รัน worker แล้ว");
      setTimeout(load, 1500);
    } catch (e: any) { showError(e?.message ?? "รันไม่สำเร็จ"); }
  };
  const requeue = async (id: string) => {
    const { error } = await supabase.from("district_feed_outbox").update({
      status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null,
    }).eq("id", id);
    if (error) return showError(error.message);
    showSuccess("จัดคิวใหม่แล้ว");
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">District Sync Dashboard</h1>
          <p className="text-sm text-muted-foreground">สถานะการซิงก์ข้อมูลไปยังส่วนกลาง (snapshot รายคืน + คิวส่งข้อมูล)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" />รีเฟรช</Button>
          <Button onClick={runSnapshot}><Play className="w-4 h-4 mr-1" />รัน Snapshot เดี๋ยวนี้</Button>
          <Button variant="secondary" onClick={() => runWorker()}><RotateCw className="w-4 h-4 mr-1" />รัน Worker</Button>
        </div>
      </div>

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Snapshot Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="outbox">Outbox / คิวส่ง ({outbox.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader><CardTitle>ประวัติการรัน snapshot</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b">
                  <tr>
                    <th className="p-2">สถานะ</th><th className="p-2">เริ่ม</th><th className="p-2">จบ</th>
                    <th className="p-2">ระยะเวลา</th><th className="p-2">โรงเรียน (สำเร็จ/ล้มเหลว)</th>
                    <th className="p-2">โดย</th><th className="p-2 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="p-2"><Badge className={`${statusColor(r.status)} text-white`}>{r.status}</Badge></td>
                      <td className="p-2">{formatThaiDateTime(r.started_at)}</td>
                      <td className="p-2">{r.finished_at ? formatThaiDateTime(r.finished_at) : "—"}</td>
                      <td className="p-2">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                      <td className="p-2">
                        {(r.schools_processed ?? 0) - (r.schools_failed ?? 0)} / <span className="text-rose-600">{r.schools_failed ?? 0}</span>
                      </td>
                      <td className="p-2">{r.triggered_by ?? "—"}</td>
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setViewer({ title: `Run ${r.id.slice(0, 8)}`, data: r.error ? { error: r.error, results: r.results } : r.results })}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {runs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ยังไม่มีการรัน</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbox">
          <Card>
            <CardHeader><CardTitle>คิวการส่งข้อมูล (retry + dead-letter)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b">
                  <tr>
                    <th className="p-2">สถานะ</th><th className="p-2">ปลายทาง</th>
                    <th className="p-2">ครั้งที่</th><th className="p-2">รอบถัดไป</th>
                    <th className="p-2">HTTP</th><th className="p-2">Error</th>
                    <th className="p-2 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {outbox.map((o) => (
                    <tr key={o.id} className="border-b hover:bg-muted/40">
                      <td className="p-2"><Badge className={`${statusColor(o.status)} text-white`}>{o.status}</Badge></td>
                      <td className="p-2 max-w-[280px] truncate" title={o.endpoint}>{o.endpoint}</td>
                      <td className="p-2">{o.attempts}/{o.max_attempts}</td>
                      <td className="p-2">{formatThaiDateTime(o.next_attempt_at)}</td>
                      <td className="p-2">{o.last_status_code ?? "—"}</td>
                      <td className="p-2 max-w-[240px] truncate text-rose-600" title={o.last_error ?? ""}>{o.last_error ?? "—"}</td>
                      <td className="p-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewer({ title: `Outbox ${o.id.slice(0, 8)}`, data: { payload: o.payload, response: o.response_body } })}><Eye className="w-4 h-4" /></Button>
                        {o.status !== "success" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => runWorker(o.id)}>ลองใหม่</Button>
                            {o.status === "dead" && <Button size="sm" variant="secondary" onClick={() => requeue(o.id)}>Requeue</Button>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {outbox.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ไม่มีรายการในคิว</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewer} onOpenChange={(v) => !v && setViewer(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>{viewer?.title}</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto whitespace-pre-wrap break-words">
            {viewer ? JSON.stringify(viewer.data, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
