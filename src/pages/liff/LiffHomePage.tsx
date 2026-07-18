import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, GraduationCap, CheckSquare, CalendarDays, BookOpen,
  Heart, Sparkles, Newspaper, MessageCircle, LogIn, ExternalLink,
} from "lucide-react";
import LiffShell from "./LiffShell";

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
    const url = `${window.location.origin}${path}`;
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
    { icon: FileText, label: "ยื่นใบลา", path: "/liff/leave", show: !!ctx.student, color: "text-sky-500" },
    { icon: GraduationCap, label: "คะแนน/เกรด", path: "/liff/grades", show: !!ctx.student, color: "text-violet-500" },
    { icon: CheckSquare, label: "เช็คชื่อ (ครู)", path: "/liff/attendance", show: ctx.isTeacher, color: "text-emerald-500" },
  ];

  // เมนู "เปิดระบบเต็ม" — เปิดในเบราว์เซอร์ (ต้องล็อกอินครั้งแรก)
  const appTiles: Array<{ icon: any; label: string; path: string; show: boolean; color: string }> = [
    { icon: CalendarDays, label: "ตารางสอน/ตารางเรียน", path: "/academic/schedule", show: true, color: "text-blue-500" },
    { icon: BookOpen, label: "การบ้าน", path: "/student/homework", show: true, color: "text-orange-500" },
    { icon: Heart, label: "พฤติกรรม", path: "/student/behavior", show: true, color: "text-rose-500" },
    { icon: Sparkles, label: "สุขภาพ", path: "/hub/student-health", show: true, color: "text-pink-500" },
    { icon: Newspaper, label: "ข่าวสาร/ประกาศ", path: "/feed", show: true, color: "text-amber-500" },
    { icon: MessageCircle, label: "กล่องข้อความ", path: "/inbox", show: linked, color: "text-cyan-500" },
    { icon: FileText, label: "เอกสาร/แบบฟอร์ม", path: "/hub/documents", show: linked, color: "text-indigo-500" },
    { icon: GraduationCap, label: "หน้าหลักระบบ", path: "/", show: true, color: "text-primary" },
  ];

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
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
            <Button size="sm" onClick={() => openApp("/login")} className="w-full">
              <LogIn className="w-4 h-4 mr-2" /> เข้าสู่ระบบ
            </Button>
          </>
        )}
      </Card>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">⚡ ใช้งานเร็วในไลน์</p>
        <div className="grid grid-cols-3 gap-2">
          {liffTiles.filter(t => t.show).map((t) => (
            <button key={t.path} onClick={() => openLiff(t.path)}
              className="rounded-xl border bg-card p-3 flex flex-col items-center gap-1.5 hover:bg-muted/50 active:scale-95 transition">
              <t.icon className={`w-6 h-6 ${t.color}`} />
              <span className="text-[11px] text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 px-1 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> เปิดระบบเต็ม (ทุกฟีเจอร์)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {appTiles.filter(t => t.show).map((t) => (
            <button key={t.path} onClick={() => openApp(t.path)}
              className="rounded-xl border bg-card p-3 flex flex-col items-center gap-1.5 hover:bg-muted/50 active:scale-95 transition">
              <t.icon className={`w-6 h-6 ${t.color}`} />
              <span className="text-[11px] text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          * เมนูเปิดระบบเต็มจะเปิดในเบราว์เซอร์ ครั้งแรกต้องล็อกอินด้วยรหัสของโรงเรียน (จำได้ครั้งเดียว)
        </p>
      </div>
    </div>
  );
}

export default function LiffHomePage() {
  return <LiffShell title="🏫 ระบบโรงเรียน">{(uid) => <Hub lineUserId={uid} />}</LiffShell>;
}
