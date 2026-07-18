// Weekly batch — refresh mascot advice for active users in ONE run.
// Run: ทุกวันอาทิตย์ 02:00 BKK (= วันเสาร์ 19:00 UTC) ผ่าน pg_cron
// ลด AI calls จาก ~1,200 ครั้ง/สัปดาห์ → ~จำนวน active users / สัปดาห์
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateMascotMessages } from "../_shared/mascotAdvice.ts";

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function buildContextFor(supa: any, userId: string, role: string) {
  const today = todayBangkok();
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // profile
  const { data: prof } = await supa.from("profiles")
    .select("first_name, last_name, nickname").eq("id", userId).maybeSingle();
  const name = prof ? (prof.nickname || [prof.first_name, prof.last_name].filter(Boolean).join(" ")) : "";

  // unread + next event (เร็ว ๆ — ทำขนานกัน)
  const [unreadRes, eventRes] = await Promise.all([
    supa.from("notifications").select("id, title", { count: "exact" })
      .eq("user_id", userId).eq("is_read", false)
      .order("created_at", { ascending: false }).limit(1),
    supa.from("academic_events").select("title, event_date")
      .gte("event_date", today).lte("event_date", in7)
      .order("event_date", { ascending: true }).limit(1),
  ]);

  const ctx: any = {
    name,
    unread: unreadRes.count || 0,
    nextEvent: eventRes.data?.[0] || null,
  };

  // นักเรียน: เพิ่ม BMI + คะแนนล่าสุด
  if (role === "student") {
    const { data: stu } = await supa.from("students")
      .select("id, student_code").eq("auth_user_id", userId).maybeSingle();
    if (stu?.id) {
      const [hm, sc] = await Promise.all([
        supa.from("health_measurements")
          .select("bmi, height_cm, weight_kg, measured_at")
          .eq("student_id", stu.id)
          .order("measured_at", { ascending: false }).limit(1).maybeSingle(),
        stu.student_code
          ? supa.from("student_scores")
              .select("total_score, subjects(name_th)")
              .eq("student_code", stu.student_code)
              .not("total_score", "is", null)
              .order("updated_at", { ascending: false }).limit(8)
          : Promise.resolve({ data: [] }),
      ]);
      if (hm.data?.bmi != null) {
        ctx.bmi = {
          value: Number(hm.data.bmi),
          height_cm: hm.data.height_cm,
          weight_kg: hm.data.weight_kg,
          measured_at: hm.data.measured_at,
        };
      }
      ctx.subjectScores = (sc.data || []).map((r: any) => ({
        subject: r.subjects?.name_th || "-",
        score: Number(r.total_score) || 0,
        max: 100,
      }));
    }
  }

  // หัวข้อที่เคยถาม AI 60 วันล่าสุด
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data: logs } = await supa.from("ai_chat_logs")
    .select("topic, sentiment, risk_level")
    .eq("user_id", userId).eq("role", "user")
    .gte("created_at", since)
    .not("topic", "is", null).limit(50);
  const map = new Map<string, { count: number; lastSentiment?: string; lastRisk?: string }>();
  (logs || []).forEach((r: any) => {
    if (!r.topic) return;
    const p = map.get(r.topic);
    if (p) p.count++;
    else map.set(r.topic, { count: 1, lastSentiment: r.sentiment, lastRisk: r.risk_level });
  });
  ctx.aiTopics = Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count).slice(0, 5)
    .map(([topic, v]) => ({ topic, ...v }));

  return ctx;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = svc();

  // เลือกผู้ใช้ที่ active 30 วันล่าสุด — เพื่อไม่เปลือง token กับคนที่ไม่ใช้ระบบ
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: notiUsers }, { data: roleRows }] = await Promise.all([
    supa.from("notifications").select("user_id").gte("created_at", since),
    supa.from("user_roles").select("user_id, role"),
  ]);

  const activeIds = new Set<string>();
  (notiUsers || []).forEach((r: any) => { if (r.user_id) activeIds.add(r.user_id); });

  // ถ้าใน cache เก่ามีอยู่แล้วและยังไม่หมดอายุ ข้าม
  const { data: existing } = await supa.from("mascot_advice_cache")
    .select("user_id, next_refresh_at");
  const fresh = new Set<string>();
  (existing || []).forEach((r: any) => {
    if (r.next_refresh_at && new Date(r.next_refresh_at) > new Date()) fresh.add(r.user_id);
  });

  const roleByUser = new Map<string, string>();
  (roleRows || []).forEach((r: any) => { if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role); });

  const targets = Array.from(activeIds).filter((id) => !fresh.has(id));

  // จำกัดสูงสุด/รอบ กันเกิน token quota
  const MAX_PER_RUN = 200;
  const slice = targets.slice(0, MAX_PER_RUN);

  let ok = 0, fail = 0;
  for (const userId of slice) {
    try {
      const role = roleByUser.get(userId) || "teacher";
      const ctx = await buildContextFor(supa, userId, role);
      const messages = await generateMascotMessages(ctx, role);
      const next = new Date(Date.now() + 7 * 86400_000).toISOString();
      await supa.from("mascot_advice_cache").upsert({
        user_id: userId,
        role,
        messages,
        context_snapshot: ctx,
        generated_at: new Date().toISOString(),
        next_refresh_at: next,
      }, { onConflict: "user_id" });
      ok++;
      // หน่วงเล็กน้อยกัน rate-limit ผู้ให้บริการ
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      fail++;
      console.error("[refresh-mascot] fail", userId, e);
    }
  }

  return new Response(JSON.stringify({
    scanned: activeIds.size,
    skipped_fresh: fresh.size,
    attempted: slice.length,
    refreshed: ok,
    failed: fail,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
