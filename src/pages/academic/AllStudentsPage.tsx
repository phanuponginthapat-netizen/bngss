import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Users, Search, ArrowUpCircle, Download, Printer, Eye, Pencil, User, Heart, GraduationCap } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useFieldVisibility, FIELD_LABELS, type DmcFieldConfig } from "@/hooks/useFieldVisibility";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { formatDateBE } from "@/lib/dateBE";
import { SPECIAL_NEEDS_TYPES } from "@/lib/specialNeeds";
import { z } from "zod";
import { validateAndConfirm, commonRegex } from "@/lib/formValidation";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage } from "@/lib/saveError";

const studentSchema = z.object({
  first_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  last_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  student_code: z.string().trim().min(1, "กรุณากรอกรหัสนักเรียน").max(20),
  national_id: z.string().trim().regex(/^\d{13}$/, "ต้องเป็นเลข 13 หลัก").optional().or(z.literal("")).or(z.null()),
  father_phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์ไม่ถูกต้อง").optional().or(z.literal("")).or(z.null()),
  mother_phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์ไม่ถูกต้อง").optional().or(z.literal("")).or(z.null()),
  guardian_phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์ไม่ถูกต้อง").optional().or(z.literal("")).or(z.null()),
});
const studentLabels = {
  first_name: "ชื่อ", last_name: "นามสกุล", student_code: "รหัสนักเรียน",
  national_id: "เลขบัตรประชาชน", father_phone: "เบอร์บิดา", mother_phone: "เบอร์มารดา", guardian_phone: "เบอร์ผู้ปกครอง",
};

const GRADE_LEVELS = [
  "อ.1", "อ.2", "อ.3",
  "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
  "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  "การศึกษาพิเศษ",
];

const GRADE_NEXT: Record<string, string> = {
  "อ.1": "อ.2", "อ.2": "อ.3", "อ.3": "ป.1",
  "ป.1": "ป.2", "ป.2": "ป.3", "ป.3": "ป.4",
  "ป.4": "ป.5", "ป.5": "ป.6", "ป.6": "ม.1",
  "ม.1": "ม.2", "ม.2": "ม.3", "ม.3": "ม.4",
  "ม.4": "ม.5", "ม.5": "ม.6",
};

const AllStudentsPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { config: fieldConfig } = useFieldVisibility();
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterSpecial, setFilterSpecial] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteClassroomIds, setPromoteClassroomIds] = useState<string[]>([]);
  // Per-source target classroom override: source_id → target_id ("auto" = round-robin, "graduate" = จบการศึกษา)
  const [promoteTarget, setPromoteTarget] = useState<Record<string, string>>({});
  // Per-student opt-out: student ids ที่จะให้จบการศึกษา (ศิษย์เก่า) แทนการเลื่อนชั้น
  const [graduateStudentIds, setGraduateStudentIds] = useState<Record<string, Set<string>>>({});
  const [expandedClassroom, setExpandedClassroom] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [detailStudent, setDetailStudent] = useState<any>(null);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { data: students = [], isLoading, isError, error } = useQuery({
    queryKey: ["all_students_dmc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(name, grade_level)")
        .order("student_code");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });

  const filtered = students.filter((s: any) => {
    const matchSearch =
      s.student_code?.toLowerCase().includes(search.toLowerCase()) ||
      s.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.national_id?.includes(search);
    const matchGrade = filterGrade === "all" || s.classrooms?.grade_level === filterGrade;
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchSpecial = !filterSpecial || !!s.is_special_needs;
    return matchSearch && matchGrade && matchStatus && matchSpecial;
  });

  const totalActive = students.filter((s: any) => s.status === "active").length;
  const isMale = (s: any) => s.gender === "ช" || s.gender === "ชาย" || s.gender === "male" || s.prefix === "ด.ช." || s.prefix === "เด็กชาย" || s.prefix === "นาย";
  const isFemale = (s: any) => s.gender === "ญ" || s.gender === "หญิง" || s.gender === "female" || s.prefix === "ด.ญ." || s.prefix === "เด็กหญิง" || s.prefix === "นางสาว" || s.prefix === "น.ส.";
  const totalMale = students.filter((s: any) => s.status === "active" && isMale(s)).length;
  const totalFemale = students.filter((s: any) => s.status === "active" && isFemale(s)).length;
  const gradeStats = GRADE_LEVELS.map((g) => ({
    grade: g,
    count: students.filter((s: any) => s.status === "active" && s.classrooms?.grade_level === g).length,
  }));

  const handlePromote = async () => {
    if (promoteClassroomIds.length === 0) return;
    setPromoting(true);
    try {
      let totalPromoted = 0;
      let totalGraduated = 0;
      const errors: string[] = [];
      const nowYear = new Date().getFullYear() + BE_OFFSET;

      for (const classroomId of promoteClassroomIds) {
        const source = classrooms.find((c: any) => c.id === classroomId);
        if (!source) continue;

        const allActive = students.filter(
          (s: any) => s.classroom_id === classroomId && s.status === "active"
        );
        if (allActive.length === 0) continue;

        const optOut = graduateStudentIds[classroomId] || new Set<string>();
        const explicitTarget = promoteTarget[classroomId];
        const nextGrade = GRADE_NEXT[source.grade_level];
        const wholeRoomGraduate = explicitTarget === "graduate" || !nextGrade;

        // แยก 2 กลุ่ม: จบการศึกษา vs เลื่อนชั้น
        const graduatingStudents = wholeRoomGraduate
          ? allActive
          : allActive.filter((s: any) => optOut.has(s.id));
        const promotingStudents = wholeRoomGraduate
          ? []
          : allActive.filter((s: any) => !optOut.has(s.id));

        // ── กลุ่มจบการศึกษา → ศิษย์เก่า
        if (graduatingStudents.length > 0) {
          const ids = graduatingStudents.map((s: any) => s.id);
          const { error } = await supabase
            .from("students")
            .update({ status: "graduated", graduation_year: nowYear })
            .in("id", ids);
          if (error) {
            errors.push(`${source.grade_level}/${source.name} (จบ): ${error.message}`);
          } else {
            totalGraduated += ids.length;
          }
        }

        if (promotingStudents.length === 0) continue;

        // ── กลุ่มเลื่อนชั้น: ไปห้องที่ระบุ (batch)
        if (explicitTarget && explicitTarget !== "auto") {
          const ids = promotingStudents.map((s: any) => s.id);
          const { error } = await supabase
            .from("students")
            .update({ classroom_id: explicitTarget })
            .in("id", ids);
          if (error) { errors.push(`${source.grade_level}/${source.name}: ${error.message}`); continue; }
          totalPromoted += ids.length;
          continue;
        }

        // ── auto: กระจาย round-robin ไปทุกห้องของ nextGrade
        const targetClassrooms = classrooms.filter((c: any) => c.grade_level === nextGrade);
        if (targetClassrooms.length === 0) {
          errors.push(`ไม่มีห้อง ${nextGrade} — โปรดสร้างก่อน หรือเลือก "จบการศึกษา"`);
          continue;
        }
        const buckets: Record<string, string[]> = {};
        promotingStudents.forEach((st: any, i: number) => {
          const t = targetClassrooms[i % targetClassrooms.length].id;
          (buckets[t] ||= []).push(st.id);
        });
        for (const [targetId, ids] of Object.entries(buckets)) {
          const { error } = await supabase
            .from("students")
            .update({ classroom_id: targetId })
            .in("id", ids);
          if (error) { errors.push(`${source.grade_level}/${source.name} → ${targetId.slice(0, 8)}: ${error.message}`); continue; }
          totalPromoted += ids.length;
        }
      }

      const parts: string[] = [];
      if (totalPromoted) parts.push(`เลื่อนชั้น ${totalPromoted} คน`);
      if (totalGraduated) parts.push(`จบการศึกษา ${totalGraduated} คน`);
      if (parts.length) toast.success(parts.join(" · "));
      if (errors.length) toast.error(errors.slice(0, 3).join("\n"));

      qc.invalidateQueries({ queryKey: ["all_students_dmc"] });
      setPromoteOpen(false);
      setPromoteClassroomIds([]);
      setPromoteTarget({});
      setGraduateStudentIds({});
      setExpandedClassroom(null);
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    }
    setPromoting(false);
  };

  const handleSaveStudent = async () => {
    if (!editStudent) return;
    const { ok } = await validateAndConfirm(
      studentSchema,
      {
        first_name: editStudent.first_name,
        last_name: editStudent.last_name,
        student_code: editStudent.student_code,
        national_id: editStudent.national_id ?? "",
        father_phone: editStudent.father_phone ?? "",
        mother_phone: editStudent.mother_phone ?? "",
        guardian_phone: editStudent.guardian_phone ?? "",
      },
      {
        confirmTitle: "ยืนยันบันทึกข้อมูลนักเรียน?",
        confirmText: `${editStudent.first_name} ${editStudent.last_name} (${editStudent.student_code})`,
        labels: studentLabels,
      },
    );
    if (!ok) return;
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      const { id, classrooms: _, ...updateData } = editStudent;
      delete updateData.created_at;
      delete updateData.updated_at;
      const { error } = await supabase.from("students").update(updateData).eq("id", id);
      if (error) throw error;
      toast.success("บันทึกข้อมูลสำเร็จ");
      qc.invalidateQueries({ queryKey: ["all_students_dmc"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditStudent(null);
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    }
    toast.dismiss(__tid_save_1);
      setSaving(false);
  };

  const handleExportCSV = () => {
    const headers = ["รหัสนักเรียน", "เลขประจำตัวประชาชน", "คำนำหน้า", "ชื่อ", "นามสกุล", "เพศ", "วันเกิด", "สัญชาติ", "ศาสนา", "ระดับชั้น", "ห้อง", "สถานะ", "ชื่อบิดา", "ชื่อมารดา", "ผู้ปกครอง", "โทรผู้ปกครอง"];
    const rows = filtered.map((s: any) => [
      s.student_code, s.national_id || "", s.prefix || "", s.first_name, s.last_name,
      s.gender || "", s.date_of_birth || "", s.nationality || "", s.religion || "",
      s.classrooms?.grade_level || "", s.classrooms?.name || "", s.status,
      s.father_name || "", s.mother_name || "", s.guardian_name || "", s.guardian_phone || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students_dmc.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const updateEdit = (field: string, value: any) => {
    if (editStudent) setEditStudent({ ...editStudent, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {lang === "th" ? "ข้อมูลนักเรียนทั้งหมด (DMC)" : "All Students (DMC)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th" ? "ระบบจัดการข้อมูลนักเรียนรายบุคคล แบบ DMC สพฐ." : "OBEC DMC Student Data System"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" /> ส่งออก CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> พิมพ์
          </Button>
          <Button size="sm" onClick={() => setPromoteOpen(true)}>
            <ArrowUpCircle className="w-4 h-4 mr-1" /> เลื่อนชั้นทั้งห้อง
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">นักเรียนทั้งหมด</p>
          <p className="text-3xl font-bold text-accent-foreground bg-transparent text-red-600">{totalActive}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">ชาย</p>
          <p className="text-3xl font-bold text-blue-600">{totalMale}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">หญิง</p>
          <p className="text-3xl font-bold text-pink-600">{totalFemale}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">ห้องเรียน</p>
          <p className="text-3xl font-bold text-amber-600">{classrooms.length}</p>
        </CardContent></Card>
      </div>

      {/* Grade Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">จำนวนนักเรียนแยกตามระดับชั้น</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {gradeStats.filter((g) => g.count > 0).map((g) => (
              <div key={g.grade} className="text-center p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => setFilterGrade(g.grade)}>
                <p className="text-xs font-semibold text-muted-foreground">{g.grade}</p>
                <p className="text-lg font-bold text-foreground">{g.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อ รหัส เลขบัตรฯ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <ScanSearchButton onScan={setSearch} />
        <Select value={filterGrade} onValueChange={setFilterGrade}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับชั้น</SelectItem>
            {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="active">กำลังศึกษา</SelectItem>
            <SelectItem value="graduated">จบการศึกษา</SelectItem>
            <SelectItem value="transferred">ย้ายสถานศึกษา</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card cursor-pointer text-sm">
          <Checkbox checked={filterSpecial} onCheckedChange={(v) => setFilterSpecial(!!v)} />
          เฉพาะการศึกษาพิเศษ
        </label>
      </div>

      {/* Student Table */}
      <Card className="shadow-card border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {fieldConfig.photo_url && <TableHead className="w-14">รูป</TableHead>}
                <TableHead>รหัส นร.</TableHead>
                {fieldConfig.national_id && <TableHead>เลขบัตรฯ</TableHead>}
                <TableHead>คำนำหน้า</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>นามสกุล</TableHead>
                {fieldConfig.gender && <TableHead>เพศ</TableHead>}
                <TableHead>ระดับชั้น</TableHead>
                <TableHead>ห้อง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={20} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={20} className="text-center py-8 text-destructive">โหลดข้อมูลนักเรียนไม่สำเร็จ: {(error as Error)?.message || "ไม่ทราบสาเหตุ"}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={20} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลนักเรียน</TableCell></TableRow>
              ) : (
                filtered.map((s: any, i: number) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    {fieldConfig.photo_url && (
                      <TableCell className="w-14">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={s.first_name}
                            width={36}
                            height={36}
                            className="w-9 h-9 min-w-9 min-h-9 aspect-square shrink-0 rounded-full object-cover border block"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-9 h-9 aspect-square shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">{s.student_code}</TableCell>
                    {fieldConfig.national_id && <TableCell className="font-mono text-xs">{s.national_id || "—"}</TableCell>}
                    <TableCell>{s.prefix}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{s.first_name}</span>
                        {s.is_special_needs && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300" title={s.special_needs_type || s.special_needs || "การศึกษาพิเศษ"}>
                            พิเศษ
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{s.last_name}</TableCell>
                    {fieldConfig.gender && <TableCell className="text-xs">{isMale(s) ? "ชาย" : isFemale(s) ? "หญิง" : s.gender || "—"}</TableCell>}
                    <TableCell><Badge variant="secondary">{s.classrooms?.grade_level || "—"}</Badge></TableCell>
                    <TableCell>{s.classrooms?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "outline"}
                        className={s.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
                        {s.status === "active" ? "กำลังศึกษา" : s.status === "graduated" ? "จบ" : s.status === "transferred" ? "ย้าย" : s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailStudent(s)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditStudent({ ...s })}><Pencil className="w-4 h-4 text-primary" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailStudent} onOpenChange={(o) => { if (!o) setDetailStudent(null); }}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              ข้อมูลนักเรียน DMC - {detailStudent?.first_name} {detailStudent?.last_name}
            </DialogTitle>
          </DialogHeader>
          {detailStudent && (
            <>
              {fieldConfig.photo_url && (
                <div className="flex justify-center pb-2">
                  {detailStudent.photo_url ? (
                    <img src={detailStudent.photo_url} alt={detailStudent.first_name} className="w-28 h-28 rounded-full object-cover border-4 border-primary/20 shadow-md" />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            <Tabs defaultValue="personal" className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="personal">ข้อมูลส่วนตัว</TabsTrigger>
                <TabsTrigger value="parents">ข้อมูลผู้ปกครอง</TabsTrigger>
                <TabsTrigger value="education">การศึกษา</TabsTrigger>
              </TabsList>
              <TabsContent value="personal">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoItem label="รหัสนักเรียน" value={detailStudent.student_code} />
                  {fieldConfig.national_id && <InfoItem label="เลขบัตรฯ" value={detailStudent.national_id} />}
                  <InfoItem label="คำนำหน้า" value={detailStudent.prefix} />
                  <InfoItem label="ชื่อ-นามสกุล" value={`${detailStudent.first_name} ${detailStudent.last_name}`} />
                  {fieldConfig.gender && <InfoItem label="เพศ" value={isMale(detailStudent) ? "ชาย" : isFemale(detailStudent) ? "หญิง" : detailStudent.gender || "—"} />}
                  {fieldConfig.date_of_birth && <InfoItem label="วันเกิด" value={formatDateBE(detailStudent.date_of_birth) || detailStudent.date_of_birth} />}
                  {fieldConfig.nationality && <InfoItem label="สัญชาติ" value={detailStudent.nationality} />}
                  {fieldConfig.ethnicity && <InfoItem label="เชื้อชาติ" value={detailStudent.ethnicity} />}
                  {fieldConfig.religion && <InfoItem label="ศาสนา" value={detailStudent.religion} />}
                  {fieldConfig.blood_type && <InfoItem label="หมู่เลือด" value={detailStudent.blood_type} />}
                  {fieldConfig.birth_province && <InfoItem label="จังหวัดเกิด" value={detailStudent.birth_province} />}
                  {fieldConfig.weight && <InfoItem label="น้ำหนัก" value={detailStudent.weight ? `${detailStudent.weight} กก.` : null} />}
                  {fieldConfig.height && <InfoItem label="ส่วนสูง" value={detailStudent.height ? `${detailStudent.height} ซม.` : null} />}
                  {fieldConfig.phone && <InfoItem label="โทรศัพท์" value={detailStudent.phone} />}
                  {fieldConfig.address && <div className="col-span-2"><InfoItem label="ที่อยู่" value={detailStudent.address} /></div>}
                </div>
              </TabsContent>
              <TabsContent value="parents">
                <div className="space-y-4">
                  {fieldConfig.father_name && (
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> ข้อมูลบิดา</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <InfoItem label="ชื่อบิดา" value={detailStudent.father_name} />
                        {fieldConfig.father_id && <InfoItem label="เลขบัตรฯ" value={detailStudent.father_id} />}
                        {fieldConfig.father_phone && <InfoItem label="โทรศัพท์" value={detailStudent.father_phone} />}
                        {fieldConfig.father_occupation && <InfoItem label="อาชีพ" value={detailStudent.father_occupation} />}
                      </div>
                    </div>
                  )}
                  {fieldConfig.mother_name && (
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> ข้อมูลมารดา</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <InfoItem label="ชื่อมารดา" value={detailStudent.mother_name} />
                        {fieldConfig.mother_id && <InfoItem label="เลขบัตรฯ" value={detailStudent.mother_id} />}
                        {fieldConfig.mother_phone && <InfoItem label="โทรศัพท์" value={detailStudent.mother_phone} />}
                        {fieldConfig.mother_occupation && <InfoItem label="อาชีพ" value={detailStudent.mother_occupation} />}
                      </div>
                    </div>
                  )}
                  {fieldConfig.guardian_name && (
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2 flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> ข้อมูลผู้ปกครอง</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <InfoItem label="ชื่อผู้ปกครอง" value={detailStudent.guardian_name} />
                        {fieldConfig.guardian_phone && <InfoItem label="โทรศัพท์" value={detailStudent.guardian_phone} />}
                        {fieldConfig.guardian_relation && <InfoItem label="ความสัมพันธ์" value={detailStudent.guardian_relation} />}
                      </div>
                    </div>
                  )}
                  {fieldConfig.emergency_contact && (
                    <div>
                      <h4 className="font-semibold text-sm text-destructive mb-2">ผู้ติดต่อฉุกเฉิน</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <InfoItem label="ชื่อ" value={detailStudent.emergency_contact} />
                        {fieldConfig.emergency_phone && <InfoItem label="โทรศัพท์" value={detailStudent.emergency_phone} />}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="education">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoItem label="ระดับชั้น" value={detailStudent.classrooms?.grade_level} />
                  <InfoItem label="ห้อง" value={detailStudent.classrooms?.name} />
                  {fieldConfig.previous_school && <InfoItem label="โรงเรียนเดิม" value={detailStudent.previous_school} />}
                  {fieldConfig.admission_date && <InfoItem label="วันที่เข้าเรียน" value={detailStudent.admission_date} />}
                  {detailStudent.is_special_needs && (
                    <div className="col-span-2"><InfoItem label="การศึกษาพิเศษ" value={detailStudent.special_needs_type || "—"} /></div>
                  )}
                  {fieldConfig.special_needs && <div className="col-span-2"><InfoItem label="หมายเหตุความต้องการพิเศษ" value={detailStudent.special_needs} /></div>}
                  <InfoItem label="สถานะ" value={detailStudent.status === "active" ? "กำลังศึกษา" : detailStudent.status} />
                </div>
              </TabsContent>
            </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editStudent} onOpenChange={(o) => { if (!o) setEditStudent(null); }}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              แก้ไขข้อมูล DMC - {editStudent?.first_name} {editStudent?.last_name}
            </DialogTitle>
          </DialogHeader>
          {editStudent && (
            <Tabs defaultValue="personal" className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="personal">ข้อมูลส่วนตัว</TabsTrigger>
                <TabsTrigger value="parents">ผู้ปกครอง</TabsTrigger>
                <TabsTrigger value="education">การศึกษา</TabsTrigger>
                <TabsTrigger value="health">สุขภาพ</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>รหัสนักเรียน</Label><Input value={editStudent.student_code} onChange={e => updateEdit("student_code", e.target.value)} /></div>
                  {fieldConfig.national_id && <div><Label>เลขประจำตัวประชาชน</Label><Input value={editStudent.national_id || ""} onChange={e => updateEdit("national_id", e.target.value)} maxLength={13} /></div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>คำนำหน้า</Label>
                    <Select value={editStudent.prefix || "ด.ช."} onValueChange={v => updateEdit("prefix", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ด.ช.">ด.ช.</SelectItem>
                        <SelectItem value="ด.ญ.">ด.ญ.</SelectItem>
                        <SelectItem value="นาย">นาย</SelectItem>
                        <SelectItem value="นางสาว">นางสาว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>ชื่อ</Label><Input value={editStudent.first_name} onChange={e => updateEdit("first_name", e.target.value)} /></div>
                  <div><Label>นามสกุล</Label><Input value={editStudent.last_name} onChange={e => updateEdit("last_name", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fieldConfig.gender && <div><Label>เพศ</Label>
                    <Select value={editStudent.gender || ""} onValueChange={v => updateEdit("gender", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">ชาย</SelectItem>
                        <SelectItem value="female">หญิง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>}
                  {fieldConfig.date_of_birth && <div><Label>วันเกิด</Label><BEDatePicker value={editStudent.date_of_birth || ""} onChange={(v) => updateEdit("date_of_birth", v)} /></div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {fieldConfig.nationality && <div><Label>สัญชาติ</Label><Input value={editStudent.nationality || "ไทย"} onChange={e => updateEdit("nationality", e.target.value)} /></div>}
                  {fieldConfig.ethnicity && <div><Label>เชื้อชาติ</Label><Input value={editStudent.ethnicity || "ไทย"} onChange={e => updateEdit("ethnicity", e.target.value)} /></div>}
                  {fieldConfig.religion && <div><Label>ศาสนา</Label><Input value={editStudent.religion || "พุทธ"} onChange={e => updateEdit("religion", e.target.value)} /></div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fieldConfig.blood_type && <div><Label>หมู่เลือด</Label>
                    <Select value={editStudent.blood_type || ""} onValueChange={v => updateEdit("blood_type", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                      <SelectContent>
                        {["A", "B", "AB", "O"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>}
                  {fieldConfig.birth_province && <div><Label>จังหวัดเกิด</Label><Input value={editStudent.birth_province || ""} onChange={e => updateEdit("birth_province", e.target.value)} /></div>}
                </div>
                {fieldConfig.phone && <div><Label>โทรศัพท์</Label><Input value={editStudent.phone || ""} onChange={e => updateEdit("phone", e.target.value)} /></div>}
                {fieldConfig.address && <div><Label>ที่อยู่</Label><Textarea value={editStudent.address || ""} onChange={e => updateEdit("address", e.target.value)} /></div>}
              </TabsContent>
              <TabsContent value="parents" className="space-y-4">
                {fieldConfig.father_name && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-primary">ข้อมูลบิดา</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อบิดา</Label><Input value={editStudent.father_name || ""} onChange={e => updateEdit("father_name", e.target.value)} /></div>
                      {fieldConfig.father_id && <div><Label>เลขบัตรฯ</Label><Input value={editStudent.father_id || ""} onChange={e => updateEdit("father_id", e.target.value)} maxLength={13} /></div>}
                      {fieldConfig.father_phone && <div><Label>โทรศัพท์</Label><Input value={editStudent.father_phone || ""} onChange={e => updateEdit("father_phone", e.target.value)} /></div>}
                      {fieldConfig.father_occupation && <div><Label>อาชีพ</Label><Input value={editStudent.father_occupation || ""} onChange={e => updateEdit("father_occupation", e.target.value)} /></div>}
                    </div>
                  </div>
                )}
                {fieldConfig.mother_name && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-primary">ข้อมูลมารดา</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อมารดา</Label><Input value={editStudent.mother_name || ""} onChange={e => updateEdit("mother_name", e.target.value)} /></div>
                      {fieldConfig.mother_id && <div><Label>เลขบัตรฯ</Label><Input value={editStudent.mother_id || ""} onChange={e => updateEdit("mother_id", e.target.value)} maxLength={13} /></div>}
                      {fieldConfig.mother_phone && <div><Label>โทรศัพท์</Label><Input value={editStudent.mother_phone || ""} onChange={e => updateEdit("mother_phone", e.target.value)} /></div>}
                      {fieldConfig.mother_occupation && <div><Label>อาชีพ</Label><Input value={editStudent.mother_occupation || ""} onChange={e => updateEdit("mother_occupation", e.target.value)} /></div>}
                    </div>
                  </div>
                )}
                {fieldConfig.guardian_name && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-primary">ข้อมูลผู้ปกครอง</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อผู้ปกครอง</Label><Input value={editStudent.guardian_name || ""} onChange={e => updateEdit("guardian_name", e.target.value)} /></div>
                      {fieldConfig.guardian_phone && <div><Label>โทรศัพท์</Label><Input value={editStudent.guardian_phone || ""} onChange={e => updateEdit("guardian_phone", e.target.value)} /></div>}
                      {fieldConfig.guardian_relation && <div><Label>ความสัมพันธ์</Label><Input value={editStudent.guardian_relation || ""} onChange={e => updateEdit("guardian_relation", e.target.value)} /></div>}
                    </div>
                  </div>
                )}
                {fieldConfig.emergency_contact && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-destructive">ผู้ติดต่อฉุกเฉิน</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ชื่อ</Label><Input value={editStudent.emergency_contact || ""} onChange={e => updateEdit("emergency_contact", e.target.value)} /></div>
                      {fieldConfig.emergency_phone && <div><Label>โทรศัพท์</Label><Input value={editStudent.emergency_phone || ""} onChange={e => updateEdit("emergency_phone", e.target.value)} /></div>}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="education" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>ระดับชั้น (ห้องเรียน)</Label>
                    <Select value={editStudent.classroom_id || ""} onValueChange={v => updateEdit("classroom_id", v)}>
                      <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                      <SelectContent>
                        {classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>สถานะ</Label>
                    <Select value={editStudent.status} onValueChange={v => updateEdit("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">กำลังศึกษา</SelectItem>
                        <SelectItem value="graduated">จบการศึกษา</SelectItem>
                        <SelectItem value="transferred">ย้ายสถานศึกษา</SelectItem>
                        <SelectItem value="dropped">พ้นสภาพ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {fieldConfig.previous_school && <div><Label>โรงเรียนเดิม</Label><Input value={editStudent.previous_school || ""} onChange={e => updateEdit("previous_school", e.target.value)} /></div>}
                {fieldConfig.admission_date && <div><Label>วันที่เข้าเรียน</Label><BEDatePicker value={editStudent.admission_date || ""} onChange={(v) => updateEdit("admission_date", v)} /></div>}
                <div className="border rounded-md p-3 bg-amber-50/40 dark:bg-amber-900/10 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!editStudent.is_special_needs}
                      onCheckedChange={(v) => {
                        const on = !!v;
                        if (on) {
                          // Move current classroom -> inclusion, clear primary until special class picked
                          setEditStudent((prev: any) => ({
                            ...prev,
                            is_special_needs: true,
                            inclusion_classroom_id: prev?.inclusion_classroom_id || prev?.classroom_id || null,
                            classroom_id: null,
                          }));
                        } else {
                          // Move inclusion back to primary, clear special-needs fields
                          setEditStudent((prev: any) => ({
                            ...prev,
                            is_special_needs: false,
                            classroom_id: prev?.inclusion_classroom_id || prev?.classroom_id || null,
                            inclusion_classroom_id: null,
                            special_needs_type: null,
                          }));
                        }
                      }}
                    />
                    <span className="font-medium text-sm">เป็นนักเรียนการศึกษาพิเศษ (เรียนรวม)</span>
                  </label>
                  {editStudent.is_special_needs && (
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label>ห้องประจำ (การศึกษาพิเศษ)</Label>
                        <Select
                          value={editStudent.classroom_id || ""}
                          onValueChange={(v) => updateEdit("classroom_id", v)}
                        >
                          <SelectTrigger><SelectValue placeholder="เลือกห้องการศึกษาพิเศษ" /></SelectTrigger>
                          <SelectContent>
                            {classrooms
                              .filter((c: any) => c.grade_level === "การศึกษาพิเศษ")
                              .map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            {classrooms.filter((c: any) => c.grade_level === "การศึกษาพิเศษ").length === 0 && (
                              <div className="px-3 py-2 text-sm text-muted-foreground">
                                ยังไม่มีห้องการศึกษาพิเศษ — สร้างที่หน้าจัดการห้องเรียนก่อน
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ห้องเรียนรวม (ห้องปกติ)</Label>
                        <Select
                          value={editStudent.inclusion_classroom_id || ""}
                          onValueChange={(v) => updateEdit("inclusion_classroom_id", v)}
                        >
                          <SelectTrigger><SelectValue placeholder="เลือกห้องเรียนรวม" /></SelectTrigger>
                          <SelectContent>
                            {classrooms
                              .filter((c: any) => c.grade_level !== "การศึกษาพิเศษ")
                              .map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.grade_level} {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>ประเภทความต้องการพิเศษ</Label>
                        <Select
                          value={editStudent.special_needs_type || ""}
                          onValueChange={(v) => updateEdit("special_needs_type", v)}
                        >
                          <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                          <SelectContent>
                            {SPECIAL_NEEDS_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>หมายเหตุ / รายละเอียดเพิ่มเติม</Label>
                        <Textarea
                          rows={2}
                          value={editStudent.special_needs || ""}
                          onChange={(e) => updateEdit("special_needs", e.target.value)}
                          placeholder="เช่น แผน IEP, ครูพี่เลี้ยง, การช่วยเหลือพิเศษ"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="health" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fieldConfig.weight && <div><Label>น้ำหนัก (กก.)</Label><Input type="number" value={editStudent.weight || ""} onChange={e => updateEdit("weight", e.target.value ? Number(e.target.value) : null)} /></div>}
                  {fieldConfig.height && <div><Label>ส่วนสูง (ซม.)</Label><Input type="number" value={editStudent.height || ""} onChange={e => updateEdit("height", e.target.value ? Number(e.target.value) : null)} /></div>}
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStudent(null)}>ยกเลิก</Button>
            <Button onClick={handleSaveStudent} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote Dialog */}
      <Dialog open={promoteOpen} onOpenChange={(open) => { setPromoteOpen(open); if (!open) { setPromoteClassroomIds([]); setPromoteTarget({}); setGraduateStudentIds({}); setExpandedClassroom(null); } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-primary" />
              เลื่อนชั้น / จบการศึกษา
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              เลือกห้อง แล้วเลือกปลายทาง — กด <b>"เลือกรายคน"</b> เพื่อระบุนักเรียนที่ไม่ได้เรียนต่อ (จะย้ายเป็นศิษย์เก่าอัตโนมัติ)
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectable = classrooms.filter((c: any) => !!GRADE_NEXT[c.grade_level] || c.grade_level === "ม.6").map((c: any) => c.id);
                  setPromoteClassroomIds(prev => prev.length === selectable.length ? [] : selectable);
                }}
              >
                {promoteClassroomIds.length > 0 ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
              <span className="text-sm text-muted-foreground">เลือกแล้ว {promoteClassroomIds.length} ห้อง</span>
            </div>

            {/* Preview summary */}
            {promoteClassroomIds.length > 0 && (() => {
              let willPromote = 0, willGraduate = 0;
              for (const cid of promoteClassroomIds) {
                const c = classrooms.find((x: any) => x.id === cid);
                if (!c) continue;
                const cnt = students.filter((s: any) => s.classroom_id === cid && s.status === "active").length;
                const t = promoteTarget[cid];
                const optOut = graduateStudentIds[cid]?.size || 0;
                if (t === "graduate" || !GRADE_NEXT[c.grade_level]) {
                  willGraduate += cnt;
                } else {
                  willGraduate += optOut;
                  willPromote += cnt - optOut;
                }
              }
              return (
                <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <span className="font-medium">สรุป:</span>
                  {willPromote > 0 && <Badge className="bg-emerald-600 text-white">เลื่อนชั้น {willPromote} คน</Badge>}
                  {willGraduate > 0 && <Badge className="bg-amber-600 text-white">จบการศึกษา (ศิษย์เก่า) {willGraduate} คน</Badge>}
                </div>
              );
            })()}

            <div className="max-h-[26rem] overflow-y-auto space-y-2 border rounded-md p-3">
              {classrooms.map((c: any) => {
                const roomStudents = students.filter((s: any) => s.classroom_id === c.id && s.status === "active");
                const count = roomStudents.length;
                const nextGrade = GRADE_NEXT[c.grade_level];
                const isChecked = promoteClassroomIds.includes(c.id);
                const nextClassrooms = nextGrade ? classrooms.filter((x: any) => x.grade_level === nextGrade) : [];
                const target = promoteTarget[c.id] || (nextGrade ? "auto" : "graduate");
                const optOut = graduateStudentIds[c.id] || new Set<string>();
                const optOutCount = optOut.size;
                const isExpanded = expandedClassroom === c.id;
                const canPickPerStudent = isChecked && nextGrade && target !== "graduate";
                return (
                  <div key={c.id} className={`rounded-md ${isChecked ? "bg-accent/50" : "hover:bg-accent/30"}`}>
                    <div className="flex items-center gap-3 p-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) setPromoteClassroomIds(prev => [...prev, c.id]);
                          else {
                            setPromoteClassroomIds(prev => prev.filter(id => id !== c.id));
                            setGraduateStudentIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                            if (expandedClassroom === c.id) setExpandedClassroom(null);
                          }
                        }}
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {c.grade_level} / {c.name}
                          <span className="text-muted-foreground font-normal"> · {count} คน</span>
                          {optOutCount > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-700">
                              ไม่เรียนต่อ {optOutCount} คน
                            </Badge>
                          )}
                        </div>
                      </div>
                      {canPickPerStudent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setExpandedClassroom(isExpanded ? null : c.id)}
                        >
                          {isExpanded ? "ซ่อน" : "เลือกรายคน"}
                        </Button>
                      )}
                      <Select
                        value={target}
                        onValueChange={(v) => setPromoteTarget(prev => ({ ...prev, [c.id]: v }))}
                        disabled={!isChecked}
                      >
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nextGrade && <SelectItem value="auto">→ {nextGrade} (อัตโนมัติ)</SelectItem>}
                          {nextClassrooms.map((nc: any) => (
                            <SelectItem key={nc.id} value={nc.id}>→ {nc.grade_level}/{nc.name}</SelectItem>
                          ))}
                          <SelectItem value="graduate">🎓 จบการศึกษา (ทั้งห้อง)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {isExpanded && canPickPerStudent && (
                      <div className="border-t border-border/50 bg-background/60 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>ติ๊กนักเรียนที่ <b className="text-amber-700">ไม่เรียนต่อ</b> (ย้ายเป็นศิษย์เก่า)</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="underline hover:text-foreground"
                              onClick={() => setGraduateStudentIds(prev => ({ ...prev, [c.id]: new Set(roomStudents.map((s: any) => s.id)) }))}
                            >เลือกทั้งหมด</button>
                            <button
                              type="button"
                              className="underline hover:text-foreground"
                              onClick={() => setGraduateStudentIds(prev => { const n = { ...prev }; delete n[c.id]; return n; })}
                            >ล้าง</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-52 overflow-y-auto">
                          {roomStudents.map((s: any) => {
                            const willGrad = optOut.has(s.id);
                            return (
                              <label key={s.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${willGrad ? "bg-amber-50 dark:bg-amber-950/30" : "hover:bg-accent/40"}`}>
                                <Checkbox
                                  checked={willGrad}
                                  onCheckedChange={(chk) => {
                                    setGraduateStudentIds(prev => {
                                      const next = { ...prev };
                                      const set = new Set(next[c.id] || []);
                                      if (chk) set.add(s.id); else set.delete(s.id);
                                      if (set.size === 0) delete next[c.id]; else next[c.id] = set;
                                      return next;
                                    });
                                  }}
                                />
                                <span className="truncate">
                                  {s.prefix || ""}{s.first_name} {s.last_name}
                                  <span className="text-muted-foreground"> · {s.student_code}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)}>ยกเลิก</Button>
            <Button onClick={handlePromote} disabled={promoting || promoteClassroomIds.length === 0}>
              {promoting ? "กำลังดำเนินการ..." : `ดำเนินการ (${promoteClassroomIds.length} ห้อง)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value: any }) => (
  <div className="space-y-0.5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

export default AllStudentsPage;
