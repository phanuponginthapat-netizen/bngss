import React, { useState, useMemo, useEffect } from "react";
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
import { Plus, Trash2, Search, ScanLine, Settings2, Save, TrendingUp, TrendingDown, FileBarChart, Download, ImageIcon, X } from "lucide-react";
import { PhotoUploadField } from "@/components/ui/photo-upload-field";
import * as XLSX from "xlsx";
import BarcodeScanner from "@/components/BarcodeScanner";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useStudentData } from "@/hooks/useStudentData";
import { useUserRole } from "@/hooks/useUserRole";
import { useParentChildren } from "@/hooks/useParentChildren";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { notify } from "@/lib/notify";
import { useAuthSession } from "@/hooks/useAuthSession";
import { dateMatchesTerm } from "@/lib/academicTerm";
import BehaviorReportDashboard from "@/components/student/BehaviorReportDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// หัวข้อพฤติกรรมตามมาตรฐาน สพฐ.
const OBEC_BEHAVIOR_TOPICS = [
  { value: "discipline", label: "ระเบียบวินัย", positive: "ปฏิบัติตามกฎ มาเรียนตรงเวลา", negative: "ไม่ปฏิบัติตามกฎ มาสาย หนีเรียน" },
  { value: "morality", label: "คุณธรรม จริยธรรม", positive: "ซื่อสัตย์ มีน้ำใจ กตัญญู", negative: "ทุจริต ลักขโมย โกหก" },
  { value: "politeness", label: "มารยาท สัมมาคารวะ", positive: "ไหว้ สุภาพ เคารพผู้ใหญ่", negative: "ก้าวร้าว ไม่สุภาพ" },
  { value: "responsibility", label: "ความรับผิดชอบ", positive: "ทำงานที่ได้รับมอบหมาย รักษาความสะอาด", negative: "ไม่ส่งงาน ไม่รับผิดชอบหน้าที่" },
  { value: "unity", label: "ความสามัคคี", positive: "ช่วยเหลือเพื่อน ทำงานกลุ่มดี", negative: "ทะเลาะวิวาท กลั่นแกล้งเพื่อน" },
  { value: "drug_free", label: "ยาเสพติด/สิ่งเสพติด", positive: "ร่วมกิจกรรมต่อต้านยาเสพติด", negative: "สูบบุหรี่ ดื่มสุรา ยาเสพติด" },
  { value: "dress_code", label: "การแต่งกาย", positive: "แต่งกายถูกระเบียบ สะอาดเรียบร้อย", negative: "แต่งกายไม่ถูกระเบียบ" },
  { value: "public_mind", label: "จิตสาธารณะ", positive: "บำเพ็ญประโยชน์ ช่วยเหลือสังคม", negative: "ทำลายทรัพย์สินส่วนรวม" },
  { value: "other", label: "อื่นๆ", positive: "พฤติกรรมเชิงบวกอื่นๆ", negative: "พฤติกรรมเชิงลบอื่นๆ" },
];

const topicLabelMap = Object.fromEntries(OBEC_BEHAVIOR_TOPICS.map(t => [t.value, t.label]));

const BehaviorPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const studentData = useStudentData();
  const { isParent, isStudent, isAdmin, isDirector } = useUserRole();
  const { user: authUser } = useAuthSession();
  const { childIds } = useParentChildren();
  const { currentAcademicYear, currentSemester, academicYearOptions, config: termCfg } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState<number>(currentAcademicYear);
  const [semester, setSemester] = useState<number>(currentSemester);
  // ติดตามค่า ปี/เทอม จาก global switcher (topbar) อัตโนมัติ
  useEffect(() => { if (currentAcademicYear > 0) setAcademicYear(currentAcademicYear); }, [currentAcademicYear]);
  useEffect(() => { setSemester(currentSemester); }, [currentSemester]);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState("positive");
  const [topic, setTopic] = useState("discipline");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState("0");
  const [images, setImages] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);

  // Scope: parent → only their children; teachers → homeroom students; admin/director → all
  const scopedStudentIds = useMemo(() => {
    if (isParent) return childIds;
    if (!studentData.homeroomClassroomIds) return null;
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [isParent, childIds, studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["behavior_records", academicYear, scopedStudentIds?.join(",") || "all"],
    enabled: scopedStudentIds === null || scopedStudentIds.length >= 0,
    queryFn: async () => {
      let q = supabase.from("behavior_records").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level))").order("created_at", { ascending: false }).limit(500);
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      const { data } = await q;
      return data || [];
    },
  });

  // Starting points configuration (default 100)
  const { data: startingPoints = 100 } = useQuery({
    queryKey: ["behavior_starting_points"],
    queryFn: async () => {
      const { data } = await supabase.from("school_settings").select("setting_value").eq("setting_key", "behavior_starting_points").maybeSingle();
      const n = parseInt(data?.setting_value || "100");
      return Number.isFinite(n) ? n : 100;
    },
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startingPointsInput, setStartingPointsInput] = useState("100");
  useEffect(() => { setStartingPointsInput(String(startingPoints)); }, [startingPoints]);
  const saveStartingPoints = async () => {
    const v = parseInt(startingPointsInput);
    if (!Number.isFinite(v) || v < 0) { toast.error(lang === "th" ? "ค่าไม่ถูกต้อง" : "Invalid"); return; }
    const { error } = await supabase.from("school_settings").upsert({ setting_key: "behavior_starting_points", setting_value: String(v) }, { onConflict: "setting_key" });
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
    qc.invalidateQueries({ queryKey: ["behavior_starting_points"] });
    setSettingsOpen(false);
  };

  // For students: find their student row (linked to auth user)
  const { data: myStudent } = useQuery({
    queryKey: ["my-student-row", authUser?.id],
    enabled: !!authUser?.id && (isStudent || isParent),
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data } = await supabase.from("students").select("id, prefix, first_name, last_name, student_code").eq("auth_user_id", authUser.id).maybeSingle();
      return data;
    },
  });

  // Build per-student balance map = startingPoints + Σ(signed points)
  const balanceByStudent = useMemo(() => {
    const m = new Map<string, { balance: number; added: number; deducted: number; count: number }>();
    for (const r of records as any[]) {
      const sid = r.student_id;
      if (!sid) continue;
      const cur = m.get(sid) || { balance: startingPoints, added: 0, deducted: 0, count: 0 };
      const pts = r.points || 0;
      if (r.behavior_type === "positive") { cur.balance += pts; cur.added += pts; }
      else { cur.balance -= pts; cur.deducted += pts; }
      cur.count += 1;
      m.set(sid, cur);
    }
    return m;
  }, [records, startingPoints]);


  // Filter by academic year/semester (derived from record_date)
  const termFiltered = useMemo(() => {
    if (!academicYear) return records;
    return records.filter((r: any) =>
      dateMatchesTerm(r.record_date || r.created_at, academicYear, (semester as 0 | 1 | 2), termCfg),
    );
  }, [records, academicYear, semester, termCfg]);

  const filteredRecords = useMemo(() => {
    let result = termFiltered;
    const studentIds = new Set(studentData.filteredStudents.map((s: any) => s.id));
    if (studentData.search || studentData.gradeFilter !== "all" || studentData.classroomFilter !== "all") {
      result = result.filter((r: any) => studentIds.has(r.student_id));
    }
    if (filterTopic !== "all") {
      result = result.filter((r: any) => r.description?.includes(topicLabelMap[filterTopic] || filterTopic));
    }
    return result;
  }, [termFiltered, studentData.filteredStudents, studentData.search, studentData.gradeFilter, studentData.classroomFilter, filterTopic]);

  // Stats
  const stats = useMemo(() => {
    const positive = termFiltered.filter((r: any) => r.behavior_type === "positive").length;
    const negative = termFiltered.filter((r: any) => r.behavior_type === "negative").length;
    const totalPoints = termFiltered.reduce((sum: number, r: any) => sum + (r.behavior_type === "positive" ? (r.points || 0) : -(r.points || 0)), 0);
    return { total: termFiltered.length, positive, negative, totalPoints };
  }, [termFiltered]);

  // Current user profile (for recorded_by) — try profiles, then personnel, then email
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-name", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", authUser!.id).maybeSingle();
      const pName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";
      if (pName) return { source: "profile" as const, name: pName };
      const { data: personnel } = await supabase.from("personnel").select("prefix, first_name, last_name").eq("user_id", authUser!.id).maybeSingle();
      const personnelName = personnel ? `${personnel.prefix || ""}${personnel.first_name || ""} ${personnel.last_name || ""}`.trim() : "";
      if (personnelName) return { source: "personnel" as const, name: personnelName };
      return { source: "fallback" as const, name: authUser!.email || "" };
    },
  });
  const myDisplayName = myProfile?.name || authUser?.email || "";

  // Per-student report (filtered scope) + internal filters
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSort, setReportSort] = useState<"deducted" | "added" | "balance">("deducted");
  const [reportSearch, setReportSearch] = useState("");
  const [reportGrade, setReportGrade] = useState("all");
  const [reportStudentId, setReportStudentId] = useState("all");
  const [reportScanOpen, setReportScanOpen] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const perStudentReport = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of filteredRecords as any[]) {
      const sid = r.student_id; if (!sid) continue;
      const s = r.students || {};
      const cur = m.get(sid) || {
        student_id: sid,
        code: s.student_code || "",
        name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
        classroom: s.classrooms?.name || "",
        grade: s.classrooms?.grade_level || "",
        added: 0, deducted: 0, count: 0, positive_count: 0, negative_count: 0,
        records: [] as any[],
      };
      const pts = r.points || 0;
      if (r.behavior_type === "positive") { cur.added += pts; cur.positive_count += 1; }
      else { cur.deducted += pts; cur.negative_count += 1; }
      cur.count += 1;
      cur.records.push(r);
      m.set(sid, cur);
    }
    let arr = Array.from(m.values()).map(x => ({ ...x, balance: startingPoints + x.added - x.deducted }));
    // Apply report-dialog filters
    const q = reportSearch.trim().toLowerCase();
    if (q) arr = arr.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    if (reportGrade !== "all") arr = arr.filter(r => r.grade === reportGrade);
    if (reportStudentId !== "all") arr = arr.filter(r => r.student_id === reportStudentId);
    arr.sort((a, b) => (b[reportSort] || 0) - (a[reportSort] || 0));
    return arr;
  }, [filteredRecords, startingPoints, reportSort, reportSearch, reportGrade, reportStudentId]);

  const exportReport = () => {
    const rows = perStudentReport.map((r, i) => ({
      ลำดับ: i + 1,
      รหัสนักเรียน: r.code,
      ชื่อ: r.name,
      ชั้น: r.grade,
      ห้อง: r.classroom,
      คะแนนตั้งต้น: startingPoints,
      เพิ่ม: r.added,
      หัก: r.deducted,
      คงเหลือ: r.balance,
      "ครั้ง(บวก)": r.positive_count,
      "ครั้ง(ลบ)": r.negative_count,
      รวมครั้ง: r.count,
    }));
    const detailRows: any[] = [];
    perStudentReport.forEach((r) => {
      r.records.forEach((rec: any) => {
        detailRows.push({
          รหัสนักเรียน: r.code,
          ชื่อ: r.name,
          วันที่: rec.record_date,
          ประเภท: rec.behavior_type === "positive" ? "บวก" : "ลบ",
          คะแนน: (rec.behavior_type === "positive" ? "+" : "-") + (rec.points || 0),
          รายละเอียด: rec.description,
          ผู้บันทึก: rec.recorded_by || "-",
        });
      });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Details");
    XLSX.writeFile(wb, `behavior-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(lang === "th" ? "ดาวน์โหลดแล้ว" : "Downloaded");
  };

  const handleReportScan = (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;
    setReportSearch(cleaned);
    setReportScanOpen(false);
    toast.success(`ค้นหา: ${cleaned}`);
  };

  const selectedTopicInfo = OBEC_BEHAVIOR_TOPICS.find(t => t.value === topic);

  const handleAdd = async () => {
    if (!studentId || !desc) return;
    const topicLabel = topicLabelMap[topic] || topic;
    const fullDesc = `[${topicLabel}] ${desc}`;
    const { data: inserted, error } = await supabase.from("behavior_records").insert({
      student_id: studentId, behavior_type: type, description: fullDesc, points: parseInt(points),
      recorded_by: myDisplayName || null,
      images: images as any,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["behavior_records"] });

    // Notify the student (if linked to auth account)
    try {
      const student = studentData.students.find((s: any) => s.id === studentId);
      if (student?.auth_user_id) {
        const isPositive = type === "positive";
        await notify({
          user_ids: [student.auth_user_id],
          title: isPositive ? `⭐ พฤติกรรมเชิงบวก` : `⚠️ บันทึกพฤติกรรม`,
          body: `${topicLabel}: ${desc} (${isPositive ? "+" : "-"}${points} คะแนน)`,
          type: "behavior",
          severity: isPositive ? "success" : "warning",
          reference_id: inserted?.id,
          reference_type: "behavior_records",
          url: "/dashboard/student/behavior",
        });
      }
    } catch {/* non-blocking */}

    setOpen(false); setDesc(""); setPoints("0"); setStudentId(""); setTopic("discipline"); setImages([]);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("behavior_records").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "ลบสำเร็จ" : "Deleted");
    qc.invalidateQueries({ queryKey: ["behavior_records"] });
  };

  const handleScan = (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;
    const found = studentData.students.find((s: any) => s.student_code === cleaned);
    if (!found) { toast.error(`ไม่พบนักเรียนรหัส ${cleaned}`); return; }
    setStudentId(found.id);
    setOpen(true);
    toast.success(`เลือก: ${found.first_name} ${found.last_name}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-responsive-title font-bold text-foreground">{lang === "th" ? "ระบบความประพฤตินักเรียน" : "Behavior Records"}</h1>
          <p className="text-responsive-subtitle text-muted-foreground">{lang === "th" ? "บันทึกพฤติกรรมนักเรียนตามหัวข้อ สพฐ." : "Track student behavior per OBEC topics"}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
          {(isAdmin || isDirector) && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><Settings2 className="w-4 h-4" />{lang === "th" ? "ตั้งค่า" : "Settings"}</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>{lang === "th" ? "ตั้งค่าคะแนนความประพฤติ" : "Behavior Points Settings"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>{lang === "th" ? "คะแนนเริ่มต้นต่อคน" : "Starting points per student"}</Label>
                    <Input type="number" min={0} value={startingPointsInput} onChange={e => setStartingPointsInput(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">{lang === "th" ? "คะแนนตั้งต้นที่นักเรียนทุกคนมี ก่อนถูกหัก/เพิ่ม (ปกติ 100)" : "Starting balance every student has before adjustments (default 100)"}</p>
                  </div>
                  <Button onClick={saveStartingPoints} className="w-full gap-1"><Save className="w-4 h-4" />{lang === "th" ? "บันทึก" : "Save"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* My balance — student / parent */}
      {(isStudent || isParent) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(isStudent && myStudent ? [myStudent] : (isParent ? (studentData.students.filter((s: any) => childIds?.includes(s.id))) : [])).map((s: any) => {
            const b = balanceByStudent.get(s.id) || { balance: startingPoints, added: 0, deducted: 0, count: 0 };
            return (
              <Card key={s.id} className="border-0 shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.student_code} {s.prefix || ""}{s.first_name} {s.last_name}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className={`text-3xl font-bold ${b.balance >= startingPoints * 0.7 ? "text-success" : b.balance >= startingPoints * 0.4 ? "text-warning" : "text-destructive"}`}>{b.balance}</p>
                    <p className="text-xs text-muted-foreground">/ {startingPoints} {lang === "th" ? "คะแนน" : "pts"}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-success"><TrendingUp className="w-3 h-3" />+{b.added}</span>
                    <span className="inline-flex items-center gap-1 text-destructive"><TrendingDown className="w-3 h-3" />-{b.deducted}</span>
                    <span className="text-muted-foreground">· {b.count} {lang === "th" ? "ครั้ง" : "records"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {!isParent && !isStudent && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกพฤติกรรม" : "Record"}</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{lang === "th" ? "บันทึกพฤติกรรมนักเรียน" : "Record Behavior"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Student search */}
              <div>
                <Label>{lang === "th" ? "ค้นหานักเรียน (รหัส/ชื่อ)" : "Search Student"}</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder={lang === "th" ? "พิมพ์รหัสหรือชื่อนักเรียน..." : "Type code or name..."}
                    value={studentData.search}
                    onChange={e => {
                      studentData.setSearch(e.target.value);
                      const v = e.target.value.trim();
                      const exact = studentData.students.find((s: any) => s.student_code === v);
                      if (exact) setStudentId(exact.id);
                    }}
                  />
                  <ScanSearchButton onScan={(code) => {
                    studentData.setSearch(code);
                    const exact = studentData.filteredStudents.find((s: any) => s.student_code === code);
                    if (exact) setStudentId(exact.id);
                  }} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <Select value={studentData.gradeFilter} onValueChange={v => { studentData.setGradeFilter(v); studentData.setClassroomFilter("all"); }}>
                    <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกชั้น" : "All"}</SelectItem>
                      {studentData.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={studentData.classroomFilter} onValueChange={studentData.setClassroomFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ห้อง" : "Room"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                      {studentData.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกนักเรียน" : "Select student"} /></SelectTrigger>
                  <SelectContent>
                    {studentData.filteredStudents.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.student_code} - {s.prefix || ""}{s.first_name} {s.last_name}
                        {s.classrooms && <span className="text-muted-foreground"> ({s.classrooms.name})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic per OBEC */}
              <div>
                <Label>{lang === "th" ? "หัวข้อพฤติกรรม (สพฐ.)" : "Behavior Topic (OBEC)"}</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBEC_BEHAVIOR_TOPICS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTopicInfo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {type === "positive" ? `✅ ${selectedTopicInfo.positive}` : `⚠️ ${selectedTopicInfo.negative}`}
                  </p>
                )}
              </div>

              <div>
                <Label>{lang === "th" ? "ประเภท" : "Type"}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">{lang === "th" ? "🟢 เชิงบวก (เพิ่มคะแนน)" : "🟢 Positive"}</SelectItem>
                    <SelectItem value="negative">{lang === "th" ? "🔴 เชิงลบ (หักคะแนน)" : "🔴 Negative"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{lang === "th" ? "รายละเอียด" : "Description"}</Label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder={lang === "th" ? "รายละเอียดพฤติกรรม..." : "Behavior details..."} />
              </div>
              <div>
                <Label>{lang === "th" ? "คะแนน" : "Points"}</Label>
                <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> {lang === "th" ? "ภาพประกอบ (ไม่บังคับ)" : "Photos (optional)"}</Label>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2 mb-2">
                    {images.map((u, i) => (
                      <div key={i} className="relative group">
                        <img src={u} className="w-full h-20 object-cover rounded border cursor-pointer" onClick={() => setLightbox(u)} />
                        <Button size="icon" variant="destructive" className="absolute -top-1 -right-1 w-6 h-6" onClick={() => setImages(images.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <PhotoUploadField value="" onChange={(url) => url && setImages((p) => [...p, url])} bucket="cms-images" folder="behavior-evidence" />
                <p className="text-xs text-muted-foreground mt-1">{lang === "th" ? "ถ่ายภาพหรืออัพโหลดได้ (ไม่บังคับ)" : "Take a photo or upload (optional)"}</p>
              </div>
              <Button onClick={handleAdd} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
        {!isParent && !isStudent && (
          <Button variant="outline" onClick={() => setScanOpen(true)} className="gap-1">
            <ScanLine className="w-4 h-4" />
            {lang === "th" ? "สแกน QR นักเรียน" : "Scan QR"}
          </Button>
        )}
        <Button variant="outline" onClick={() => setReportOpen(true)} className="gap-1">
          <FileBarChart className="w-4 h-4" />
          {lang === "th" ? "รายงานรายบุคคล" : "Per-Student Report"}
        </Button>
      </div>

      {/* Per-Student Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart className="w-5 h-5" />
              {lang === "th" ? "รายงานคะแนนความประพฤติรายบุคคล" : "Per-Student Behavior Report"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder={lang === "th" ? "ค้นหารหัส/ชื่อนักเรียน..." : "Search code/name..."}
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setReportScanOpen(true)} className="gap-1 h-9">
                <ScanLine className="w-4 h-4" />{lang === "th" ? "สแกน QR" : "QR"}
              </Button>
              <Select value={reportGrade} onValueChange={(v) => { setReportGrade(v); setReportStudentId("all"); }}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกชั้น" : "All grades"}</SelectItem>
                  {Array.from(new Set(perStudentReport.map(r => r.grade).filter(Boolean))).sort().map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reportStudentId} onValueChange={setReportStudentId}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder={lang === "th" ? "นักเรียน" : "Student"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "th" ? "ทุกคน" : "All students"}</SelectItem>
                  {studentData.filteredStudents
                    .filter((s: any) => reportGrade === "all" || s.classrooms?.grade_level === reportGrade)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.student_code} {s.first_name} {s.last_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">{lang === "th" ? "เรียงตาม" : "Sort"}:</Label>
              <Select value={reportSort} onValueChange={(v: any) => setReportSort(v)}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deducted">{lang === "th" ? "ถูกหักมากที่สุด" : "Most deducted"}</SelectItem>
                  <SelectItem value="added">{lang === "th" ? "ได้เพิ่มมากที่สุด" : "Most added"}</SelectItem>
                  <SelectItem value="balance">{lang === "th" ? "คะแนนคงเหลือสูงสุด" : "Highest balance"}</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline">{perStudentReport.length} {lang === "th" ? "คน" : "students"}</Badge>
                <Button size="sm" onClick={exportReport} className="gap-1">
                  <Download className="w-4 h-4" />Excel
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-auto flex-1 border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
                  <TableHead className="hidden sm:table-cell">{lang === "th" ? "ห้อง" : "Class"}</TableHead>
                  <TableHead className="text-right text-success">+ {lang === "th" ? "เพิ่ม" : "Added"}</TableHead>
                  <TableHead className="text-right text-destructive">- {lang === "th" ? "หัก" : "Deducted"}</TableHead>
                  <TableHead className="text-right">{lang === "th" ? "คงเหลือ" : "Balance"}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">{lang === "th" ? "ครั้ง" : "Records"}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perStudentReport.map((r, i) => {
                  const expanded = expandedStudent === r.student_id;
                  return (
                    <React.Fragment key={r.student_id}>
                      <TableRow key={r.student_id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedStudent(expanded ? null : r.student_id)}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <div>{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.code}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{r.grade} {r.classroom}</TableCell>
                        <TableCell className="text-right text-success font-semibold">+{r.added}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">-{r.deducted}</TableCell>
                        <TableCell className={`text-right font-bold ${r.balance >= startingPoints * 0.7 ? "text-success" : r.balance >= startingPoints * 0.4 ? "text-warning" : "text-destructive"}`}>{r.balance}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-sm text-muted-foreground">{r.count}</TableCell>
                        <TableCell className="text-xs text-primary">{expanded ? "▾" : "▸"}</TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${r.student_id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-3">
                            <div className="text-xs font-semibold mb-2 text-muted-foreground">
                              {lang === "th" ? "รายละเอียดการเพิ่ม/หักคะแนน" : "Score change history"}
                            </div>
                            <div className="space-y-1.5 max-h-[260px] overflow-auto">
                              {r.records.sort((a: any, b: any) => (b.record_date || "").localeCompare(a.record_date || "")).map((rec: any) => (
                                <div key={rec.id} className="flex items-start gap-2 text-xs bg-background p-2 rounded border">
                                  <Badge variant={rec.behavior_type === "positive" ? "default" : "destructive"} className="shrink-0">
                                    {rec.behavior_type === "positive" ? "+" : "-"}{rec.points || 0}
                                  </Badge>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium break-words">{rec.description}</div>
                                    <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                      <span>📅 {rec.record_date}</span>
                                      <span>👤 {lang === "th" ? "ผู้บันทึก" : "By"}: {rec.recorded_by || "—"}</span>
                                    </div>
                                    {Array.isArray(rec.images) && rec.images.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {rec.images.map((u: string, i: number) => (
                                          <img key={i} src={u} className="w-12 h-12 object-cover rounded border cursor-zoom-in hover:ring-2 hover:ring-primary" onClick={() => setLightbox(u)} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {perStudentReport.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={reportScanOpen}
        onClose={() => setReportScanOpen(false)}
        onScan={handleReportScan}
        title={lang === "th" ? "สแกน QR เพื่อค้นหา" : "Scan QR to search"}
      />


      {/* Tabs: Dashboard / Records */}
      <Tabs defaultValue={(isAdmin || isDirector || !isStudent && !isParent) ? "dashboard" : "records"} className="space-y-3">
        <TabsList>
          <TabsTrigger value="dashboard">{lang === "th" ? "แดชบอร์ดรายงาน" : "Dashboard"}</TabsTrigger>
          <TabsTrigger value="records">{lang === "th" ? "รายการบันทึก" : "Records"}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-0">
          <BehaviorReportDashboard
            records={termFiltered as any}
            startingPoints={startingPoints}
            topicCatalog={OBEC_BEHAVIOR_TOPICS}
            showRecorder={isAdmin || isDirector}
          />
        </TabsContent>

        <TabsContent value="records" className="space-y-4 mt-0">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs text-muted-foreground">{lang === "th" ? "บันทึกทั้งหมด" : "Total"}</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs text-muted-foreground">{lang === "th" ? "เชิงบวก" : "Positive"}</p>
              <p className="text-xl sm:text-2xl font-bold text-success">{stats.positive}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs text-muted-foreground">{lang === "th" ? "เชิงลบ" : "Negative"}</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{stats.negative}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs text-muted-foreground">{lang === "th" ? "คะแนนรวม" : "Net Points"}</p>
              <p className={`text-xl sm:text-2xl font-bold ${stats.totalPoints >= 0 ? "text-success" : "text-destructive"}`}>{stats.totalPoints >= 0 ? "+" : ""}{stats.totalPoints}</p>
            </CardContent></Card>
          </div>

          {/* Filter */}
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={lang === "th" ? "ค้นหาจากรหัสหรือชื่อ..." : "Search..."} value={studentData.search} onChange={e => studentData.setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={studentData.gradeFilter} onValueChange={v => { studentData.setGradeFilter(v); studentData.setClassroomFilter("all"); }}>
                  <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
                    {studentData.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={studentData.classroomFilter} onValueChange={studentData.setClassroomFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Classroom"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                    {studentData.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
                <TableHead>{lang === "th" ? "ประเภท" : "Type"}</TableHead>
                <TableHead className="hidden sm:table-cell">{lang === "th" ? "รายละเอียด" : "Description"}</TableHead>
                <TableHead>{lang === "th" ? "คะแนน" : "Pts"}</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredRecords.map((r: any) => {
                  const s = r.students;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.record_date}</TableCell>
                      <TableCell className="font-medium">
                        <div>{s ? `${s.student_code} ${s.prefix || ""}${s.first_name} ${s.last_name}` : "—"}</div>
                        {s?.classrooms?.name && <span className="text-xs text-muted-foreground">{s.classrooms.name}</span>}
                      </TableCell>
                      <TableCell><Badge variant={r.behavior_type === "positive" ? "default" : "destructive"}>{r.behavior_type === "positive" ? (lang === "th" ? "บวก" : "+") : (lang === "th" ? "ลบ" : "-")}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[260px]">
                        <div className="truncate">{r.description}</div>
                        {Array.isArray(r.images) && r.images.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {r.images.slice(0, 4).map((u: string, i: number) => (
                              <img key={i} src={u} className="w-10 h-10 object-cover rounded border cursor-zoom-in hover:ring-2 hover:ring-primary" onClick={() => setLightbox(u)} />
                            ))}
                            {r.images.length > 4 && <span className="text-xs text-muted-foreground self-center">+{r.images.length - 4}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{r.behavior_type === "positive" ? "+" : "-"}{r.points}</TableCell>
                      <TableCell>{!isStudent && !isParent && (<Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>)}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        title={lang === "th" ? "สแกน QR บัตรนักเรียน" : "Scan Student QR"}
      />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-0">
          <DialogHeader className="sr-only"><DialogTitle>ภาพประกอบ</DialogTitle></DialogHeader>
          {lightbox && <img src={lightbox} className="w-full max-h-[85vh] object-contain rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BehaviorPage;
