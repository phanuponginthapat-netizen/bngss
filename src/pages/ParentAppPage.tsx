import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  AlertTriangle,
  BookOpen,
  Clock,
  RefreshCw,
  Phone,
  School,
  ScanFace,
  FileText,
  Sparkles,
  Award,
  TrendingUp,
  UserCheck,
  Heart,
} from "lucide-react";
import { todayBangkok } from "@/lib/dateBE";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

// ---------- Types ----------
type Child = {
  id: string;
  student_code: string;
  prefix: string | null;
  first_name: string;
  last_name: string;
  classroom_id: string | null;
  guardian_phone: string | null;
  photo_url: string | null;
  classrooms?: { name: string | null } | null;
};

type FaceLog = {
  id: string;
  scan_date: string;
  scan_time: string | null;
  scan_type: string | null;
  status: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
};

type ScoreRow = {
  id: string;
  student_code: string | null;
  subject_id: string | null;
  total_score: number | null;
  grade: string | null;
  grade_point: number | null;
  semester: number | null;
  academic_year: number | null;
  subjects?: { code: string; name_th: string } | null;
};

type HomeworkRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  subject_id: string | null;
  classroom_id: string | null;
  subjects?: { name_th: string; code: string } | null;
  classrooms?: { name: string } | null;
};

type RemediationRow = {
  id: string;
  student_id: string;
  subject_code: string;
  subject_name: string | null;
  term: string;
  original_grade: string;
  status: string;
  fix_deadline: string | null;
  created_at: string;
};

type ChildBundle = {
  child: Child;
  faceLogs: FaceLog[];
  attendance: AttendanceRow[];
  scores: ScoreRow[];
  homework: HomeworkRow[];
  remediation: RemediationRow[];
  loading: boolean;
};

// ---------- Helpers ----------
function fullName(c: Child) {
  return `${c.prefix || ""}${c.first_name} ${c.last_name}`.trim();
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "present":
      return "default" as const;
    case "late":
      return "secondary" as const;
    case "absent":
      return "destructive" as const;
    case "leave":
    case "sick":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function gradeColor(grade: string | null) {
  if (!grade) return "bg-muted";
  if (["0", "ร", "มส", "มผ"].includes(grade)) return "bg-destructive text-destructive-foreground";
  const n = Number(grade);
  if (!Number.isNaN(n) && n >= 3) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (!Number.isNaN(n) && n >= 2) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-secondary";
}

export default function ParentAppPage() {
  const { lang } = useLanguage();
  const L = useCallback((th: string, en: string) => (lang === "th" ? th : en), [lang]);

  const [children, setChildren] = useState<Child[]>([]);
  const [bundles, setBundles] = useState<Record<string, ChildBundle>>({});
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // ---- 1) resolve current user id ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setUserId(data.user?.id ?? null);
        if (!data.user) {
          // also try getSession fallback
          const { data: s } = await supabase.auth.getSession();
          if (!cancelled && s.session?.user) setUserId(s.session.user.id);
        }
      } catch {
        if (!cancelled) setUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- 2) fetch children: parent_id / parent_students link / guardian_phone fallback ----
  const fetchChildren = useCallback(async (uid: string): Promise<Child[]> => {
    // Strategy A: students where parent_user_id = uid OR parent_user_id_2 = uid
    // This covers students.parent_id / parent_user_id pattern
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classroom_id, guardian_phone, photo_url, classrooms(name)")
        .or(`parent_user_id.eq.${uid},parent_user_id_2.eq.${uid}`)
        .limit(20);
      if (!error && data && data.length > 0) return data as unknown as Child[];
    } catch (e) {
      console.warn("parent_user_id query failed", e);
    }

    // Strategy B: via parent_students link table (also try parent_student_links for backward compat)
    // Requirement: query students where parent_id or via parent_students link
    for (const linkTable of ["parent_students", "parent_student_links"]) {
      try {
        // try parent_user_id column
        const { data: links } = await supabase
          .from(linkTable as never)
          .select("student_id")
          .eq("parent_user_id" as never, uid as never)
          .limit(20);
        const rows = (links as unknown as { student_id: string }[] | null) ?? [];
        if (rows.length > 0) {
          const ids = rows.map((r) => r.student_id);
          const { data: studs } = await supabase
            .from("students")
            .select("id, student_code, prefix, first_name, last_name, classroom_id, guardian_phone, photo_url, classrooms(name)")
            .in("id", ids);
          if (studs && (studs as unknown[]).length > 0) return studs as unknown as Child[];
        }
        // fallback column name parent_id
        const { data: links2 } = await supabase
          .from(linkTable as never)
          .select("student_id")
          .eq("parent_id" as never, uid as never)
          .limit(20);
        const rows2 = (links2 as unknown as { student_id: string }[] | null) ?? [];
        if (rows2.length > 0) {
          const ids = rows2.map((r) => r.student_id);
          const { data: studs } = await supabase
            .from("students")
            .select("id, student_code, prefix, first_name, last_name, classroom_id, guardian_phone, photo_url, classrooms(name)")
            .in("id", ids);
          if (studs && (studs as unknown[]).length > 0) return studs as unknown as Child[];
        }
      } catch (e) {
        // table may not exist (dropped in later migration) — ignore and continue
        console.warn(`link table ${linkTable} query failed`, e);
      }
    }

    // Strategy C: fallback to students where guardian_phone matches parent user phone
    // Fetch parent phone from profiles and auth user
    try {
      const [{ data: profile }, { data: auth }] = await Promise.all([
        supabase.from("profiles").select("phone").eq("id", uid).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      const rawPhone =
        (profile as unknown as { phone?: string | null } | null)?.phone ||
        (auth.user as unknown as { phone?: string } | null)?.phone ||
        null;
      const phone = rawPhone?.toString().trim();
      if (phone) {
        const normalized = phone.replace(/[^0-9+]/g, "");
        // use .or with guardian_phone and parent_phone_1/2/3 and phone
        // keep fast with limit
        const orFilter = [
          `guardian_phone.eq.${phone}`,
          normalized !== phone ? `guardian_phone.eq.${normalized}` : null,
          `parent_phone_1.eq.${phone}`,
          normalized !== phone ? `parent_phone_1.eq.${normalized}` : null,
          `parent_phone_2.eq.${phone}`,
          `parent_phone_3.eq.${phone}`,
          `phone.eq.${phone}`,
        ]
          .filter(Boolean)
          .join(",");
        const { data: byPhone } = await supabase
          .from("students")
          .select("id, student_code, prefix, first_name, last_name, classroom_id, guardian_phone, photo_url, classrooms(name)")
          .or(orFilter)
          .limit(20);
        if (byPhone && (byPhone as unknown[]).length > 0) return byPhone as unknown as Child[];
      }
    } catch (e) {
      console.warn("guardian_phone fallback failed", e);
    }

    return [];
  }, []);

  // ---- 3) fetch per-child bundles (attendance today + grades + homework + remediation) ----
  const fetchBundleForChild = useCallback(async (child: Child): Promise<Omit<ChildBundle, "child" | "loading">> => {
    const today = todayBangkok();

    // attendance today from face_scan_logs + attendance
    const facePromise = supabase
      .from("face_scan_logs")
      .select("id, scan_date, scan_time, scan_type, status, created_at")
      .eq("student_id", child.id)
      .eq("scan_date", today)
      .order("scan_time", { ascending: false })
      .limit(5);

    const attendancePromise = supabase
      .from("attendance")
      .select("id, attendance_date, status, notes")
      .eq("student_id", child.id)
      .eq("attendance_date", today)
      .limit(5);

    // latest grades from student_scores (uses student_code) — keep fast with .limit(5)
    const scoresPromise = child.student_code
      ? supabase
          .from("student_scores")
          .select("id, student_code, subject_id, total_score, grade, grade_point, semester, academic_year, subjects(code, name_th)")
          .eq("student_code", child.student_code)
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null } as unknown as { data: ScoreRow[] | null });

    // upcoming homework — try task_assignments by classroom_id + due_date >= today, limit 5
    // also fallback to homework_assignments
    const homeworkTaskPromise = child.classroom_id
      ? supabase
          .from("task_assignments")
          .select("id, title, description, due_date, subject_id, classroom_id, subjects(name_th, code)")
          .eq("classroom_id", child.classroom_id)
          .eq("task_type", "homework")
          .gte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [], error: null } as unknown as { data: HomeworkRow[] | null });

    const homeworkAssignPromise = child.classroom_id
      ? supabase
          .from("homework_assignments")
          .select("id, title, description, due_date, subject_id, classroom_id")
          .eq("classroom_id", child.classroom_id)
          .gte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [], error: null } as unknown as { data: HomeworkRow[] | null });

    // 0 ร มส status — grade_remediation where student_id = child.id and status != 'ผ่าน'
    const remediationPromise = (supabase as any)
      .from("grade_remediation")
      .select("id, student_id, subject_code, subject_name, term, original_grade, status, fix_deadline, created_at")
      .eq("student_id", child.id)
      .neq("status", "ผ่าน")
      .order("created_at", { ascending: false })
      .limit(5);

    const [faceRes, attRes, scoresRes, hwTaskRes, hwAssignRes, remRes] = await Promise.allSettled([
      facePromise,
      attendancePromise,
      scoresPromise,
      homeworkTaskPromise,
      homeworkAssignPromise,
      remediationPromise,
    ]);

    const faceLogs = faceRes.status === "fulfilled" ? ((faceRes.value.data as unknown as FaceLog[]) ?? []) : [];
    const attendance = attRes.status === "fulfilled" ? ((attRes.value.data as unknown as AttendanceRow[]) ?? []) : [];
    const scores = scoresRes.status === "fulfilled" ? ((scoresRes.value.data as unknown as ScoreRow[]) ?? []) : [];
    let homework: HomeworkRow[] = [];
    if (hwTaskRes.status === "fulfilled" && hwTaskRes.value.data && (hwTaskRes.value.data as unknown[]).length > 0) {
      homework = hwTaskRes.value.data as unknown as HomeworkRow[];
    } else if (hwAssignRes.status === "fulfilled" && hwAssignRes.value.data) {
      // map homework_assignments to same shape
      homework = (hwAssignRes.value.data as unknown as HomeworkRow[]).map((h) => ({
        ...h,
        title: (h as unknown as { title: string }).title || "การบ้าน",
      }));
    }
    const remediation = remRes.status === "fulfilled" ? ((remRes.value.data as unknown as RemediationRow[]) ?? []) : [];

    return { faceLogs, attendance, scores, homework, remediation };
  }, []);

  const loadAll = useCallback(async () => {
    if (!userId) {
      setLoadingChildren(false);
      return;
    }
    setLoadingChildren(true);
    try {
      const kids = await fetchChildren(userId);
      setChildren(kids);
      setSelectedChildId(prev => {
        if (kids.length === 0) return prev;
        if (!prev) return kids[0].id;
        if (!kids.find(k => k.id === prev)) return kids[0].id;
        return prev;
      });

      if (kids.length === 0) {
        setBundles({});
        return;
      }

      // init loading bundles
      const init: Record<string, ChildBundle> = {};
      kids.forEach((c) => {
        init[c.id] = { child: c, faceLogs: [], attendance: [], scores: [], homework: [], remediation: [], loading: true };
      });
      setBundles(init);

      // fetch each child in parallel, keep fast with .limit(5) inside fetchBundleForChild
      const results = await Promise.allSettled(
        kids.map(async (child) => {
          const data = await fetchBundleForChild(child);
          return { childId: child.id, data };
        })
      );

      const next: Record<string, ChildBundle> = { ...init };
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const { childId, data } = r.value;
          const child = kids.find((k) => k.id === childId)!;
          next[childId] = { child, ...data, loading: false };
        }
      });
      // handle rejected
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          const child = kids[idx];
          next[child.id] = { ...next[child.id], loading: false };
          toast.error(L(`โหลดข้อมูล ${fullName(child)} ไม่สำเร็จ`, `Failed to load ${fullName(child)}`));
        }
      });
      setBundles(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || L("โหลดข้อมูลไม่สำเร็จ", "Failed to load"));
    } finally {
      setLoadingChildren(false);
      setRefreshing(false);
    }
  }, [userId, fetchChildren, fetchBundleForChild, L]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    toast.success(L("รีเฟรชแล้ว", "Refreshed"));
  };

  // ---------- Render helpers ----------
  const renderAttendance = (b: ChildBundle) => {
    if (b.loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {L("กำลังโหลดการมาเรียน...", "Loading attendance...")}</div>;
    const today = todayBangkok();
    const hasFace = b.faceLogs.length > 0;
    const hasAtt = b.attendance.length > 0;
    if (!hasFace && !hasAtt) {
      return (
        <div className="text-center py-6 space-y-2">
          <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{L(`ยังไม่มีการเช็คชื่อวันนี้ (${today})`, `No attendance today (${today})`)}</p>
          <p className="text-xs text-muted-foreground">{L("ข้อมูลจาก face_scan_logs + attendance", "Data from face_scan_logs + attendance")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {hasFace && (
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><ScanFace className="w-3.5 h-3.5" /> {L("สแกนใบหน้า วันนี้", "Face scan today")} · face_scan_logs</p>
            <div className="space-y-1.5">
              {b.faceLogs.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={f.status === "present" ? "default" : f.status === "late" ? "secondary" : "outline"} className="capitalize">
                      {f.status || f.scan_type || "scan"}
                    </Badge>
                    <span className="text-xs font-mono">{f.scan_time?.slice(0, 8) || new Date(f.created_at).toLocaleTimeString("th-TH")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{f.scan_date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasAtt && (
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" /> {L("บันทึกการมาเรียน วันนี้", "Attendance today")} · attendance</p>
            <div className="space-y-1.5">
              {b.attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(a.status)}>{a.status}</Badge>
                    <span className="text-xs text-muted-foreground">{a.attendance_date}</span>
                  </div>
                  {a.notes && <span className="text-xs truncate max-w-[150px]">{a.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderScores = (b: ChildBundle) => {
    if (b.loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {L("กำลังโหลดคะแนน...", "Loading grades...")}</div>;
    if (b.scores.length === 0) {
      return (
        <div className="text-center py-6 space-y-2">
          <GraduationCap className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{L("ยังไม่มีคะแนนล่าสุด", "No recent grades")}</p>
          <p className="text-xs text-muted-foreground">student_scores · {L("แสดง 5 รายการล่าสุด", "latest 5 items")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> student_scores · .limit(5)</p>
        <div className="space-y-1.5">
          {b.scores.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.subjects?.name_th || s.subjects?.code || L("วิชา", "Subject")} · {s.subjects?.code || s.subject_id?.slice(0, 6) || "-"}</div>
                <div className="text-xs text-muted-foreground">
                  {s.academic_year ? `${L("ปี", "Year")} ${s.academic_year}` : ""} {s.semester ? `· ${L("เทอม", "Sem")} ${s.semester}` : ""} · {L("คะแนนรวม", "Total")} {s.total_score ?? "-"}
                </div>
              </div>
              <Badge className={gradeColor(s.grade)} variant="outline">{s.grade ?? "-"}</Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHomework = (b: ChildBundle) => {
    if (b.loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {L("กำลังโหลดการบ้าน...", "Loading homework...")}</div>;
    if (b.homework.length === 0) {
      return (
        <div className="text-center py-6 space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{L("ไม่มีการบ้านที่ใกล้กำหนด", "No upcoming homework")}</p>
          <p className="text-xs text-muted-foreground">{L("ดึงจาก homework_assignments / task_assignments ตามห้องเรียน", "From homework_assignments / task_assignments by classroom")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {L("การบ้านที่จะถึงกำหนด", "Upcoming homework")} · .limit(5)</p>
        <div className="space-y-1.5">
          {b.homework.map((h) => (
            <div key={h.id} className="rounded-lg border px-3 py-2 bg-amber-50/50 dark:bg-amber-950/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{h.title}</div>
                  {h.description && <div className="text-xs text-muted-foreground line-clamp-2">{h.description}</div>}
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    {h.subjects?.name_th && <span>{h.subjects.name_th}</span>}
                    {h.due_date && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {h.due_date}</span>}
                  </div>
                </div>
                {h.due_date && <Badge variant="outline" className="shrink-0">{new Date(h.due_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRemediation = (b: ChildBundle) => {
    if (b.loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {L("กำลังโหลดสถานะ 0 ร มส...", "Loading remediation...")}</div>;
    if (b.remediation.length === 0) {
      return (
        <div className="text-center py-6 space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto"><ClipboardCheck className="w-5 h-5" /></div>
          <p className="text-sm font-medium text-emerald-700">{L("ไม่มีรายการติด 0 ร มส", "No pending remediation")}</p>
          <p className="text-xs text-muted-foreground">grade_remediation · status != &#39;ผ่าน&#39; · .limit(5)</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> 0 ร มส · grade_remediation where student_id = {b.child.id.slice(0, 6)}… and status != &#39;ผ่าน&#39; · .limit(5)</p>
        <div className="space-y-1.5">
          {b.remediation.map((r) => (
            <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.subject_code} {r.subject_name ? `· ${r.subject_name}` : ""}</div>
                  <div className="text-xs text-muted-foreground">{L("เทอม", "Term")} {r.term} · {L("เกรดเดิม", "Original")} <span className="font-bold">{r.original_grade}</span> {r.fix_deadline ? `· ${L("กำหนดแก้", "Fix by")} ${r.fix_deadline}` : ""}</div>
                </div>
                <Badge variant={r.status === "ติด" ? "destructive" : r.status === "ประกาศแล้ว" ? "secondary" : "outline"}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------- Page ----------
  if (!userId && !loadingChildren) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="font-medium">{L("กรุณาเข้าสู่ระบบด้วยบัญชีผู้ปกครอง", "Please login with a parent account")}</p>
            <Button onClick={() => (window.location.href = "/login")}>{L("ไปหน้าเข้าสู่ระบบ", "Go to Login")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Users className="w-5 h-5" /></span>
            {L("แดชบอร์ดผู้ปกครอง", "Parent Dashboard")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {L("ดูข้อมูลบุตร: การมาเรียนวันนี้ · คะแนนล่าสุด · การบ้านที่จะถึง · สถานะ 0 ร มส", "Track your children: today attendance · latest grades · upcoming homework · 0/R/MS status")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loadingChildren} className="gap-1.5 self-start sm:self-auto">
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {L("รีเฟรช", "Refresh")}
        </Button>
      </div>

      {/* Loading children */}
      {loadingChildren && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{L("กำลังโหลดข้อมูลบุตร...", "Loading children...")}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loadingChildren && children.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <School className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">{L("ยังไม่มีข้อมูลบุตรที่เชื่อมกับบัญชีนี้", "No children linked to this account")}</h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {L(
                  "ระบบไม่พบนักเรียนที่ผูกกับบัญชีผู้ปกครองของคุณ — ทั้งจาก parent_user_id / parent_id, ตาราง parent_students / parent_student_links และ fallback guardian_phone ที่ตรงกับเบอร์โทรของคุณ",
                  "No students found linked via parent_user_id / parent_id, parent_students / parent_student_links, or fallback guardian_phone matching your phone"
                )}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-left max-w-lg mx-auto space-y-2">
              <p className="text-sm font-medium flex items-center gap-2"><Phone className="w-4 h-4" /> {L("วิธีเชื่อมข้อมูลบุตร", "How to link your child")}</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>{L("ติดต่อครูประจำชั้นหรือผู้ดูแลระบบ", "Contact the homeroom teacher or admin")}</li>
                <li>{L("แจ้งรหัสนักเรียน (student_code) และเบอร์โทรผู้ปกครอง (guardian_phone) ให้ตรงกัน", "Provide student_code and ensure guardian_phone matches your account phone")}</li>
                <li>{L("หรือให้ผู้ดูแลเพิ่มข้อมูลใน parent_students / parent_student_links หรือตั้งค่า parent_user_id ในตาราง students", "Or ask admin to add a row in parent_students / parent_student_links or set parent_user_id in students")}</li>
                <li>{L("จากนั้นกดรีเฟรชหน้านี้อีกครั้ง", "Then refresh this page")}</li>
              </ol>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleRefresh}><RefreshCw className="w-4 h-4 mr-1" /> {L("ลองใหม่", "Retry")}</Button>
              <Button onClick={() => (window.location.href = "/dashboard/profile")}><FileText className="w-4 h-4 mr-1" /> {L("ไปหน้าโปรไฟล์", "Go to Profile")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{L("หากยังไม่พบข้อมูล กรุณาติดต่อผู้ดูแลระบบของโรงเรียน", "If still not linked, please contact the school administrator")}</p>
          </CardContent>
        </Card>
      )}

      {/* Child selector — modern pill + Select, with stagger entrance */}
      {!loadingChildren && children.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {L(`พบข้อมูลบุตร ${children.length} คน`, `Found ${children.length} child${children.length > 1 ? "ren" : ""}`)}
              <Badge variant="secondary">{todayBangkok()}</Badge>
            </div>
            {children.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">{L("เลือกบุตร", "Select child")}:</span>
                <div className="hidden sm:flex gap-1.5 flex-wrap">
                  {children.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChildId(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${selectedChildId === c.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border hover:bg-muted"}`}
                    >
                      {c.photo_url ? <img src={c.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" /> : <GraduationCap className="w-3.5 h-3.5" />}
                      <span className="max-w-[90px] truncate">{fullName(c)}</span>
                    </button>
                  ))}
                </div>
                <Select value={selectedChildId || undefined} onValueChange={(v) => setSelectedChildId(v)}>
                  <SelectTrigger className="w-[200px] sm:hidden h-9 rounded-xl">
                    <SelectValue placeholder={L("เลือกบุตร", "Select child")} />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map(c => (
                      <SelectItem key={c.id} value={c.id}>{fullName(c)} · {c.student_code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Selected child quick KPIs — 4 modern cards with gradient, sparkline, skeleton */}
          {(() => {
            const selId = selectedChildId || children[0]?.id;
            const selBundle = selId ? bundles[selId] : null;
            const selChild = children.find(c => c.id === selId);
            if (!selChild) return null;
            const gpaVals = selBundle?.scores?.map((s: any) => Number(s.grade_point)).filter((n: number) => !isNaN(n) && n > 0) || [];
            const avgGpa = gpaVals.length ? (gpaVals.reduce((a: number, b: number) => a + b, 0) / gpaVals.length).toFixed(2) : "—";
            const attendanceToday = selBundle?.faceLogs?.length || selBundle?.attendance?.length ? (selBundle?.attendance?.[0]?.status || selBundle?.faceLogs?.[0]?.status || "present") : null;
            const attendanceLabel = !selBundle ? "—" : !selBundle.loading && !attendanceToday ? L("ยังไม่เช็คชื่อ", "Not checked") : attendanceToday === "present" ? L("มาเรียน", "Present") : attendanceToday === "late" ? L("มาสาย", "Late") : attendanceToday === "absent" ? L("ขาด", "Absent") : attendanceToday || "—";
            return (
              <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0,1,2,3].map((idx) => {
                  if (selBundle?.loading) {
                    return (
                      <Card key={idx} className="rounded-2xl border border-border/40">
                        <CardContent className="p-4 space-y-2">
                          <Skeleton className="h-9 w-9 rounded-xl" />
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-6 w-12" />
                          <Skeleton className="h-2 w-full" />
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })}
                {!selBundle?.loading && (
                  <>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.35 }}>
                      <Card className="relative overflow-hidden border-0 shadow-elevated rounded-2xl ring-1 ring-border/40 h-full">
                        <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-10 blur-xl ${attendanceToday === "present" || attendanceToday === "late" ? "bg-success" : attendanceToday === "absent" ? "bg-destructive" : "bg-muted"}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${attendanceToday === "present" ? "gradient-success" : attendanceToday === "late" ? "gradient-warning" : attendanceToday === "absent" ? "bg-destructive" : "bg-muted"}`}>
                              <UserCheck className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <Badge variant="secondary" className={`text-[10px] border-0 ${attendanceToday === "present" ? "bg-success/10 text-success" : attendanceToday === "late" ? "bg-amber-100 text-amber-700" : attendanceToday === "absent" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{attendanceLabel}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">{L("มาเรียนวันนี้", "Today")}</p>
                          <p className="text-lg font-bold">{attendanceLabel}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{selBundle?.faceLogs?.[0]?.scan_time?.slice(0,5) || selBundle?.attendance?.[0]?.attendance_date || todayBangkok()}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.35 }}>
                      <Card className="relative overflow-hidden border-0 shadow-elevated rounded-2xl ring-1 ring-border/40 h-full">
                        <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full gradient-primary opacity-10 blur-xl" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm"><Award className="w-4 h-4 text-primary-foreground" /></div>
                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">{gpaVals.length} {L("วิชา", "subj")}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">GPA</p>
                          <p className="text-lg font-bold tabular-nums">{avgGpa}</p>
                          <div className="mt-1 h-[20px]">{gpaVals.length > 1 ? <ResponsiveContainer width="100%" height={20}><AreaChart data={gpaVals.slice(0,6).map((v: number) => ({ v }))}><Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="hsl(var(--primary) / 0.12)" /></AreaChart></ResponsiveContainer> : <span className="text-[10px] text-muted-foreground/60">{selBundle?.scores?.length ? `${selBundle.scores.length} ${L("รายการ", "items")}` : L("ยังไม่มีคะแนน", "No grades")}</span>}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.35 }}>
                      <Card className="relative overflow-hidden border-0 shadow-elevated rounded-2xl ring-1 ring-border/40 h-full">
                        <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-10 blur-xl ${ (selBundle?.homework?.length || 0) > 0 ? "gradient-warning" : "bg-success"}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${(selBundle?.homework?.length || 0) > 0 ? "gradient-warning" : "gradient-success"}`}><BookOpen className="w-4 h-4 text-primary-foreground" /></div>
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-0">{selBundle?.homework?.length || 0} {L("ชิ้น", "items")}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">{L("การบ้านจะถึงกำหนด", "Upcoming HW")}</p>
                          <p className="text-lg font-bold">{selBundle?.homework?.length || 0}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{selBundle?.homework?.[0]?.due_date ? `${L("ถึง", "Due")} ${selBundle.homework[0].due_date}` : L("ไม่มีการบ้านค้าง", "No pending")}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.35 }}>
                      <Card className={`relative overflow-hidden border-0 shadow-elevated rounded-2xl ring-1 h-full ${(selBundle?.remediation?.length || 0) > 0 ? "ring-destructive/30" : "ring-border/40"}`}>
                        <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-10 blur-xl ${(selBundle?.remediation?.length || 0) > 0 ? "bg-destructive" : "gradient-success"}`} />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${(selBundle?.remediation?.length || 0) > 0 ? "bg-destructive" : "gradient-success"}`}><AlertTriangle className="w-4 h-4 text-primary-foreground" /></div>
                            <Badge variant={ (selBundle?.remediation?.length || 0) > 0 ? "destructive" : "secondary"} className="text-[10px]">{selBundle?.remediation?.length || 0}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium">0 ร มส</p>
                          <p className="text-lg font-bold">{selBundle?.remediation?.length || 0}</p>
                          <p className="text-[10px] truncate" style={{ color: (selBundle?.remediation?.length || 0) > 0 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>{(selBundle?.remediation?.length || 0) > 0 ? selBundle.remediation[0].subject_code : L("ไม่มีรายการค้าง", "All clear")}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </>
                )}
              </motion.div>
            );
          })()}

          {/* Detailed child cards — filtered by selector */}
          {(selectedChildId ? children.filter(c => c.id === selectedChildId) : children).map((child) => {
            const bundle = bundles[child.id];
            const isLoadingBundle = !bundle || bundle.loading;
            return (
              <Card key={child.id} className="overflow-hidden border-border/60 shadow-sm">
                <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                  <div className="flex items-start gap-4">
                    {child.photo_url ? (
                      <img src={child.photo_url} alt={fullName(child)} className="w-14 h-14 rounded-xl object-cover border" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center border">
                        <GraduationCap className="w-7 h-7 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight">{fullName(child)}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="font-mono text-xs">{child.student_code}</Badge>
                        {child.classrooms?.name && <Badge variant="secondary" className="gap-1"><School className="w-3 h-3" /> {child.classrooms.name}</Badge>}
                        {child.guardian_phone && <span className="text-xs inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {child.guardian_phone}</span>}
                      </CardDescription>
                    </div>
                    {isLoadingBundle && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0 mt-1" />}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <Tabs defaultValue="attendance" className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto">
                      <TabsTrigger value="attendance" className="gap-1.5">
                        <CalendarDays className="w-4 h-4" /> {L("มาเรียนวันนี้", "Today")}
                      </TabsTrigger>
                      <TabsTrigger value="scores" className="gap-1.5">
                        <GraduationCap className="w-4 h-4" /> {L("คะแนนล่าสุด", "Grades")}
                      </TabsTrigger>
                      <TabsTrigger value="homework" className="gap-1.5">
                        <BookOpen className="w-4 h-4" /> {L("การบ้าน", "Homework")}
                      </TabsTrigger>
                      <TabsTrigger value="remediation" className="gap-1.5 relative">
                        <AlertTriangle className="w-4 h-4" /> 0 ร มส
                        {bundle && bundle.remediation.length > 0 && (
                          <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">{bundle.remediation.length}</span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="attendance" className="mt-4">
                      {bundle ? renderAttendance(bundle) : <div className="text-sm text-muted-foreground">{L("กำลังโหลด...", "Loading...")}</div>}
                    </TabsContent>

                    <TabsContent value="scores" className="mt-4">
                      {bundle ? renderScores(bundle) : <div className="text-sm text-muted-foreground">{L("กำลังโหลด...", "Loading...")}</div>}
                    </TabsContent>

                    <TabsContent value="homework" className="mt-4">
                      {bundle ? renderHomework(bundle) : <div className="text-sm text-muted-foreground">{L("กำลังโหลด...", "Loading...")}</div>}
                    </TabsContent>

                    <TabsContent value="remediation" className="mt-4">
                      {bundle ? renderRemediation(bundle) : <div className="text-sm text-muted-foreground">{L("กำลังโหลด...", "Loading...")}</div>}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* Footer hint */}
      {!loadingChildren && children.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {L(
            "ข้อมูลอัปเดตแบบเรียลไทม์ · แตะรีเฟรชเพื่อดึงข้อมูลล่าสุด · หากข้อมูลไม่ถูกต้องโปรดติดต่อครูประจำชั้น",
            "Data refreshes in real-time · Tap refresh for latest · If incorrect, contact homeroom teacher"
          )}
        </p>
      )}
    </div>
  );
}
