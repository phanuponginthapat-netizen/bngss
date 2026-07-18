// Daily LINE digest — push สรุปประจำวันให้ผู้ใช้ที่เปิด opt-in
// Trigger: cron 06:30 Asia/Bangkok (เซ็ตด้วย pg_cron)
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/getSecret.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function pushLine(to: string, messages: unknown[]) {
  const LINE_TOKEN = await getSecret(["LINE", "CHANNEL", "ACCESS", "TOKEN"].join("_"));
  if (!LINE_TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}

function todayISO() {
  const d = new Date();
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 10);
}

async function buildParentDigest(studentIds: string[], date: string) {
  if (!studentIds.length) return null;
  const lines: string[] = [`📅 สรุปประจำวัน ${date}`];

  // Attendance วันนี้
  const { data: att } = await supabase
    .from("attendance")
    .select("student_id,status,students(prefix,first_name,last_name)")
    .in("student_id", studentIds)
    .eq("attendance_date", date);
  if (att?.length) {
    lines.push("", "🏫 การมาเรียน:");
    for (const a of att) {
      const s: any = a.students;
      const name = s ? `${s.prefix ?? ""}${s.first_name} ${s.last_name}` : "นักเรียน";
      const emoji = a.status === "present" ? "✅" : a.status === "absent" ? "❌" : "⚠️";
      lines.push(`${emoji} ${name}: ${a.status}`);
    }
  }

  // Behavior 7 วันล่าสุด
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const { data: bh } = await supabase
    .from("behavior_records")
    .select("description,points,behavior_type,record_date")
    .in("student_id", studentIds)
    .gte("record_date", weekAgo)
    .order("record_date", { ascending: false })
    .limit(5);
  if (bh?.length) {
    lines.push("", "📝 พฤติกรรม 7 วันล่าสุด:");
    bh.forEach((b) =>
      lines.push(`${b.behavior_type === "positive" ? "⭐" : "⚠️"} ${b.record_date}: ${b.description}`),
    );
  }

  return lines.length > 1 ? lines.join("\n") : null;
}

async function buildTeacherDigest(personnelId: string, date: string) {
  // คาบสอนวันนี้
  const dow = ((new Date().getDay() + 6) % 7) + 1; // 1=Mon..7=Sun (จับให้ตรง schedules.day_of_week)
  const { data: p } = await supabase
    .from("personnel")
    .select("prefix,first_name,last_name")
    .eq("id", personnelId)
    .maybeSingle();
  if (!p) return null;
  const teacherName = `${p.prefix ?? ""}${p.first_name} ${p.last_name}`;
  const { data: sched } = await supabase
    .from("schedules")
    .select("period_number,subjects(subject_name),classrooms(name)")
    .eq("teacher_name", teacherName)
    .eq("day_of_week", dow)
    .order("period_number");

  const lines = [`📅 ตารางสอนวันนี้ (${date})`];
  if (sched?.length) {
    sched.forEach((s: any) =>
      lines.push(`คาบ ${s.period_number} • ${s.subjects?.subject_name ?? "-"} • ${s.classrooms?.name ?? "-"}`),
    );
  } else {
    lines.push("ไม่มีคาบสอนวันนี้");
  }

  // สอนแทน
  const { data: sub } = await supabase
    .from("substitute_teaching")
    .select("period,subjects(subject_name),classrooms(name)")
    .eq("substitute_teacher", teacherName)
    .eq("teaching_date", date);
  if (sub?.length) {
    lines.push("", "🔁 สอนแทน:");
    sub.forEach((s: any) =>
      lines.push(`${s.period} • ${s.subjects?.subject_name ?? "-"} • ${s.classrooms?.name ?? "-"}`),
    );
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const date = todayISO();

    // ดึงผู้ใช้ที่เปิด digest
    const { data: prefs } = await supabase
      .from("line_user_preferences")
      .select("line_user_id,role")
      .eq("digest_enabled", true);

    let sent = 0;
    for (const pref of prefs ?? []) {
      const lineId = pref.line_user_id;
      let text: string | null = null;

      if (pref.role === "teacher") {
        const { data: prof } = await supabase
          .from("profiles").select("id").eq("line_user_id", lineId).maybeSingle();
        if (prof) {
          const { data: per } = await supabase
            .from("personnel").select("id").eq("user_id", prof.id).maybeSingle();
          if (per) text = await buildTeacherDigest(per.id, date);
        }
      } else {
        // parent/student
        const { data: studs } = await supabase
          .from("students")
          .select("id")
          .or(`line_user_id.eq.${lineId},line_user_id_2.eq.${lineId},line_user_id_3.eq.${lineId}`);
        const ids = (studs ?? []).map((s) => s.id);
        text = await buildParentDigest(ids, date);
      }

      if (text) {
        await pushLine(lineId, [{ type: "text", text }]);
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: prefs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digest error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
