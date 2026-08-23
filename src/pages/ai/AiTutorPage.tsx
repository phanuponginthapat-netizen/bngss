import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { getWeakSubjects, getAttendanceRisk, getBehavior, getRecommendedLessons, getRemediation, buildTutorPrompt } from "@/lib/aiTutor";
import { Sparkles, BookOpen, CalendarDays, Shield, AlertTriangle, Send, Loader2, GraduationCap, Clock, CheckCircle2 } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function AiTutorPage() {
  const { user, isReady } = useAuthSession();
  const { role } = useUserRole();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentLabel, setStudentLabel] = useState<string>("");
  const [manualCode, setManualCode] = useState("");

  // resolve studentId for current user
  useEffect(() => {
    if (!isReady || !user) return;
    (async () => {
      // student -> link via auth_user_id
      if (role === "student") {
        const { data } = await supabase.from("students").select("id, student_code, first_name, last_name").eq("auth_user_id", user.id).maybeSingle();
        if (data) {
          setStudentId((data as any).id);
          setStudentLabel(`${(data as any).first_name} ${(data as any).last_name} (${(data as any).student_code})`);
          return;
        }
      }
      // parent -> first child (if needed, could add picker)
      if (role === "parent") {
        const { data } = await supabase.from("students").select("id, student_code, first_name, last_name").or(`parent_user_id.eq.${user.id},parent_user_id_2.eq.${user.id}`).limit(1).maybeSingle();
        if (data) {
          setStudentId((data as any).id);
          setStudentLabel(`${(data as any).first_name} ${(data as any).last_name} (${(data as any).student_code}) — บุตร`);
          return;
        }
      }
      // teacher/admin: no auto student; let manual input
      setStudentId(null);
      setStudentLabel("");
    })();
  }, [isReady, user, role]);

  const handleManualLookup = async () => {
    const code = manualCode.trim();
    if (!code) return toast.error("กรอกรหัสนักเรียนก่อน");
    const { data, error } = await supabase.from("students").select("id, student_code, first_name, last_name").eq("student_code", code).maybeSingle();
    if (error || !data) return toast.error("ไม่พบรหัสนักเรียนนี้");
    setStudentId((data as any).id);
    setStudentLabel(`${(data as any).first_name} ${(data as any).last_name} (${(data as any).student_code})`);
    toast.success("โหลดข้อมูลนักเรียนแล้ว");
  };

  const enabled = !!studentId;

  const weakQ = useQuery({
    queryKey: ["aiTutor-weak", studentId],
    enabled,
    queryFn: () => getWeakSubjects(studentId!),
  });
  const attQ = useQuery({
    queryKey: ["aiTutor-att", studentId],
    enabled,
    queryFn: () => getAttendanceRisk(studentId!),
  });
  const behQ = useQuery({
    queryKey: ["aiTutor-beh", studentId],
    enabled,
    queryFn: () => getBehavior(studentId!),
  });
  const remQ = useQuery({
    queryKey: ["aiTutor-rem", studentId],
    enabled,
    queryFn: () => getRemediation(studentId!),
  });
  const recQ = useQuery({
    queryKey: ["aiTutor-rec", studentId],
    enabled,
    queryFn: () => getRecommendedLessons(studentId!),
  });
  const promptQ = useQuery({
    queryKey: ["aiTutor-prompt", studentId],
    enabled,
    queryFn: () => buildTutorPrompt(studentId!),
  });

  // chat
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const canChat = !!studentId || !!user; // allow even without studentId (generic)
  const effectiveStudentId = studentId || null;

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!user) return toast.error("กรุณาเข้าสู่ระบบก่อน");
    setInput("");
    const nextHistory: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setSending(true);
    try {
      // ai-chat supports both {messages, student_id} and legacy {message, student_id}
      const payload: any = {
        messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        message: text,
        student_id: effectiveStudentId,
        studentId: effectiveStudentId,
      };
      const { data, error } = await supabase.functions.invoke("ai-chat", { body: payload });
      if (error) throw error;
      const reply = (data as any)?.reply || (data as any)?.content || "ขออภัย ลองใหม่นะครับ";
      setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(msg.slice(0, 300));
      setMessages((prev) => [...prev, { role: "assistant", content: `ขออภัย เกิดข้อผิดพลาด: ${msg.slice(0, 300)}` }]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = useMemo(() => {
    const w = weakQ.data || [];
    if (w.length === 0) return ["ช่วยวางแผนทบทวนบทเรียนสัปดาห์นี้หน่อย", "อธิบายวิธีคิดแบบ Socratic ให้หน่อย", "ช่วยสรุปเทคนิคจำสูตรคณิต"];
    return w.slice(0, 3).map((s) => `ช่วยติววิชา ${s.subject_code || s.subject_name} เรื่องที่อ่อนให้หน่อย`);
  }, [weakQ.data]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white"><Sparkles className="w-5 h-5" /></span>
            AI Tutor ส่วนตัว
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ติวเตอร์ที่รู้จุดอ่อนของคุณ — ปรับบทเรียนตามเกรด การมาเรียน และ 0 ร มส</p>
        </div>
        {studentLabel && <Badge variant="secondary" className="self-start sm:self-auto px-3 py-1 text-sm"><GraduationCap className="w-4 h-4 mr-1" />{studentLabel}</Badge>}
      </div>

      {/* manual lookup for teacher/admin or when no linked student */}
      {!studentId && (
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="flex-1 w-full">
              <p className="text-sm font-medium mb-1">ค้นหานักเรียนเพื่อดูแดชบอร์ดส่วนตัว</p>
              <p className="text-xs text-muted-foreground mb-2">สำหรับนักเรียน: ระบบจะผูกบัญชีอัตโนมัติ • ครู/ผู้ปกครอง: กรอกรหัสนักเรียน</p>
              <div className="flex gap-2">
                <Input placeholder="รหัสนักเรียน เช่น 12345" value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleManualLookup()} />
                <Button onClick={handleManualLookup}>โหลด</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">หรือแชทแบบทั่วไปได้เลยด้านล่าง</div>
          </CardContent>
        </Card>
      )}

      {/* personalized dashboard */}
      {enabled ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* weak subjects */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-500" /> วิชาที่ควรติวเข้ม</CardTitle>
              <CardDescription>เกรด 0–2 หรือ GP &lt; 2 • ระบบจะเน้นติววิชาเหล่านี้ก่อน</CardDescription>
            </CardHeader>
            <CardContent>
              {weakQ.isLoading ? <Skeleton className="h-24 w-full" /> : (weakQ.data && weakQ.data.length > 0) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {weakQ.data.slice(0, 6).map((w) => (
                    <div key={w.id} className="rounded-xl border p-3 bg-amber-50/60 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold">{w.subject_code || w.subject_name}</span>
                        <Badge variant="destructive" className="text-xs">เกรด {w.grade ?? "-"} (GP {w.grade_point ?? "-"})</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{w.subject_name || w.subject_code} • คะแนน {w.total_score ?? "-"} • เทอม {w.semester ?? "-"}/{w.academic_year ?? "-"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">เยี่ยมมาก! ไม่พบวิชาที่อ่อน (0–2)</p>
                  <p className="text-xs text-muted-foreground">AI จะช่วยเสริมจุดแข็งและทบทวนเชิงลึกแทน</p>
                </div>
              )}
              {remQ.data && remQ.data.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold flex items-center gap-1 mb-2"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> ติด 0 / ร / มส / มผ ล่าสุด</p>
                  <div className="flex flex-wrap gap-2">
                    {remQ.data.slice(0, 6).map((r) => (
                      <Badge key={r.id} variant="outline" className="border-red-200 text-red-700 bg-red-50">
                        {r.subject_code} {r.term}  {r.original_grade} → {r.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* attendance + behavior */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4 text-sky-500" /> การมาเรียน</CardTitle>
              </CardHeader>
              <CardContent>
                {attQ.isLoading ? <Skeleton className="h-20 w-full" /> : attQ.data ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-center">
                      <div className="flex-1 rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">มา</p><p className="font-bold text-emerald-600">{attQ.data.present}</p></div>
                      <div className="flex-1 rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">ขาด</p><p className="font-bold text-red-600">{attQ.data.absent}</p></div>
                      <div className="flex-1 rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">สาย</p><p className="font-bold text-amber-600">{attQ.data.late}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={attQ.data.riskLevel === "high" ? "destructive" : attQ.data.riskLevel === "medium" ? "secondary" : "outline"} className="capitalize">
                        เสี่ยง {attQ.data.riskLevel === "high" ? "สูง" : attQ.data.riskLevel === "medium" ? "ปานกลาง" : "ต่ำ"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">60 วัน • อัตราขาด {(attQ.data.absentRate * 100).toFixed(1)}%</span>
                    </div>
                    {attQ.data.recentAbsences.length > 0 && (
                      <p className="text-xs text-muted-foreground">ล่าสุด: {attQ.data.recentAbsences.map((a) => `${a.date}(${a.status})`).join(", ")}</p>
                    )}
                  </div>
                ) : <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-violet-500" /> พฤติกรรม</CardTitle>
              </CardHeader>
              <CardContent>
                {behQ.isLoading ? <Skeleton className="h-20 w-full" /> : behQ.data ? (
                  <div className="space-y-2">
                    <div className="flex gap-3 text-sm">
                      <span className="text-emerald-600">บวก {behQ.data.positive}</span>
                      <span className="text-rose-600">ลบ {behQ.data.negative}</span>
                      <span className="text-muted-foreground">รวม {behQ.data.total} • คะแนน {behQ.data.totalPoints}</span>
                    </div>
                    {behQ.data.recent.length > 0 ? (
                      <ul className="space-y-1">
                        {behQ.data.recent.slice(0, 3).map((b, i) => (
                          <li key={i} className="text-xs p-2 rounded-lg bg-muted/60 truncate">[{b.behavior_type}] {b.description} <span className="text-muted-foreground">({b.record_date})</span></li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">ยังไม่มีบันทึก</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {isReady && !user ? "กรุณาเข้าสู่ระบบเพื่อดูแดชบอร์ดส่วนตัว" : "เลือกนักเรียนด้านบนเพื่อดูจุดอ่อนและบทเรียนแนะนำ"}
          </CardContent>
        </Card>
      )}

      {/* recommended lessons */}
      {enabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4 text-indigo-500" /> บทเรียนแนะนำ</CardTitle>
            <CardDescription>ดึงจากตาราง subjects ตามวิชาที่อ่อน — กดเพื่อเริ่มติวกับ AI</CardDescription>
          </CardHeader>
          <CardContent>
            {recQ.isLoading ? <Skeleton className="h-16 w-full" /> : recQ.data && recQ.data.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recQ.data.map((s) => (
                  <div key={s.id} className="rounded-xl border p-3 hover:bg-accent/50 transition-colors">
                    <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                    <p className="font-medium text-sm truncate">{s.name_th}</p>
                    {s.name_en && <p className="text-xs text-muted-foreground truncate">{s.name_en}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[11px]">{s.credits ?? 1} หน่วยกิต</Badge>
                      <Button size="sm" variant="secondary" className="ml-auto h-7 text-xs" onClick={() => setInput(`ช่วยติววิชา ${s.code} ${s.name_th} แบบเข้าใจง่าย พร้อมตัวอย่างคล้ายๆ ให้หน่อย`)}>
                        ติวเลย
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">ยังไม่มีวิชาแนะนำ</p>}
            {promptQ.data && (
              <details className="mt-4">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">ดู prompt ส่วนตัวที่ส่งให้ AI</summary>
                <pre className="mt-2 p-3 bg-muted rounded-lg text-[11px] whitespace-pre-wrap break-words max-h-64 overflow-auto">{promptQ.data}</pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* chat */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-500" /> แชทกับติวเตอร์ AI</CardTitle>
          <CardDescription>
            {effectiveStudentId ? "AI จะรู้จุดอ่อนและปรับการสอนให้ตรงวิชาที่คุณอ่อน — ถามการบ้านได้ แต่ AI จะสอนวิธีคิด ไม่เฉลยตรง" : "แชททั่วไป — ถ้าเลือกนักเรียนแล้ว AI จะปรับให้ตรงจุดมากขึ้น"}
          </CardDescription>
          {quickPrompts.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {quickPrompts.map((p) => (
                <Button key={p} variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => setInput(p)}>
                  {p}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="h-[380px] rounded-xl border bg-muted/20">
            <div ref={scrollRef} className="p-3 space-y-3 max-h-[380px] overflow-auto">
              {messages.length === 0 && (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-violet-600" />
                  </div>
                  <p className="text-sm font-medium">เริ่มถามได้เลย</p>
                  <p className="text-xs text-muted-foreground mt-1">เช่น “ช่วยติวคณิตเรื่องเศษส่วนหน่อย” หรือวางโจทย์การบ้าน</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border shadow-sm rounded-bl-sm"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-background border shadow-sm rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> กำลังคิด...
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              placeholder={effectiveStudentId ? "พิมพ์คำถาม เช่น ช่วยติวคณิตเศษส่วนหน่อย..." : "พิมพ์คำถามทั่วไป..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={2}
              className="min-h-[56px] max-h-[120px] resize-none"
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim() || !canChat} size="icon" className="h-[56px] w-[56px] shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">กด Enter ส่ง • Shift+Enter ขึ้นบรรทัดใหม่ • AI จะเรียก supabase.functions.invoke("ai-chat", {`{ message, student_id }`}) พร้อมบริบทส่วนตัว</p>
        </CardContent>
      </Card>
    </div>
  );
}
