import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Swal from "sweetalert2";
import { swal } from "@/lib/swal";
import { formatThaiLongTime } from "@/lib/dateBE";
import { Download, KeyRound, Plus, RefreshCw } from "lucide-react";

type School = {
  id: string; school_code: string; school_name: string; area_name: string | null; province: string | null;
  deploy_type: string; status: string; last_seen_at: string | null; enrolled_at: string | null; app_version: string | null;
};
type Snap = { school_id: string; snapshot_date: string; payload: any };

const DEPLOY_LABEL: Record<string, string> = { cloud: "Cloud", standalone: "ในโรงเรียน", hybrid: "แบบผสม" };

function pick(p: any) {
  const st = p?.kpi?.students ?? {};
  const att = p?.attendance ?? {};
  return {
    students: Number(st.total ?? st.count ?? 0),
    personnel: Number(p?.kpi?.personnel?.total ?? p?.kpi?.personnel?.count ?? 0),
    attendRate: att.rate ?? att.present_rate ?? null,
    gpa: p?.grading?.avg_gpa ?? p?.grading?.gpa ?? null,
  };
}

export default function DistrictHubPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [snaps, setSnaps] = useState<Record<string, Snap>>({});
  const [form, setForm] = useState({ school_code: "", school_name: "", area_name: "", province: "", deploy_type: "standalone" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const [{ data: s }, { data: sn }] = await Promise.all([
      supabase.from("district_hub_schools" as any)
        .select("id,school_code,school_name,area_name,province,deploy_type,status,last_seen_at,enrolled_at,app_version")
        .order("school_code"),
      supabase.from("district_hub_snapshots" as any).select("school_id,snapshot_date,payload")
        .gte("snapshot_date", since).order("snapshot_date", { ascending: false }).limit(2000),
    ]);
    setSchools((s as any) ?? []);
    const latest: Record<string, Snap> = {};
    for (const r of ((sn as any) ?? []) as Snap[]) if (!latest[r.school_id]) latest[r.school_id] = r;
    setSnaps(latest);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("district-feed-api/hub/admin", { body });
    if (error) throw error;
    return data;
  };

  const addSchool = async () => {
    try {
      await call({ action: "upsert_school", ...form });
      setForm({ school_code: "", school_name: "", area_name: "", province: "", deploy_type: "standalone" });
      swal.success("บันทึกโรงเรียนแล้ว");
      load();
    } catch (e: any) { swal.error("ผิดพลาด", e?.message); }
  };

  const issue = async (s: School) => {
    try {
      const r = await call({ action: "issue_code", school_id: s.id });
      await Swal.fire({
        title: "รหัสลงทะเบียน",
        html: `<p>ให้โรงเรียน <b>${s.school_name}</b> ใส่ในหน้า "เชื่อมระบบเขต"</p>
          <p style="font-size:1.6rem;font-family:monospace;margin:12px 0">${r.enrollment_code}</p>
          <p>รหัสโรงเรียน: <b>${s.school_code}</b> · ใช้ได้ครั้งเดียว หมดอายุใน 7 วัน</p>`,
        icon: "info",
      });
      load();
    } catch (e: any) { swal.error("ผิดพลาด", e?.message); }
  };

  const toggle = async (s: School) => {
    try { await call({ action: "set_status", school_id: s.id, status: s.status === "disabled" ? "active" : "disabled" }); load(); }
    catch (e: any) { swal.error("ผิดพลาด", e?.message); }
  };

  const stale = (s: School) => !s.last_seen_at || Date.now() - new Date(s.last_seen_at).getTime() > 2 * 86400_000;

  const totals = useMemo(() => {
    let students = 0, personnel = 0;
    for (const s of schools) { const k = pick(snaps[s.id]?.payload); students += k.students; personnel += k.personnel; }
    return { students, personnel, staleCount: schools.filter((s) => s.status === "active" && stale(s)).length };
  }, [schools, snaps]);

  const exportExcel = () => {
    const rows = schools.map((s) => {
      const k = pick(snaps[s.id]?.payload);
      return {
        รหัสโรงเรียน: s.school_code, ชื่อโรงเรียน: s.school_name, เขต: s.area_name ?? "", จังหวัด: s.province ?? "",
        รูปแบบ: DEPLOY_LABEL[s.deploy_type] ?? s.deploy_type, นักเรียน: k.students, บุคลากร: k.personnel,
        "อัตรามาเรียน (%)": k.attendRate ?? "", "เกรดเฉลี่ย": k.gpa ?? "",
        ข้อมูลล่าสุด: snaps[s.id]?.snapshot_date ?? "", ติดต่อล่าสุด: s.last_seen_at ? formatThaiLongTime(s.last_seen_at) : "",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "ภาพรวมเขต");
    XLSX.writeFile(wb, `ภาพรวมเขต_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวมเขตพื้นที่</h1>
          <p className="text-sm text-muted-foreground">ข้อมูลสรุปจากทุกโรงเรียน (ทั้ง Cloud และติดตั้งในโรงเรียน) ไม่มีข้อมูลรายบุคคล</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-1 h-4 w-4" />รีเฟรช</Button>
          <Button onClick={exportExcel}><Download className="mr-1 h-4 w-4" />ดาวน์โหลด Excel</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">โรงเรียน</div><div className="text-2xl font-bold">{schools.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">นักเรียนรวม</div><div className="text-2xl font-bold">{totals.students.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">บุคลากรรวม</div><div className="text-2xl font-bold">{totals.personnel.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">ไม่ส่งข้อมูลเกิน 2 วัน</div><div className="text-2xl font-bold text-destructive">{totals.staleCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">เพิ่มโรงเรียน</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-6">
          <Input placeholder="รหัสโรงเรียน" value={form.school_code} onChange={(e) => setForm({ ...form, school_code: e.target.value })} />
          <Input className="sm:col-span-2" placeholder="ชื่อโรงเรียน" value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} />
          <Input placeholder="เขตพื้นที่" value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} />
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={form.deploy_type} onChange={(e) => setForm({ ...form, deploy_type: e.target.value })}>
            <option value="standalone">ติดตั้งในโรงเรียน</option><option value="hybrid">แบบผสม</option><option value="cloud">Cloud</option>
          </select>
          <Button onClick={addSchool}><Plus className="mr-1 h-4 w-4" />บันทึก</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>โรงเรียน</TableHead><TableHead>รูปแบบ</TableHead><TableHead className="text-right">นักเรียน</TableHead>
              <TableHead className="text-right">มาเรียน %</TableHead><TableHead>ติดต่อล่าสุด</TableHead><TableHead>สถานะ</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {schools.map((s) => {
                const k = pick(snaps[s.id]?.payload);
                return (
                  <TableRow key={s.id}>
                    <TableCell><div className="font-medium">{s.school_name}</div><div className="text-xs text-muted-foreground">{s.school_code} · {s.area_name ?? "-"}</div></TableCell>
                    <TableCell>{DEPLOY_LABEL[s.deploy_type] ?? s.deploy_type}</TableCell>
                    <TableCell className="text-right">{k.students.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{k.attendRate ?? "-"}</TableCell>
                    <TableCell className={stale(s) && s.status === "active" ? "text-destructive" : ""}>{s.last_seen_at ? formatThaiLongTime(s.last_seen_at) : "ยังไม่เคยส่ง"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : s.status === "disabled" ? "destructive" : "secondary"}>
                        {s.status === "active" ? "เชื่อมแล้ว" : s.status === "disabled" ? "ปิด" : "รอลงทะเบียน"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => issue(s)}><KeyRound className="mr-1 h-3 w-3" />ออกรหัส</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.status === "disabled" ? "เปิด" : "ปิด"}</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {schools.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">ยังไม่มีโรงเรียน</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
