import { useMemo, useState, useEffect } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeatherData } from "@/hooks/useWeatherData";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { useMascotSettings } from "@/hooks/useMascotSettings";
import { useAiBotSettings } from "@/hooks/useAiBotSettings";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend,
} from "recharts";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/lib/obecStandards";

function classifySubjectGroup(name: string): SubjectGroup["key"] | null {
  const n = (name || "").toLowerCase();
  if (/ภาษาไทย|ไทย$|^ไทย/.test(n)) return "thai";
  if (/คณิต|math/.test(n)) return "math";
  if (/วิทย|maker|วิทยาการคำนวณ|คอมพิว|computer|เทคโนโลยี/.test(n)) return "science";
  if (/สังคม|ประวัติศาสตร์|ศาสนา|หน้าที่พลเมือง|เศรษฐ|ภูมิ/.test(n)) return "social";
  if (/สุข|พล(ะ|ศึกษา)|พ\.ศ\.|health|pe/.test(n)) return "health";
  if (/ศิลป|ดนตรี|นาฏ|art|music/.test(n)) return "art";
  if (/การงาน|อาชีพ|งานบ้าน|เกษตร|career/.test(n)) return "career";
  if (/อังกฤษ|english|จีน|chinese|ญี่ปุ่น|japanese|ภาษาต่างประเทศ|foreign/.test(n)) return "foreign";
  return null;
}

const _currentAY = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 5 ? d.getFullYear() : d.getFullYear() - 1;
})();

type Mood = "happy" | "neutral" | "worried";
const moodColor: Record<Mood, string> = {
  happy: "bg-success-soft text-success border-success/30",
  neutral: "bg-warning-soft text-warning border-warning/30",
  worried: "bg-danger-soft text-danger border-danger/30",
};

function AnimatedMascot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative pointer-events-none select-none">
      <img src={src} alt={alt} width={160} height={160}
        className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-2xl relative z-10" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] w-32 h-3 rounded-full bg-black/40 blur-md opacity-30" />
    </div>
  );
}

export default function MascotHeroWidget() {
  const { role, userId } = useUserRole();
  const { lang } = useLanguage();
  const weather = useWeatherData();
  const mascot = useMascotSettings();
  const aiBot = useAiBotSettings();
  const today = todayBangkok();

  const { data: profile } = useQuery({
    queryKey: ["mascot_profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("first_name, last_name, nickname").eq("id", userId!).maybeSingle();
      return data;
    },
  });
  const name = profile ? (profile.nickname || [profile.first_name, profile.last_name].filter(Boolean).join(" ")) : "";

  const isStaff = role === "admin" || role === "director" || role === "teacher";
  const { data: stats } = useQuery({
    queryKey: ["mascot_stats", today, role],
    enabled: isStaff,
    queryFn: async () => {
      const [students, scannedTodayRows, attendanceToday] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("face_scan_logs").select("student_id, scan_time").eq("scan_date", today),
        supabase.from("attendance").select("student_id, status").eq("attendance_date", today),
      ]);
      // นักเรียนที่ "มาโรงเรียน" = present หรือ late (จาก attendance) ∪ มีการสแกนหน้า
      const presentSet = new Set<string>();
      const statusByStudent = new Map<string, "present" | "late" | "absent">();
      (attendanceToday.data || []).forEach((a: any) => {
        if (!a.student_id) return;
        if (a.status === "present" || a.status === "late" || a.status === "absent") {
          statusByStudent.set(a.student_id, a.status);
        }
        if (a.status === "present" || a.status === "late") presentSet.add(a.student_id);
      });
      (scannedTodayRows.data || []).forEach((row: any) => {
        if (row.student_id) presentSet.add(row.student_id);
      });
      return {
        students: students.count || 0,
        scannedToday: presentSet.size,
        attTotal: statusByStudent.size,
      };
    },
    staleTime: 15_000,
  });


  const { data: bubbleExtras } = useQuery({
    queryKey: ["mascot_bubble", userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
      const [unread, upcoming] = await Promise.all([
        supabase.from("notifications").select("id, title", { count: "exact" })
          .eq("user_id", userId!).eq("is_read", false).order("created_at", { ascending: false }).limit(1),
        supabase.from("academic_events").select("title, event_date")
          .gte("event_date", today).lte("event_date", in7.slice(0, 10))
          .order("event_date", { ascending: true }).limit(1),
      ]);
      return {
        unreadCount: unread.count || 0,
        latestUnread: unread.data?.[0]?.title as string | undefined,
        nextEvent: upcoming.data?.[0] as { title: string; event_date: string } | undefined,
      };
    },
    staleTime: 60_000,
  });

  const staticMessages = useMemo(() => {
    const msgs: string[] = [];
    msgs.push(`สวัสดี${name ? ` ${name}` : ""} วันนี้ยิ้มสดใสนะ! ☀️`);
    if (weather?.temperature != null) {
      msgs.push(`ตอนนี้อุณหภูมิ ${weather.temperature.toFixed(0)}°C ${weather.isRainy ? "มีฝนตก ☔ พกร่มด้วยน้า" : "อากาศดีมาก ☀️"}`);
    }
    if (stats) {
      const total = stats.students || 0;
      const scanned = stats.scannedToday || 0;
      const pct = total > 0 ? Math.round((scanned / total) * 100) : 0;
      msgs.push(`รายงานวันนี้: เข้ามาโรงเรียน ${scanned}/${total} คน (${pct}%) 🏫`);
    }
    if (bubbleExtras?.nextEvent) {
      const d = new Date(bubbleExtras.nextEvent.event_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
      msgs.push(`นัดหมายถัดไป: ${bubbleExtras.nextEvent.title} (${d}) 📅`);
    }
    if (bubbleExtras?.unreadCount) {
      msgs.push(`มีข้อความใหม่ ${bubbleExtras.unreadCount} รายการรอคุณอยู่! 🔔${bubbleExtras.latestUnread ? ` "${bubbleExtras.latestUnread}"` : ""}`);
    }
    return msgs;
  }, [name, weather, stats, bubbleExtras]);

  // Radar
  const { data: studentRadar } = useQuery({
    queryKey: ["mascot_student_radar_groups", userId, _currentAY],
    enabled: !!userId && role === "student",
    queryFn: async () => {
      const { data: stu } = await supabase.from("students")
        .select("student_code").eq("auth_user_id", userId!).maybeSingle();
      if (!stu?.student_code) return [] as any[];
      const prev = _currentAY - 1;
      const [scoresRes, subjectsRes] = await Promise.all([
        supabase.from("student_scores")
          .select("subject_id,total_score,academic_year")
          .eq("student_code", stu.student_code)
          .in("academic_year", [_currentAY, prev])
          .not("total_score", "is", null),
        supabase.from("subjects").select("id,name_th"),
      ]);
      const subjMap = new Map<string, SubjectGroup["key"]>();
      ((subjectsRes.data as any[]) || []).forEach((s) => {
        const g = classifySubjectGroup(s.name_th || "");
        if (g) subjMap.set(s.id, g);
      });
      const acc = new Map<SubjectGroup["key"], { cs: number; cn: number; ps: number; pn: number }>();
      SUBJECT_GROUPS.forEach((g) => acc.set(g.key, { cs: 0, cn: 0, ps: 0, pn: 0 }));
      ((scoresRes.data as any[]) || []).forEach((r) => {
        const k = subjMap.get(r.subject_id);
        if (!k) return;
        const slot = acc.get(k)!;
        const v = Number(r.total_score) || 0;
        if (r.academic_year === _currentAY) { slot.cs += v; slot.cn += 1; }
        else if (r.academic_year === prev) { slot.ps += v; slot.pn += 1; }
      });
      return SUBJECT_GROUPS.map((g) => {
        const s = acc.get(g.key)!;
        return {
          axis: g.name.length > 10 ? g.name.slice(0, 9) + "…" : g.name,
          fullName: g.name,
          value: s.cn ? Math.round((s.cs / s.cn) * 10) / 10 : 0,
          previous: s.pn ? Math.round((s.ps / s.pn) * 10) / 10 : 0,
          fullMark: 100,
        };
      });
    },
    staleTime: 60_000,
  });

  const { data: staffSubjectRadar } = useQuery({
    queryKey: ["mascot_staff_subject_radar", _currentAY],
    enabled: !!userId && isStaff,
    queryFn: async () => {
      const prev = _currentAY - 1;
      const [scoresRes, subjectsRes] = await Promise.all([
        supabase.from("student_scores")
          .select("subject_id,total_score,academic_year")
          .in("academic_year", [_currentAY, prev])
          .not("total_score", "is", null),
        supabase.from("subjects").select("id,name_th"),
      ]);
      const subjMap = new Map<string, SubjectGroup["key"]>();
      ((subjectsRes.data as any[]) || []).forEach((s) => {
        const g = classifySubjectGroup(s.name_th || "");
        if (g) subjMap.set(s.id, g);
      });
      const acc = new Map<SubjectGroup["key"], { cs: number; cn: number; ps: number; pn: number }>();
      SUBJECT_GROUPS.forEach((g) => acc.set(g.key, { cs: 0, cn: 0, ps: 0, pn: 0 }));
      ((scoresRes.data as any[]) || []).forEach((r) => {
        const k = subjMap.get(r.subject_id);
        if (!k) return;
        const slot = acc.get(k)!;
        const v = Number(r.total_score) || 0;
        if (r.academic_year === _currentAY) { slot.cs += v; slot.cn += 1; }
        else if (r.academic_year === prev) { slot.ps += v; slot.pn += 1; }
      });
      return SUBJECT_GROUPS.map((g) => {
        const s = acc.get(g.key)!;
        return {
          axis: g.name,
          fullName: g.name,
          value: s.cn ? Math.round((s.cs / s.cn) * 10) / 10 : 0,
          previous: s.pn ? Math.round((s.ps / s.pn) * 10) / 10 : 0,
          fullMark: 100,
        };
      });
    },
    staleTime: 5 * 60_000,
  });

  const radarData = useMemo(() => {
    if (role === "student" && studentRadar && studentRadar.length > 0) return studentRadar as any[];
    if (isStaff && staffSubjectRadar && staffSubjectRadar.length > 0) return staffSubjectRadar as any[];
    return [];
  }, [role, isStaff, studentRadar, staffSubjectRadar]);
  const isGroupRadar = radarData.length > 0;
  const hasPrev = isGroupRadar && radarData.some((d: any) => (d.previous ?? 0) > 0);
  const overallScore = radarData.length
    ? Math.round(radarData.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) / radarData.length)
    : 0;
  const overallPrev = hasPrev
    ? Math.round(radarData.reduce((s: number, d: any) => s + (Number(d.previous) || 0), 0) / radarData.length)
    : 0;
  const delta = hasPrev ? overallScore - overallPrev : 0;
  const sorted = isGroupRadar ? [...radarData].filter((d: any) => d.value > 0).sort((a: any, b: any) => b.value - a.value) : [];
  const topGroup = sorted[0];
  const lowGroup = sorted[sorted.length - 1];
  const radarTitle = role === "student"
    ? `คะแนนของฉันตามกลุ่มสาระ • พ.ศ. ${_currentAY + 543}`
    : isStaff
      ? `คะแนนเฉลี่ยนักเรียนตามกลุ่มสาระ • พ.ศ. ${_currentAY + 543}`
      : "Stat ภาพรวมระบบ";

  const overall: Mood = overallScore >= 80 ? "happy" : overallScore >= 50 ? "neutral" : "worried";
  const mascotImg = mascot.happyUrl;

  // === ดึงข้อมูลส่วนตัวเพิ่ม: BMI (นักเรียน) + หัวข้อที่เคยถาม AI ===
  const { data: personalCtx } = useQuery({
    queryKey: ["mascot_personal_ctx", userId, role],
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // BMI: นักเรียนเท่านั้น
      let bmi: { value: number; height_cm: number | null; weight_kg: number | null; measured_at: string } | null = null;
      if (role === "student") {
        const { data: stu } = await supabase.from("students")
          .select("id").eq("auth_user_id", userId!).maybeSingle();
        if (stu?.id) {
          const { data: hm } = await supabase.from("health_measurements")
            .select("bmi, height_cm, weight_kg, measured_at")
            .eq("student_id", stu.id)
            .order("measured_at", { ascending: false })
            .limit(1).maybeSingle();
          if (hm?.bmi != null) {
            bmi = {
              value: Number(hm.bmi),
              height_cm: hm.height_cm != null ? Number(hm.height_cm) : null,
              weight_kg: hm.weight_kg != null ? Number(hm.weight_kg) : null,
              measured_at: hm.measured_at,
            };
          }
        }
      }
      // หัวข้อที่ผู้ใช้เคยถาม AI ใน 60 วันล่าสุด (เฉพาะข้อความผู้ใช้)
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data: logs } = await supabase.from("ai_chat_logs")
        .select("topic, sentiment, risk_level, created_at")
        .eq("user_id", userId!)
        .eq("role", "user")
        .gte("created_at", since)
        .not("topic", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      const topicMap = new Map<string, { count: number; lastSentiment?: string; lastRisk?: string }>();
      (logs || []).forEach((r: any) => {
        if (!r.topic) return;
        const t = String(r.topic);
        const prev = topicMap.get(t);
        if (prev) prev.count += 1;
        else topicMap.set(t, { count: 1, lastSentiment: r.sentiment || undefined, lastRisk: r.risk_level || undefined });
      });
      const aiTopics = Array.from(topicMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([topic, v]) => ({ topic, ...v }));
      return { bmi, aiTopics };
    },
  });

  // === Mascot AI ปิดอยู่ — ใช้แค่ cache รายสัปดาห์ที่ cron `refresh-mascot-advice-weekly` เติมไว้ ===
  // ไม่เรียก edge function `mascot-advice` แบบ on-demand แล้ว เพราะทำให้ AI ถูกยิงทุกครั้งที่เปิด Dashboard
  // ถ้า cache ว่าง → fallback ไปใช้ staticMessages (ข้อมูลในระบบ) ทันที โดยไม่ trigger AI
  const { data: aiAdvice } = useQuery({
    queryKey: ["mascot_ai_advice_cache_only", userId, role],
    enabled: !!userId && !!role,
    staleTime: 6 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
    queryFn: async () => {
      // อ่าน cache โดยตรง — ไม่เรียก edge function เพื่อไม่ให้ AI ถูก trigger
      const { data } = await supabase
        .from("mascot_advice_cache")
        .select("messages, next_refresh_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (!data || !data.next_refresh_at) return [] as string[];
      if (new Date(data.next_refresh_at) <= new Date()) return [] as string[];
      return (Array.isArray(data.messages) ? data.messages : []).filter(
        (m: any): m is string => typeof m === "string" && !!m.trim(),
      );
    },
  });

  const bubbleMessages = useMemo(
    () => [ ...((aiAdvice && aiAdvice.length > 0) ? aiAdvice : []), ...staticMessages ],
    [aiAdvice, staticMessages],
  );

  const [bubbleIdx, setBubbleIdx] = useState(0);
  useEffect(() => {
    if (bubbleMessages.length < 2) return;
    const t = setInterval(() => setBubbleIdx(i => (i + 1) % bubbleMessages.length), 5000);
    return () => clearInterval(t);
  }, [bubbleMessages.length]);
  const currentBubble = bubbleMessages[bubbleIdx % Math.max(1, bubbleMessages.length)] || "";


  return (
    <Card className="relative overflow-hidden border-2 border-primary/20 p-0 h-full">
      <div
        className="relative w-full h-full"
        style={{
          backgroundImage: `url(${mascot.backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/40 to-white/80 dark:from-black/30 dark:via-black/50 dark:to-black/80" />

        <div className="relative flex flex-col gap-3 p-3 md:p-4">

          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3 md:gap-4 items-center">
            <div className="relative w-full rounded-2xl bg-transparent p-2 md:p-3">
              {isGroupRadar && (
                <>
                  <div className="flex justify-center mb-2">
                    <div className="text-[11px] md:text-xs font-bold text-white bg-gradient-to-r from-danger via-danger to-info px-3 py-1 rounded-full border-2 border-white shadow-md">
                      ✨ {radarTitle}
                    </div>
                  </div>
                  <div className="w-full h-[220px] md:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="72%" margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                        <defs>
                          <linearGradient id="radarPastel" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#f9a8d4" stopOpacity={0.7} />
                            <stop offset="50%" stopColor="#c4b5fd" stopOpacity={0.65} />
                            <stop offset="100%" stopColor="#7dd3fc" stopOpacity={0.7} />
                          </linearGradient>
                          <linearGradient id="radarStroke" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#ec4899" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <PolarGrid stroke="#000000" strokeOpacity={0.85} strokeWidth={1.2} />
                        <PolarAngleAxis dataKey="axis" tick={{ fill: "#000000", fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        {hasPrev && (
                          <Radar name={`ปี ${_currentAY + 542}`} dataKey="previous" stroke="#64748b"
                            strokeOpacity={0.6} strokeWidth={2} strokeDasharray="4 3"
                            fill="#94a3b8" fillOpacity={0.18} isAnimationActive animationDuration={1200} />
                        )}
                        <Radar name={`ปี ${_currentAY + 543}`} dataKey="value" stroke="url(#radarStroke)"
                          strokeWidth={3} fill="url(#radarPastel)" fillOpacity={0.85}
                          dot={{ r: 4, fill: "#fff", stroke: "#ec4899", strokeWidth: 2 }}
                          isAnimationActive animationDuration={1200} />
                        <Tooltip
                          contentStyle={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, fontSize: 12 }}
                          formatter={(v: any, name: any) => [`${v} / 100`, name]}
                          labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName || ""} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  {radarData.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-white/85 backdrop-blur border border-white/60 shadow-sm p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] md:text-xs">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-muted-foreground">เฉลี่ยรวม</div>
                          <div className="text-base font-bold text-foreground">{overallScore}</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-muted-foreground">เทียบปีก่อน</div>
                          <div className={`text-base font-bold ${delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted-foreground"}`}>
                            {hasPrev ? `${delta > 0 ? "+" : ""}${delta}` : "—"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-muted-foreground">มีข้อมูล</div>
                          <div className="text-base font-bold text-foreground">{sorted.length}/8</div>
                        </div>
                      </div>
                      {(topGroup || lowGroup) && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] md:text-xs">
                          {topGroup && (
                            <div className="rounded-lg border border-success/70 bg-success/60 p-2">
                              <div className="text-success font-semibold">🏆 {role === "student" ? "จุดแข็ง" : "สูงสุด"}</div>
                              <div className="text-foreground truncate">{(topGroup as any).fullName}</div>
                              <div className="text-muted-foreground">เฉลี่ย {(topGroup as any).value}</div>
                            </div>
                          )}
                          {lowGroup && lowGroup !== topGroup && (
                            <div className="rounded-lg border border-warning/70 bg-warning/60 p-2">
                              <div className="text-warning font-semibold">⚠ ควรพัฒนา</div>
                              <div className="text-foreground truncate">{(lowGroup as any).fullName}</div>
                              <div className="text-muted-foreground">เฉลี่ย {(lowGroup as any).value}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col items-center justify-center gap-3 md:gap-4">
              {currentBubble && (
                <div
                  className="relative w-full max-w-[320px] min-h-[88px] flex items-center justify-center bg-white text-foreground border-[3px] border-foreground rounded-2xl px-4 py-3 shadow-[6px_6px_0_hsl(var(--foreground))]"
                  style={{ fontFamily: "'Comic Sans MS', 'IBM Plex Sans Thai', sans-serif" }}
                >
                  <p className="text-sm font-semibold leading-snug text-center">{currentBubble}</p>
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[12px] border-x-transparent border-t-[14px] border-t-foreground" />
                  <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[9px] border-x-transparent border-t-[11px] border-t-white" />
                </div>
              )}
              <AnimatedMascot src={mascotImg} alt={mascot.name} />
              <Badge className="bg-primary text-primary-foreground shadow-md px-3 py-1 text-xs font-bold rounded-full">
                🤖 {aiBot.name}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
