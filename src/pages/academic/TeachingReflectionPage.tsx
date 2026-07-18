import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ClipboardCheck, BarChart3, Eye, Pencil, Trash2 } from "lucide-react";
import { useTeachingReflections, useReflectionMutations, STATUS_LABEL, STATUS_COLOR, type TeachingReflection } from "@/hooks/useTeachingReflections";
import { useUserRole } from "@/hooks/useUserRole";
import { ReflectionFormDialog } from "@/components/academic/ReflectionFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

export default function TeachingReflectionPage() {
  const { userId, isAdmin, isDirector } = useUserRole();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeachingReflection | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("list");
  const { data: rows = [], isLoading } = useTeachingReflections();
  const { remove } = useReflectionMutations();

  // Fetch teacher name map for teacher_ids used in the list
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.teacher_id).filter(Boolean)));
    if (!ids.length) return;
    (async () => {
      const [{ data: pers }, { data: profs }] = await Promise.all([
        (supabase as any).from("personnel").select("user_id,prefix,first_name,last_name").in("user_id", ids),
        (supabase as any).from("profiles").select("id,prefix,first_name,last_name").in("id", ids),
      ]);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        map[p.id] = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      });
      (pers || []).forEach((p: any) => {
        if (p.user_id) map[p.user_id] = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      });
      setTeacherMap(map);
    })();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!s) return true;
      const tName = (teacherMap[r.teacher_id] || "").toLowerCase();
      return r.lesson_topic.toLowerCase().includes(s) || tName.includes(s);
    });
  }, [rows, search, teacherMap]);

  // ล็อกการแก้ไข/ลบเมื่อหัวหน้าวิชาการ (หรือขั้นสูงกว่า) ลงนามแล้ว
  const LOCKED_STATUSES: TeachingReflection["status"][] = ["academic_signed", "deputy_signed", "director_signed"];
  const isLocked = (r: TeachingReflection) => LOCKED_STATUSES.includes(r.status);
  // แอดมินแก้ไข/ลบได้เสมอ แม้ลงนามแล้ว
  const canManage = (r: TeachingReflection) =>
    isAdmin || (!isLocked(r) && (isDirector || r.teacher_id === userId));

  const stats = useMemo(() => {
    const total = rows.length;
    const avgPass = total ? Math.round(rows.reduce((a, r) => a + Number(r.pass_percent || 0), 0) / total) : 0;
    const pending = rows.filter((r) => !["director_signed", "draft"].includes(r.status)).length;
    const returned = rows.filter((r) => r.status === "returned").length;
    const bySubject: Record<string, number> = {};
    rows.forEach((r) => { const k = r.subject_group || "อื่น ๆ"; bySubject[k] = (bySubject[k] || 0) + 1; });
    const chartSubject = Object.entries(bySubject).map(([name, value]) => ({ name, value }));
    const byDate: Record<string, { d: string; sum: number; n: number }> = {};
    rows.forEach((r) => {
      byDate[r.lesson_date] = byDate[r.lesson_date] || { d: r.lesson_date, sum: 0, n: 0 };
      byDate[r.lesson_date].sum += Number(r.pass_percent || 0);
      byDate[r.lesson_date].n++;
    });
    const trend = Object.values(byDate).sort((a, b) => a.d.localeCompare(b.d))
      .map((x) => ({ date: x.d.slice(5), pct: Math.round(x.sum / x.n) }));
    return { total, avgPass, pending, returned, chartSubject, trend };
  }, [rows]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: TeachingReflection) => { setEditing(r); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> บันทึกหลังการสอน
          </h1>
          <p className="text-sm text-muted-foreground">บันทึกผลการสอน ประเมินผู้เรียน แนบชิ้นงาน และลงนามอนุมัติตามลำดับ</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> บันทึกใหม่
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list"><ClipboardCheck className="w-4 h-4 mr-1" /> รายการ</TabsTrigger>
          <TabsTrigger value="dash"><BarChart3 className="w-4 h-4 mr-1" /> Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3">
          <Input placeholder="ค้นหาหัวข้อ / ชื่อครู..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">วันที่</th>
                  <th className="text-left p-3">หัวข้อ</th>
                  <th className="text-left p-3">ครูผู้บันทึก</th>
                  <th className="text-left p-3">กลุ่มสาระ</th>
                  <th className="text-center p-3">%ผ่าน</th>
                  <th className="text-center p-3">สถานะ</th>
                  <th className="text-right p-3">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">กำลังโหลด...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ยังไม่มีบันทึก</td></tr>}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{r.lesson_date}</td>
                    <td className="p-3 font-medium">{r.lesson_topic}</td>
                    <td className="p-3">{teacherMap[r.teacher_id] || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3">{r.subject_group || "—"}</td>
                    <td className="p-3 text-center font-mono">{Number(r.pass_percent || 0).toFixed(1)}%</td>
                    <td className="p-3 text-center">
                      <Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Link to={`/dashboard/academic/teaching-reflections/${r.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                      </Link>
                      {canManage(r) ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : isLocked(r) ? (
                        <span className="text-xs text-muted-foreground italic" title="หัวหน้าวิชาการลงนามแล้ว ไม่สามารถแก้ไขได้">🔒 ลงนามแล้ว</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="dash" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">บันทึกทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">% ผ่านเฉลี่ย</div><div className="text-2xl font-bold text-emerald-600">{stats.avgPass}%</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">รอลงนาม</div><div className="text-2xl font-bold text-amber-600">{stats.pending}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">ส่งกลับแก้ไข</div><div className="text-2xl font-bold text-red-600">{stats.returned}</div></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">บันทึกตามกลุ่มสาระ</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.chartSubject}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-medium mb-2">แนวโน้ม % ผ่าน</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={stats.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ReflectionFormDialog open={open} onClose={closeDialog} initial={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบบันทึก?</AlertDialogTitle>
            <AlertDialogDescription>
              การดำเนินการนี้จะลบบันทึกหลังการสอนพร้อมชิ้นงานที่แนบและลายเซ็นทั้งหมด และไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
