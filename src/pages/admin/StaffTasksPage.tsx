import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardList, Send, Loader2, Trash2, Users, CheckCircle2, Clock, AlertTriangle, ImagePlus, X } from "lucide-react";
import { TaskAttachmentViewer } from "@/components/tasks/TaskAttachmentViewer";

type Priority = "high" | "normal" | "low";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "ด่วนมาก",
  normal: "ปกติ",
  low: "ไม่เร่งด่วน",
};

const priorityOf = (notes: string | null): Priority =>
  notes === "high" || notes === "low" ? notes : "normal";

export default function StaffTasksPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const userId = user?.id ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: personnel = [], isPending: loadingPeople } = useQuery({
    queryKey: ["staff-tasks-personnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, user_id, prefix, first_name, last_name, position_title, department, status")
        .not("user_id", "is", null)
        .order("first_name");
      if (error) throw error;
      return (data || []).filter((p: any) => !p.status || p.status === "active");
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["staff-tasks-sent", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("assigned_by", userId!)
        .eq("task_type", "assignment")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    personnel.forEach((p: any) =>
      map.set(p.user_id, `${p.prefix || ""}${p.first_name} ${p.last_name}`.trim()),
    );
    return map;
  }, [personnel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personnel;
    return personnel.filter((p: any) =>
      `${p.prefix || ""}${p.first_name} ${p.last_name} ${p.position_title || ""} ${p.department || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [personnel, search]);

  const toggle = (uid: string) =>
    setSelected((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));

  const toggleAll = () =>
    setSelected((s) =>
      s.length === filtered.length ? [] : filtered.map((p: any) => p.user_id as string),
    );

  const submit = async () => {
    if (!userId) return toast.error("ยังไม่ได้เข้าสู่ระบบ");
    if (!title.trim()) return toast.error("กรอกชื่องานก่อน");
    if (selected.length === 0) return toast.error("เลือกบุคลากรอย่างน้อย 1 คน");

    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = selected.map((uid) => ({
        title: title.trim(),
        description: description.trim() || null,
        task_type: "assignment",
        status: "pending",
        assigned_by: userId,
        assigned_to_user_id: uid,
        assigned_date: today,
        due_date: dueDate || null,
        notes: priority,
      }));

      const { error } = await supabase.from("task_assignments").insert(rows);
      if (error) throw error;

      // แจ้งเตือนในระบบ (ถ้าสิทธิ์ไม่พอ ให้ข้ามไปโดยไม่ล้มงาน)
      try {
        await supabase.from("notifications").insert(
          selected.map((uid) => ({
            user_id: uid,
            title: "งานใหม่จากผู้อำนวยการ",
            message: title.trim(),
            type: "task",
            reference_type: "task_assignment",
          })),
        );
      } catch {
        /* ignore */
      }

      toast.success(`มอบหมายงานให้ ${selected.length} คนแล้ว`);
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("normal");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["staff-tasks-sent"] });
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (id: string) => {
    const { error } = await supabase.from("task_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบงานแล้ว");
    qc.invalidateQueries({ queryKey: ["staff-tasks-sent"] });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />เสร็จสิ้น</Badge>;
      case "in_progress":
        return <Badge className="bg-primary/10 text-primary border-0 text-[10px]"><Clock className="w-3 h-3 mr-1" />กำลังดำเนินการ</Badge>;
      case "overdue":
        return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />เลยกำหนด</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><Clock className="w-3 h-3 mr-1" />รอดำเนินการ</Badge>;
    }
  };

  const summary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t: any) => t.status === "completed").length;
    const doing = tasks.filter((t: any) => t.status === "in_progress").length;
    return { total, done, doing, pending: total - done - doing };
  }, [tasks]);

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-warning flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold">สั่งงานบุคลากร</h1>
          <p className="text-xs text-muted-foreground">
            มอบหมายงานให้ครูและบุคลากร พร้อมติดตามสถานะการดำเนินงาน
          </p>
        </div>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList>
          <TabsTrigger value="new">มอบหมายงานใหม่</TabsTrigger>
          <TabsTrigger value="track">ติดตามงาน ({summary.total})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">รายละเอียดงาน</CardTitle>
                <CardDescription className="text-xs">กรอกข้อมูลงานที่ต้องการมอบหมาย</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>ชื่องาน *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น จัดทำรายงาน SAR ประจำปี" />
                </div>
                <div className="space-y-1">
                  <Label>รายละเอียด</Label>
                  <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="อธิบายขอบเขตงาน ผลลัพธ์ที่ต้องการ" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>กำหนดส่ง</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>ความสำคัญ</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">ด่วนมาก</SelectItem>
                        <SelectItem value="normal">ปกติ</SelectItem>
                        <SelectItem value="low">ไม่เร่งด่วน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={submit} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  มอบหมายงาน ({selected.length} คน)
                </Button>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" /> เลือกบุคลากร
                </CardTitle>
                <CardDescription className="text-xs">
                  เลือกได้หลายคน · ทั้งหมด {personnel.length} คน
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / ตำแหน่ง / ฝ่าย" />
                <Button variant="outline" size="sm" className="w-full" onClick={toggleAll} disabled={filtered.length === 0}>
                  {selected.length === filtered.length && filtered.length > 0 ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมดที่แสดง"}
                </Button>
                <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                  {loadingPeople && <p className="text-xs text-muted-foreground py-4 text-center">กำลังโหลด…</p>}
                  {!loadingPeople && filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">ไม่พบบุคลากรที่มีบัญชีผู้ใช้</p>
                  )}
                  {filtered.map((p: any) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox checked={selected.includes(p.user_id)} onCheckedChange={() => toggle(p.user_id)} />
                      <div className="min-w-0">
                        <p className="text-sm truncate">{`${p.prefix || ""}${p.first_name} ${p.last_name}`}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[p.position_title, p.department].filter(Boolean).join(" · ") || "-"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="track" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "ทั้งหมด", value: summary.total },
              { label: "รอดำเนินการ", value: summary.pending },
              { label: "กำลังทำ", value: summary.doing },
              { label: "เสร็จสิ้น", value: summary.done },
            ].map((s) => (
              <Card key={s.label} className="min-w-0">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-3 space-y-2">
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">ยังไม่ได้มอบหมายงาน</p>
              )}
              {tasks.map((t: any) => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {statusBadge(t.status)}
                      <Badge variant="secondary" className="text-[10px]">{PRIORITY_LABEL[priorityOf(t.notes)]}</Badge>
                    </div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>ผู้รับผิดชอบ: {nameById.get(t.assigned_to_user_id) || "-"}</span>
                      <span>สั่งเมื่อ: {new Date(t.assigned_date).toLocaleDateString("th-TH")}</span>
                      {t.due_date && <span>กำหนดส่ง: {new Date(t.due_date).toLocaleDateString("th-TH")}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => removeTask(t.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
