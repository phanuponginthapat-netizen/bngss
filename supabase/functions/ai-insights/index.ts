// AI Insights — analyzes school KPIs and returns 3-5 actionable insight cards
// Uses the existing aiCall helper (Lovable AI Gateway + admin-managed providers).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { aiCall } from "../_shared/aiCall.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Insight {
  id: string;
  type: "anomaly" | "opportunity" | "warning" | "recommendation" | "celebration";
  title: string;
  detail: string;
  metric?: string;
  action?: { label: string; url: string };
  priority: "high" | "medium" | "low";
}

async function gatherStats(sb: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [
    students, personnel, classrooms,
    attendanceToday, attendanceWeek,
    behaviorWeek, leavesPending, damagePending,
    eformsPending, newsRecent, hwOverdue,
  ] = await Promise.all([
    sb.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("personnel").select("id", { count: "exact", head: true }),
    sb.from("classrooms").select("id", { count: "exact", head: true }),
    sb.from("attendance").select("status").eq("attendance_date", today),
    sb.from("attendance").select("status").gte("attendance_date", weekAgo),
    sb.from("behavior_records").select("behavior_type").gte("record_date", weekAgo),
    sb.from("student_leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("asset_damage_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("eforms").select("id", { count: "exact", head: true }).neq("status", "completed"),
    sb.from("news_posts").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    sb.from("task_assignments").select("id", { count: "exact", head: true })
      .eq("task_type", "homework").eq("status", "pending").lte("due_date", today),
  ]);

  const att = (attendanceToday.data || []) as { status: string }[];
  const attW = (attendanceWeek.data || []) as { status: string }[];
  const beh = (behaviorWeek.data || []) as { behavior_type: string }[];

  const countBy = (arr: any[], key: string, val: string) =>
    arr.filter((x) => x[key] === val).length;

  return {
    counts: {
      students: students.count ?? 0,
      personnel: personnel.count ?? 0,
      classrooms: classrooms.count ?? 0,
    },
    attendance_today: {
      total: att.length,
      present: countBy(att, "status", "present"),
      absent: countBy(att, "status", "absent"),
      late: countBy(att, "status", "late"),
    },
    attendance_week: {
      total: attW.length,
      absent: countBy(attW, "status", "absent"),
      late: countBy(attW, "status", "late"),
    },
    behavior_week: {
      positive: countBy(beh, "behavior_type", "positive"),
      negative: countBy(beh, "behavior_type", "negative"),
    },
    pending: {
      student_leaves: leavesPending.count ?? 0,
      damage_reports: damagePending.count ?? 0,
      eforms: eformsPending.count ?? 0,
      overdue_homework: hwOverdue.count ?? 0,
    },
    news_this_week: newsRecent.count ?? 0,
  };
}

const SYSTEM = `คุณคือผู้ช่วย AI วิเคราะห์ข้อมูลโรงเรียน หน้าที่: อ่านสถิติแล้วสร้าง insight cards ภาษาไทย 3-5 รายการ
แต่ละ card ต้องสั้น เฉพาะเจาะจง และนำไปลงมือทำได้

ส่ง JSON เท่านั้น:
{
  "insights": [
    {
      "id": "string-สั้น",
      "type": "anomaly|opportunity|warning|recommendation|celebration",
      "title": "หัวข้อสั้น <=60 อักษร",
      "detail": "อธิบาย 1-2 ประโยค <=160 อักษร อ้างตัวเลขจากข้อมูล",
      "metric": "ตัวเลข/% ที่เกี่ยวข้อง (optional)",
      "action": {"label": "ปุ่ม CTA <=20 อักษร", "url": "/dashboard/..."},
      "priority": "high|medium|low"
    }
  ]
}

แนวทางตัวอย่างหัวข้อ:
- ขาดเรียนสูงผิดปกติวันนี้ → recommendation /dashboard/student/attendance
- ใบลาค้าง 12 รายการเกิน 3 วัน → warning /dashboard/student/leave
- พฤติกรรมเชิงบวกพุ่ง 40% สัปดาห์นี้ → celebration /dashboard/student/behavior
- ยังไม่มีข่าวสารสัปดาห์นี้ → opportunity /dashboard/admin/news
ห้าม markdown ห้ามอธิบายเพิ่ม ส่งเฉพาะ JSON`;

function safeParse(s: string): { insights: Insight[] } | null {
  try {
    const cleaned = s.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    await req.json().catch(() => ({}));

    const stats = await gatherStats(sb);

    const result = await aiCall({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `ข้อมูลโรงเรียน:\n${JSON.stringify(stats, null, 2)}` },
      ],
      temperature: 0.4,
      json: true,
      functionName: "ai-insights",
      userId,
    });

    const parsed = safeParse(result.content);
    const insights: Insight[] = Array.isArray(parsed?.insights) ? parsed!.insights.slice(0, 6) : [];

    return new Response(JSON.stringify({ insights, provider: result.provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("402") ? 402 : msg.includes("429") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
