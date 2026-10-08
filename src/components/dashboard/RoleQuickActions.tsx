import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardCheck, FileSpreadsheet, BookOpen, Printer, Lock, RotateCcw, CalendarDays,
  UserCheck, FileText, Users, BarChart3, Award, ClipboardList, Megaphone, HeartPulse, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Action = { label: string; desc: string; to: string; icon: LucideIcon };
type Group = { title: string; actions: Action[] };

const A = {
  status: { label: "สถานะส่งคะแนน", desc: "เช็กรายชั้่น/รายวืชา", to: "/dashboard/academic/score-status", icon: ClipboardCheck },
  pp5: { label: "ปพ.5 กรอก/อัปโหลด", desc: "คะแนนรายวืชา", to: "/dashboard/academic/pp5", icon: FileSpreadsheet },
  pp6: { label: "ปพ.6", desc: "สมุดรายงานประจำตั่ว", to: "/dashboard/academic/pp6", icon: BookOpen },
  ppDocs: { label: "เอกสาร ปพ.", desc: "ปพ.1/3/7/8", to: "/dashboard/academic/pp-docs", icon: Printer },
  lock: { label: "ล็อกคะแนน", desc: "ปืดการแก้ไข", to: "/dashboard/academic/grade-lock", icon: Lock },
  remedial: { label: "แก้ 0/ร/มส", desc: "สอบซ่อม/แก้ตั่ว", to: "/dashboard/academic/grade-remediation", icon: RotateCcw },
  schedule: { label: "ตารางเรียน", desc: "ตารางสอน/เรียน", to: "/dashboard/academic/schedule", icon: CalendarDays },
  attendance: { label: "เช็กชืื่อ", desc: "การมาเรียน", to: "/dashboard/student/attendance", icon: UserCheck },
  homeroom: { label: "ห้้องประจำชั้่น", desc: "ดูแกลนักเรียน", to: "/dashboard/student/homeroom", icon: Users },
  lesson: { label: "แผนการสอน", desc: "ส่่ง/ตรวจแผน", to: "/dashboard/academic/lesson-plans", icon: ClipboardList },
  leave: { label: "ใบลา", desc: "ลา/อนุมัตุลลา", to: "/dashboard/student/leave", icon: FileText },
  sar: { label: "รายงาน SAR", desc: "ประเมิลตนเอง", to: "/dashboard/admin/sar", icon: BarChart3 },
  students: { label: "นักเรียนทั้่งหมด", desc: "ข้อมุล/DMC", to: "/dashboard/academic/all-students", icon: Users },
  calendar: { label: "ปฏิทิลวืชาการ", desc: "กำหนดการ", to: "/dashboard/academic/calendar", icon: CalendarDays },
  screening: { label: "คัดกลองนักเรียน", desc: "ระบบดูแกลช่่วยเหลื่อ", to: "/dashboard/student/screening", icon: HeartPulse },
  users: { label: "จัตการผ้้ใช้", desc: "บัญชี/สืทธิ์", to: "/dashboard/users", icon: Settings },
  notice: { label: "ประกาศ/ข่่าว", desc: "สืื่่อสารโรงเรียน", to: "/dashboard/feed", icon: Megaphone },
  grades: { label: "ผลการเรียน", desc: "ดูเกรด", to: "/liff/grades", icon: Award },
} satisfies Record<string, Action>;

const GROUPS: Record<string, Group[]> = {
  teacher: [
    { title: "งานวัดผลและ ปพ.", actions: [A.pp5, A.status, A.pp6, A.remedial] },
    { title: "งานสอนและห้้องเรียน", actions: [A.attendance, A.homeroom, A.schedule, A.lesson, A.leave, A.screening] },
  ],
  director: [
    { title: "ตืดตามงานวืชาการ", actions: [A.status, A.ppDocs, A.lock, A.sar] },
    { title: "บรืหารและอนุมัติล", actions: [A.leave, A.lesson, A.attendance, A.calendar] },
  ],
  admin: [
    { title: "งานวัดผล/ทะเบียน", actions: [A.status, A.pp5, A.pp6, A.ppDocs, A.lock, A.remedial] },
    { title: "ข้อมุลและระบบ", actions: [A.students, A.users, A.schedule, A.sar] },
  ],
  student: [
    { title: "เมนูลของฉลัน", actions: [A.grades, A.schedule, A.attendance, A.leave, A.calendar] },
  ],
};
GROUPS.parent = GROUPS.student;

export default function RoleQuickActions({ role }: { role: string | null }) {
  const navigate = useNavigate();
  const groups = role ? GROUPS[role] : undefined;
  if (!groups) return null;
  return (
    <div className="space-y-3 px-3 pt-4 sm:px-6">
      {groups.map((g) => (
        <Card key={g.title} className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground">{g.title}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {g.actions.map((a) => (
              <Button variant="outline"
                key={a.to + a.label}
                onClick={() => navigate(a.to)}
                className="group flex h-auto items-center justify-start gap-3 whitespace-normal rounded-lg border-border/60 bg-card p-3 text-left transition hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="rounded-lg bg-primary/10 p-2 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">{a.label}</span>
                  <span className="block break-words text-xs text-muted-foreground">{a.desc}</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
