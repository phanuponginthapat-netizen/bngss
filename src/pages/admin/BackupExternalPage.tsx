import { useEffect, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, RefreshCw, ShieldCheck, AlertTriangle, Copy, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getBackendConfig } from "@/lib/runtimeConfig";

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS public.backup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  row_count int,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_backup_table_date
  ON public.backup_snapshots(table_name, snapshot_date DESC);`;

export default function BackupExternalPage() {
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [last, setLast] = useState<any>(null);

  const downloadZip = async () => {
    setZipLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${getBackendConfig().url}/functions/v1/backup-snapshot`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: getBackendConfig().anonKey,
        },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `school-backup-${todayBangkok()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("ดาวน์โหลด ZIP สำเร็จ");
    } catch (e: any) {
      toast.error(`ดาวน์โหลดล้มเหลว: ${e.message ?? e}`);
    } finally {
      setZipLoading(false);
    }
  };

  const loadLast = async () => {
    const { data } = await supabase
      .from("school_settings")
      .select("setting_value, updated_at")
      .eq("setting_key", "last_external_backup")
      .maybeSingle();
    if (data?.setting_value) {
      try { setLast({ ...JSON.parse(data.setting_value), updated_at: data.updated_at }); } catch { setLast(null); }
    }
  };

  useEffect(() => { loadLast(); }, []);

  const runBackup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-external", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`สำรองข้อมูลสำเร็จ: ${(data as any).ok} ตาราง / ผิดพลาด ${(data as any).failed}`);
      await loadLast();
    } catch (e: any) {
      toast.error(`สำรองล้มเหลว: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">สำรองข้อมูลไป Supabase ภายนอก</h1>
          <p className="text-sm text-muted-foreground">ป้องกัน Lovable Cloud เสียหาย โดยสำรองข้อมูลเป็นชั้นที่สอง</p>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>การตั้งค่าเบื้องต้น</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>1. สร้างโปรเจกต์ Supabase ใหม่ที่ supabase.com (แยกจาก Lovable Cloud)</p>
          <p>2. คัดลอก <b>Project URL</b> และ <b>service_role key</b> ใส่ใน Secrets แล้ว ✓</p>
          <p>3. ไปที่ SQL Editor ของ Supabase ภายนอกแล้วรัน SQL ด้านล่างนี้ครั้งเดียว:</p>
          <div className="relative mt-2">
            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{CREATE_TABLE_SQL}</pre>
            <Button size="sm" variant="ghost" className="absolute top-2 right-2"
              onClick={() => { navigator.clipboard.writeText(CREATE_TABLE_SQL); toast.success("คัดลอกแล้ว"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>สำรองข้อมูลทันที</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runBackup} disabled={loading} size="lg">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "กำลังสำรอง..." : "เริ่มสำรองข้อมูลตอนนี้"}
          </Button>
          <p className="text-xs text-muted-foreground">
            ระบบจะสำรองอัตโนมัติทุกคืน (ผ่าน cron) — ปุ่มนี้สำหรับสำรองด้วยตนเอง
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> ดาวน์โหลด Snapshot ฉุกเฉิน (ZIP/CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ดาวน์โหลดข้อมูลทั้งโรงเรียนเป็นไฟล์ ZIP ที่รวม CSV ของทุกตารางหลัก — ใช้สำหรับเก็บไฟล์ออฟไลน์หรือย้ายข้อมูล
          </p>
          <Button onClick={downloadZip} disabled={zipLoading} size="lg">
            <Download className={`h-4 w-4 mr-2 ${zipLoading ? "animate-pulse" : ""}`} />
            {zipLoading ? "กำลังสร้างไฟล์..." : "ดาวน์โหลด ZIP ตอนนี้"}
          </Button>
        </CardContent>
      </Card>


      {last && (
        <Card>
          <CardHeader>
            <CardTitle>สำรองครั้งล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap text-sm">
              <Badge variant="outline">วันที่ snapshot: {last.snapshot_date}</Badge>
              <Badge variant="outline">เวลา: {last.ran_at && new Date(last.ran_at).toLocaleString("th-TH")}</Badge>
              <Badge className="bg-green-600">สำเร็จ {last.ok ?? 0}</Badge>
              {last.failed > 0 && <Badge variant="destructive">ผิดพลาด {last.failed}</Badge>}
            </div>
            <div className="border rounded divide-y max-h-96 overflow-y-auto text-sm">
              {(last.results ?? []).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono">{r.table}</span>
                  {r.ok ? (
                    <span className="text-green-600 text-xs">{r.rows} แถว ✓</span>
                  ) : (
                    <span className="text-destructive text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
