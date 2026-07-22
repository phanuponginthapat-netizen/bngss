// AI Data Analysis — สรุป/วิเคราะห์ข้อมูลระบบโรงเรียน
// Input:  { question: string, scope?: "attendance"|"grades"|"behavior"|"budget"|"all", year?: number, semester?: number }
// Output: { answer: string, data: any, model: string }
import { aiCouncil } from "../_shared/aiCall.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // AI key handled by aiCall (DB providers + key pool fallback)

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "director"]).limit(1).maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin/director only" }, 403);

    const { question, scope = "all", year, semester } = await req.json();
    if (!question || typeof question !== "string") return json({ error: "missing question" }, 400);

    const yr = Number(year) || new Date().getFullYear();
    const sem = Number(semester) || 1;

    // รวบรวมสถิติย่อจาก DB (ไม่ส่งข้อมูลส่วนตัว)
    const stats: any = { academic_year: yr, semester: sem };

    if (scope === "all" || scope === "attendance") {
      const { count: present } = await admin.from("attendance").select("*", { count: "exact", head: true }).eq("status", "present").eq("academic_year", yr).eq("semester", sem);
      const { count: absent } = await admin.from("attendance").select("*", { count: "exact", head: true }).eq("status", "absent").eq("academic_year", yr).eq("semester", sem);
      const { count: late } = await admin.from("attendance").select("*", { count: "exact", head: true }).eq("status", "late").eq("academic_year", yr).eq("semester", sem);
      stats.attendance = { present, absent, late };
    }
    if (scope === "all" || scope === "grades") {
      const { data: grades } = await admin.from("student_scores").select("grade").limit(5000);
      const dist: Record<string, number> = {};
      (grades || []).forEach((g: any) => { if (g.grade) dist[g.grade] = (dist[g.grade] || 0) + 1; });
      stats.grade_distribution = dist;
    }
    if (scope === "all" || scope === "behavior") {
      const { count: pos } = await admin.from("behavior_records").select("*", { count: "exact", head: true }).eq("behavior_type", "positive");
      const { count: neg } = await admin.from("behavior_records").select("*", { count: "exact", head: true }).eq("behavior_type", "negative");
      stats.behavior = { positive: pos, negative: neg };
    }
    if (scope === "all" || scope === "budget") {
      const { data: bt } = await admin.from("budget_transactions").select("transaction_type, amount").eq("fiscal_year", yr).limit(5000);
      let income = 0, expense = 0;
      (bt || []).forEach((t: any) => { if (t.transaction_type === "income") income += Number(t.amount || 0); else expense += Number(t.amount || 0); });
      stats.budget = { income, expense, balance: income - expense };
    }

    const { count: students } = await admin.from("students").select("*", { count: "exact", head: true }).eq("status", "active");
    const { count: personnel } = await admin.from("personnel").select("*", { count: "exact", head: true });
    stats.totals = { active_students: students, personnel };

    const sys = `คุณเป็นนักวิเคราะห์ข้อมูลโรงเรียนไทย ตอบเป็นภาษาไทยกระชับ มีตัวเลขจริง และเสนอข้อเสนอแนะที่ปฏิบัติได้`;
    const userMsg = `คำถาม: ${question}\n\nข้อมูลสถิติ (${yr}/${sem}):\n${JSON.stringify(stats, null, 2)}`;

    const result = await aiCouncil({
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      temperature: 0.4,
      functionName: "analyze-data",
      userId: user.id,
    });

    return json({ answer: result.content, data: stats, model: result.model, provider: result.provider, panel: result.panel.map(p => ({ provider: p.provider, ok: p.ok })) });
  } catch (e: any) {
    console.error("analyze-data error:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
