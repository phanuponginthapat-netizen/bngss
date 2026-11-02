import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, GraduationCap, CheckSquare, CalendarDays, BookOpen,
  Heart, Sparkles, Newspaper, MessageCircle, LogIn, ExternalLink,
} from "lucide-react";
import LiffShell from "./LiffShell";
import { taskLoginUrl } from "@/lib/navigation/taskEntry";

type Ctx = {
  profile: { id: string; first_name: string; last_name: string; role?: string } | null;
  student: { id: string; prefix: string | null; first_name: string; last_name: string; classroom_id: string | null } | null;
  isTeacher: boolean;
};

function Hub({ lineUserId }: { lineUserId: string }) {
  const [ctx, setCtx] = useState<Ctx>({ profile: null, student: null, isTeacher: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from("profiles")
        .select("id,first_name,last_name")
        .eq("line_user_id", lineUserId).maybeSingle();

      let isTeacher = false;
      if (prof) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", prof.id);
        isTeacher = (roles || []).some((r: any) => ["teacher", "admin", "director"].includes(r.role));
      }

      const { data: stu } = await supabase.from("students")
        .select("id,prefix,first_name,last_name,classroom_id")
        .or(`line_user_id.eq.${lineUserId},line_user_id_2.eq.${lineUserId},line_user_id_3.eq.${lineUserId}`)
        .maybeSingle();

      setCtx({ profile: prof as any, student: stu as any, isTeacher });
      setLoading(false);
    })();
  }, [lineUserId]);

  const openApp = (path: string) => {
    // เปิดในเบราว์เซอร์ภายนอก LINE เพื่อใช้งานเต็มระบบ (มีเซสชัน Supabase, PWA, etc.)
    const url = `${window.location.origin}${taskLoginUrl(path)}`;
    if ((window as any).liff?.openWindow) {
      (window as any).liff.openWindow({ url, external: true });
    } else {
      window.open(url, "_blank");
    }
  };

  const openLiff = (path: string) => { window.location.href = path; };

  if (loading) return <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>;

  const linked = !!(ctx.profile || ctx.student);
  const name = ctx.student
    ? `${ctx.student.prefix ?? ""}${ctx.student.first_name} ${ctx.student.last_name}`
    : ctx.profile ? `${ctx.profile.first_name} ${ctx.profile.last_name}` : "";

  // เมนู "ในไลน์" (LIFF) — ใช้งานเร็ว ไม่ต้องล็อกอินซ้ำ
  const liffTiles: Array<{ icon: any; label: string; path: string; show: boolean; color: string }> = [
    { icon: FileText, label: "ยื่นใบลา", path: "/liff/leave", show: !!ctx.student, color: "text-primary" },
    { icon: GraduationCap, label: "คะแนน/เกรด", path: "/liff/grades", show: !!ctx.student, color: "text-primary" },
    { icon: CheckSquare, label: "เช็คชื่อ (ครู)", path: "/liff/attendance", show: ctx.isTeacher, color: "text-primary" },
  ];

  // เมนู "เปิดระบบเต็ม" — เปิดในเบราว์เซอร์ (ต้องล็อกอินครั้งแรก)
  const appTiles: Array<{ icon: any; label: string; path: string; show: boolean; color: string }> = [
    { icon: CalendarDays, label: "ตารางสอน/ตารางเรียน", path: "/dashboard/academic/schedule", show: true, color: "text-primary" },
    { icon: BookOpen, label: "การบ้าน", path: "/dashboard/homework", show: true, color: "text-primary" },
    { icon: Heart, label: "พฤติกรรม", path: "/dashboard/student/behavior", show: linked, color: "text-primary" },
    { icon: Sparkles, label: "สุขภาพ", path: "/dashboard/student/health-trend", show: !!ctx.student, color: "text-primary" },
    { icon: Newspaper, label: "ข่าวสาร/ประกาศ", path: "/dashboard/feed", show: true, color: "text-primary" },
    { icon: MessageCircle, label: "กล่องข้อความ", path: "/dashboard/inbox", show: linked, color: "text-primary" },
    { icon: FileText, label: "เอกสาร/แบบฟอร์ม", path: "/dashboard/hub/documents", show: ctx.isTeacher, color: "text-primary" },
    { icon: GraduationCap, label: "หน้าหลักระบบ", path: "/dashboard", show: true, color: "text-primary" },
  ];

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      <header className="border-b border-border pb-4">
        {linked ? (
          <>
            <p className="text-xs text-muted-foreground">ยินดีต้อนรับ</p>
            <p className="font-bold text-lg">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ctx.isTeacher ? "บุคลากร" : ctx.student ? "นักเรียน/ผู้ปกครอง" : "ผู้ใช้"}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold mb-1">ยังไม่ได้ผูกบัญชี</p>
            <p className="text-xs text-muted-foreground mb-3">พิมพ์ "ผูกบัญชี" ในแชท LINE OA หรือกดปุ่มด้านล่างเพื่อเข้าระบบผ่านเว็บ</p>
            <Button size="sm" onClick={() => openApp("/dashboard")} className="w-full">
              <LogIn className="w-4 h-4 mr-2" /> เข้าสู่ระบบ
            </Button>
          </>
        )}
      </header>

      {liffTiles.some(t => t.show) && <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">ทำรายการใน LINE</p>
        <div className="grid grid-cols-3 gap-2">
          {liffTiles.filter(t => t.show).map((t) => (
            <Button variant="outline" key={t.path} onClick={() => openLiff(t.path)}
              className="h-auto min-h-24 rounded-lg bg-card p-3 flex flex-col items-center gap-1.5 whitespace-normal">
              <t.icon className={`w-6 h-6 ${t.color}`} />
              <span className="text-[11px] text-center leading-tight">{t.label}</span>
            </Button>
          ))}
        </div>
      </div>}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> งานในระบบโรงเรียน
        </p>
        <div className="grid grid-cols-3 gap-2">
          {appTiles.filter(t => t.show).map((t) => (
            <Button variant="outline" key={t.path} onClick={() => openApp(t.path)}
              className="h-auto min-h-24 rounded-lg bg-card p-3 flex flex-col items-center gap-1.5 whitespace-normal">
              <t.icon className={`w-6 h-6 ${t.color}`} />
              <span className="text-[11px] text-center leading-tight">{t.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          
        </p>
      </div>
    </div>
  );
}

export default function LiffHomePage() {
  return <LiffShell title="ระบบโรงเรียน">{(uid) => <Hub lineUserId={uid} />}</LiffShell>;
}
