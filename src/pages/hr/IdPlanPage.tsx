import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, GraduationCap, Sparkles, Lightbulb, Paperclip, FileText, ImageIcon, X, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { StatCard } from "@/components/shared";
import { saveErrorMessage, safeInt, nullIfEmpty } from "@/lib/saveError";
import { swal } from "@/lib/swal";

const PLAN_TYPES = [
  { value: "training", th: "อบรม/สัมมนา" },
  { value: "workshop", th: "ปฏิบัติการ (Workshop)" },
  { value: "online", th: "อบรมออนไลน์" },
  { value: "conference", th: "ประชุมวิชาการ" },
  { value: "study_visit", th: "ศึกษาดูงาน" },
  { value: "self_study", th: "ศึกษาด้วยตนเอง" },
  { value: "plc", th: "ชุมชนแห่งการเรียนรู้ (PLC)" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: "วางแผน", color: "bg-blue-100 text-blue-800" },
  in_progress: { label: "กำลังดำเนินการ", color: "bg-amber-100 text-amber-800" },
  completed: { label: "สำเร็จ", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "ยกเลิก", color: "bg-red-100 text-red-800" },
};

// PA → ID Plan suggestion mapping based on DISC dominant style + Mental Health weak areas
const DISC_SUGGESTIONS: Record<string, { label: string; courses: string[] }> = {
  D: {
    label: "Dominance (ผู้นำ มุ่งผลลัพธ์)",
    courses: [
      "การฟังอย่างลึกซึ้ง (Active Listening) สำหรับครู",
      "Coaching & Mentoring เพื่อพัฒนาผู้เรียน",
      "การบริหารทีมและการมอบหมายงานอย่างมีประสิทธิภาพ",
    ],
  },
  I: {
    label: "Influence (สร้างแรงบันดาลใจ)",
    courses: [
      "การจัดการเวลาและวินัยในตนเอง",
      "การวางแผนการสอนเชิงระบบ (Backward Design)",
      "การวัดและประเมินผลตามสภาพจริง",
    ],
  },
  S: {
    label: "Steadiness (มั่นคง อดทน)",
    courses: [
      "ทักษะการนำเสนอและการสื่อสารในที่สาธารณะ",
      "การออกแบบกิจกรรมเชิงรุก (Active Learning)",
      "การปรับตัวกับเทคโนโลยีการศึกษาใหม่",
    ],
  },
  C: {
    label: "Conscientiousness (รอบคอบ วิเคราะห์)",
    courses: [
      "การสร้างปฏิสัมพันธ์เชิงบวกกับนักเรียน",
      "Growth Mindset & Positive Psychology",
      "การทำงานเป็นทีม PLC อย่างมีส่วนร่วม",
    ],
  },
};

const MH_SUGGESTIONS: Record<string, string[]> = {
  stress: ["การจัดการความเครียด & Mindfulness สำหรับครู", "เทคนิคการผ่อนคลายและสมดุลชีวิต-การงาน"],
  burnout: ["การฟื้นฟูพลังใจในวิชาชีพครู", "Resilience Training: การฟื้นตัวจากความเหนื่อยล้า"],
  anxiety: ["การจัดการความวิตกกังวลในห้องเรียน", "การให้คำปรึกษาเบื้องต้น (Counseling Basics)"],
  depression: ["การดูแลสุขภาพจิตเชิงบวก", "Self-Compassion สำหรับครู"],
};

const IdPlanPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { role, userId, isAdmin, isDirector } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personnelId, setPersonnelId] = useState("");
  const [planType, setPlanType] = useState("training");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [notes, setNotes] = useState("");
  const [orderDocPath, setOrderDocPath] = useState<string>("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const uploadToBucket = async (file: File, kind: "order" | "image") => {
    if (!userId) { toast.error("กรุณาเข้าสู่ระบบ"); return null; }
    const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "bin").toLowerCase();
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${userId}/id-plan/${Date.now()}-${kind}-${safeName}`;
    const { error } = await supabase.storage.from("pa-files").upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) { toast.error("อัปโหลดล้มเหลว: " + error.message); return null; }
    return path;
  };

  const openSigned = async (path: string) => {
    const { data, error } = await supabase.storage.from("pa-files").createSignedUrl(path, 300);
    if (error || !data) { toast.error("เปิดไฟล์ไม่ได้"); return; }
    window.open(data.signedUrl, "_blank");
  };

  // Get current user's personnel_id
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-idplan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("employee_code").eq("id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-idplan", myProfile?.employee_code],
    enabled: !!myProfile?.employee_code,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id").eq("employee_code", myProfile!.employee_code!).maybeSingle();
      return data;
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: canManageAll ? ["id_plan_records"] : ["my_id_plan_records", myPersonnel?.id],
    enabled: canManageAll || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("id_plan_records").select("*, personnel(prefix, first_name, last_name, employee_code)");
      if (!canManageAll && myPersonnel?.id) {
        q = q.eq("personnel_id", myPersonnel.id);
      }
      const { data } = await q.order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Pull latest PA result to power suggestions
  const { data: latestPa } = useQuery({
    queryKey: ["my-latest-pa", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel_assessments")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const suggestions = (() => {
    if (!latestPa) return null;
    const dominant = (latestPa as any).result_summary as string | null;
    const mhScores = ((latestPa as any).scores?.mh || {}) as Record<string, number>;
    const weakMh = Object.entries(mhScores)
      .filter(([, v]) => Number(v) >= 3) // higher avg = more concerning
      .map(([k]) => k);
    const discBlock = dominant && DISC_SUGGESTIONS[dominant];
    const mhCourses = weakMh.flatMap((k) => MH_SUGGESTIONS[k] || []);
    if (!discBlock && mhCourses.length === 0) return null;
    return { discBlock, mhCourses, dominant };
  })();

  const handleQuickAdd = (courseTitle: string) => {
    setTitle(courseTitle);
    setPlanType("training");
    setOpen(true);
  };

  const handleAdd = async () => {
    if (saving) return;
    const targetPersonnelId = canManageAll ? personnelId : myPersonnel?.id;
    if (!targetPersonnelId || !title.trim()) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("id_plan_records").insert({
        personnel_id: targetPersonnelId, plan_type: planType, title: title.trim(), description: nullIfEmpty(description),
        training_hours: hours ? safeInt(hours, 0) : 0,
        training_date: nullIfEmpty(trainingDate), organizer: nullIfEmpty(organizer), notes: nullIfEmpty(notes),
        order_doc_path: orderDocPath || null,
        image_paths: imagePaths,
      } as any);
      if (error) { toast.error(saveErrorMessage(error)); return; }
      toast.success("บันทึกสำเร็จ");
      qc.invalidateQueries({ queryKey: ["id_plan_records"] });
      qc.invalidateQueries({ queryKey: ["my_id_plan_records"] });
      setOpen(false); setTitle(""); setDescription(""); setHours(""); setTrainingDate(""); setOrganizer(""); setNotes("");
      setOrderDocPath(""); setImagePaths([]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ต้องการลบแผนพัฒนานี้หรือไม่?", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("id_plan_records").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: ["id_plan_records"] });
    qc.invalidateQueries({ queryKey: ["my_id_plan_records"] });
  };

  const totalHours = records.filter((r: any) => r.status === "completed").reduce((s: number, r: any) => s + Number(r.training_hours || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            ระบบ ID Plan (แผนพัฒนาตนเอง)
          </h1>
          <p className="text-sm text-muted-foreground">
            {canManageAll ? "จัดเก็บแผนพัฒนาตนเองและเกียรติบัตรการอบรม" : "บันทึกแผนพัฒนาตนเองและเกียรติบัตรการอบรมของคุณ"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />เพิ่มแผนพัฒนา</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>บันทึกแผนพัฒนาตนเอง</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {canManageAll ? (
                <div><Label>บุคลากร *</Label>
                  <Select value={personnelId} onValueChange={setPersonnelId}>
                    <SelectTrigger><SelectValue placeholder="เลือกบุคลากร" /></SelectTrigger>
                    <SelectContent>{personnel.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.employee_code} - {p.prefix}{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">บันทึกแผนพัฒนาตนเองของคุณ</p>
                  {!myPersonnel?.id && <p className="text-destructive text-xs mt-1">⚠ ยังไม่พบข้อมูลบุคลากรของคุณในระบบ กรุณาติดต่อผู้ดูแลระบบ</p>}
                </div>
              )}
              <div><Label>ประเภท</Label>
                <Select value={planType} onValueChange={setPlanType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.th}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>หัวข้อ/ชื่อหลักสูตร *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>รายละเอียด</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>จำนวนชั่วโมง</Label><Input type="number" value={hours} onChange={e => setHours(e.target.value)} /></div>
                <div><Label>วันที่อบรม</Label><BEDatePicker value={trainingDate} onChange={(v) => setTrainingDate(v)} /></div>
              </div>
              <div><Label>หน่วยงานจัด</Label><Input value={organizer} onChange={e => setOrganizer(e.target.value)} placeholder="เช่น สพฐ., คุรุสภา" /></div>
              <div><Label>หมายเหตุ</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>

              {/* หนังสือคำสั่ง */}
              <div>
                <Label className="flex items-center gap-1.5"><FileText className="w-4 h-4" />หนังสือคำสั่ง / เอกสารแนบ</Label>
                {orderDocPath ? (
                  <div className="flex items-center justify-between p-2 mt-1 rounded-md border bg-muted/50 text-sm">
                    <button type="button" className="text-primary hover:underline truncate text-left flex items-center gap-1.5" onClick={() => openSigned(orderDocPath)}>
                      <Paperclip className="w-3.5 h-3.5" /> {orderDocPath.split("/").pop()}
                    </button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOrderDocPath("")}><X className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled={uploadingOrder}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setUploadingOrder(true);
                      const p = await uploadToBucket(f, "order");
                      setUploadingOrder(false);
                      if (p) setOrderDocPath(p);
                      e.target.value = "";
                    }}
                  />
                )}
                {uploadingOrder && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังอัปโหลด...</p>}
              </div>

              {/* รูปภาพ */}
              <div>
                <Label className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4" />รูปภาพประกอบ ({imagePaths.length})</Label>
                {imagePaths.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {imagePaths.map((p, i) => (
                      <div key={p} className="flex items-center justify-between p-2 rounded-md border bg-muted/50 text-sm">
                        <button type="button" className="text-primary hover:underline truncate text-left flex items-center gap-1.5" onClick={() => openSigned(p)}>
                          <ImageIcon className="w-3.5 h-3.5" /> {p.split("/").pop()}
                        </button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImagePaths(imagePaths.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingImages}
                  className="mt-1"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []); if (!files.length) return;
                    setUploadingImages(true);
                    const uploaded: string[] = [];
                    for (const f of files) {
                      const p = await uploadToBucket(f, "image");
                      if (p) uploaded.push(p);
                    }
                    setUploadingImages(false);
                    setImagePaths([...imagePaths, ...uploaded]);
                    e.target.value = "";
                  }}
                />
                {uploadingImages && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังอัปโหลด...</p>}
              </div>

              <Button onClick={handleAdd} className="w-full" disabled={saving || (!canManageAll && !myPersonnel?.id)}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="แผนพัฒนาทั้งหมด" value={records.length} icon={BookOpen} tone="primary" />
        <StatCard
          label="สำเร็จแล้ว"
          value={records.filter((r: any) => r.status === "completed").length}
          icon={GraduationCap}
          tone="success"
        />
        <StatCard label="รวมชั่วโมงอบรม" value={`${totalHours} ชม.`} tone="muted" />
      </div>

      {suggestions && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  คำแนะนำหลักสูตรจากผลการประเมินบุคลากร (PA)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  อิงจากผล DISC ล่าสุด: <Badge variant="outline" className="ml-1">{suggestions.dominant || "-"}</Badge>
                  {suggestions.discBlock && <span className="ml-2">{suggestions.discBlock.label}</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestions.discBlock?.courses.map((c) => (
                <button
                  key={c}
                  onClick={() => handleQuickAdd(c)}
                  className="text-left p-3 rounded-lg border bg-background/60 hover:bg-primary/5 hover:border-primary/40 transition-all flex items-start gap-2 group"
                >
                  <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{c}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 group-hover:text-primary">+ คลิกเพื่อเพิ่มเข้าแผน</p>
                  </div>
                </button>
              ))}
              {suggestions.mhCourses.map((c) => (
                <button
                  key={c}
                  onClick={() => handleQuickAdd(c)}
                  className="text-left p-3 rounded-lg border bg-background/60 hover:bg-amber-50 hover:border-amber-300 transition-all flex items-start gap-2 group"
                >
                  <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{c}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 group-hover:text-amber-700">+ ด้านสุขภาพจิต · คลิกเพื่อเพิ่ม</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>บุคลากร</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>หัวข้อ</TableHead>
            <TableHead>ชั่วโมง</TableHead>
            <TableHead>วันที่</TableHead>
            <TableHead>หน่วยงาน</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead>ไฟล์แนบ</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => {
              const st = STATUS_MAP[r.status] || { label: r.status, color: "" };
              const pt = PLAN_TYPES.find(t => t.value === r.plan_type);
              const imgs: string[] = r.image_paths || [];
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell>
                  <TableCell><Badge variant="outline">{pt?.th || r.plan_type}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.title}</TableCell>
                  <TableCell>{r.training_hours || 0} ชม.</TableCell>
                  <TableCell className="whitespace-nowrap">{r.training_date || "-"}</TableCell>
                  <TableCell>{r.organizer || "-"}</TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.order_doc_path && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={() => openSigned(r.order_doc_path)} title="หนังสือคำสั่ง">
                          <FileText className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      {imgs.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" onClick={() => openSigned(imgs[0])} title={`รูปภาพ ${imgs.length} ไฟล์`}>
                          <ImageIcon className="w-4 h-4 text-primary" /> <span className="text-xs">{imgs.length}</span>
                        </Button>
                      )}
                      {!r.order_doc_path && imgs.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
            {records.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default IdPlanPage;
