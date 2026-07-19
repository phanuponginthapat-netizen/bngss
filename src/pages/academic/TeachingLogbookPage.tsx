import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useMyPersonnel } from "@/hooks/useMyPersonnel";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, ClipboardList, Sparkles, CalendarDays, Trash2, FileEdit, Users, ChevronLeft, ChevronRight, Flame, Search } from "lucide-react";

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function weekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d); }
  return days;
}
const iso = (d: Date) => bkkDateISO(d);

export default function TeachingLogbookPage() {
  const { session } = useAuthSession();
  const userId = session?.user?.id;
  const { data: myPersonnel } = useMyPersonnel();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const qc = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const week = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const weekStart = iso(week[0]);
  const weekEnd = iso(week[6]);

  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-list-log"],
    queryFn: async () => (await supabase.from("subjects").select("id,code,name_th").order("code")).data || [],
  });
  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms-list-log"],
    queryFn: async () => (await supabase.from("classrooms").select("id,name,grade_level").order("grade_level")).data || [],
  });
  const { data: myPlans = [] } = useQuery({
    queryKey: ["my-plans-select", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase.from("lesson_plans" as any) as any).select("id,unit_title,lesson_title,unit_no,lesson_no").eq("user_id", userId).order("updated_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: weekLogs = [] } = useQuery({
    queryKey: ["logbook-week", userId, weekStart, weekEnd],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase.from("teaching_logbook" as any) as any).select("*").eq("user_id", userId).gte("teaching_date", weekStart).lte("teaching_date", weekEnd).order("teaching_date").order("period");
      return data || [];
    },
  });

  const { data: allLogs = [] } = useQuery({
    queryKey: ["logbook-all", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase.from("teaching_logbook" as any) as any).select("*").eq("user_id", userId).order("teaching_date", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase.from("teaching_logbook" as any) as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("teaching_logbook" as any) as any).insert({ ...rest, user_id: userId, school_id: myPersonnel?.school_id, academic_year: rest.academic_year || currentAcademicYear, semester: rest.semester || currentSemester });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("บันทึกแล้ว"); qc.invalidateQueries({ queryKey: ["logbook-week"] }); qc.invalidateQueries({ queryKey: ["logbook-all"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase.from("teaching_logbook" as any) as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบแล้ว"); qc.invalidateQueries({ queryKey: ["logbook-week"] }); qc.invalidateQueries({ queryKey: ["logbook-all"] }); },
  });

  const subjectName = (id: string) => { const s = subjects.find((x: any) => x.id === id); return s ? `${s.code}` : "-"; };
  const classroomName = (id: string) => { const c = classrooms.find((x: any) => x.id === id); return c ? `${c.grade_level} ${c.name}` : "-"; };

  const openCreate = (date?: string) => setEditing({
    teaching_date: date || iso(new Date()),
    period: 1,
    academic_year: currentAcademicYear,
    semester: currentSemester,
  });

  const filteredAll = useMemo(() => {
    if (!search) return allLogs;
    const s = search.toLowerCase();
    return allLogs.filter((l: any) => (l.topic || "").toLowerCase().includes(s) || (l.activities || "").toLowerCase().includes(s));
  }, [allLogs, search]);

  const totalWeek = weekLogs.length;
  const totalMonth = allLogs.filter((l: any) => new Date(l.teaching_date).getMonth() === new Date().getMonth()).length;
  const totalPresent = weekLogs.reduce((s: number, l: any) => s + (l.students_present || 0), 0);
  const totalPossible = weekLogs.reduce((s: number, l: any) => s + (l.students_total || 0), 0);
  const attRate = totalPossible ? Math.round((totalPresent / totalPossible) * 100) : 0;

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-fuchsia-500/5 to-transparent border border-fuchsia-500/20 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-fuchsia-600 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Teaching Excellence
            </div>
            <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-fuchsia-600" />
              บันทึกหลังการสอน (Logbook)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">บันทึกการสอนรายคาบ · ใช้ประกอบ วPA และรายงานการปฏิบัติงาน</p>
          </div>
          <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreate()} className="rounded-full shadow-lg gap-2">
                <Plus className="w-4 h-4" /> บันทึกใหม่
              </Button>
            </DialogTrigger>
            <LogFormDialog editing={editing} setEditing={setEditing} subjects={subjects} classrooms={classrooms} plans={myPlans} onSave={(p: any) => upsert.mutate(p)} saving={upsert.isPending} />
          </Dialog>
        </div>

        {/* Mini KPIs */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <MiniStat label="สัปดาห์นี้" value={totalWeek} icon={<CalendarDays className="w-4 h-4" />} color="text-fuchsia-600" />
          <MiniStat label="เดือนนี้" value={totalMonth} icon={<Flame className="w-4 h-4" />} color="text-orange-500" />
          <MiniStat label="อัตราเข้าเรียน" value={`${attRate}%`} icon={<Users className="w-4 h-4" />} color="text-emerald-500" />
        </div>
      </div>

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />รายสัปดาห์</TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" />ทั้งหมด</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset - 1)}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="text-sm font-medium">
              {week[0].toLocaleDateString("th-TH", { day: "numeric", month: "short" })} – {week[6].toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(weekOffset + 1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {week.map((d, i) => {
              const key = iso(d);
              const dayLogs = weekLogs.filter((l: any) => l.teaching_date === key);
              const isToday = key === iso(new Date());
              return (
                <Card key={key} className={`${isToday ? "border-primary shadow-md" : "border-border/60"} min-h-[160px]`}>
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[10px] text-muted-foreground">{THAI_DAYS[d.getDay()]}</div>
                        <div className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}/{d.getMonth() + 1}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openCreate(key)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {dayLogs.length === 0 && <div className="text-[10px] text-muted-foreground italic text-center py-3">—</div>}
                      {dayLogs.map((l: any) => (
                        <button key={l.id} onClick={() => setEditing(l)} className="w-full text-left p-1.5 rounded-md bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">คาบ {l.period ?? "-"}</Badge>
                            <span>{subjectName(l.subject_id)}</span>
                          </div>
                          <div className="text-[11px] font-medium truncate mt-0.5">{l.topic}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{classroomName(l.classroom_id)}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ค้นหาหัวข้อ / กิจกรรม…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>คาบ</TableHead>
                    <TableHead>วิชา</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead>หัวข้อ</TableHead>
                    <TableHead className="text-right">เข้าเรียน</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีบันทึก</TableCell></TableRow>
                  )}
                  {filteredAll.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">{l.teaching_date}</TableCell>
                      <TableCell>{l.period ?? "-"}</TableCell>
                      <TableCell className="text-xs">{subjectName(l.subject_id)}</TableCell>
                      <TableCell className="text-xs">{classroomName(l.classroom_id)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm font-medium">{l.topic}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{l.students_present ?? "-"}/{l.students_total ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(l)}><FileEdit className="w-3.5 h-3.5" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>ลบบันทึก?</AlertDialogTitle><AlertDialogDescription>{l.topic}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(l.id)}>ลบ</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({ label, value, icon, color }: any) {
  return (
    <div className="rounded-xl bg-background/60 backdrop-blur border border-border/40 p-3">
      <div className={`text-xs text-muted-foreground flex items-center gap-1 ${color}`}>{icon}{label}</div>
      <div className="text-xl font-bold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function LogFormDialog({ editing, setEditing, subjects, classrooms, plans, onSave, saving }: any) {
  if (!editing) return null;
  const set = (k: string, v: any) => setEditing({ ...editing, [k]: v });
  return (
    <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing.id ? "แก้ไขบันทึกการสอน" : "บันทึกการสอนใหม่"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="วันที่ *"><BEDatePicker value={editing.teaching_date || ""} onChange={(v) => set("teaching_date", v)} /></Field>
          <Field label="คาบ"><Input type="number" value={editing.period ?? ""} onChange={(e) => set("period", Number(e.target.value))} /></Field>
          <Field label="ปีการศึกษา"><Input type="number" value={editing.academic_year || ""} onChange={(e) => set("academic_year", Number(e.target.value))} /></Field>
          <Field label="ภาคเรียน">
            <Select value={String(editing.semester || 1)} onValueChange={(v) => set("semester", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="วิชา">
            <Select value={editing.subject_id || ""} onValueChange={(v) => set("subject_id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือกวิชา" /></SelectTrigger>
              <SelectContent>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code} · {s.name_th}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="ห้องเรียน">
            <Select value={editing.classroom_id || ""} onValueChange={(v) => set("classroom_id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
              <SelectContent>{classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="แผนการสอนที่ใช้ (ไม่บังคับ)">
          <Select value={editing.lesson_plan_id || "none"} onValueChange={(v) => set("lesson_plan_id", v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="เลือกแผน" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— ไม่ระบุ —</SelectItem>
              {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>หน่วย{p.unit_no}·บท{p.lesson_no} — {p.unit_title}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="หัวข้อที่สอน *"><Input value={editing.topic || ""} onChange={(e) => set("topic", e.target.value)} /></Field>
        <Field label="กิจกรรมการสอน"><Textarea rows={3} value={editing.activities || ""} onChange={(e) => set("activities", e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="นักเรียนทั้งหมด"><Input type="number" value={editing.students_total ?? ""} onChange={(e) => set("students_total", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="เข้าเรียน"><Input type="number" value={editing.students_present ?? ""} onChange={(e) => set("students_present", e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="ขาด"><Input type="number" value={editing.students_absent ?? ""} onChange={(e) => set("students_absent", e.target.value ? Number(e.target.value) : null)} /></Field>
        </div>
        <Field label="ผลการสอน"><Textarea rows={2} value={editing.teaching_result || ""} onChange={(e) => set("teaching_result", e.target.value)} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="ปัญหา / อุปสรรค"><Textarea rows={2} value={editing.problems || ""} onChange={(e) => set("problems", e.target.value)} /></Field>
          <Field label="แนวทางแก้ไข"><Textarea rows={2} value={editing.solutions || ""} onChange={(e) => set("solutions", e.target.value)} /></Field>
        </div>
        <Field label="สะท้อนคิด (Reflection)"><Textarea rows={2} value={editing.reflection || ""} onChange={(e) => set("reflection", e.target.value)} /></Field>
        <Field label="แผนคาบต่อไป"><Textarea rows={2} value={editing.next_plan || ""} onChange={(e) => set("next_plan", e.target.value)} /></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
        <Button disabled={!editing.topic || !editing.teaching_date || saving} onClick={() => onSave(editing)}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: any) {
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}
