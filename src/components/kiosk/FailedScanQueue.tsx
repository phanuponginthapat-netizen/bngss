import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { swal } from "@/lib/swal";
import { RefreshCw, Send, Trash2 } from "lucide-react";

type Row = { id: string; payload: any; error: string | null; attempts: number | null; created_at: string };

/** รายการสแกนที่ส่งขึ้นระบบไม่สำเร็จเกิน 10 ครั้ง — ผู้ดูแลส่งใหม่หรือลบได้ */
export default function FailedScanQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("offline_failed_queue" as any) as any)
      .select("id,payload,error,attempts,created_at")
      .eq("queue_name", "face_scan_logs")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Row[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const retry = async (r: Row) => {
    const raw = r.payload?.payload ?? {};
    const { __face_data, ...payload } = raw;
    const { error } = await supabase.from("face_scan_logs").insert(payload as any);
    if (error && error.code !== "23505") {
      swal.error("ส่งไม่สำเร็จ", error.message);
      return;
    }
    await (supabase.from("offline_failed_queue" as any) as any).delete().eq("id", r.id);
    void swal.success(error ? "รายการนี้บันทึกไว้แล้ว" : "ส่งขึ้นระบบแล้ว");
    void load();
  };

  const discard = async (r: Row) => {
    const ok = await swal.confirm({ title: "ลบรายการนี้?", text: "เวลามาเรียนรายการนี้จะไม่ถูกบันทึก", danger: true } as any);
    if (!ok) return;
    await (supabase.from("offline_failed_queue" as any) as any).delete().eq("id", r.id);
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>รายการสแกนที่ส่งไม่สำเร็จ ({rows.length})</CardTitle>
          <CardDescription>สแกนที่ตู้ส่งขึ้นระบบไม่ผ่านครบ 10 ครั้ง ตรวจแล้วกดส่งใหม่หรือลบ</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-1 h-4 w-4" /> รีเฟรช
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีรายการค้าง</p>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map((r) => {
              const p = r.payload?.payload ?? {};
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">{p.scan_date} · {p.scan_type === "exit" ? "ออก" : "เข้า"} · {p.device_label || "-"}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.error}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => retry(r)}><Send className="mr-1 h-4 w-4" />ส่งใหม่</Button>
                    <Button size="sm" variant="outline" onClick={() => discard(r)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
