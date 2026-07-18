import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertTriangle, Send, FileWarning, CheckCircle2, Trash2, Search,
  CalendarRange, Settings2, Users, GraduationCap, Layers, LayoutList, Save,
  ClipboardCheck, MessageSquarePlus, BookOpenCheck, Megaphone, XCircle, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { notify, notifyRole } from "@/lib/notify";
import { confirmDelete } from "@/lib/confirmAction";
import { DateInput } from "@/components/ui/date-input";
import { DateTimeInput } from "@/components/ui/datetime-input";

type GradeType = "0" | "ร" | "มส";
type FixStatus = "pending" | "accepted" | "assigned" | "completed" | "rejected";

const GRADE_OPTIONS: { value: GradeType; label: string; desc: string; color: string; ring: string }[] = [
  { value: "0", label: "0", desc: "คะแนนต่ำกว่าเกณฑ์", color: "bg-danger/15 text-danger border-danger/40", ring: "ring-danger/30" },
  { value: "ร", label: "ร", desc: "รอผลการประเมิน (ไม่สมบูรณ์)", color: "bg-warning/15 text-warning border-warning/40", ring: "ring-warning/30" },
  { value: "มส", label: "มส", desc: "ไม่มีสิทธิ์เข้าสอบ (เวลาเรียนไม่ถึง)", color: "bg-warning/15 text-warning border-warning/40", ring: "ring-warning/30" },
];

const FIX_STATUS_META: Record<FixStatus, { label: string; color: string; icon: any }> = {
  pending:   { label: "รอครูตอบรับ",  color: "bg-neutral/15 text-neutral border-neutral/40", icon: ClipboardList },
  accepted:  { label: "ครูรับเรื่อง",  color: "bg-info/15 text-info border-info/40",     icon: CheckCircle2 },
  assigned:  { label: "มอบหมายแล้ว",   color: "bg-info/15 text-info border-info/40", icon: BookOpenCheck },
  completed: { label: "แก้สำเร็จ",     color: "bg-success/15 text-success border-success/40", icon: CheckCircle2 },
  rejected:  { label: "ปฏิเสธคำร้อง",  color: "bg-danger/15 text-danger border-danger/40", icon: XCircle },
};

const windowKey = (kind: "start" | "end", year: number, sem: number) =>
  `incomplete_grade_window_${kind}_${year}_${sem}`;
const fixWindowKey = (kind: "start" | "end", year: number, sem: number) =>
  `incomplete_grade_fix_window_${kind}_${year}_${sem}`;

const IncompleteGradePage = () => {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const { user } = useAuthSession();
  const { role } = useUserRole();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const qc = useQueryClient();

  const isTeacher = role === "teacher";
  const isAdminLike = role === "admin" || role === "director";
  const isStudent = role === "student";
  const canReport = isTeacher || isAdminLike;

  const [academicYear, setAcademicYear] = useState<number>(currentAcademicYear);
  const [semester, setSemester] = useState<number>(currentSemester);
  useEffect(() => { setAcademicYear(currentAcademicYear); }, [currentAcademicYear]);
  useEffect(() => { setSemester(currentSemester); }, [currentSemester]);

  // ----- Personnel record for current user -----
  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id, first_name, last_name, prefix").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // ----- Student record for current user (for student role) -----
  const { data: myStudent } = useQuery({
    queryKey: ["my-student", user?.id],
    enabled: !!user?.id && isStudent,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, student_code, prefix, first_name, last_name, classroom_id").eq("auth_user_id", user!.id).maybeSingle();
      return data;
    },
  });

  // ----- Assignments -----
  const { data: myAssignments = [] } = useQuery({
    queryKey: ["incomplete-grade-assignments", isAdminLike ? "all" : myPersonnel?.id],
    enabled: canReport && (isAdminLike || !!myPersonnel?.id),
    queryFn: async () => {
      let q = supabase
        .from("teacher_assignments")
        .select("id, subject_id, classroom_id, personnel_id, personnel(prefix, first_name, last_name), subjects(id, name_th, code), classrooms(id, name, grade_level)")
        .order("created_at", { ascending: false });
      if (!isAdminLike && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data } = await q;
      return data || [];
    },
  });

  // ----- Window settings (report + fix) -----
  const { data: windowSettings = [] } = useQuery({
    queryKey: ["incomplete-grade-window", academicYear, semester],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          windowKey("start", academicYear, semester), windowKey("end", academicYear, semester),
          fixWindowKey("start", academicYear, semester), fixWindowKey("end", academicYear, semester),
        ]);
      return data || [];
    },
  });
  const findVal = (key: string) => windowSettings.find((s: any) => s.setting_key === key)?.setting_value || "";
  const windowStart = findVal(windowKey("start", academicYear, semester));
  const windowEnd   = findVal(windowKey("end", academicYear, semester));
  const fixStart    = findVal(fixWindowKey("start", academicYear, semester));
  const fixEnd      = findVal(fixWindowKey("end", academicYear, semester));

  const now = new Date();
  const checkWindow = (s: string, e: string): "always" | "before" | "open" | "closed" => {
    if (!s && !e) return "always";
    if (s && now < new Date(s + "T00:00:00")) return "before";
    if (e && now > new Date(e + "T23:59:59")) return "closed";
    return "open";
  };
  const windowStatus = useMemo(() => checkWindow(windowStart, windowEnd), [windowStart, windowEnd]);
  const fixStatus    = useMemo(() => checkWindow(fixStart, fixEnd), [fixStart, fixEnd]);
  const inWindow = windowStatus === "always" || windowStatus === "open";
  const inFixWindow = fixStatus === "always" || fixStatus === "open";

  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editFixStart, setEditFixStart] = useState("");
  const [editFixEnd, setEditFixEnd] = useState("");
  useEffect(() => {
    setEditStart(windowStart); setEditEnd(windowEnd);
    setEditFixStart(fixStart); setEditFixEnd(fixEnd);
  }, [windowStart, windowEnd, fixStart, fixEnd]);

  const publishNews = async (title: string, content: string, category: string) => {
    await supabase.from("news_posts").insert({
      title, content, category,
      is_published: true,
      published_at: new Date().toISOString(),
      author_id: user?.id ?? null,
      author: "ฝ่ายวัดและประเมินผล",
    } as any);
  };

  const saveWindow = async (kind: "report" | "fix") => {
    const [k1, k2, s, e] = kind === "report"
      ? [windowKey("start", academicYear, semester), windowKey("end", academicYear, semester), editStart, editEnd]
      : [fixWindowKey("start", academicYear, semester), fixWindowKey("end", academicYear, semester), editFixStart, editFixEnd];
    const rows = [
      { setting_key: k1, setting_value: s || "", updated_by: user?.id },
      { setting_key: k2, setting_value: e || "", updated_by: user?.id },
    ];
    const { error } = await supabase.from("school_settings").upsert(rows, { onConflict: "setting_key" });
    if (error) { toast.error(error.message); return; }
    toast.success(L("บันทึกช่วงเวลาแล้ว", "Window saved"));
    qc.invalidateQueries({ queryKey: ["incomplete-grade-window"] });

    // Auto announcement
    if (s || e) {
      const yearTH = academicYear; // already in B.E. from useAcademicYear()
      if (kind === "report") {
        await publishNews(
          `📢 เปิดรับรายงานผล 0/ร/มส ปีการศึกษา ${yearTH} ภาคเรียนที่ ${semester}`,
          `<p>ขอแจ้งให้คณะครูทุกท่านทราบ ขณะนี้เปิดรับการรายงานนักเรียนที่มีผลการเรียน <strong>0, ร, มส</strong> ผ่านระบบงานวัดและประเมินผล</p>
           <ul>
             <li>วันเริ่มรับรายงาน: <strong>${s || "ทันที"}</strong></li>
             <li>วันสิ้นสุดรับรายงาน: <strong>${e || "ไม่ระบุ"}</strong></li>
           </ul>
           <p>โปรดเข้าสู่ระบบ → งานวัดและประเมินผล → รายงานผล 0/ร/มส เพื่อบันทึกรายชื่อนักเรียนรายวิชาที่ท่านรับผิดชอบ</p>`,
          "academic",
        );
        await Promise.all([
          notifyRole("teacher", { title: L("📢 เปิดรับรายงานผล 0/ร/มส", "Incomplete grade reporting open"), body: L(`ปีการศึกษา ${yearTH}/${semester} ระหว่าง ${s || "ทันที"} – ${e || "ไม่ระบุ"}`, ""), type: "incomplete_grade_window", severity: "info", url: "/dashboard/academic/incomplete-grades" }),
        ]);
      } else {
        await publishNews(
          `📢 เปิดรับคำร้องขอแก้ 0/ร/มส ปีการศึกษา ${yearTH} ภาคเรียนที่ ${semester}`,
          `<p>นักเรียนที่มีผลการเรียน <strong>0, ร, มส</strong> สามารถยื่นคำร้องขอแก้ผลการเรียนผ่านระบบได้แล้ว</p>
           <ul>
             <li>วันเริ่มยื่นคำร้อง: <strong>${s || "ทันที"}</strong></li>
             <li>วันสิ้นสุดยื่นคำร้อง: <strong>${e || "ไม่ระบุ"}</strong></li>
           </ul>
           <p>เข้าสู่ระบบ → งานวัดและประเมินผล → รายงานผล 0/ร/มส → กดปุ่ม <strong>"ยื่นคำร้องขอแก้"</strong> ในรายการของตน ระบบจะแจ้งครูประจำวิชาเพื่อนัดสอบ/มอบหมายงานต่อไป</p>`,
          "academic",
        );
        await Promise.all([
          notifyRole("student", { title: L("📢 เปิดรับคำร้องขอแก้ 0/ร/มส", "Fix request window open"), body: L(`ยื่นคำร้องได้ ${s || "ทันที"} – ${e || "ไม่ระบุ"}`, ""), type: "incomplete_grade_fix_window", severity: "info", url: "/dashboard/academic/incomplete-grades" }),
          notifyRole("parent",  { title: L("📢 เปิดรับคำร้องขอแก้ 0/ร/มส", "Fix request window open"), body: L(`บุตรหลานสามารถยื่นคำร้องได้ ${s || "ทันที"} – ${e || "ไม่ระบุ"}`, ""), type: "incomplete_grade_fix_window", severity: "info", url: "/dashboard/academic/incomplete-grades" }),
        ]);
      }
      toast.success(L("ออกประกาศข่าวล่าสุดให้อัตโนมัติแล้ว", "Auto-published news announcement"));
    }
  };

  // ----- Form state (report) -----
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const selectedAssignment = useMemo(
    () => myAssignments.find((a: any) => a.id === selectedAssignmentId),
    [myAssignments, selectedAssignmentId],
  );
  const [gradeType, setGradeType] = useState<GradeType>("0");
  const [reason, setReason] = useState("");
  // Default deadline: end of next month
  const defaultDeadline = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 2); d.setDate(0);
    return d.toISOString().slice(0, 10);
  }, []);
  const [fixDeadline, setFixDeadline] = useState<string>(defaultDeadline);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: classroomStudents = [] } = useQuery({
    queryKey: ["classroom-students", selectedAssignment?.classroom_id],
    enabled: !!selectedAssignment?.classroom_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, auth_user_id")
        .eq("classroom_id", selectedAssignment!.classroom_id)
        .eq("status", "active")
        .order("student_code");
      return data || [];
    },
  });

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return classroomStudents;
    return classroomStudents.filter((s: any) =>
      `${s.student_code} ${s.prefix || ""}${s.first_name} ${s.last_name}`.toLowerCase().includes(q),
    );
  }, [classroomStudents, studentSearch]);

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) setSelectedStudentIds(new Set());
    else setSelectedStudentIds(new Set(filteredStudents.map((s: any) => s.id)));
  };
  const resetForm = () => { setSelectedStudentIds(new Set()); setReason(""); };

  const handleSubmit = async () => {
    if (!selectedAssignment || selectedStudentIds.size === 0) {
      toast.error(L("กรุณาเลือกวิชาและนักเรียน", "Select subject and students"));
      return;
    }
    if (isTeacher && !inWindow) {
      toast.error(L("ขณะนี้อยู่นอกช่วงเวลารายงานที่ผู้บริหารกำหนด", "Outside admin-defined reporting window"));
      return;
    }
    setSubmitting(true);
    try {
      const ids = Array.from(selectedStudentIds);
      const rows = ids.map((sid) => ({
        student_id: sid,
        subject_id: selectedAssignment.subject_id,
        classroom_id: selectedAssignment.classroom_id,
        teacher_id: (selectedAssignment as any).personnel_id ?? myPersonnel?.id ?? null,
        reported_by: user?.id ?? null,
        grade_type: gradeType,
        reason: reason.trim() || null,
        fix_deadline: fixDeadline || null,
        academic_year: academicYear - 543, // store as CE to match existing data + query filter
        semester: currentSemester,         // lock to actual-date semester (avoid both-term notifications)
      }));
      const { error } = await supabase.from("incomplete_grade_reports").insert(rows);
      if (error) throw error;

      const targetStudents = classroomStudents.filter((s: any) => selectedStudentIds.has(s.id));
      const studentUserIds = targetStudents.map((s: any) => s.auth_user_id).filter(Boolean) as string[];
      const subjName = (selectedAssignment as any).subjects?.name_th || "วิชา";
      const teacherName = `${myPersonnel?.prefix || ""}${myPersonnel?.first_name || ""} ${myPersonnel?.last_name || ""}`.trim();

      if (studentUserIds.length > 0) {
        await notify({
          user_ids: studentUserIds,
          title: L(`⚠️ คุณมีผลการเรียน "${gradeType}" ในวิชา ${subjName}`, `You have an incomplete grade (${gradeType}) in ${subjName}`),
          body: reason || L(`ครูผู้สอน: ${teacherName} — กรุณายื่นคำร้องขอแก้ 0/ร/มส ในระบบ`, `Please file a fix request in the system.`),
          type: "incomplete_grade", severity: "warning",
          reference_type: "incomplete_grade_report",
          url: "/dashboard/academic/incomplete-grades",
        });
      }
      const summary = L(
        `ครู ${teacherName} รายงานนักเรียน ${ids.length} คน ติด "${gradeType}" ในวิชา ${subjName}`,
        `${teacherName} reported ${ids.length} student(s) with "${gradeType}" in ${subjName}`,
      );
      await Promise.all([
        notifyRole("admin", { title: L(`📋 รายงานผล ${gradeType}`, `Incomplete grade ${gradeType}`), body: summary, type: "incomplete_grade", severity: "warning", url: "/dashboard/academic/incomplete-grades" }),
        notifyRole("director", { title: L(`📋 รายงานผล ${gradeType}`, `Incomplete grade ${gradeType}`), body: summary, type: "incomplete_grade", severity: "warning", url: "/dashboard/academic/incomplete-grades" }),
      ]);

      toast.success(L(`บันทึก ${ids.length} รายการ และแจ้งเตือนแล้ว`, `Saved ${ids.length} report(s).`));
      resetForm();
      qc.invalidateQueries({ queryKey: ["incomplete-grade-reports"] });
    } catch (e: any) {
      toast.error(e?.message || L("บันทึกไม่สำเร็จ", "Failed to save"));
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Reports (RLS auto-filters by role; teachers see all history like admin) -----
  const { data: reports = [] } = useQuery({
    queryKey: ["incomplete-grade-reports", academicYear, semester, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_grade_reports")
        .select("*, subject_name_text, teacher_name_text, grade_level_text, classroom_room, student_no, students(student_code, prefix, first_name, last_name, auth_user_id), subjects(name_th, code), classrooms(id, name, grade_level), personnel:teacher_id(prefix, first_name, last_name, user_id)")
        .eq("academic_year", academicYear - 543)
        .eq("semester", semester)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ----- Fix requests (RLS auto-filters by role) -----
  const { data: fixRequests = [] } = useQuery({
    queryKey: ["incomplete-grade-fix-requests", academicYear, semester, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_grade_fix_requests")
        .select("*, subject_name_text, teacher_name_text, students(student_code, prefix, first_name, last_name, auth_user_id), subjects(name_th, code), classrooms(name), personnel:teacher_id(prefix, first_name, last_name, user_id)")
        .eq("academic_year", academicYear - 543)
        .eq("semester", semester)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const ch1 = supabase
      .channel("incomplete_grade_reports_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "incomplete_grade_reports" }, () => {
        qc.invalidateQueries({ queryKey: ["incomplete-grade-reports"] });
      })
      .subscribe();
    const ch2 = supabase
      .channel("incomplete_grade_fix_requests_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "incomplete_grade_fix_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["incomplete-grade-fix-requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [qc]);

  // ----- Dashboard filters -----
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClassroom, setFilterClassroom] = useState<string>("all");
  const [groupMode, setGroupMode] = useState<"list" | "student" | "classroom">("list");

  const classroomOptions = useMemo(() => {
    const map = new Map<string, string>();
    reports.forEach((r: any) => { if (r.classrooms) map.set(r.classrooms.id, r.classrooms.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r: any) => {
      if (filterGrade !== "all" && r.grade_type !== filterGrade) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterClassroom !== "all" && r.classroom_id !== filterClassroom) return false;
      if (q) {
        const text = [
          r.students?.student_code, r.students?.first_name, r.students?.last_name,
          r.subjects?.name_th, r.subjects?.code, r.subject_name_text, r.teacher_name_text, r.classrooms?.name, r.grade_level_text,
          r.personnel?.first_name, r.personnel?.last_name, r.reason,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, filterGrade, filterStatus, filterClassroom]);

  const stats = useMemo(() => {
    const s = { total: filteredReports.length, "0": 0, ร: 0, มส: 0, pending: 0, resolved: 0, students: new Set<string>() };
    filteredReports.forEach((r: any) => {
      s[r.grade_type as GradeType]++;
      if (r.status === "pending") s.pending++;
      if (r.status === "resolved") s.resolved++;
      s.students.add(r.student_id);
    });
    return { ...s, students: s.students.size };
  }, [filteredReports]);

  const byStudent = useMemo(() => {
    const map = new Map<string, { student: any; classroom: any; items: any[] }>();
    filteredReports.forEach((r: any) => {
      const k = r.student_id;
      if (!map.has(k)) map.set(k, { student: r.students, classroom: r.classrooms, items: [] });
      map.get(k)!.items.push(r);
    });
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filteredReports]);

  const byClassroom = useMemo(() => {
    const map = new Map<string, { classroom: any; items: any[]; students: Set<string> }>();
    filteredReports.forEach((r: any) => {
      const k = r.classroom_id || "none";
      if (!map.has(k)) map.set(k, { classroom: r.classrooms, items: [], students: new Set() });
      const g = map.get(k)!;
      g.items.push(r);
      g.students.add(r.student_id);
    });
    return Array.from(map.values()).sort((a, b) => (a.classroom?.name || "").localeCompare(b.classroom?.name || "", "th"));
  }, [filteredReports]);

  const resolveReport = async (id: string) => {
    const { error } = await supabase.from("incomplete_grade_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(L("ทำเครื่องหมายว่าแก้ไขแล้ว", "Marked as resolved"));
    qc.invalidateQueries({ queryKey: ["incomplete-grade-reports"] });
  };
  const deleteReport = async (id: string) => {
    if (!(await confirmDelete(L("ลบรายการนี้?", "Delete this report?")))) return;
    const { error } = await supabase.from("incomplete_grade_reports").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(L("ลบแล้ว", "Deleted"));
    qc.invalidateQueries({ queryKey: ["incomplete-grade-reports"] });
  };

  // ----- Student: submit fix request -----
  const [fixDlgOpen, setFixDlgOpen] = useState(false);
  const [fixReport, setFixReport] = useState<any>(null);
  const [fixNote, setFixNote] = useState("");
  const [fixSubmitting, setFixSubmitting] = useState(false);

  const fixRequestByReport = useMemo(() => {
    const m = new Map<string, any>();
    fixRequests.forEach((f: any) => { if (f.report_id) m.set(f.report_id, f); });
    return m;
  }, [fixRequests]);

  const openFixDialog = (report: any) => {
    setFixReport(report); setFixNote(""); setFixDlgOpen(true);
  };

  const submitFixRequest = async () => {
    if (!fixReport || !myStudent) return;
    if (!inFixWindow) {
      toast.error(L("อยู่นอกช่วงเวลาที่เปิดให้ยื่นคำร้อง", "Outside fix request window"));
      return;
    }
    setFixSubmitting(true);
    try {
      const { error } = await supabase.from("incomplete_grade_fix_requests").insert({
        report_id: fixReport.id,
        student_id: myStudent.id,
        teacher_id: fixReport.teacher_id,
        subject_id: fixReport.subject_id,
        classroom_id: fixReport.classroom_id,
        grade_type: fixReport.grade_type,
        student_note: fixNote.trim() || null,
        academic_year: academicYear - 543,
        semester: currentSemester,
        submitted_by: user?.id ?? null,
      } as any);
      if (error) throw error;

      // Notify teacher
      const teacherUid = fixReport.personnel?.user_id;
      const studentName = `${myStudent.prefix || ""}${myStudent.first_name} ${myStudent.last_name}`.trim();
      const subjName = fixReport.subjects?.name_th || "วิชา";
      if (teacherUid) {
        await notify({
          user_ids: [teacherUid],
          title: L(`📨 คำร้องขอแก้ "${fixReport.grade_type}" จาก ${studentName}`, `Fix request from ${studentName}`),
          body: L(`วิชา ${subjName} — กรุณามอบหมายงานและนัดวันสอบในระบบ`, `Subject ${subjName} — please assign task & exam date`),
          type: "incomplete_grade_fix_request", severity: "info",
          reference_type: "incomplete_grade_fix_request",
          url: "/dashboard/academic/incomplete-grades",
        });
      }
      await Promise.all([
        notifyRole("admin",    { title: L("📨 คำร้องขอแก้ 0/ร/มส", "Fix request submitted"), body: L(`${studentName} ยื่นคำร้องวิชา ${subjName}`, ""), type: "incomplete_grade_fix_request", severity: "info", url: "/dashboard/academic/incomplete-grades" }),
        notifyRole("director", { title: L("📨 คำร้องขอแก้ 0/ร/มส", "Fix request submitted"), body: L(`${studentName} ยื่นคำร้องวิชา ${subjName}`, ""), type: "incomplete_grade_fix_request", severity: "info", url: "/dashboard/academic/incomplete-grades" }),
      ]);
      toast.success(L("ยื่นคำร้องและแจ้งครูประจำวิชาแล้ว", "Submitted and teacher notified"));
      setFixDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["incomplete-grade-fix-requests"] });
    } catch (e: any) {
      toast.error(e?.message || L("ยื่นคำร้องไม่สำเร็จ", "Failed"));
    } finally {
      setFixSubmitting(false);
    }
  };

  // ----- Teacher: respond fix request (assign task + exam date) -----
  const [respondDlgOpen, setRespondDlgOpen] = useState(false);
  const [respondFix, setRespondFix] = useState<any>(null);
  const [task, setTask] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examLocation, setExamLocation] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [responding, setResponding] = useState(false);

  const openRespond = (f: any) => {
    setRespondFix(f);
    setTask(f.assigned_task || "");
    setExamDate(f.exam_date ? new Date(f.exam_date).toISOString().slice(0, 16) : "");
    setExamLocation(f.exam_location || "");
    setTeacherNote(f.teacher_note || "");
    setRespondDlgOpen(true);
  };

  const saveRespond = async (newStatus: FixStatus) => {
    if (!respondFix) return;
    setResponding(true);
    try {
      const patch: any = {
        status: newStatus,
        teacher_note: teacherNote.trim() || null,
        responded_at: new Date().toISOString(),
        responded_by: user?.id ?? null,
      };
      if (newStatus === "assigned") {
        patch.assigned_task = task.trim() || null;
        patch.exam_date = examDate ? new Date(examDate).toISOString() : null;
        patch.exam_location = examLocation.trim() || null;
      }
      if (newStatus === "completed") {
        patch.completed_at = new Date().toISOString();
        // Also resolve the linked report
        if (respondFix.report_id) {
          await supabase.from("incomplete_grade_reports")
            .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id })
            .eq("id", respondFix.report_id);
        }
      }
      const { error } = await supabase.from("incomplete_grade_fix_requests").update(patch).eq("id", respondFix.id);
      if (error) throw error;

      const studentUid = respondFix.students?.auth_user_id;
      const subjName = respondFix.subjects?.name_th || "วิชา";
      const title = newStatus === "assigned"
        ? L(`📚 ครูมอบหมายงานแก้ "${respondFix.grade_type}" ในวิชา ${subjName}`, `Task assigned for ${subjName}`)
        : newStatus === "completed"
          ? L(`✅ แก้ผลการเรียน "${respondFix.grade_type}" สำเร็จ — ${subjName}`, `Fix completed — ${subjName}`)
          : newStatus === "rejected"
            ? L(`❌ คำร้องขอแก้ "${respondFix.grade_type}" ถูกปฏิเสธ — ${subjName}`, `Fix request rejected — ${subjName}`)
            : L(`📨 ครูรับเรื่องคำร้อง — ${subjName}`, `Teacher acknowledged — ${subjName}`);
      const bodyLines = [
        teacherNote && `หมายเหตุครู: ${teacherNote}`,
        newStatus === "assigned" && task && `งานที่มอบหมาย: ${task}`,
        newStatus === "assigned" && examDate && `วันนัดสอบ: ${new Date(examDate).toLocaleString("th-TH")}`,
        newStatus === "assigned" && examLocation && `สถานที่: ${examLocation}`,
      ].filter(Boolean).join(" • ");

      if (studentUid) {
        await notify({
          user_ids: [studentUid],
          title,
          body: bodyLines || L("เปิดดูรายละเอียดในระบบ", "Open details in system"),
          type: "incomplete_grade_fix_response",
          severity: newStatus === "rejected" ? "warning" : "info",
          url: "/dashboard/academic/incomplete-grades",
        });
      }
      toast.success(L("บันทึกและแจ้งนักเรียนแล้ว", "Saved & notified student"));
      setRespondDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["incomplete-grade-fix-requests"] });
      qc.invalidateQueries({ queryKey: ["incomplete-grade-reports"] });
    } catch (e: any) {
      toast.error(e?.message || L("บันทึกไม่สำเร็จ", "Failed"));
    } finally {
      setResponding(false);
    }
  };

  const allSelected = filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length;

  // ----- Student-specific view (own data only via RLS) -----
  const myReports = useMemo(() => {
    if (!isStudent || !myStudent) return [];
    return reports.filter((r: any) => r.student_id === myStudent.id);
  }, [reports, isStudent, myStudent]);

  const initialTab = canReport ? "new" : (isStudent ? "mine" : "list");

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-danger/10 via-warning/5 to-warning/10 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-danger/10 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-warning/10 rounded-full blur-3xl -ml-32 -mb-32" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-danger/30 to-warning/30 border border-danger/40 shadow-lg">
              <FileWarning className="w-7 h-7 text-danger" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{L("รายงานผลการเรียน 0 / ร / มส", "Incomplete Grade Reports")}</h1>
              <p className="text-sm text-muted-foreground">{L("รายงาน · ติดตาม · ยื่นคำร้องขอแก้ผลการเรียน พร้อมแจ้งเตือนอัตโนมัติ", "Report, track, and request fix workflow with automatic notifications.")}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {windowStatus !== "always" && (
              <Badge className={
                windowStatus === "open" ? "bg-success/20 text-success border-success/40 gap-1.5 px-3 py-1.5"
                : windowStatus === "before" ? "bg-info/20 text-info border-info/40 gap-1.5 px-3 py-1.5"
                : "bg-danger/20 text-danger border-danger/40 gap-1.5 px-3 py-1.5"
              }>
                <CalendarRange className="w-3.5 h-3.5" />
                {L("ครูรายงาน", "Report")}: {windowStatus === "open" ? L(`ถึง ${windowEnd || "—"}`, `until ${windowEnd || "—"}`) : windowStatus === "before" ? L(`เริ่ม ${windowStart}`, `from ${windowStart}`) : L(`ปิดแล้ว`, `closed`)}
              </Badge>
            )}
            {fixStatus !== "always" && (
              <Badge className={
                fixStatus === "open" ? "bg-success/20 text-success border-success/40 gap-1.5 px-3 py-1.5"
                : fixStatus === "before" ? "bg-info/20 text-info border-info/40 gap-1.5 px-3 py-1.5"
                : "bg-danger/20 text-danger border-danger/40 gap-1.5 px-3 py-1.5"
              }>
                <ClipboardCheck className="w-3.5 h-3.5" />
                {L("นักเรียนยื่นคำร้อง", "Fix")}: {fixStatus === "open" ? L(`ถึง ${fixEnd || "—"}`, `until ${fixEnd || "—"}`) : fixStatus === "before" ? L(`เริ่ม ${fixStart}`, `from ${fixStart}`) : L(`ปิดแล้ว`, `closed`)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Year/Sem + admin windows */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">{L("ปีการศึกษา", "Academic year")}</Label>
            <Select value={String(academicYear)} onValueChange={(v) => setAcademicYear(parseInt(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{academicYearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{L("ภาคเรียน", "Semester")}</Label>
            <Select value={String(semester)} onValueChange={(v) => setSemester(parseInt(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
            </Select>
          </div>
          {isAdminLike && (
            <div className="ml-auto grid md:grid-cols-2 gap-3 w-full md:w-auto">
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-dashed border-danger/40 bg-danger/5">
                <Settings2 className="w-4 h-4 text-danger mb-2.5" />
                <div className="text-xs font-medium w-full mb-1 text-danger flex items-center gap-1"><Megaphone className="w-3 h-3" />{L("ช่วงครูรายงาน", "Reporting window")}</div>
                <div>
                  <Label className="text-xs">{L("เริ่ม", "Start")}</Label>
                  <DateInput value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-36" />
                </div>
                <div>
                  <Label className="text-xs">{L("สิ้นสุด", "End")}</Label>
                  <DateInput value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-36" />
                </div>
                <Button size="sm" onClick={() => saveWindow("report")} className="gap-1.5"><Save className="w-3.5 h-3.5" />{L("บันทึก+ประกาศ", "Save+News")}</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-dashed border-success/40 bg-success/5">
                <ClipboardCheck className="w-4 h-4 text-success mb-2.5" />
                <div className="text-xs font-medium w-full mb-1 text-success flex items-center gap-1"><Megaphone className="w-3 h-3" />{L("ช่วงนักเรียนยื่นคำร้องแก้", "Fix request window")}</div>
                <div>
                  <Label className="text-xs">{L("เริ่ม", "Start")}</Label>
                  <DateInput value={editFixStart} onChange={(e) => setEditFixStart(e.target.value)} className="w-36" />
                </div>
                <div>
                  <Label className="text-xs">{L("สิ้นสุด", "End")}</Label>
                  <DateInput value={editFixEnd} onChange={(e) => setEditFixEnd(e.target.value)} className="w-36" />
                </div>
                <Button size="sm" onClick={() => saveWindow("fix")} className="gap-1.5"><Save className="w-3.5 h-3.5" />{L("บันทึก+ประกาศ", "Save+News")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          {canReport && <TabsTrigger value="new" className="gap-1.5"><Send className="w-3.5 h-3.5" /> {L("รายงานใหม่", "New report")}</TabsTrigger>}
          {isStudent && <TabsTrigger value="mine" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {L("ผลการเรียนของฉัน", "My grades")}</TabsTrigger>}
          <TabsTrigger value="list" className="gap-1.5"><LayoutList className="w-3.5 h-3.5" /> {L("แดชบอร์ดรายงาน", "Dashboard")}</TabsTrigger>
          <TabsTrigger value="fix" className="gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> {L("คำร้องขอแก้", "Fix requests")} {fixRequests.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{fixRequests.length}</Badge>}</TabsTrigger>
        </TabsList>

        {canReport && (
          <TabsContent value="new" className="space-y-4">
            {isTeacher && !inWindow && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm flex items-center gap-2 text-danger">
                <AlertTriangle className="w-4 h-4" />
                {windowStatus === "before" ? L(`ยังไม่ถึงวันเปิดรับรายงาน (เริ่ม ${windowStart})`, `Reporting opens ${windowStart}`)
                  : L(`ปิดรับรายงานแล้ว (ถึง ${windowEnd})`, `Reporting closed (until ${windowEnd})`)}
              </div>
            )}
            <Card>
              <CardHeader><CardTitle className="text-base">{L("เลือกวิชาและประเภทผลการเรียน", "Select subject & grade type")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">{isAdminLike ? L("วิชา–ห้อง–ครู (ทั้งหมด)", "Subject–Class–Teacher") : L("วิชาที่สอน", "Assigned subject")}</Label>
                    <Select value={selectedAssignmentId} onValueChange={(v) => { setSelectedAssignmentId(v); setSelectedStudentIds(new Set()); }}>
                      <SelectTrigger><SelectValue placeholder={L("เลือกวิชา…", "Select…")} /></SelectTrigger>
                      <SelectContent className="max-h-80">
                        {myAssignments.length === 0 && <div className="p-2 text-sm text-muted-foreground">{L("ยังไม่มีการมอบหมาย", "No assignments")}</div>}
                        {myAssignments.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.subjects?.code} — {a.subjects?.name_th} · {a.classrooms?.name}
                            {isAdminLike && a.personnel ? ` · ${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{L("ประเภทผลการเรียน", "Grade type")}</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {GRADE_OPTIONS.map((g) => (
                        <button key={g.value} type="button" onClick={() => setGradeType(g.value)}
                          className={`p-3 rounded-lg border text-center transition ${gradeType === g.value ? g.color + " ring-2 " + g.ring : "border-border hover:bg-accent"}`}
                          title={g.desc}>
                          <div className="text-2xl font-bold">{g.label}</div>
                          <div className="text-[10px] mt-0.5 opacity-80 leading-tight">{g.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs">{L("เหตุผล (ไม่บังคับ)", "Reason (optional)")}</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                      placeholder={L("เช่น ขาดสอบกลางภาค, ส่งงานไม่ครบ, เวลาเรียนไม่ถึง 80%", "e.g. missed exam, incomplete assignments…")} />
                  </div>
                  <div>
                    <Label className="text-xs">{L("กำหนดส่งงานแก้ (เพื่อแจ้งเตือนอัตโนมัติ)", "Fix deadline (auto-reminder)")}</Label>
                    <Input type="date" value={fixDeadline} onChange={(e) => setFixDeadline(e.target.value)}
                      min={new Date().toISOString().slice(0,10)} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {L("ระบบจะเตือนนักเรียน/ผู้ปกครอง/ครู เมื่อเหลือ 14, 7, 3, 1 วัน และเลยกำหนด", "Auto-reminds 14/7/3/1 days before & after deadline")}
                    </p>
                  </div>
                </div>
                {selectedAssignment && (
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="all" />
                        <Label htmlFor="all" className="text-sm cursor-pointer">
                          {L("เลือกทั้งหมด", "Select all")} ({selectedStudentIds.size}/{filteredStudents.length})
                        </Label>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder={L("ค้นหานักเรียน…", "Search…")} className="pl-8 w-64" />
                      </div>
                    </div>
                    <div className="border rounded-lg max-h-96 overflow-auto divide-y">
                      {filteredStudents.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">{L("ไม่พบนักเรียน", "No students")}</div>}
                      {filteredStudents.map((s: any) => (
                        <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-accent cursor-pointer">
                          <Checkbox checked={selectedStudentIds.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                          <span className="font-mono text-xs text-muted-foreground w-20">{s.student_code}</span>
                          <span className="text-sm">{s.prefix || ""}{s.first_name} {s.last_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetForm} disabled={submitting}>{L("ล้าง", "Reset")}</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !selectedAssignment || selectedStudentIds.size === 0 || (isTeacher && !inWindow)} className="gap-2">
                    <Send className="w-4 h-4" />
                    {submitting ? L("กำลังบันทึก…", "Saving…") : L(`บันทึก ${selectedStudentIds.size} รายการ`, `Save ${selectedStudentIds.size}`)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Student "My grades" tab */}
        {isStudent && (
          <TabsContent value="mine" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label={L("ทั้งหมด", "Total")} value={myReports.length} icon={<FileWarning className="w-4 h-4" />} color="from-neutral/20 to-neutral/5 border-neutral/40 text-neutral" />
              <KpiCard label="0"  value={myReports.filter((r: any) => r.grade_type === "0").length} icon={<span className="font-bold">0</span>} color="from-danger/20 to-danger/5 border-danger/40 text-danger" />
              <KpiCard label="ร"  value={myReports.filter((r: any) => r.grade_type === "ร").length} icon={<span className="font-bold">ร</span>} color="from-warning/20 to-warning/5 border-warning/40 text-warning" />
              <KpiCard label="มส" value={myReports.filter((r: any) => r.grade_type === "มส").length} icon={<span className="font-bold">มส</span>} color="from-warning/20 to-warning/5 border-warning/40 text-warning" />
              <KpiCard label={L("แก้แล้ว", "Resolved")} value={myReports.filter((r: any) => r.status === "resolved").length} icon={<CheckCircle2 className="w-4 h-4" />} color="from-success/20 to-success/5 border-success/40 text-success" />
            </div>

            {!inFixWindow && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm flex items-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                {fixStatus === "before" ? L(`การยื่นคำร้องขอแก้จะเปิด ${fixStart}`, `Fix requests open ${fixStart}`)
                  : L(`ปิดรับคำร้องขอแก้แล้ว (ถึง ${fixEnd})`, `Fix requests closed`)}
              </div>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{L("รายวิชาที่ติด 0/ร/มส ของฉัน", "My incomplete subjects")}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{L("วันที่รายงาน", "Date")}</TableHead>
                      <TableHead>{L("วิชา", "Subject")}</TableHead>
                      <TableHead>{L("ครูประจำวิชา", "Teacher")}</TableHead>
                      <TableHead className="text-center">{L("ผล", "Grade")}</TableHead>
                      <TableHead>{L("เหตุผล", "Reason")}</TableHead>
                      <TableHead className="text-center">{L("คำร้อง", "Request")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReports.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success/60" />
                        {L("ยังไม่มีรายวิชาที่ติด 0/ร/มส 🎉", "You have no incomplete grades 🎉")}
                      </TableCell></TableRow>
                    )}
                    {myReports.map((r: any) => {
                      const g = GRADE_OPTIONS.find((x) => x.value === r.grade_type);
                      const fix = fixRequestByReport.get(r.id);
                      const fixMeta = fix ? FIX_STATUS_META[fix.status as FixStatus] : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell>
                          <TableCell className="text-sm">{r.subjects?.code ? `${r.subjects.code} ${r.subjects.name_th}` : (r.subject_name_text || "—")}</TableCell>
                          <TableCell className="text-xs">{r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell>
                          <TableCell className="text-center"><Badge className={g?.color}>{r.grade_type}</Badge></TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={r.reason || ""}>{r.reason || "-"}</TableCell>
                          <TableCell className="text-center">
                            {fixMeta ? <Badge className={fixMeta.color}><fixMeta.icon className="w-3 h-3 mr-1" />{L(fixMeta.label, fix.status)}</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {!fix && r.status !== "resolved" && (
                              <Button size="sm" variant="outline" onClick={() => openFixDialog(r)} disabled={!inFixWindow} className="gap-1.5">
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                {L("ยื่นคำร้องขอแก้", "Request fix")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="list" className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KpiCard label={L("รายงานทั้งหมด", "Total")} value={stats.total} icon={<FileWarning className="w-4 h-4" />} color="from-neutral/20 to-neutral/5 border-neutral/40 text-neutral" />
            <KpiCard label={L("นักเรียนที่เกี่ยวข้อง", "Students")} value={stats.students} icon={<Users className="w-4 h-4" />} color="from-info/20 to-info/5 border-info/40 text-info" />
            <KpiCard label="0" value={stats["0"]} icon={<span className="font-bold">0</span>} color="from-danger/20 to-danger/5 border-danger/40 text-danger" />
            <KpiCard label="ร" value={stats.ร} icon={<span className="font-bold">ร</span>} color="from-warning/20 to-warning/5 border-warning/40 text-warning" />
            <KpiCard label="มส" value={stats.มส} icon={<span className="font-bold">มส</span>} color="from-warning/20 to-warning/5 border-warning/40 text-warning" />
            <KpiCard label={L("แก้แล้ว", "Resolved")} value={`${stats.resolved}/${stats.total}`} icon={<CheckCircle2 className="w-4 h-4" />} color="from-success/20 to-success/5 border-success/40 text-success" />
          </div>

          {/* Filter bar */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Label className="text-xs">{L("ค้นหา (ชื่อ, รหัส, วิชา, ครู, เหตุผล)", "Search")}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L("ค้นหา…", "Search…")} className="pl-8" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{L("ประเภท", "Grade")}</Label>
                <Select value={filterGrade} onValueChange={setFilterGrade}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("ทั้งหมด", "All")}</SelectItem>
                    <SelectItem value="0">0</SelectItem><SelectItem value="ร">ร</SelectItem><SelectItem value="มส">มส</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{L("สถานะ", "Status")}</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("ทั้งหมด", "All")}</SelectItem>
                    <SelectItem value="pending">{L("รอแก้", "Pending")}</SelectItem>
                    <SelectItem value="resolved">{L("แก้แล้ว", "Resolved")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{L("ห้องเรียน", "Class")}</Label>
                <Select value={filterClassroom} onValueChange={setFilterClassroom}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("ทั้งหมด", "All")}</SelectItem>
                    {classroomOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex gap-1 p-1 bg-muted rounded-lg">
                {([
                  ["list", L("รายการ", "List"), LayoutList],
                  ["student", L("รายคน", "Student"), GraduationCap],
                  ["classroom", L("รายห้อง", "Class"), Layers],
                ] as const).map(([k, label, Icon]) => (
                  <Button key={k} size="sm" variant={groupMode === k ? "default" : "ghost"} onClick={() => setGroupMode(k as any)} className="h-8 gap-1.5">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Views */}
          {groupMode === "list" && (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{L("วันที่", "Date")}</TableHead>
                      <TableHead>{L("นักเรียน", "Student")}</TableHead>
                      <TableHead>{L("ห้อง", "Class")}</TableHead>
                      <TableHead>{L("วิชา", "Subject")}</TableHead>
                      <TableHead>{L("ครู", "Teacher")}</TableHead>
                      <TableHead className="text-center">{L("ผล", "Grade")}</TableHead>
                      <TableHead>{L("เหตุผล", "Reason")}</TableHead>
                      <TableHead className="text-center">{L("สถานะ", "Status")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{L("ไม่พบรายงาน", "No reports")}</TableCell></TableRow>
                    )}
                    {filteredReports.map((r: any) => {
                      const g = GRADE_OPTIONS.find((x) => x.value === r.grade_type);
                      const canEdit = isAdminLike || (isTeacher && r.teacher_id === myPersonnel?.id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{r.students?.prefix}{r.students?.first_name} {r.students?.last_name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{r.students?.student_code}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.classrooms?.name}</TableCell>
                          <TableCell className="text-sm">{r.subjects?.code ? `${r.subjects.code} ${r.subjects.name_th}` : (r.subject_name_text || "—")}</TableCell>
                          <TableCell className="text-xs">{r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell>
                          <TableCell className="text-center"><Badge className={g?.color}>{r.grade_type}</Badge></TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={r.reason || ""}>{r.reason || "-"}</TableCell>
                          <TableCell className="text-center">
                            {r.status === "resolved"
                              ? <Badge className="bg-success/15 text-success border-success/40"><CheckCircle2 className="w-3 h-3 mr-1" />{L("แก้แล้ว", "Resolved")}</Badge>
                              : <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />{L("รอแก้", "Pending")}</Badge>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {r.status === "pending" && canEdit && (
                              <Button size="sm" variant="ghost" onClick={() => resolveReport(r.id)} className="text-success"><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                            )}
                            {canEdit && (
                              <Button size="sm" variant="ghost" onClick={() => deleteReport(r.id)} className="text-danger"><Trash2 className="w-3.5 h-3.5" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {groupMode === "student" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {byStudent.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">{L("ไม่พบรายงาน", "No reports")}</CardContent></Card>}
              {byStudent.map((g) => (
                <Card key={g.student?.student_code || Math.random()} className="overflow-hidden">
                  <div className="bg-gradient-to-r from-danger/10 to-warning/10 px-4 py-3 border-b">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{g.student?.prefix}{g.student?.first_name} {g.student?.last_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{g.student?.student_code} · {g.classroom?.name}</div>
                      </div>
                      <Badge className="bg-danger/20 text-danger border-danger/40">{g.items.length}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-1.5">
                    {g.items.map((r: any) => {
                      const go = GRADE_OPTIONS.find((x) => x.value === r.grade_type);
                      return (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <Badge className={`${go?.color} text-xs px-1.5 min-w-[28px] justify-center`}>{r.grade_type}</Badge>
                          <span className="flex-1 truncate" title={`${r.subjects?.code} ${r.subjects?.name_th || r.subject_name_text || "—"}`}>{r.subjects?.name_th || r.subject_name_text || "—"}</span>
                          {r.status === "resolved" && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {groupMode === "classroom" && (
            <div className="space-y-3">
              {byClassroom.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">{L("ไม่พบรายงาน", "No reports")}</CardContent></Card>}
              {byClassroom.map((g) => {
                const counts = { "0": 0, ร: 0, มส: 0 };
                g.items.forEach((r: any) => counts[r.grade_type as GradeType]++);
                return (
                  <Card key={g.classroom?.id || "none"}>
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        {g.classroom?.name || L("ไม่ระบุห้อง", "Unassigned")}
                      </CardTitle>
                      <div className="flex gap-2 flex-wrap text-xs">
                        <Badge variant="outline">{L("นักเรียน", "Students")}: {g.students.size}</Badge>
                        <Badge className="bg-danger/15 text-danger border-danger/40">0: {counts["0"]}</Badge>
                        <Badge className="bg-warning/15 text-warning border-warning/40">ร: {counts.ร}</Badge>
                        <Badge className="bg-warning/15 text-warning border-warning/40">มส: {counts.มส}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{L("นักเรียน", "Student")}</TableHead>
                            <TableHead>{L("วิชา", "Subject")}</TableHead>
                            <TableHead className="text-center">{L("ผล", "Grade")}</TableHead>
                            <TableHead>{L("เหตุผล", "Reason")}</TableHead>
                            <TableHead className="text-center">{L("สถานะ", "Status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.items.map((r: any) => {
                            const go = GRADE_OPTIONS.find((x) => x.value === r.grade_type);
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="text-sm">{r.students?.prefix}{r.students?.first_name} {r.students?.last_name}</TableCell>
                                <TableCell className="text-sm">{r.subjects?.code ? `${r.subjects.code} ${r.subjects.name_th}` : (r.subject_name_text || "—")}</TableCell>
                                <TableCell className="text-center"><Badge className={go?.color}>{r.grade_type}</Badge></TableCell>
                                <TableCell className="text-xs max-w-xs truncate" title={r.reason || ""}>{r.reason || "-"}</TableCell>
                                <TableCell className="text-center text-xs">
                                  {r.status === "resolved"
                                    ? <Badge className="bg-success/15 text-success border-success/40">{L("แก้แล้ว", "Resolved")}</Badge>
                                    : <Badge variant="outline">{L("รอแก้", "Pending")}</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Fix requests tab */}
        <TabsContent value="fix" className="space-y-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L("วันที่ยื่น", "Submitted")}</TableHead>
                    <TableHead>{L("นักเรียน", "Student")}</TableHead>
                    <TableHead>{L("วิชา", "Subject")}</TableHead>
                    <TableHead>{L("ครู", "Teacher")}</TableHead>
                    <TableHead className="text-center">{L("ผล", "Grade")}</TableHead>
                    <TableHead>{L("งานที่มอบหมาย / นัดสอบ", "Task / Exam")}</TableHead>
                    <TableHead className="text-center">{L("สถานะ", "Status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixRequests.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">{L("ยังไม่มีคำร้อง", "No fix requests yet")}</TableCell></TableRow>
                  )}
                  {fixRequests.map((f: any) => {
                    const meta = FIX_STATUS_META[f.status as FixStatus];
                    const g = GRADE_OPTIONS.find((x) => x.value === f.grade_type);
                    const isMyTeacher = isTeacher && f.teacher_id === myPersonnel?.id;
                    const canRespond = isAdminLike || isMyTeacher;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(f.created_at).toLocaleDateString("th-TH")}</TableCell>
                        <TableCell className="text-sm">
                          <div>{f.students?.prefix}{f.students?.first_name} {f.students?.last_name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{f.students?.student_code} · {f.classrooms?.name}</div>
                        </TableCell>
                        <TableCell className="text-sm">{f.subjects?.code} {f.subjects?.name_th}</TableCell>
                        <TableCell className="text-xs">{f.personnel ? `${f.personnel.prefix || ""}${f.personnel.first_name} ${f.personnel.last_name}` : "-"}</TableCell>
                        <TableCell className="text-center"><Badge className={g?.color}>{f.grade_type}</Badge></TableCell>
                        <TableCell className="text-xs max-w-sm">
                          {f.assigned_task && <div className="truncate" title={f.assigned_task}>📝 {f.assigned_task}</div>}
                          {f.exam_date && <div>📅 {new Date(f.exam_date).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</div>}
                          {f.exam_location && <div>📍 {f.exam_location}</div>}
                          {!f.assigned_task && !f.exam_date && f.student_note && <div className="text-muted-foreground italic truncate" title={f.student_note}>"{f.student_note}"</div>}
                          {!f.assigned_task && !f.exam_date && !f.student_note && "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={meta.color}><meta.icon className="w-3 h-3 mr-1" />{L(meta.label, f.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canRespond && f.status !== "completed" && (
                            <Button size="sm" variant="outline" onClick={() => openRespond(f)} className="gap-1.5">
                              <BookOpenCheck className="w-3.5 h-3.5" />
                              {L("ตอบกลับ", "Respond")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student fix request dialog */}
      <Dialog open={fixDlgOpen} onOpenChange={setFixDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-primary" />
              {L("ยื่นคำร้องขอแก้ผลการเรียน", "Submit Fix Request")}
            </DialogTitle>
          </DialogHeader>
          {fixReport && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div><span className="text-muted-foreground">{L("วิชา:", "Subject:")}</span> <strong>{fixReport.subjects?.code ? `${fixReport.subjects.code} ${fixReport.subjects.name_th}` : (fixReport.subject_name_text || "—")}</strong></div>
                <div><span className="text-muted-foreground">{L("ครูประจำวิชา:", "Teacher:")}</span> {fixReport.personnel ? `${fixReport.personnel.prefix || ""}${fixReport.personnel.first_name} ${fixReport.personnel.last_name}` : "-"}</div>
                <div><span className="text-muted-foreground">{L("ผล:", "Grade:")}</span> <Badge className={GRADE_OPTIONS.find(x => x.value === fixReport.grade_type)?.color}>{fixReport.grade_type}</Badge></div>
                {fixReport.reason && <div className="text-xs text-muted-foreground">{L("เหตุผลจากครู:", "Reason:")} {fixReport.reason}</div>}
              </div>
              <div>
                <Label className="text-xs">{L("ข้อความถึงครู (เช่น สะดวกวันใด, ขอคำแนะนำงาน)", "Message to teacher")}</Label>
                <Textarea rows={4} value={fixNote} onChange={(e) => setFixNote(e.target.value)}
                  placeholder={L("ขออนุญาตยื่นคำร้องเพื่อขอแก้ผลการเรียน…", "I would like to request to fix…")} />
              </div>
              <p className="text-xs text-muted-foreground">{L("ระบบจะแจ้งครูประจำวิชาให้มอบหมายงานและนัดวันสอบ", "The teacher will be notified to assign task & exam date.")}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixDlgOpen(false)} disabled={fixSubmitting}>{L("ยกเลิก", "Cancel")}</Button>
            <Button onClick={submitFixRequest} disabled={fixSubmitting} className="gap-1.5">
              <Send className="w-4 h-4" />{fixSubmitting ? L("กำลังส่ง…", "Sending…") : L("ส่งคำร้อง", "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teacher respond dialog */}
      <Dialog open={respondDlgOpen} onOpenChange={setRespondDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-primary" />
              {L("ตอบกลับคำร้องขอแก้ผลการเรียน", "Respond to Fix Request")}
            </DialogTitle>
          </DialogHeader>
          {respondFix && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div><span className="text-muted-foreground">{L("นักเรียน:", "Student:")}</span> <strong>{respondFix.students?.prefix}{respondFix.students?.first_name} {respondFix.students?.last_name}</strong> ({respondFix.students?.student_code})</div>
                <div><span className="text-muted-foreground">{L("วิชา:", "Subject:")}</span> {respondFix.subjects?.code ? `${respondFix.subjects.code} ${respondFix.subjects.name_th}` : (respondFix.subject_name_text || "—")}</div>
                <div><span className="text-muted-foreground">{L("ผล:", "Grade:")}</span> <Badge className={GRADE_OPTIONS.find(x => x.value === respondFix.grade_type)?.color}>{respondFix.grade_type}</Badge></div>
                {respondFix.student_note && <div className="text-xs italic text-muted-foreground">"{respondFix.student_note}"</div>}
              </div>
              <div>
                <Label className="text-xs">{L("งานที่มอบหมาย", "Assigned task")}</Label>
                <Textarea rows={3} value={task} onChange={(e) => setTask(e.target.value)}
                  placeholder={L("เช่น ทำใบงานบทที่ 1-3, รายงานสรุป 5 หน้า…", "e.g. worksheet, report…")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{L("วันและเวลานัดสอบ", "Exam date & time")}</Label>
                  <DateTimeInput value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{L("สถานที่", "Location")}</Label>
                  <Input value={examLocation} onChange={(e) => setExamLocation(e.target.value)} placeholder={L("ห้อง…", "Room…")} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{L("หมายเหตุถึงนักเรียน", "Note to student")}</Label>
                <Textarea rows={2} value={teacherNote} onChange={(e) => setTeacherNote(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRespondDlgOpen(false)} disabled={responding}>{L("ปิด", "Close")}</Button>
            <Button variant="outline" onClick={() => saveRespond("rejected")} disabled={responding} className="text-danger border-danger/40 gap-1.5">
              <XCircle className="w-4 h-4" />{L("ปฏิเสธ", "Reject")}
            </Button>
            <Button variant="outline" onClick={() => saveRespond("accepted")} disabled={responding} className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" />{L("รับเรื่อง", "Accept")}
            </Button>
            <Button onClick={() => saveRespond("assigned")} disabled={responding} className="gap-1.5">
              <BookOpenCheck className="w-4 h-4" />{L("มอบหมาย + นัดสอบ", "Assign + Exam")}
            </Button>
            <Button onClick={() => saveRespond("completed")} disabled={responding} className="bg-success/80 hover:bg-success gap-1.5">
              <CheckCircle2 className="w-4 h-4" />{L("แก้สำเร็จ", "Mark complete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiCard = ({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) => (
  <Card className={`relative overflow-hidden border bg-gradient-to-br ${color}`}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
          <div className="text-2xl font-bold mt-0.5">{value}</div>
        </div>
        <div className="opacity-70">{icon}</div>
      </div>
    </CardContent>
  </Card>
);

export default IncompleteGradePage;
