import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyPersonnel } from "@/hooks/useMyPersonnel";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { formatDateBE } from "@/lib/dateBE";
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
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileEdit, Send, CheckCircle2, XCircle, Eye, Trash2, Search, BookOpenCheck, Sparkles, Filter, Clock, AlertCircle, MessageSquare, Users, Printer, Download, NotebookPen, Save } from "lucide-react";
import { printLessonPlan, exportLessonPlanJSON } from "@/lib/lessonPlanExport";

const STATUS_STYLES: Record<string, { label: string; className: string; icon: any }> = {
  draft: { label: "ร่าง", className: "bg-slate-500/15 text-slate-600 border-slate-500/30", icon: FileEdit },
  submitted: { label: "รอนิเทศ", className: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: Clock },
  approved: { label: "อนุมัติ", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
  revise_needed: { label: "ปรับแก้", className: "bg-red-500/15 text-red-700 border-red-500/30", icon: AlertCircle },
};

type Plan = any;

export default function LessonPlansPage() {
  const { session } = useAuthSession();
  const userId = session?.user?.id;
  const { isAdmin, isDirector } = useUserRole();
  const canSupervise = isAdmin || isDirector;
  const { data: myPersonnel } = useMyPersonnel();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get("tab") || "mine";
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(searchParams.get("tab") || "mine"); }, [searchParams]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [viewing, setViewing] = useState<Plan | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reflection, setReflection] = useState<any>(null);

  // Load data by tab
  const { data: plans = [] } = useQuery({
    queryKey: ["lesson_plans", tab, userId, myPersonnel?.id],
    enabled: !!userId,
    queryFn: async () => {
      let q = (supabase.from("lesson_plans" as any) as any).select("*").order("updated_at", { ascending: false });
      if (tab === "mine") q = q.eq("user_id", userId);
      else if (tab === "review") q = q.eq("status", "submitted");
      else if (tab === "peer") q = q.eq("status", "approved").neq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => (await supabase.from("subjects").select("id,code,name_th,grade_level").order("code")).data || [],
  });
  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms-list"],
    queryFn: async () => (await supabase.from("classrooms").select("id,name,grade_level").order("grade_level").order("name")).data || [],
  });
  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel-lookup"],
    queryFn: async () => (await supabase.from("personnel").select("id,prefix,first_name,last_name")).data || [],
  });

  const filtered = useMemo(() => plans.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.unit_title || "").toLowerCase().includes(s) ||
      (p.lesson_title || "").toLowerCase().includes(s) ||
      (p.objectives || "").toLowerCase().includes(s);
  }), [plans, statusFilter, search]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: Plan) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await (supabase.from("lesson_plans" as any) as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("lesson_plans" as any) as any).insert({ ...rest, user_id: userId, school_id: myPersonnel?.school_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกแผนการสอนแล้ว");
      qc.invalidateQueries({ queryKey: ["lesson_plans"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusChange = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const patch: any = { status };
      if (status === "submitted") patch.submitted_at = new Date().toISOString();
      if (status === "approved" || status === "revise_needed") {
        patch.reviewer_id = myPersonnel?.id;
        patch.reviewed_at = new Date().toISOString();
        patch.reviewer_note = note || null;
      }
      const { error } = await (supabase.from("lesson_plans" as any) as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัปเดตสถานะแล้ว");
      qc.invalidateQueries({ queryKey: ["lesson_plans"] });
      setViewing(null);
      setReviewNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("lesson_plans" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ลบแล้ว"); qc.invalidateQueries({ queryKey: ["lesson_plans"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveReflection = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase.from("lesson_plans" as any) as any)
        .update({ ...patch, post_reflection_updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success("บันทึกหลังการสอนแล้ว");
      qc.invalidateQueries({ queryKey: ["lesson_plans"] });
      setViewing((prev: any) => prev ? { ...prev, ...v.patch } : prev);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // sync reflection editor when viewing changes
  useEffect(() => {
    if (viewing) {
      setReflection({
        post_reflection_taught_at: viewing.post_reflection_taught_at || "",
        post_reflection_outcomes: viewing.post_reflection_outcomes || "",
        post_reflection_problems: viewing.post_reflection_problems || "",
        post_reflection_improvements: viewing.post_reflection_improvements || "",
        post_reflection_notes: viewing.post_reflection_notes || "",
      });
    } else {
      setReflection(null);
    }
  }, [viewing?.id]);

  const personnelName = (id: string) => {
    const p = personnelList.find((x: any) => x.id === id);
    return p ? `${p.prefix || ""}${p.first_name} ${p.last_name}` : "-";
  };
  const subjectName = (id: string) => {
    const s = subjects.find((x: any) => x.id === id);
    return s ? `${s.code} · ${s.name_th}` : "-";
  };
  const classroomName = (id: string) => {
    const c = classrooms.find((x: any) => x.id === id);
    return c ? `${c.grade_level} ${c.name}` : "-";
  };

  const openCreate = () => {
    setEditing({
      academic_year: currentAcademicYear,
      semester: currentSemester,
      unit_no: 1,
      lesson_no: 1,
      hours: 1,
      status: "draft",
      indicators: [],
      competencies: [],
      desired_characteristics: [],
      attachment_urls: [],
    });
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Teaching Excellence
            </div>
            <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
              <BookOpenCheck className="w-6 h-6 text-blue-600" />
              แผนการจัดการเรียนรู้
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              สร้าง แก้ไข และส่งแผนการสอนให้ผู้อำนวยการนิเทศ · แชร์แผนที่ผ่านการอนุมัติกับเพื่อนครูเพื่อ PLC
            </p>
          </div>
          <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="rounded-full shadow-lg gap-2">
                <Plus className="w-4 h-4" /> สร้างแผนใหม่
              </Button>
            </DialogTrigger>
            <PlanFormDialog
              editing={editing}
              setEditing={setEditing}
              subjects={subjects}
              classrooms={classrooms}
              onSave={(p) => upsertMutation.mutate(p)}
              saving={upsertMutation.isPending}
            />
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSearchParams({ tab: v }); }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="mine" className="gap-1.5"><FileEdit className="w-3.5 h-3.5" />แผนของฉัน</TabsTrigger>
          {canSupervise && <TabsTrigger value="review" className="gap-1.5"><Clock className="w-3.5 h-3.5" />รอนิเทศ</TabsTrigger>}
          <TabsTrigger value="peer" className="gap-1.5"><Users className="w-3.5 h-3.5" />คลัง PLC</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ค้นหาหน่วย/บท/วัตถุประสงค์…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="draft">ร่าง</SelectItem>
              <SelectItem value="submitted">รอนิเทศ</SelectItem>
              <SelectItem value="approved">อนุมัติ</SelectItem>
              <SelectItem value="revise_needed">ปรับแก้</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(["mine", "review", "peer"] as const).map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            {filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <BookOpenCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div className="text-sm">
                    {k === "mine" ? "ยังไม่มีแผนของคุณ กดสร้างแผนใหม่ด้านบน" :
                     k === "review" ? "ไม่มีแผนที่รอนิเทศ" : "ยังไม่มีแผนที่ผ่านการอนุมัติจากเพื่อนครู"}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p: any) => {
                  const st = STATUS_STYLES[p.status] || STATUS_STYLES.draft;
                  const StIcon = st.icon;
                  return (
                    <Card key={p.id} className="hover:shadow-md hover:border-primary/40 transition-all">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-mono text-muted-foreground">หน่วย {p.unit_no ?? "-"} · บท {p.lesson_no ?? "-"}</div>
                            <div className="font-semibold text-sm truncate">{p.unit_title}</div>
                            {p.lesson_title && <div className="text-xs text-muted-foreground truncate">{p.lesson_title}</div>}
                          </div>
                          <Badge variant="outline" className={`gap-1 shrink-0 ${st.className}`}>
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-y-0.5">
                          <span>📚 {subjectName(p.subject_id)}</span>
                          <span>🏫 {classroomName(p.classroom_id)}</span>
                          <span>⏱ {p.hours || 1} คาบ</span>
                          <span>👤 {personnelName(p.teacher_id)}</span>
                        </div>
                        {p.reviewer_note && p.status === "revise_needed" && (
                          <div className="text-[11px] p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-700 flex gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{p.reviewer_note}</span>
                          </div>
                        )}
                        <div className="flex gap-1.5 pt-2 border-t">
                          <Button size="sm" variant="ghost" className="flex-1 h-8 gap-1" onClick={() => setViewing(p)}>
                            <Eye className="w-3.5 h-3.5" /> ดู
                          </Button>
                          {p.user_id === userId && p.status !== "approved" && (
                            <Button size="sm" variant="ghost" className="flex-1 h-8 gap-1" onClick={() => setEditing(p)}>
                              <FileEdit className="w-3.5 h-3.5" /> แก้ไข
                            </Button>
                          )}
                          {p.user_id === userId && (p.status === "draft" || p.status === "revise_needed") && (
                            <Button size="sm" variant="default" className="h-8 gap-1" onClick={() => statusChange.mutate({ id: p.id, status: "submitted" })}>
                              <Send className="w-3.5 h-3.5" /> ส่ง
                            </Button>
                          )}
                          {p.user_id === userId && (p.status === "draft" || p.status === "revise_needed") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>ลบแผนการสอน?</AlertDialogTitle>
                                  <AlertDialogDescription>{p.unit_title} — ย้อนกลับไม่ได้</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deletePlan.mutate(p.id)}>ลบ</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* View + review dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        {viewing && (
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="flex items-center gap-2">
                  <BookOpenCheck className="w-5 h-5 text-primary" />
                  {viewing.unit_title}
                </DialogTitle>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => printLessonPlan(viewing, { subjectName, classroomName, personnelName })}>
                    <Printer className="w-3.5 h-3.5" /> พิมพ์ / PDF
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => exportLessonPlanJSON(viewing)}>
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Info label="หน่วย/บท">หน่วย {viewing.unit_no} · บท {viewing.lesson_no}</Info>
                <Info label="หัวข้อบทเรียน">{viewing.lesson_title || "-"}</Info>
                <Info label="วิชา">{subjectName(viewing.subject_id)}</Info>
                <Info label="ห้อง">{classroomName(viewing.classroom_id)}</Info>
                <Info label="ปีการศึกษา / ภาค">{viewing.academic_year} / {viewing.semester}</Info>
                <Info label="จำนวนคาบ">{viewing.hours}</Info>
              </div>
              <Section title="มาตรฐาน / ตัวชี้วัด">
                <div>{viewing.learning_standard || "-"}</div>
                {viewing.indicators?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{viewing.indicators.map((i: string, k: number) => <Badge key={k} variant="secondary" className="text-[10px]">{i}</Badge>)}</div>}
              </Section>
              <Section title="จุดประสงค์การเรียนรู้">{viewing.objectives}</Section>
              <Section title="สาระสำคัญ">{viewing.key_concept}</Section>
              <Section title="สาระการเรียนรู้">{viewing.content}</Section>
              <Section title="กระบวนการจัดการเรียนรู้">{viewing.teaching_process}</Section>
              <Section title="สื่อ / แหล่งเรียนรู้">{viewing.materials}</Section>
              <Section title="การวัดและประเมินผล">
                <div><b>วิธี:</b> {viewing.assessment_method || "-"}</div>
                <div><b>เกณฑ์:</b> {viewing.assessment_criteria || "-"}</div>
              </Section>
              {viewing.competencies?.length > 0 && <Section title="สมรรถนะสำคัญ"><div className="flex flex-wrap gap-1">{viewing.competencies.map((c: string, k: number) => <Badge key={k} variant="secondary">{c}</Badge>)}</div></Section>}
              {viewing.desired_characteristics?.length > 0 && <Section title="คุณลักษณะอันพึงประสงค์"><div className="flex flex-wrap gap-1">{viewing.desired_characteristics.map((c: string, k: number) => <Badge key={k} variant="secondary">{c}</Badge>)}</div></Section>}

              {/* บันทึกหลังการสอน */}
              <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                    <NotebookPen className="w-4 h-4" /> บันทึกหลังการสอน (Reflection)
                  </div>
                  {viewing.post_reflection_updated_at && (
                    <span className="text-[10px] text-muted-foreground">อัปเดตล่าสุด {formatDateBE(viewing.post_reflection_updated_at)}</span>
                  )}
                </div>
                {viewing.user_id === userId ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">วันที่สอน</Label>
                        <Input type="date" value={reflection?.post_reflection_taught_at || ""}
                          onChange={(e) => setReflection({ ...reflection, post_reflection_taught_at: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">ผลการจัดการเรียนรู้ (นักเรียนได้อะไร บรรลุจุดประสงค์ไหม)</Label>
                      <Textarea rows={2} value={reflection?.post_reflection_outcomes || ""}
                        onChange={(e) => setReflection({ ...reflection, post_reflection_outcomes: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">ปัญหา / อุปสรรค</Label>
                      <Textarea rows={2} value={reflection?.post_reflection_problems || ""}
                        onChange={(e) => setReflection({ ...reflection, post_reflection_problems: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">แนวทางแก้ไข / ปรับปรุงครั้งต่อไป</Label>
                      <Textarea rows={2} value={reflection?.post_reflection_improvements || ""}
                        onChange={(e) => setReflection({ ...reflection, post_reflection_improvements: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">ข้อสังเกต / ข้อเสนอแนะเพิ่มเติม</Label>
                      <Textarea rows={2} value={reflection?.post_reflection_notes || ""}
                        onChange={(e) => setReflection({ ...reflection, post_reflection_notes: e.target.value })} />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        disabled={saveReflection.isPending}
                        onClick={() => saveReflection.mutate({ id: viewing.id, patch: reflection })}>
                        <Save className="w-3.5 h-3.5" /> บันทึกหลังการสอน
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {viewing.post_reflection_taught_at && <div className="text-xs"><b>วันที่สอน:</b> {formatDateBE(viewing.post_reflection_taught_at)}</div>}
                    {viewing.post_reflection_outcomes && <div><b className="text-xs text-emerald-700">ผลการเรียนรู้:</b><div className="whitespace-pre-wrap">{viewing.post_reflection_outcomes}</div></div>}
                    {viewing.post_reflection_problems && <div><b className="text-xs text-emerald-700">ปัญหา:</b><div className="whitespace-pre-wrap">{viewing.post_reflection_problems}</div></div>}
                    {viewing.post_reflection_improvements && <div><b className="text-xs text-emerald-700">แนวทางแก้ไข:</b><div className="whitespace-pre-wrap">{viewing.post_reflection_improvements}</div></div>}
                    {viewing.post_reflection_notes && <div><b className="text-xs text-emerald-700">ข้อสังเกต:</b><div className="whitespace-pre-wrap">{viewing.post_reflection_notes}</div></div>}
                    {!viewing.post_reflection_outcomes && !viewing.post_reflection_problems && !viewing.post_reflection_improvements && !viewing.post_reflection_notes && (
                      <div className="text-xs text-muted-foreground italic">ยังไม่มีบันทึกหลังการสอน</div>
                    )}
                  </div>
                )}
              </div>
              {viewing.reviewer_note && (
                <div className="p-3 rounded-lg border bg-muted/40">
                  <div className="text-xs font-semibold flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5" />ความเห็นผู้นิเทศ</div>
                  <div className="text-sm">{viewing.reviewer_note}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">โดย {personnelName(viewing.reviewer_id)} · {viewing.reviewed_at ? formatDateBE(viewing.reviewed_at) : ""}</div>
                </div>
              )}
              {canSupervise && viewing.status === "submitted" && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />ความเห็น / ข้อเสนอแนะ</Label>
                  <Textarea rows={3} placeholder="เขียนความเห็นสำหรับครู…" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" className="gap-1.5" onClick={() => statusChange.mutate({ id: viewing.id, status: "revise_needed", note: reviewNote })}>
                      <XCircle className="w-4 h-4 text-red-500" /> ให้ปรับแก้
                    </Button>
                    <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => statusChange.mutate({ id: viewing.id, status: "approved", note: reviewNote })}>
                      <CheckCircle2 className="w-4 h-4" /> อนุมัติ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Info({ label, children }: any) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-medium mt-0.5">{children}</div>
    </div>
  );
}
function Section({ title, children }: any) {
  return (
    <div className="p-3 rounded-lg border bg-muted/20">
      <div className="text-xs font-semibold text-primary mb-1">{title}</div>
      <div className="text-sm whitespace-pre-wrap">{children || <span className="text-muted-foreground italic">—</span>}</div>
    </div>
  );
}

function PlanFormDialog({ editing, setEditing, subjects, classrooms, onSave, saving }: any) {
  if (!editing) return null;
  const set = (k: string, v: any) => setEditing({ ...editing, [k]: v });
  const arrText = (arr: string[] | undefined) => (arr || []).join(", ");
  const parseArr = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

  return (
    <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing.id ? "แก้ไขแผนการสอน" : "สร้างแผนการสอนใหม่"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Field label="ปีการศึกษา"><Input type="number" value={editing.academic_year || ""} onChange={(e) => set("academic_year", Number(e.target.value))} /></Field>
          <Field label="ภาคเรียน">
            <Select value={String(editing.semester || 1)} onValueChange={(v) => set("semester", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="หน่วยที่"><Input type="number" value={editing.unit_no || ""} onChange={(e) => set("unit_no", Number(e.target.value))} /></Field>
          <Field label="บทที่"><Input type="number" value={editing.lesson_no || ""} onChange={(e) => set("lesson_no", Number(e.target.value))} /></Field>
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
        <Field label="ชื่อหน่วยการเรียนรู้ *"><Input value={editing.unit_title || ""} onChange={(e) => set("unit_title", e.target.value)} placeholder="เช่น การบวก ลบ คูณ หาร" /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2"><Field label="หัวข้อบท"><Input value={editing.lesson_title || ""} onChange={(e) => set("lesson_title", e.target.value)} /></Field></div>
          <Field label="จำนวนคาบ"><Input type="number" value={editing.hours || 1} onChange={(e) => set("hours", Number(e.target.value))} /></Field>
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="มาตรฐานการเรียนรู้"><Input value={editing.learning_standard || ""} onChange={(e) => set("learning_standard", e.target.value)} placeholder="เช่น ค 1.1" /></Field>
          <Field label="ตัวชี้วัด (คั่น ,)"><Input value={arrText(editing.indicators)} onChange={(e) => set("indicators", parseArr(e.target.value))} placeholder="ป.1/1, ป.1/2" /></Field>
        </div>
        <Field label="จุดประสงค์การเรียนรู้"><Textarea rows={2} value={editing.objectives || ""} onChange={(e) => set("objectives", e.target.value)} /></Field>
        <Field label="สาระสำคัญ"><Textarea rows={2} value={editing.key_concept || ""} onChange={(e) => set("key_concept", e.target.value)} /></Field>
        <Field label="สาระการเรียนรู้"><Textarea rows={3} value={editing.content || ""} onChange={(e) => set("content", e.target.value)} /></Field>
        <Field label="กระบวนการจัดการเรียนรู้ (ขั้นนำ / สอน / สรุป)"><Textarea rows={4} value={editing.teaching_process || ""} onChange={(e) => set("teaching_process", e.target.value)} /></Field>
        <Field label="สื่อ / แหล่งเรียนรู้"><Textarea rows={2} value={editing.materials || ""} onChange={(e) => set("materials", e.target.value)} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="วิธีวัดและประเมิน"><Textarea rows={2} value={editing.assessment_method || ""} onChange={(e) => set("assessment_method", e.target.value)} /></Field>
          <Field label="เกณฑ์การประเมิน"><Textarea rows={2} value={editing.assessment_criteria || ""} onChange={(e) => set("assessment_criteria", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="สมรรถนะสำคัญ (คั่น ,)"><Input value={arrText(editing.competencies)} onChange={(e) => set("competencies", parseArr(e.target.value))} placeholder="การสื่อสาร, การคิด" /></Field>
          <Field label="คุณลักษณะอันพึงประสงค์ (คั่น ,)"><Input value={arrText(editing.desired_characteristics)} onChange={(e) => set("desired_characteristics", parseArr(e.target.value))} placeholder="ใฝ่เรียนรู้, มีวินัย" /></Field>
        </div>
        <Field label="การอ่าน คิดวิเคราะห์ เขียน"><Textarea rows={2} value={editing.reading_thinking_writing || ""} onChange={(e) => set("reading_thinking_writing", e.target.value)} /></Field>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
        <Button disabled={!editing.unit_title || saving} onClick={() => onSave(editing)}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: any) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
