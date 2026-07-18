import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, GraduationCap, Trash2, Send, Move, Loader2 } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

type Student = { id: string; first_name: string; last_name: string; classroom_id: string | null; status: string; classrooms?: { grade_level: string; name: string } | null };
type Personnel = { id: string; first_name: string; last_name: string; position: string | null };
type Classroom = { id: string; name: string; grade_level: string };

export default function BulkOperationsPage() {
  const [tab, setTab] = useState("students");

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">การจัดการแบบกลุ่ม (Bulk Operations)</h1>
        <p className="text-muted-foreground text-sm mt-1">เลือกและจัดการข้อมูลหลายรายการพร้อมกัน</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="students"><Users className="w-4 h-4 mr-2" />นักเรียน</TabsTrigger>
          <TabsTrigger value="personnel"><GraduationCap className="w-4 h-4 mr-2" />บุคลากร</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <BulkStudents />
        </TabsContent>
        <TabsContent value="personnel" className="mt-4">
          <BulkPersonnel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BulkStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, classroom_id, status, classrooms:classroom_id(grade_level, name)").limit(2000),
      supabase.from("classrooms").select("id, name, grade_level").order("grade_level"),
    ]);
    setStudents(((s.data as unknown) as Student[]) || []);
    setClassrooms((c.data as Classroom[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter((s) => {
    if (gradeFilter !== "all" && s.classrooms?.grade_level !== gradeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const full = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (!full.includes(q)) return false;
    }
    return true;
  });

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((s) => next.delete(s.id));
    else filtered.forEach((s) => next.add(s.id));
    setSelected(next);
  };
  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const grades = Array.from(new Set(students.map((s) => s.classrooms?.grade_level).filter(Boolean) as string[])).sort();

  const bulkMoveClassroom = async () => {
    if (!moveTo || selected.size === 0) return toast.error("เลือกห้องเรียนและนักเรียน");
    setBusy(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("students").update({ classroom_id: moveTo }).in("id", ids);
    setBusy(false);
    if (error) return toast.error("ย้ายไม่สำเร็จ: " + error.message);
    toast.success(`ย้ายนักเรียน ${ids.length} คนเรียบร้อย`);
    logAudit({ action: "bulk_move_students", target_table: "students", details: { count: ids.length, classroom_id: moveTo } });
    setSelected(new Set());
    load();
  };

  const bulkChangeStatus = async () => {
    if (!newStatus || selected.size === 0) return toast.error("เลือกสถานะและนักเรียน");
    setBusy(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("students").update({ status: newStatus }).in("id", ids);
    setBusy(false);
    if (error) return toast.error("ไม่สำเร็จ: " + error.message);
    toast.success(`อัปเดตสถานะ ${ids.length} คนเรียบร้อย`);
    logAudit({ action: "bulk_status_students", target_table: "students", details: { count: ids.length, status: newStatus } });
    setSelected(new Set());
    load();
  };

  const bulkSendNotification = async () => {
    const message = window.prompt("ข้อความที่จะส่งให้นักเรียนที่เลือก:");
    if (!message || selected.size === 0) return;
    setBusy(true);
    // หา auth_user_id
    const ids = Array.from(selected);
    const { data: studs } = await supabase.from("students").select("id, auth_user_id, first_name").in("id", ids);
    const rows = (studs || [])
      .filter((s: any) => s.auth_user_id)
      .map((s: any) => ({
        user_id: s.auth_user_id,
        title: "ประกาศจากโรงเรียน",
        message,
        item_type: "notification",
        priority: "normal",
      }));
    if (rows.length === 0) {
      setBusy(false);
      return toast.error("ไม่มีนักเรียนที่มีบัญชีในระบบ");
    }
    const { error } = await supabase.from("inbox_items").insert(rows as any);
    setBusy(false);
    if (error) return toast.error("ส่งไม่สำเร็จ: " + error.message);
    toast.success(`ส่งแจ้งเตือนให้ ${rows.length} คนเรียบร้อย`);
    logAudit({ action: "bulk_notify_students", target_table: "inbox_items", details: { count: rows.length } });
    setSelected(new Set());
  };

  if (loading) return <Card><CardContent className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ตัวกรองและค้นหา</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="ค้นหาชื่อ-นามสกุล..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับชั้น</SelectItem>
              {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">เลือกแล้ว <Badge>{selected.size}</Badge> รายการ</div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>ล้างการเลือก</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex gap-2">
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger><SelectValue placeholder="ย้ายไปห้อง..." /></SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => <SelectItem key={c.id} value={c.id}>{c.grade_level} / {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={bulkMoveClassroom} disabled={busy}><Move className="w-4 h-4 mr-1" />ย้าย</Button>
              </div>
              <div className="flex gap-2">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue placeholder="เปลี่ยนสถานะ..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">กำลังศึกษา</SelectItem>
                    <SelectItem value="graduated">จบการศึกษา</SelectItem>
                    <SelectItem value="resigned">ลาออก</SelectItem>
                    <SelectItem value="transferred">ย้ายโรงเรียน</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={bulkChangeStatus} disabled={busy} variant="secondary">อัปเดต</Button>
              </div>
              <Button onClick={bulkSendNotification} disabled={busy} variant="outline">
                <Send className="w-4 h-4 mr-1" />ส่งแจ้งเตือน
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                  <th className="p-2 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-2 text-left">ระดับชั้น</th>
                  <th className="p-2 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/50">
                    <td className="p-2"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} /></td>
                    <td className="p-2">{s.first_name} {s.last_name}</td>
                    <td className="p-2">{s.classrooms?.grade_level || "-"} {s.classrooms?.name ? `/ ${s.classrooms.name}` : ""}</td>
                    <td className="p-2"><Badge variant="outline">{s.status}</Badge></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">ไม่พบข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BulkPersonnel() {
  const [items, setItems] = useState<Personnel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("personnel").select("id, first_name, last_name, position").limit(2000);
      setItems((data as Personnel[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = items.filter((p) => {
    if (!search) return true;
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase());
  });

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => {
    const n = new Set(selected);
    if (allChecked) filtered.forEach((s) => n.delete(s.id));
    else filtered.forEach((s) => n.add(s.id));
    setSelected(n);
  };

  const sendNotify = async () => {
    const message = window.prompt("ข้อความที่จะส่งให้บุคลากรที่เลือก:");
    if (!message || selected.size === 0) return;
    setBusy(true);
    const ids = Array.from(selected);
    const { data: ps } = await supabase.from("personnel").select("auth_user_id").in("id", ids);
    const rows = (ps || [])
      .filter((p: any) => p.auth_user_id)
      .map((p: any) => ({
        user_id: p.auth_user_id,
        title: "ประกาศจากผู้บริหาร",
        message,
        item_type: "notification",
        priority: "normal",
      }));
    if (rows.length === 0) {
      setBusy(false);
      return toast.error("ไม่มีบุคลากรที่มีบัญชีในระบบ");
    }
    const { error } = await supabase.from("inbox_items").insert(rows as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`ส่งแจ้งเตือน ${rows.length} ราย`);
    logAudit({ action: "bulk_notify_personnel", target_table: "inbox_items", details: { count: rows.length } });
    setSelected(new Set());
  };

  if (loading) return <Card><CardContent className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <Input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>เลือกแล้ว <Badge>{selected.size}</Badge> รายการ</div>
            <div className="flex gap-2">
              <Button onClick={sendNotify} disabled={busy}><Send className="w-4 h-4 mr-1" />ส่งแจ้งเตือน</Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>ล้าง</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 w-10"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>
                  <th className="p-2 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-2 text-left">ตำแหน่ง</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/50">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => {
                          const n = new Set(selected);
                          n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                          setSelected(n);
                        }}
                      />
                    </td>
                    <td className="p-2">{p.first_name} {p.last_name}</td>
                    <td className="p-2 text-muted-foreground">{p.position || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}