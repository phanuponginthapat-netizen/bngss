import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";

type Issue = {
  key: string;
  title: string;
  description: string;
  /** ลิงก์หน้าแก้ไข */
  fixTo: string;
  fixLabel: string;
  severity: "high" | "medium" | "low";
  count: number;
  samples: string[];
};

const SEVERITY_LABEL: Record<Issue["severity"], string> = {
  high: "ต้องแก้ด่วน",
  medium: "ควรแก้",
  low: "ตรวจสอบ",
};

const SEVERITY_CLASS: Record<Issue["severity"], string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

async function runChecks(): Promise<Issue[]> {
  const issues: Issue[] = [];

  // 1) ผู้ใช้ที่ยังไม่มีบทบาท (role)
  try {
    const [{ data: profiles }, { data: roles }]: any[] = await Promise.all([
      (supabase as any).from("profiles").select("id, full_name, email").limit(5000),
      (supabase as any).from("user_roles").select("user_id").limit(20000),
    ]);
    const withRole = new Set((roles || []).map((r: { user_id: string }) => r.user_id));
    const missing = (profiles || []).filter((p: { id: string }) => !withRole.has(p.id));
    issues.push({
      key: "user-no-role",
      title: "ผู้ใช้ที่ยังไม่มีบทบาท",
      description: "ผู้ใช้เหล่านี้ล็อกอินได้แต่จะไม่เห็นเมนูใด ๆ เพราะยังไม่ได้กำหนด role",
      fixTo: "/dashboard/users",
      fixLabel: "ไปกำหนดบทบาท",
      severity: "high",
      count: missing.length,
      samples: missing
        .slice(0, 8)
        .map((p: { full_name?: string | null; email?: string | null }) => p.full_name || p.email || "-"),
    });
  } catch { /* ไม่มีสิทธิ์อ่าน — ข้ามการตรวจนี้ */ }

  // 2) ครูที่ยังไม่มีคาบสอนในตารางสอน
  try {
    const [{ data: personnel }, { data: schedules }]: any[] = await Promise.all([
      supabase
        .from("personnel")
        .select("id, full_name, position")
        .eq("status", "active")
        .limit(2000),
      (supabase as any).from("schedules").select("teacher_id").limit(20000),
    ]);
    const teaching = new Set((schedules || []).map((s: { teacher_id: string | null }) => s.teacher_id));
    const noSchedule = (personnel || []).filter(
      (p: { id: string; position?: string | null }) =>
        !teaching.has(p.id) && /ครู|teacher/i.test(String(p.position || "ครู")),
    );
    issues.push({
      key: "teacher-no-schedule",
      title: "ครูที่ยังไม่มีคาบสอน",
      description: "ครูเหล่านี้จะไม่เห็นตารางสอนและบันทึกการสอนของตนเอง",
      fixTo: "/dashboard/academic/schedule",
      fixLabel: "จัดตารางสอน",
      severity: "medium",
      count: noSchedule.length,
      samples: noSchedule.slice(0, 8).map((p: { full_name?: string | null }) => p.full_name || "-"),
    });
  } catch { /* ข้าม */ }

  // 3) นักเรียนที่ยังไม่ได้อยู่ห้องเรียน
  try {
    const { data: students }: any = await supabase
      .from("students")
      .select("id, student_code, first_name, last_name, classroom_id")
      .eq("status", "active")
      .is("classroom_id", null)
      .limit(2000);
    issues.push({
      key: "student-no-classroom",
      title: "นักเรียนที่ยังไม่มีห้องเรียน",
      description: "จะไม่ปรากฏในรายชื่อห้อง การเช็คชื่อ และรายงานรายวัน",
      fixTo: "/dashboard/academic/management",
      fixLabel: "จัดห้องเรียน",
      severity: "high",
      count: (students || []).length,
      samples: (students || [])
        .slice(0, 8)
        .map((s: { student_code?: string | null; first_name?: string | null; last_name?: string | null }) =>
          `${s.student_code || ""} ${s.first_name || ""} ${s.last_name || ""}`.trim(),
        ),
    });
  } catch { /* ข้าม */ }

  // 4) บุคลากรที่ยังไม่ผูกกับบัญชีผู้ใช้
  try {
    const { data: personnel }: any = await supabase
      .from("personnel")
      .select("id, full_name, user_id")
      .eq("status", "active")
      .is("user_id", null)
      .limit(2000);
    issues.push({
      key: "personnel-no-user",
      title: "บุคลากรที่ยังไม่ผูกบัญชีผู้ใช้",
      description: "ล็อกอินแล้วระบบจะไม่รู้ว่าเป็นบุคลากรคนใด ทำให้ตารางสอน/การลาไม่ขึ้น",
      fixTo: "/dashboard/users",
      fixLabel: "ผูกบัญชี",
      severity: "high",
      count: (personnel || []).length,
      samples: (personnel || []).slice(0, 8).map((p: { full_name?: string | null }) => p.full_name || "-"),
    });
  } catch { /* ข้าม */ }

  // 5) ห้องเรียนที่ยังไม่มีครูประจำชั้น
  try {
    const { data: rooms }: any = await supabase
      .from("classrooms")
      .select("id, name, homeroom_teacher_id")
      .is("homeroom_teacher_id", null)
      .limit(500);
    issues.push({
      key: "classroom-no-homeroom",
      title: "ห้องเรียนที่ยังไม่มีครูประจำชั้น",
      description: "ระบบเยี่ยมบ้าน SDQ และรายงานประจำชั้นจะหาผู้รับผิดชอบไม่เจอ",
      fixTo: "/dashboard/academic/management",
      fixLabel: "กำหนดครูประจำชั้น",
      severity: "medium",
      count: (rooms || []).length,
      samples: (rooms || []).slice(0, 8).map((r: { name?: string | null }) => r.name || "-"),
    });
  } catch { /* ข้าม */ }

  // 6) คาบสอนที่ยังไม่ระบุครูผู้สอน
  try {
    const { count } = await supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .is("teacher_id", null);
    issues.push({
      key: "schedule-no-teacher",
      title: "คาบสอนที่ยังไม่ระบุครูผู้สอน",
      description: "คาบเหล่านี้จะไม่ขึ้นในตารางสอนของครูคนใดเลย",
      fixTo: "/dashboard/academic/schedule",
      fixLabel: "แก้ตารางสอน",
      severity: "medium",
      count: count || 0,
      samples: [],
    });
  } catch { /* ข้าม */ }

  return issues;
}

export default function DataQualityPage() {
  const { data: issues = [], isFetching, refetch } = useQuery({
    queryKey: ["data-quality-checks"],
    queryFn: runChecks,
    staleTime: 5 * 60_000,
  });

  const problems = issues.filter((i) => i.count > 0);
  const clean = issues.filter((i) => i.count === 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              ตรวจความสมบูรณ์ของข้อมูล
            </CardTitle>
            <CardDescription>
              ตรวจจุดที่ทำให้ผู้ใช้แต่ละบทบาทติดปัญหา เช่น ยังไม่มีบทบาท ยังไม่มีห้องเรียน หรือยังไม่มีตารางสอน
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            ตรวจใหม่
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {problems.length === 0 && !isFetching ? (
            <EmptyState
              icon={CheckCircle2}
              title="ข้อมูลครบถ้วนดีแล้ว"
              description="ไม่พบรายการที่ต้องแก้ไขจากการตรวจล่าสุด"
            />
          ) : (
            problems.map((issue) => (
              <div
                key={issue.key}
                className="rounded-lg border p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">{issue.title}</span>
                    <Badge variant="outline" className={SEVERITY_CLASS[issue.severity]}>
                      {SEVERITY_LABEL[issue.severity]}
                    </Badge>
                    <Badge variant="secondary">{issue.count.toLocaleString()} รายการ</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{issue.description}</p>
                  {issue.samples.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ตัวอย่าง: {issue.samples.join(" • ")}
                      {issue.count > issue.samples.length ? " …" : ""}
                    </p>
                  )}
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={issue.fixTo}>
                    <Wrench className="w-4 h-4 mr-1" />
                    {issue.fixLabel}
                  </Link>
                </Button>
              </div>
            ))
          )}

          {clean.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-2">
              {clean.map((i) => (
                <Badge key={i.key} variant="outline" className="gap-1 text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {i.title}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
