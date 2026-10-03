import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { swal } from "@/lib/swal";
import { formatThaiLongTime } from "@/lib/dateBE";
import { Link2, Unlink, Wifi } from "lucide-react";

type Status = { linked: boolean; hub_url: string | null; school_code: string | null; linked_at: string | null };

/** ฝั่งโรงเรียน: เชื่อมกับระบบหลักของเขต เพื่อส่งตัวเลขสรุปทุกคืน */
export default function DistrictHubLinkCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [f, setF] = useState({ hub_url: "", school_code: "", enrollment_code: "" });
  const [busy, setBusy] = useState(false);
  const deployMode = ((window as any).__BNG_CONFIG__?.DEPLOY_MODE as string) || "cloud";

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("district-feed-api/hub/link", { body });
    if (error) throw error;
    return data;
  };
  const load = async () => { try { setSt(await call({ action: "status" })); } catch { setSt(null); } };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { swal.error("ไม่สำเร็จ", e?.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">เชื่อมระบบเขต</CardTitle>
        {st?.linked ? <Badge>เชื่อมแล้ว</Badge> : <Badge variant="secondary">ยังไม่เชื่อม</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ส่งเฉพาะตัวเลขสรุป (จำนวนนักเรียน การมาเรียน ผลการเรียนรวม) ขึ้นระบบหลักทุกคืน ถ้าเน็ตหลุดจะส่งให้เองเมื่อเน็ตกลับมา
        </p>
        {st?.linked ? (
          <>
            <div className="text-sm">ระบบหลัก: <b>{st.hub_url}</b><br />รหัสโรงเรียน: <b>{st.school_code}</b>
              {st.linked_at && <><br />เชื่อมเมื่อ: {formatThaiLongTime(st.linked_at)}</>}</div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => run(async () => { await call({ action: "test" }); swal.success("ติดต่อระบบหลักได้"); })}>
                <Wifi className="mr-1 h-4 w-4" />ทดสอบ
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run(async () => {
                const ok = await swal.confirm({ title: "ยกเลิกการเชื่อมระบบเขต?", danger: true });
                if (!ok) return;
                await call({ action: "unlink" }); load();
              })}><Unlink className="mr-1 h-4 w-4" />ยกเลิกการเชื่อม</Button>
            </div>
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-4">
            <Input className="sm:col-span-2" placeholder="URL ระบบหลัก เช่น https://xxxx.supabase.co" value={f.hub_url} onChange={(e) => setF({ ...f, hub_url: e.target.value })} />
            <Input placeholder="รหัสโรงเรียน" value={f.school_code} onChange={(e) => setF({ ...f, school_code: e.target.value })} />
            <Input placeholder="รหัสลงทะเบียนจากเขต" value={f.enrollment_code} onChange={(e) => setF({ ...f, enrollment_code: e.target.value.toUpperCase() })} />
            <Button className="sm:col-span-4" disabled={busy} onClick={() => run(async () => {
              await call({ action: "link", ...f, deploy_type: deployMode });
              swal.success("เชื่อมระบบเขตแล้ว"); load();
            })}><Link2 className="mr-1 h-4 w-4" />เชื่อมระบบเขต</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
