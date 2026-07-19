import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { registerThaiFont } from "@/lib/jspdfThai";
import { BE_OFFSET } from "@/lib/dateBE";
import {
import { todayBangkok, bkkDateISO } from "@/lib/dateBE";
  ShieldCheck, GraduationCap, Users, BookOpen, ClipboardCheck, FileText,
  ExternalLink, BarChart3, Award, Calendar, Building2, HeartPulse,
  ClipboardList, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle,
  TrendingUp, Loader2,
} from "lucide-react";

const SINCE_DAYS = 90;
const toBE = (y: number) => (y < 2500 ? y + BE_OFFSET : y);

interface SmscData {
  schoolName: string;
  obecCode: string;
  generatedAt: string;
  // counts
  students: number;
  teachers: number;
  classrooms: number;
  subjects: number;
  schedules: number;
  documents: number;
  // standard 1
  attendanceRate: number;
  attendanceTotal: number;
  attendancePresent: number;
  testScores: any[];
  testScoresByYear: { year: number; count: number; avg: number | null }[];
  behaviorPositive: number;
  behaviorNegative: number;
  topBehaviorStudents: { name: string; positive: number; negative: number }[];
  sdq: number;
  healthRecords: number;
  // standard 2
  actionPlans: number;
  actionPlanList: { title: string; budget: number | null; status: string }[];
  paAgreements: number;
  paList: { teacher: string; year: number; status: string }[];
  evaluations: number;
  homeVisits: number;
  // standard 3
  pp5Files: number;
  pp6Files: number;
  curriculumDocs: number;
  ictDevices: number;
  // scoring
  standard1Score: number;
  standard2Score: number;
  standard3Score: number;
}

const fetchData = async (): Promise<SmscData> => {
  const since = bkkDateISO(new Date(Date.now() - SINCE_DAYS * 86400000));

  const [
    students, teachers, classrooms, subjects, schedules, documents,
    attendance, scores, behavior, behaviorAll, sdq, health,
    actionPlans, actionPlanList, pa, paList, evaluations, homeVisits,
    pp5, pp6, curriculum, ict, school,
  ] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("personnel").select("id", { count: "exact", head: true }),
    supabase.from("classrooms").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase.from("schedules").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("attendance").select("status").gte("attendance_date", since),
    supabase.from("school_test_scores").select("*").order("academic_year", { ascending: false }).limit(200),
    supabase.from("behavior_records").select("behavior_type, student_id").gte("record_date", since),
    supabase.from("behavior_records").select("behavior_type, student_id, students(first_name, last_name)").gte("record_date", since).limit(500),
    supabase.from("sdq_records").select("id", { count: "exact", head: true }),
    supabase.from("health_measurements").select("id", { count: "exact", head: true }),
    supabase.from("action_plans").select("id", { count: "exact", head: true }),
    supabase.from("action_plans").select("project_name, budget_amount, status").order("created_at", { ascending: false }).limit(10),
    supabase.from("pa_agreements").select("id", { count: "exact", head: true }),
    supabase.from("pa_agreements").select("academic_year, status, personnel:personnel_id(first_name, last_name)").order("created_at", { ascending: false }).limit(10),
    supabase.from("staff_evaluations").select("id", { count: "exact", head: true }),
    supabase.from("home_visits").select("id", { count: "exact", head: true }),
    supabase.from("pp5_files").select("id", { count: "exact", head: true }),
    supabase.from("pp6_files").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).ilike("doc_type", "%curriculum%"),
    supabase.from("ict_devices").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("school_name, obec_code").limit(1).maybeSingle(),
  ]);

  const att = attendance.data || [];
  const present = att.filter((a: any) => a.status === "present").length;
  const rate = att.length ? Math.round((present / att.length) * 1000) / 10 : 0;

  const beh = behavior.data || [];
  const pos = beh.filter((b: any) => b.behavior_type === "positive").length;
  const neg = beh.filter((b: any) => b.behavior_type === "negative").length;

  // top behavior students
  const byStudent = new Map<string, { name: string; positive: number; negative: number }>();
  for (const b of (behaviorAll.data || []) as any[]) {
    const key = b.student_id;
    if (!key) continue;
    const name = b.students ? `${b.students.first_name || ""} ${b.students.last_name || ""}`.trim() : "ไม่ระบุ";
    const cur = byStudent.get(key) || { name, positive: 0, negative: 0 };
    if (b.behavior_type === "positive") cur.positive++;
    if (b.behavior_type === "negative") cur.negative++;
    byStudent.set(key, cur);
  }
  const topBehaviorStudents = [...byStudent.values()]
    .sort((a, b) => b.positive + b.negative - (a.positive + a.negative))
    .slice(0, 10);

  // test scores by year
  const yearMap = new Map<number, { sum: number; n: number; count: number }>();
  for (const s of (scores.data || []) as any[]) {
    const y = Number(s.academic_year) || 0;
    const cur = yearMap.get(y) || { sum: 0, n: 0, count: 0 };
    cur.count++;
    if (s.avg_score != null) { cur.sum += Number(s.avg_score); cur.n++; }
    yearMap.set(y, cur);
  }
  const testScoresByYear = [...yearMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, v]) => ({ year, count: v.count, avg: v.n ? Math.round((v.sum / v.n) * 10) / 10 : null }));

  // scoring (simple heuristic 0-100 per standard)
  const cap = (n: number, max: number) => Math.min(100, Math.round((n / max) * 100));
  const std1 = Math.round((rate + cap((scores.data || []).length, 20) + cap(sdq.count || 0, (students.count || 1))) / 3);
  const std2 = Math.round((cap(actionPlans.count || 0, 10) + cap(pa.count || 0, teachers.count || 1) + cap(evaluations.count || 0, teachers.count || 1)) / 3);
  const std3 = Math.round((cap(schedules.count || 0, 50) + cap((pp5.count || 0) + (pp6.count || 0), 20) + cap(subjects.count || 0, 50)) / 3);

  return {
    schoolName: (school.data as any)?.school_name || "โรงเรียน",
    obecCode: (school.data as any)?.obec_code || "-",
    generatedAt: new Date().toLocaleString("th-TH"),
    students: students.count || 0,
    teachers: teachers.count || 0,
    classrooms: classrooms.count || 0,
    subjects: subjects.count || 0,
    schedules: schedules.count || 0,
    documents: documents.count || 0,
    attendanceRate: rate,
    attendanceTotal: att.length,
    attendancePresent: present,
    testScores: scores.data || [],
    testScoresByYear,
    behaviorPositive: pos,
    behaviorNegative: neg,
    topBehaviorStudents,
    sdq: sdq.count || 0,
    healthRecords: health.count || 0,
    actionPlans: actionPlans.count || 0,
    actionPlanList: (actionPlanList.data || []).map((a: any) => ({
      title: a.project_name, budget: a.budget_amount, status: a.status,
    })),
    paAgreements: pa.count || 0,
    paList: (paList.data || []).map((p: any) => ({
      teacher: p.personnel ? `${p.personnel.first_name || ""} ${p.personnel.last_name || ""}`.trim() : "-",
      year: p.academic_year, status: p.status,
    })),
    evaluations: evaluations.count || 0,
    homeVisits: homeVisits.count || 0,
    pp5Files: pp5.count || 0,
    pp6Files: pp6.count || 0,
    curriculumDocs: curriculum.count || 0,
    ictDevices: ict.count || 0,
    standard1Score: std1,
    standard2Score: std2,
    standard3Score: std3,
  };
};

const scoreLevel = (n: number) => {
  if (n >= 80) return { label: "ดีเยี่ยม", color: "text-emerald-600", bg: "bg-emerald-500" };
  if (n >= 60) return { label: "ดี", color: "text-blue-600", bg: "bg-blue-500" };
  if (n >= 40) return { label: "ปานกลาง", color: "text-amber-600", bg: "bg-amber-500" };
  return { label: "ต้องปรับปรุง", color: "text-rose-600", bg: "bg-rose-500" };
};

export default function SmscCenterPage() {
  const { data, isLoading } = useQuery<SmscData>({ queryKey: ["smsc-center"], queryFn: fetchData });
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const exportPDF = async () => {
    if (!data) return;
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await registerThaiFont(doc);
      doc.setFont("THSarabunNew", "bold");

      // Cover
      doc.setFontSize(22);
      doc.text("รายงานข้อมูลรองรับการประเมิน สมศ.", 105, 25, { align: "center" });
      doc.setFontSize(16);
      doc.setFont("THSarabunNew", "normal");
      doc.text(data.schoolName, 105, 35, { align: "center" });
      doc.setFontSize(12);
      doc.text(`รหัส OBEC: ${data.obecCode}`, 105, 42, { align: "center" });
      doc.text(`ออกเมื่อ: ${data.generatedAt}`, 105, 48, { align: "center" });

      // Executive summary table
      autoTable(doc, {
        startY: 58,
        head: [["ตัวชี้วัดภาพรวม", "ค่า"]],
        body: [
          ["นักเรียน (Active)", String(data.students)],
          ["บุคลากร", String(data.teachers)],
          ["ห้องเรียน", String(data.classrooms)],
          ["รายวิชา", String(data.subjects)],
          ["ตารางสอน", String(data.schedules)],
          ["อัตรามาเรียน (90 วัน)", `${data.attendanceRate}%  (${data.attendancePresent}/${data.attendanceTotal})`],
          ["มาตรฐาน 1 — คุณภาพผู้เรียน", `${data.standard1Score}/100 (${scoreLevel(data.standard1Score).label})`],
          ["มาตรฐาน 2 — การบริหารจัดการ", `${data.standard2Score}/100 (${scoreLevel(data.standard2Score).label})`],
          ["มาตรฐาน 3 — การจัดการเรียนการสอน", `${data.standard3Score}/100 (${scoreLevel(data.standard3Score).label})`],
        ],
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [59, 130, 246] },
      });

      // Standard 1: test scores by year
      doc.addPage();
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(16);
      doc.text("มาตรฐานที่ 1: คุณภาพของผู้เรียน", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["ปีการศึกษา", "จำนวนรายการ", "คะแนนเฉลี่ย"]],
        body: data.testScoresByYear.map(y => [String(toBE(y.year)), String(y.count), y.avg != null ? String(y.avg) : "-"]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });
      autoTable(doc, {
        head: [["ปี", "การสอบ", "ระดับ", "วิชา", "คะแนน"]],
        body: data.testScores.slice(0, 30).map((s: any) => [
          String(toBE(Number(s.academic_year))), s.test_type, s.grade_level, s.subject, s.avg_score ?? "-",
        ]),
        styles: { font: "THSarabunNew", fontSize: 11 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });
      autoTable(doc, {
        head: [["พฤติกรรม (90 วัน)", "จำนวน"]],
        body: [
          ["เชิงบวก", String(data.behaviorPositive)],
          ["เชิงลบ", String(data.behaviorNegative)],
          ["บันทึก SDQ", String(data.sdq)],
          ["บันทึกสุขภาพ", String(data.healthRecords)],
        ],
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [16, 185, 129] },
      });

      // Standard 2
      doc.addPage();
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(16);
      doc.text("มาตรฐานที่ 2: กระบวนการบริหารและการจัดการ", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["โครงการ (ล่าสุด)", "งบประมาณ", "สถานะ"]],
        body: data.actionPlanList.map(p => [p.title || "-", p.budget?.toLocaleString("th-TH") || "-", p.status || "-"]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [251, 146, 60] },
      });
      autoTable(doc, {
        head: [["ครู (PA)", "ปี", "สถานะ"]],
        body: data.paList.map(p => [p.teacher, String(toBE(p.year)), p.status || "-"]),
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [251, 146, 60] },
      });
      autoTable(doc, {
        head: [["รายการ", "ค่า"]],
        body: [
          ["ผลการประเมิน 360°", String(data.evaluations)],
          ["เยี่ยมบ้านนักเรียน", String(data.homeVisits)],
          ["เอกสารระบบ", String(data.documents)],
        ],
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [251, 146, 60] },
      });

      // Standard 3
      doc.addPage();
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(16);
      doc.text("มาตรฐานที่ 3: กระบวนการจัดการเรียนการสอน", 14, 18);
      autoTable(doc, {
        startY: 24,
        head: [["รายการ", "ค่า"]],
        body: [
          ["รายวิชาในหลักสูตร", String(data.subjects)],
          ["ตารางสอน", String(data.schedules)],
          ["ห้องเรียน", String(data.classrooms)],
          ["ปพ.5 (ผลการเรียน)", String(data.pp5Files)],
          ["ปพ.6 (รายงาน)", String(data.pp6Files)],
          ["เอกสารหลักสูตร", String(data.curriculumDocs)],
          ["อุปกรณ์ ICT", String(data.ictDevices)],
        ],
        styles: { font: "THSarabunNew", fontSize: 12 },
        headStyles: { font: "THSarabunNew", fontStyle: "bold", fillColor: [168, 85, 247] },
      });

      doc.save(`SMSC-Report-${data.obecCode}-${Date.now()}.pdf`);
      toast.success("ส่งออก PDF สำเร็จ");
    } catch (e: any) {
      console.error(e);
      toast.error("ส่งออก PDF ไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setExporting(null);
    }
  };

  const exportXLSX = async () => {
    if (!data) return;
    setExporting("xlsx");
    try {
      const wb = XLSX.utils.book_new();

      const summary = [
        ["รายงาน สมศ.", data.schoolName],
        ["รหัส OBEC", data.obecCode],
        ["ออกเมื่อ", data.generatedAt],
        [],
        ["ตัวชี้วัด", "ค่า"],
        ["นักเรียน", data.students],
        ["บุคลากร", data.teachers],
        ["ห้องเรียน", data.classrooms],
        ["รายวิชา", data.subjects],
        ["ตารางสอน", data.schedules],
        ["อัตรามาเรียน 90 วัน (%)", data.attendanceRate],
        ["มาตรฐาน 1 คะแนน (0-100)", data.standard1Score],
        ["มาตรฐาน 2 คะแนน (0-100)", data.standard2Score],
        ["มาตรฐาน 3 คะแนน (0-100)", data.standard3Score],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "สรุป");

      // Std 1
      const s1Header = ["test_type", "academic_year", "grade_level", "subject", "avg_score", "national_avg", "area_avg", "student_count"];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([s1Header, ...data.testScores.map((s: any) => s1Header.map(k => s[k] ?? ""))]),
        "1-ผลทดสอบ"
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["ชื่อ", "พฤติกรรมเชิงบวก", "พฤติกรรมเชิงลบ"],
          ...data.topBehaviorStudents.map(s => [s.name, s.positive, s.negative]),
        ]),
        "1-พฤติกรรม"
      );

      // Std 2
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["โครงการ", "งบประมาณ", "สถานะ"],
          ...data.actionPlanList.map(p => [p.title, p.budget, p.status]),
        ]),
        "2-แผนปฏิบัติการ"
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["ครู", "ปี", "สถานะ"],
          ...data.paList.map(p => [p.teacher, p.year, p.status]),
        ]),
        "2-PA"
      );

      // Std 3
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["รายการ", "ค่า"],
          ["รายวิชา", data.subjects],
          ["ตารางสอน", data.schedules],
          ["ห้องเรียน", data.classrooms],
          ["ปพ.5", data.pp5Files],
          ["ปพ.6", data.pp6Files],
          ["เอกสารหลักสูตร", data.curriculumDocs],
          ["อุปกรณ์ ICT", data.ictDevices],
        ]),
        "3-การเรียนการสอน"
      );

      XLSX.writeFile(wb, `SMSC-Report-${data.obecCode}-${Date.now()}.xlsx`);
      toast.success("ส่งออก Excel สำเร็จ");
    } catch (e: any) {
      console.error(e);
      toast.error("ส่งออก Excel ไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setExporting(null);
    }
  };

  if (isLoading || !data) {
    return <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูล สมศ. ...</div>;
  }

  const overall = Math.round((data.standard1Score + data.standard2Score + data.standard3Score) / 3);
  const overallLevel = scoreLevel(overall);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> รายงานสรุปรองรับการประเมินภายนอก (สมศ.)
            </div>
            <h1 className="mt-1 text-3xl font-bold">ศูนย์ข้อมูล สมศ.</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              {data.schoolName} · รหัส OBEC: <span className="font-mono">{data.obecCode}</span> · ออกเมื่อ {data.generatedAt}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportPDF} disabled={!!exporting}>
              {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              ดาวน์โหลด PDF
            </Button>
            <Button variant="outline" onClick={exportXLSX} disabled={!!exporting}>
              {exporting === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              ดาวน์โหลด Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Executive summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> สรุปภาพรวม (Executive Summary)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: GraduationCap, label: "นักเรียน", value: data.students, c: "text-blue-500" },
              { icon: Users, label: "บุคลากร", value: data.teachers, c: "text-emerald-500" },
              { icon: Building2, label: "ห้องเรียน", value: data.classrooms, c: "text-amber-500" },
              { icon: BookOpen, label: "รายวิชา", value: data.subjects, c: "text-purple-500" },
              { icon: ClipboardCheck, label: "มาเรียน 90 วัน", value: `${data.attendanceRate}%`, c: "text-teal-500" },
              { icon: Calendar, label: "ตารางสอน", value: data.schedules, c: "text-rose-500" },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="rounded-xl border bg-card/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className={`h-4 w-4 ${k.c}`} /> {k.label}
                  </div>
                  <div className="mt-1 text-2xl font-bold">{k.value}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border bg-gradient-to-br from-background to-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">คะแนนรวม 3 มาตรฐาน</div>
              <Badge className={`${overallLevel.bg} text-white`}>{overall}/100 · {overallLevel.label}</Badge>
            </div>
            <div className="space-y-3">
              {[
                { n: 1, t: "คุณภาพของผู้เรียน", s: data.standard1Score },
                { n: 2, t: "กระบวนการบริหารและการจัดการ", s: data.standard2Score },
                { n: 3, t: "การจัดการเรียนการสอน", s: data.standard3Score },
              ].map(x => {
                const lv = scoreLevel(x.s);
                return (
                  <div key={x.n}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>มาตรฐาน {x.n} · {x.t}</span>
                      <span className={`font-mono ${lv.color}`}>{x.s}/100 · {lv.label}</span>
                    </div>
                    <Progress value={x.s} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed standards (accordion drill-down) */}
      <Accordion type="multiple" defaultValue={["s1"]} className="space-y-3">
        {/* Standard 1 */}
        <AccordionItem value="s1" className="rounded-xl border bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">1</div>
              <div>
                <div className="font-semibold">มาตรฐานที่ 1: คุณภาพของผู้เรียน</div>
                <div className="text-xs text-muted-foreground">ผลสัมฤทธิ์ + คุณลักษณะอันพึงประสงค์</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            {/* Test scores by year */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">คะแนนทดสอบระดับชาติ (รายปี)</div>
                <Link to="/dashboard/admin/test-scores">
                  <Button size="sm" variant="ghost"><ExternalLink className="mr-1 h-3 w-3" /> เปิด</Button>
                </Link>
              </div>
              {data.testScoresByYear.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ปีการศึกษา</TableHead>
                      <TableHead className="text-right">จำนวนรายการ</TableHead>
                      <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.testScoresByYear.map(y => (
                      <TableRow key={y.year}>
                        <TableCell className="font-mono">{toBE(y.year)}</TableCell>
                        <TableCell className="text-right">{y.count}</TableCell>
                        <TableCell className="text-right font-mono">{y.avg ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-amber-500" />
                  ยังไม่ได้กรอกคะแนน O-NET/NT/PISA
                </div>
              )}
            </div>

            {/* Behavior + SDQ + Health */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-semibold">พฤติกรรม / SDQ / สุขภาพ</div>
                <div className="space-y-1.5 text-sm">
                  <Row label="พฤติกรรมเชิงบวก (90 วัน)" value={data.behaviorPositive} href="/dashboard/teacher/behavior" />
                  <Row label="พฤติกรรมเชิงลบ (90 วัน)" value={data.behaviorNegative} href="/dashboard/teacher/behavior" />
                  <Row label="บันทึก SDQ" value={data.sdq} href="/dashboard/student/sdq" />
                  <Row label="บันทึกสุขภาพ" value={data.healthRecords} href="/dashboard/student/health" />
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-semibold">นักเรียนที่มีบันทึกพฤติกรรมสูงสุด (Top 10)</div>
                {data.topBehaviorStudents.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead className="text-right">บวก</TableHead>
                        <TableHead className="text-right">ลบ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topBehaviorStudents.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-right text-emerald-600">{s.positive}</TableCell>
                          <TableCell className="text-right text-rose-600">{s.negative}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-xs text-muted-foreground">ยังไม่มีบันทึก</div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Standard 2 */}
        <AccordionItem value="s2" className="rounded-xl border bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white font-bold">2</div>
              <div>
                <div className="font-semibold">มาตรฐานที่ 2: กระบวนการบริหารและการจัดการ</div>
                <div className="text-xs text-muted-foreground">แผนพัฒนา · บุคลากร · การมีส่วนร่วม</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">แผนปฏิบัติการ — โครงการล่าสุด ({data.actionPlans})</div>
                <Link to="/dashboard/admin/action-plan">
                  <Button size="sm" variant="ghost"><ExternalLink className="mr-1 h-3 w-3" /> เปิด</Button>
                </Link>
              </div>
              {data.actionPlanList.length ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>โครงการ</TableHead>
                    <TableHead className="text-right">งบประมาณ</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.actionPlanList.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.title || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{p.budget?.toLocaleString("th-TH") || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{p.status || "-"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="text-xs text-muted-foreground">ยังไม่มีโครงการ</div>}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">ข้อตกลง PA ครู ({data.paAgreements})</div>
                <Link to="/dashboard/hr/pa">
                  <Button size="sm" variant="ghost"><ExternalLink className="mr-1 h-3 w-3" /> เปิด</Button>
                </Link>
              </div>
              {data.paList.length ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ครู</TableHead><TableHead>ปี</TableHead><TableHead>สถานะ</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.paList.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{p.teacher}</TableCell>
                        <TableCell className="font-mono">{toBE(p.year)}</TableCell>
                        <TableCell><Badge variant="outline">{p.status || "-"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <div className="text-xs text-muted-foreground">ยังไม่มี PA</div>}
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Row label="ผลประเมิน 360°" value={data.evaluations} href="/dashboard/hr/evaluations" />
              <Row label="เยี่ยมบ้านนักเรียน" value={data.homeVisits} href="/dashboard/teacher/home-visits" />
              <Row label="เอกสารระบบ" value={data.documents} href="/dashboard/admin/documents" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Standard 3 */}
        <AccordionItem value="s3" className="rounded-xl border bg-card">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500 text-white font-bold">3</div>
              <div>
                <div className="font-semibold">มาตรฐานที่ 3: กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียน</div>
                <div className="text-xs text-muted-foreground">หลักสูตร · ตารางสอน · การวัดประเมินผล</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-4 pb-4">
            <div className="grid gap-2 md:grid-cols-2">
              <Row label="รายวิชาในหลักสูตร" value={data.subjects} href="/dashboard/academic/subjects" />
              <Row label="ตารางสอน" value={data.schedules} href="/dashboard/academic/schedules" />
              <Row label="ห้องเรียน" value={data.classrooms} href="/dashboard/academic/classrooms" />
              <Row label="ปพ.5 (ผลการเรียน)" value={data.pp5Files} href="/dashboard/academic/pp5" />
              <Row label="ปพ.6 (รายงาน)" value={data.pp6Files} href="/dashboard/academic/pp6" />
              <Row label="เอกสารหลักสูตร (ปพ.4)" value={data.curriculumDocs} href="/dashboard/academic/pp4" />
              <Row label="อุปกรณ์ ICT" value={data.ictDevices} href="/dashboard/admin/ict-devices" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />
        รายงานนี้ดึงข้อมูลสดจากฐานข้อมูลทุกครั้งที่เปิดหน้า — กดดาวน์โหลด PDF หรือ Excel เพื่อบันทึกเป็นหลักฐาน
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: any; href?: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background/50 p-2.5 text-sm">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">{value}</Badge>
        {href && (
          <Link to={href}>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
