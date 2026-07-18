import { isAuthorizedCron, unauthorized } from "../_shared/cronAuth.ts";
// Auto-suggest E-Form / Action drafts based on patterns
// - นักเรียนขาด 3+ วันในสัปดาห์ → แนะนำผู้ปกครองสร้างใบลา + แจ้งครูประจำชั้น
// - พฤติกรรมเชิงลบ 3+ ครั้งใน 14 วัน → แนะนำครูเปิดบันทึก home visit
// - การบ้านเกินกำหนด 5+ → แนะนำครูส่งบันทึกเตือนนักเรียน
// Trigger: pg_cron รายวัน (ตอนเย็น ~17:00)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function inboxOnce(opts: {
  userId: string;
  title: string;
  message: string;
  category: string;
  actionUrl?: string;
  refTable: string;
  refId: string;
  priority?: string;
}) {
  // ป้องกัน duplicate ภายใน 7 วัน
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: existing } = await supabase
    .from("inbox_items")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("reference_table", opts.refTable)
    .eq("reference_id", opts.refId)
    .gte("created_at", since)
    .maybeSingle();
  if (existing) return false;

  await supabase.from("inbox_items").insert({
    user_id: opts.userId,
    title: opts.title,
    message: opts.message,
    item_type: "task",
    category: opts.category,
    reference_table: opts.refTable,
    reference_id: opts.refId,
    action_url: opts.actionUrl,
    priority: opts.priority ?? "high",
  });
  return true;
}

async function runAbsenceTriggers() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("attendance")
    .select("student_id")
    .eq("status", "absent")
    .gte("attendance_date", since);
  const counts = new Map<string, number>();
  (rows ?? []).forEach((r: any) => counts.set(r.student_id, (counts.get(r.student_id) ?? 0) + 1));

  let created = 0;
  for (const [studentId, n] of counts) {
    if (n < 3) continue;
    const { data: s } = await supabase
      .from("students")
      .select("id,prefix,first_name,last_name,classroom_id,parent_user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (!s) continue;
    const name = `${s.prefix ?? ""}${s.first_name} ${s.last_name}`;

    // แจ้งครูประจำชั้น
    if (s.classroom_id) {
      const { data: cls } = await supabase
        .from("classrooms")
        .select("homeroom_teacher_id")
        .eq("id", s.classroom_id)
        .maybeSingle();
      const tId = (cls as any)?.homeroom_teacher_id;
      if (tId) {
        if (
          await inboxOnce({
            userId: tId,
            title: `⚠️ ${name} ขาดเรียน ${n} วัน`,
            message: `นักเรียนขาดเรียน ${n} วันใน 7 วันที่ผ่านมา ควรติดต่อผู้ปกครอง`,
            category: "attendance",
            refTable: "students",
            refId: studentId,
            actionUrl: `/dashboard/student/profile?id=${studentId}`,
          })
        )
          created++;
      }
    }
    // แจ้งผู้ปกครองให้กรอกใบลา
    if (s.parent_user_id) {
      if (
        await inboxOnce({
          userId: s.parent_user_id,
          title: `📝 แนะนำให้กรอกใบลาให้ ${name}`,
          message: `บุตรหลานขาดเรียน ${n} วันในสัปดาห์นี้ กรุณากรอกใบลาเพื่อแจ้งสาเหตุ`,
          category: "leave",
          refTable: "students",
          refId: studentId,
          actionUrl: `/dashboard/student/leave?student=${studentId}`,
        })
      )
        created++;
    }
  }
  return created;
}

async function runBehaviorTriggers() {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const { data: rows } = await supabase
    .from("behavior_records")
    .select("student_id")
    .eq("behavior_type", "negative")
    .gte("record_date", since);
  const counts = new Map<string, number>();
  (rows ?? []).forEach((r: any) => counts.set(r.student_id, (counts.get(r.student_id) ?? 0) + 1));

  let created = 0;
  for (const [studentId, n] of counts) {
    if (n < 3) continue;
    const { data: s } = await supabase
      .from("students")
      .select("id,prefix,first_name,last_name,classroom_id")
      .eq("id", studentId)
      .maybeSingle();
    if (!s) continue;
    const name = `${s.prefix ?? ""}${s.first_name} ${s.last_name}`;
    const { data: cls } = await supabase
      .from("classrooms")
      .select("homeroom_teacher_id")
      .eq("id", s.classroom_id)
      .maybeSingle();
    const tId = (cls as any)?.homeroom_teacher_id;
    if (!tId) continue;
    if (
      await inboxOnce({
        userId: tId,
        title: `🔔 พิจารณาเยี่ยมบ้าน: ${name}`,
        message: `มีบันทึกพฤติกรรมเชิงลบ ${n} ครั้งใน 14 วัน อาจต้องเปิด home visit`,
        category: "behavior",
        refTable: "students",
        refId: studentId,
        actionUrl: `/dashboard/student/home-visits?student=${studentId}`,
        priority: "normal",
      })
    )
      created++;
  }
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await isAuthorizedCron(req))) return unauthorized();

  try {
    const absence = await runAbsenceTriggers();
    const behavior = await runBehaviorTriggers();
    return new Response(JSON.stringify({ ok: true, created: { absence, behavior } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-eform error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
