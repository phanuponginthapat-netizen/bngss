import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type FaceSync = { faces_loaded?: number; people_loaded?: number; last_sync_at?: string | null; last_error?: string | null; reported_at?: string };
type Device = { device_id: string; name: string | null; agent_version: string | null; last_seen_at: string | null; is_active: boolean | null; meta: { face_sync?: FaceSync } | null };

const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }) : "—";

export default function FaceSyncStatusTab() {
  const q = useQuery({
    queryKey: ["face-sync-status"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [dev, cloud] = await Promise.all([
        supabase.from("kiosk_devices").select("device_id,name,agent_version,last_seen_at,is_active,meta").not("device_key", "is", null).order("device_id"),
        supabase.from("student_face_descriptors").select("id", { count: "exact", head: true }),
      ]);
      if (dev.error) throw dev.error;
      if (cloud.error) throw cloud.error;
      return { devices: (dev.data ?? []) as unknown as Device[], cloudCount: cloud.count ?? 0 };
    },
  });

  if (q.isLoading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (q.error) return <div className="space-y-2"><p className="text-destructive">อ่านสถานะตู้ไม่สำเร็จ</p><Button variant="outline" onClick={() => q.refetch()}>ลองใหม่</Button></div>;
  const { devices, cloudCount } = q.data!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ข้อมูลใบหน้าบน Cloud: <b className="text-foreground">{cloudCount}</b> ชุด</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className="mr-2 h-4 w-4" />รีเฟรช</Button>
      </div>
      {devices.length === 0 && <p className="text-muted-foreground">ยังไม่มีตู้สแกนที่ลงทะเบียน</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {devices.map((d) => {
          const fs = d.meta?.face_sync;
          const online = d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 10 * 60000;
          const status = !fs ? { label: "ตู้ยังไม่รายงาน (ต้องอัปเดตโปรแกรม 1.14.2)", v: "secondary" as const }
            : fs.last_error ? { label: "ซิงค์ล้มเหลว", v: "destructive" as const }
            : (fs.faces_loaded ?? 0) === 0 ? { label: "ไม่มีใบหน้าในเครื่อง", v: "destructive" as const }
            : (fs.faces_loaded ?? 0) < cloudCount ? { label: "ซิงค์ยังไม่ครบ", v: "secondary" as const }
            : { label: "ซิงค์ครบ", v: "default" as const };
          return (
            <Card key={d.device_id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{d.name || d.device_id}</span>
                  <Badge variant={status.v}>{status.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>สถานะ: {online ? "ออนไลน์" : "ออฟไลน์"} · ล่าสุด {fmt(d.last_seen_at)}</p>
                <p>รุ่นโปรแกรม: {d.agent_version || "—"}</p>
                <p>ใบหน้าในเครื่อง: <b>{fs?.faces_loaded ?? "—"}</b> / {cloudCount} ชุด ({fs?.people_loaded ?? "—"} คน)</p>
                <p>ซิงค์สำเร็จล่าสุด: {fmt(fs?.last_sync_at)}</p>
                {fs?.last_error && <p className="text-destructive break-words">ข้อผิดพลาด: {fs.last_error}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
