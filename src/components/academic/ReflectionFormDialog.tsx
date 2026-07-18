import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import {
  useReflectionMutations,
  uploadReflectionFile,
  type TeachingReflection,
} from "@/hooks/useTeachingReflections";
import { useAcademicPeriod } from "@/contexts/AcademicPeriodContext";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ImagePlus, X, Save, Send, CalendarClock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<TeachingReflection> | null;
}

const SUBJECT_GROUPS = [
  { value: "thai", label: "ภาษาไทย" },
  { value: "math", label: "คณิตศาสตร์" },
  { value: "science", label: "วิทยาศาสตร์และเทคโนโลยี" },
  { value: "social", label: "สังคมศึกษา ศาสนา และวัฒนธรรม" },
  { value: "health_pe", label: "สุขศึกษาและพลศึกษา" },
  { value: "arts", label: "ศิลปะ" },
  { value: "occupation", label: "การงานอาชีพ" },
  { value: "foreign_lang", label: "ภาษาต่างประเทศ" },
  { value: "special_ed", label: "การศึกษาพิเศษ" },
];

const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface DraftFile { file: File; previewUrl: string; caption: string; }
interface ScheduleBlock {
  key: string;
  startPeriod: number;
  endPeriod: number;
  hours: number;
  subject_id: string | null;
  subject_name: string;
  classroom_id: string | null;
  classroom_name: string;
  room: string | null;
}

export function ReflectionFormDialog({ open, onClose, initial }: Props) {
  const { upsert } = useReflectionMutations();
  const { currentPeriod, selectedPeriod } = useAcademicPeriod();
  const activePeriod = selectedPeriod || currentPeriod;

  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [periodInput, setPeriodInput] = useState<string>("");
  const [form, setForm] = useState<any>({
    lesson_topic: "",
    lesson_date: new Date().toISOString().slice(0, 10),
    period_no: 1,
    hours_taught: 1,
    subject_id: null,
    classroom_id: null,
    teacher_id: null,
    academic_period_id: null,
    subject_group: null,
    learning_outcomes: "",
    students_total: 0,
    students_pass: 0,
    students_fail: 0,
    score_knowledge: 80,
    score_process: 80,
    score_attitude: 80,
    problems: "",
    suggestions: "",
  });
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [saving, setSaving] = useState(false);

  // load master data + user's schedule for current academic period
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm((f: any) => ({ ...f, ...initial }));
    } else {
      // reset for new record
      setForm({
        lesson_topic: "",
        lesson_date: new Date().toISOString().slice(0, 10),
        period_no: 1,
        hours_taught: 1,
        subject_id: null,
        classroom_id: null,
        teacher_id: null,
        academic_period_id: null,
        subject_group: null,
        learning_outcomes: "",
        students_total: 0,
        students_pass: 0,
        students_fail: 0,
        score_knowledge: 80,
        score_process: 80,
        score_attitude: 80,
        problems: "",
        suggestions: "",
      });
      setFiles([]);
    }
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      setCurrentUserId(uid || null);
      const [c, s, per, sc, tch] = await Promise.all([
        supabase.from("classrooms").select("id,name,grade_level").order("grade_level") as any,
        supabase.from("subjects").select("id,name_th,code").order("name_th") as any,
        uid ? (supabase.from("personnel").select("subject_group").eq("user_id", uid).maybeSingle() as any) : Promise.resolve({ data: null }),
        uid && activePeriod
          ? (supabase.from("schedules")
              .select("id,day_of_week,period,duration_periods,subject_id,classroom_id,room,subject_name_raw")
              .eq("teacher_id", uid)
              .eq("academic_year", activePeriod.academic_year_be)
              .eq("semester", activePeriod.semester)
              .order("day_of_week").order("period") as any)
          : Promise.resolve({ data: [] }),
        supabase.from("personnel")
          .select("id,user_id,prefix,first_name,last_name,position,subject_group,department")
          .not("user_id", "is", null)
          .order("first_name") as any,
      ]);
      setClassrooms(c.data || []);
      setSubjects(s.data || []);
      setDefaultGroup(per?.data?.subject_group || null);
      setSchedule(sc.data || []);
      const tlist = (tch.data || [])
        .map((p: any) => ({
          id: p.user_id,
          prefix: p.prefix,
          first_name: p.first_name,
          last_name: p.last_name,
          position: p.position,
          subject_group: p.subject_group,
          department: p.department,
        }))
        .sort((a: any, b: any) => (a.first_name || "").localeCompare(b.first_name || "", "th"));
      setTeachers(tlist);
      // auto-attach current period & group defaults
      setForm((f: any) => ({
        ...f,
        teacher_id: f.teacher_id || uid || null,
        academic_period_id: f.academic_period_id || activePeriod?.id || null,
        subject_group: f.subject_group || per?.data?.subject_group || null,
      }));
    })();
  }, [open, initial, activePeriod?.id]);

  // sync periodInput ↔ form
  useEffect(() => {
    if (form.period_no) {
      const end = form.hours_taught > 1 ? Number(form.period_no) + Number(form.hours_taught) - 1 : null;
      setPeriodInput(end ? `${form.period_no}-${end}` : `${form.period_no}`);
    }
  }, [form.period_no, form.hours_taught]);

  const applyPeriodInput = (v: string) => {
    setPeriodInput(v);
    const m = v.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]); const b = Number(m[2]);
      if (b >= a) setForm((f: any) => ({ ...f, period_no: a, hours_taught: b - a + 1 }));
    } else if (/^\d+$/.test(v.trim())) {
      setForm((f: any) => ({ ...f, period_no: Number(v.trim()), hours_taught: 1 }));
    }
  };

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const classroomMap = useMemo(() => new Map(classrooms.map((c) => [c.id, c])), [classrooms]);

  // จำกัดรายวิชา/ห้องเรียนให้เฉพาะที่ปรากฏในตารางสอนของครูคนนี้
  const mySubjectIds = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach((r) => { if (r.subject_id) set.add(r.subject_id); });
    return set;
  }, [schedule]);
  const myClassroomIds = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach((r) => { if (r.classroom_id) set.add(r.classroom_id); });
    return set;
  }, [schedule]);
  const mySubjects = useMemo(() => {
    if (!mySubjectIds.size) return subjects;
    const list = subjects.filter((s) => mySubjectIds.has(s.id));
    if (form.subject_id && !mySubjectIds.has(form.subject_id)) {
      const cur = subjects.find((s) => s.id === form.subject_id);
      if (cur) list.unshift(cur);
    }
    return list;
  }, [subjects, mySubjectIds, form.subject_id]);
  const myClassrooms = useMemo(() => {
    if (!myClassroomIds.size) return classrooms;
    const list = classrooms.filter((c) => myClassroomIds.has(c.id));
    if (form.classroom_id && !myClassroomIds.has(form.classroom_id)) {
      const cur = classrooms.find((c) => c.id === form.classroom_id);
      if (cur) list.unshift(cur);
    }
    return list;
  }, [classrooms, myClassroomIds, form.classroom_id]);


  // Build schedule blocks for the selected date (group consecutive same-subject periods)
  const dayBlocks = useMemo<ScheduleBlock[]>(() => {
    if (!form.lesson_date) return [];
    const dow = new Date(form.lesson_date).getDay();
    const rows = schedule
      .filter((r) => r.day_of_week === dow)
      .sort((a, b) => a.period - b.period);
    const blocks: ScheduleBlock[] = [];
    for (const r of rows) {
      const subj = r.subject_id ? subjectMap.get(r.subject_id) : null;
      const cls = r.classroom_id ? classroomMap.get(r.classroom_id) : null;
      const sName = subj?.name_th || r.subject_name_raw || "รายวิชา";
      const cName = cls?.name || "";
      const last = blocks[blocks.length - 1];
      if (last && last.subject_id === r.subject_id && last.classroom_id === r.classroom_id && last.endPeriod + 1 === r.period) {
        last.endPeriod = r.period;
        last.hours = last.endPeriod - last.startPeriod + 1;
      } else {
        const dur = Math.max(1, Number(r.duration_periods) || 1);
        blocks.push({
          key: r.id,
          startPeriod: r.period,
          endPeriod: r.period + dur - 1,
          hours: dur,
          subject_id: r.subject_id,
          subject_name: sName,
          classroom_id: r.classroom_id,
          classroom_name: cName,
          room: r.room,
        });
      }
    }
    return blocks;
  }, [schedule, form.lesson_date, subjectMap, classroomMap]);

  const applyBlock = (b: ScheduleBlock) => {
    setForm((f: any) => ({
      ...f,
      period_no: b.startPeriod,
      hours_taught: b.hours,
      subject_id: b.subject_id,
      classroom_id: b.classroom_id,
      subject_group: f.subject_group || defaultGroup,
      academic_period_id: activePeriod?.id || f.academic_period_id,
    }));
    toast.success(`เลือกคาบ ${b.startPeriod}${b.endPeriod > b.startPeriod ? `-${b.endPeriod}` : ""} · ${b.subject_name}`);
  };

  const passPct = useMemo(() => {
    const t = Number(form.students_total) || 0;
    if (!t) return 0;
    return Math.round((Number(form.students_pass) / t) * 1000) / 10;
  }, [form.students_pass, form.students_total]);

  const kpaAvg = useMemo(() =>
    Math.round(((form.score_knowledge + form.score_process + form.score_attitude) / 3) * 10) / 10,
    [form.score_knowledge, form.score_process, form.score_attitude]
  );

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const remaining = 3 - files.length;
    const chosen = Array.from(fl).slice(0, remaining);
    const draft: DraftFile[] = chosen.map((f) => ({
      file: f, previewUrl: URL.createObjectURL(f), caption: "",
    }));
    setFiles((prev) => [...prev, ...draft]);
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const save = async (asSubmit: boolean) => {
    if (!form.lesson_topic) return toast.error("กรุณากรอกหัวข้อการสอน");
    if (files.length > 3) return toast.error("แนบชิ้นงานได้ 1–3 ภาพ");
    setSaving(true);
    try {
      const status = asSubmit ? "submitted" : "draft";
      const current_step = asSubmit ? 1 : 0;
      const saved = await upsert.mutateAsync({
        ...form,
        status,
        current_step,
        assessment_data: { K: form.score_knowledge, P: form.score_process, A: form.score_attitude },
      });
      if (files.length && saved) {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id!;
        const rows: any[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const compressed = await compressImage(f.file, { maxWidth: 1400, quality: 0.85 }).catch(() => f.file);
          const url = await uploadReflectionFile(uid, saved.id, compressed as File);
          rows.push({
            reflection_id: saved.id,
            file_url: url,
            file_name: f.file.name,
            caption: f.caption,
            display_order: i,
          });
        }
        await (supabase as any).from("teaching_reflection_attachments").insert(rows);
      }
      toast.success(asSubmit ? "ส่งบันทึกให้หัวหน้ากลุ่มสาระแล้ว" : "บันทึกร่างเรียบร้อย");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const kpaData = [
    { name: "ความรู้ (K)", value: form.score_knowledge },
    { name: "ทักษะ (P)", value: form.score_process },
    { name: "เจตคติ (A)", value: form.score_attitude },
  ];
  const passData = [
    { name: "ผ่าน", value: Number(form.students_pass) || 0 },
    { name: "ไม่ผ่าน", value: Number(form.students_fail) || 0 },
  ];
  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

  const dowLabel = form.lesson_date ? DAY_NAMES[new Date(form.lesson_date).getDay()] : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>บันทึกหลังการสอน</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="info">ข้อมูลการสอน</TabsTrigger>
            <TabsTrigger value="outcome">ผลการเรียนรู้</TabsTrigger>
            <TabsTrigger value="assess">ผลประเมิน K/P/A</TabsTrigger>
            <TabsTrigger value="issues">ปัญหา & ข้อเสนอ</TabsTrigger>
            <TabsTrigger value="attach">แนบชิ้นงาน & สรุป</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 pt-4">
            {activePeriod && (
              <Card className="p-3 bg-primary/5 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">ปีการศึกษา/ภาคเรียนปัจจุบัน: </span>
                  <b>{activePeriod.academic_year_be}/{activePeriod.semester}</b>
                </div>
                <Badge variant="secondary">ผูกอัตโนมัติ</Badge>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>หัวข้อการสอน / หน่วยการเรียนรู้ *</Label>
                <Input value={form.lesson_topic} onChange={(e) => setForm({ ...form, lesson_topic: e.target.value })} />
              </div>
              <div>
                <Label>วันที่สอน {dowLabel && <span className="text-xs text-muted-foreground">(วัน{dowLabel})</span>}</Label>
                <Input type="date" value={form.lesson_date} onChange={(e) => setForm({ ...form, lesson_date: e.target.value })} />
              </div>
              <div className="col-span-1">
                <Label className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> เลือกจากตารางสอน</Label>
                {dayBlocks.length === 0 ? (
                  <div className="text-xs text-muted-foreground border rounded-md p-2 mt-1">
                    ไม่มีตารางสอนในวัน{dowLabel || "ที่เลือก"} (หรือยังไม่ได้จัดตารางในภาคเรียนนี้)
                  </div>
                ) : (
                  <Select onValueChange={(v) => { const b = dayBlocks.find((x) => x.key === v); if (b) applyBlock(b); }}>
                    <SelectTrigger><SelectValue placeholder="เลือกคาบเรียน..." /></SelectTrigger>
                    <SelectContent>
                      {dayBlocks.map((b) => (
                        <SelectItem key={b.key} value={b.key}>
                          คาบ {b.startPeriod}{b.endPeriod > b.startPeriod ? `-${b.endPeriod}` : ""} · {b.subject_name}
                          {b.classroom_name && ` · ${b.classroom_name}`}
                          {b.room && ` (${b.room})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>คาบที่ <span className="text-xs text-muted-foreground">(เช่น 1-2)</span></Label>
                <Input placeholder="1 หรือ 1-2" value={periodInput} onChange={(e) => applyPeriodInput(e.target.value)} />
              </div>
              <div>
                <Label>จำนวนคาบ</Label>
                <Input type="number" min={0} step={0.5} value={form.hours_taught} onChange={(e) => setForm({ ...form, hours_taught: Number(e.target.value) })} />
              </div>
              <div className="col-span-2">
                <Label>ครูผู้สอน / บุคลากร</Label>
                <Select value={form.teacher_id ?? ""} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกครูผู้สอน" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {`${t.prefix || ""}${t.first_name || ""} ${t.last_name || ""}`.trim()}
                        {t.position ? ` · ${t.position}` : ""}
                        {t.id === currentUserId ? " (ฉัน)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>รายวิชา</Label>
                <Select value={form.subject_id ?? ""} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {mySubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_th}{s.code ? ` (${s.code})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ห้องเรียน</Label>
                <Select value={form.classroom_id ?? ""} onValueChange={(v) => setForm({ ...form, classroom_id: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {myClassrooms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}

                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>กลุ่มสาระการเรียนรู้</Label>
                <Select value={form.subject_group ?? ""} onValueChange={(v) => setForm({ ...form, subject_group: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {SUBJECT_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="outcome" className="space-y-3 pt-4">
            <div>
              <Label>ผลการจัดการเรียนรู้</Label>
              <Textarea rows={6} value={form.learning_outcomes ?? ""} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} placeholder="สรุปผลการจัดการเรียนรู้ พฤติกรรมผู้เรียน..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>จำนวนนักเรียนทั้งหมด</Label>
                <Input type="number" min={0} value={form.students_total} onChange={(e) => setForm({ ...form, students_total: Number(e.target.value) })} />
              </div>
              <div>
                <Label>จำนวนผ่าน</Label>
                <Input type="number" min={0} value={form.students_pass} onChange={(e) => setForm({ ...form, students_pass: Number(e.target.value), students_fail: Math.max(0, form.students_total - Number(e.target.value)) })} />
              </div>
              <div>
                <Label>จำนวนไม่ผ่าน</Label>
                <Input type="number" min={0} value={form.students_fail} readOnly />
              </div>
            </div>
            <Card className="p-4 bg-primary/5">
              <div className="text-sm text-muted-foreground">ร้อยละการผ่าน</div>
              <div className="text-3xl font-bold text-primary">{passPct}%</div>
            </Card>
          </TabsContent>

          <TabsContent value="assess" className="space-y-4 pt-4">
            {(["knowledge", "process", "attitude"] as const).map((k) => {
              const labels = { knowledge: "ความรู้ (K)", process: "ทักษะกระบวนการ (P)", attitude: "เจตคติ (A)" };
              const val = form[`score_${k}`];
              return (
                <div key={k}>
                  <div className="flex justify-between mb-1">
                    <Label>{labels[k]}</Label>
                    <span className="font-bold text-primary">{val}%</span>
                  </div>
                  <Slider min={0} max={100} step={1} value={[val]} onValueChange={([v]) => setForm({ ...form, [`score_${k}`]: v })} />
                </div>
              );
            })}
            <Card className="p-3 bg-emerald-50 dark:bg-emerald-950/30">
              ค่าเฉลี่ยรวม: <span className="text-xl font-bold text-emerald-700">{kpaAvg}%</span>
            </Card>
          </TabsContent>

          <TabsContent value="issues" className="space-y-3 pt-4">
            <div>
              <Label>ปัญหา / อุปสรรค</Label>
              <Textarea rows={4} value={form.problems ?? ""} onChange={(e) => setForm({ ...form, problems: e.target.value })} />
            </div>
            <div>
              <Label>ข้อเสนอแนะ / แนวทางแก้ไข</Label>
              <Textarea rows={4} value={form.suggestions ?? ""} onChange={(e) => setForm({ ...form, suggestions: e.target.value })} />
            </div>
          </TabsContent>

          <TabsContent value="attach" className="space-y-4 pt-4">
            <div>
              <Label>แนบชิ้นงาน 1–3 ภาพ</Label>

              <label className="block mt-2 cursor-pointer border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition">
                <ImagePlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">คลิกเพื่อเลือกภาพ ({files.length}/3)</div>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {files.map((f, i) => (
                  <div key={i} className="relative rounded-md border overflow-hidden">
                    <img src={f.previewUrl} alt="" className="aspect-square object-cover w-full" />
                    <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeFile(i)}>
                      <X className="w-3 h-3" />
                    </Button>
                    <Input
                      className="text-xs border-0 rounded-none"
                      placeholder="คำบรรยาย"
                      value={f.caption}
                      onChange={(e) => {
                        const nf = [...files]; nf[i].caption = e.target.value; setFiles(nf);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-3">
                <div className="text-sm font-medium mb-2">คะแนน K/P/A</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={kpaData}>
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-3">
                <div className="text-sm font-medium mb-2">ผ่าน / ไม่ผ่าน</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={passData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} label>
                      {passData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> บันทึกร่าง
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            <Send className="w-4 h-4 mr-1" /> ส่งอนุมัติ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
