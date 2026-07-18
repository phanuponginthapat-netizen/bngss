// Weekly Parent Digest — push สรุปประจำสัปดาห์ของลูก
// แนะนำให้ตั้ง pg_cron ทุกอาทิตย์ 18:00 Asia/Bangkok (วันอาทิตย์)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/getSecret.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function pushLine(to: string, text: string) {
  const LINE_TOKEN = await getSecret("LINE_CHANNEL_ACCESS_TOKEN");
  if (!LINE_TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

function weekRange() {
  const end = new Date();
  const start = new Date(Date.now() - 7 * 86400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function buildWeekly(studentIds: string[]) {
  if (!studentIds.length) return null;
  const { start, end } = weekRange();

  const [{ data: students }, { data: att }, { data: bh }, { data: lv }, { data: hw }] = await Promise.all([
    supabase.from("students").select("id,prefix,first_name,last_name").in("id", studentIds),
    supabase
      .from("attendance")
      .select("student_id,status,attendance_date")
      .in("student_id", studentIds)
      .gte("attendance_date", start)
      .lte("attendance_date", end),
    supabase
      .from("behavior_records")
      .select("student_id,points,behavior_type")
      .in("student_id", studentIds)
      .gte("record_date", start),
    supabase
      .from("student_leaves")
      .select("student_id,status")
      .in("student_id", studentIds)
      .gte("start_date", start),
    supabase
      .from("homework_assignments")
      .select("id,due_date,title")
      .gte("due_date", end)
      .order("due_date")
      .limit(5),
  ]);

  const lines: string[] = [`📊 สรุปประจำสัปดาห์ (${start} → ${end})`];

  for (const s of students ?? []) {
    const name = `${s.prefix ?? ""}${s.first_name} ${s.last_name}`;
    const my = (att ?? []).filter((a: any) => a.student_id === s.id);
    const present = my.filter((a: any) => a.status === "present").length;
    const absent = my.filter((a: any) => a.status === "absent").length;
    const late = my.filter((a: any) => a.status === "late").length;
    const bhMy = (bh ?? []).filter((b: any) => b.student_id === s.id);
    const pos = bhMy.filter((b: any) => b.behavior_type === "positive").length;
    const neg = bhMy.length - pos;
    const lvMy = (lv ?? []).filter((l: any) => l.student_id === s.id).length;

    lines.push("", `👦 ${name}`);
    lines.push(`✅ มา ${present} • ❌ ขาด ${absent} • ⏰ สาย ${late}`);
    if (bhMy.length) lines.push(`⭐ ดี ${pos} • ⚠️ ต้องปรับ ${neg}`);
    if (lvMy) lines.push(`📝 คำขอลา: ${lvMy} รายการ`);
  }

  if (hw?.length) {
    lines.push("", "📚 การบ้านสัปดาห์หน้า:");
    hw.forEach((h: any) => lines.push(`• ${h.title} (กำหนด ${h.due_date})`));
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { data: prefs } = await supabase
      .from("line_user_preferences")
      .select("line_user_id,role")
      .eq("digest_enabled", true)
      .neq("role", "teacher");

    let sent = 0;
    for (const pref of prefs ?? []) {
      const { data: studs } = await supabase
        .from("students")
        .select("id")
        .or(
          `line_user_id.eq.${pref.line_user_id},line_user_id_2.eq.${pref.line_user_id},line_user_id_3.eq.${pref.line_user_id}`,
        );
      const ids = (studs ?? []).map((s) => s.id);
      const text = await buildWeekly(ids);
      if (text) {
        await pushLine(pref.line_user_id, text);
        sent++;
      }
    }
    return new Response(JSON.stringify({ ok: true, sent, total: prefs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly digest error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
