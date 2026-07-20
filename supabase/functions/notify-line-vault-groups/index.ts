// Push LINE notifications to LINE Vault groups by category.
// Called by DB triggers via pg_net (with x-cron-secret header) and by UI test button.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { pushMessage } from "../_shared/lineApi.ts";
import { buildInfoCard, BRAND } from "../_shared/lineFlex.ts";

async function getVaultToken(sb: any): Promise<string | null> {
  const env = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim();
  if (env) return env;
  const { data } = await sb.from("app_secrets")
    .select("value").eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return (data?.value as string) || null;
}

const CATEGORY_COLUMN: Record<string, string> = {
  leaves: "notify_leaves",
  substitute: "notify_substitute",
  calendar: "notify_calendar",
};

function thDate(d?: string | null): string {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

function buildLeaveCard(p: any): { msg: any; title: string } {
  const isStudent = p.kind === "student_leave";
  const actionLabel: Record<string, string> = {
    new: "📝 คำขอลาใหม่",
    approved: "✅ อนุมัติการลาแล้ว",
    rejected: "❌ ไม่อนุมัติการลา",
    pending: "⏳ รอพิจารณา",
  };
  const color = p.action === "approved" ? "#10B981" : p.action === "rejected" ? "#EF4444" : "#F59E0B";
  const title = actionLabel[p.action] || "แจ้งเตือนการลา";
  const rows = [
    { label: isStudent ? "นักเรียน" : "ผู้ลา", value: p.name || "-" },
    ...(isStudent && p.classroom ? [{ label: "ห้อง", value: p.classroom }] : []),
    { label: "ประเภท", value: p.leave_type || "-" },
    { label: "ช่วงวันที่", value: `${thDate(p.start_date)} — ${thDate(p.end_date)}` },
    ...(p.reason ? [{ label: "เหตุผล", value: String(p.reason).slice(0, 120) }] : []),
    ...(p.action === "approved" && p.approved_by ? [{ label: "ผู้อนุมัติ", value: p.approved_by }] : []),
    ...(p.action === "rejected" && p.rejected_reason ? [{ label: "เหตุผลปฏิเสธ", value: String(p.rejected_reason).slice(0, 120) }] : []),
  ];
  return { msg: { type: "flex", altText: title, contents: buildInfoCard(title, rows, color) }, title };
}

function buildSubstituteCard(p: any) {
  const title = "🔁 มอบหมายสอนแทน";
  const rows = [
    { label: "ครูประจำ", value: p.original || "-" },
    { label: "ครูสอนแทน", value: p.substitute || "รอมอบหมาย" },
    { label: "วันที่", value: thDate(p.date) },
    { label: "คาบ", value: String(p.period ?? "-") },
    ...(p.subject ? [{ label: "วิชา", value: p.subject }] : []),
    ...(p.classroom ? [{ label: "ห้อง", value: p.classroom }] : []),
    ...(p.notes ? [{ label: "หมายเหตุ", value: String(p.notes).slice(0, 120) }] : []),
  ];
  return { msg: { type: "flex", altText: title, contents: buildInfoCard(title, rows, "#6366F1") }, title };
}

function buildCalendarCard(events: any[]) {
  const title = `📅 กิจกรรมของวันนี้ (${events.length})`;
  const rows = events.slice(0, 10).map((e) => ({
    label: thDate(e.event_date),
    value: `${e.title}${e.location ? ` — ${e.location}` : ""}`,
  }));
  return { msg: { type: "flex", altText: title, contents: buildInfoCard(title, rows, "#0EA5E9") }, title };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const header = req.headers.get("x-cron-secret") || "";
    // Allow either: valid cron secret OR authenticated user (relying on Supabase's JWT verify at gateway).
    // Since verify_jwt=false, we only trust the header path for automated calls.
    const isCron = cronSecret && header === cronSecret;

    const sb = makeAdmin();
    const body = await req.json().catch(() => ({}));
    const { category, payload, group_id, test } = body || {};

    if (!category || !CATEGORY_COLUMN[category]) {
      return new Response(JSON.stringify({ error: "invalid category" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = await getVaultToken(sb);
    if (!token) {
      return new Response(JSON.stringify({ error: "LINE_VAULT_CHANNEL_ACCESS_TOKEN not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build message
    let msg: any; let title = "";
    if (category === "leaves") ({ msg, title } = buildLeaveCard(payload || {}));
    else if (category === "substitute") ({ msg, title } = buildSubstituteCard(payload || {}));
    else if (category === "calendar") ({ msg, title } = buildCalendarCard(payload?.events || []));

    // Pick groups
    let q = sb.from("line_vault_groups").select("id, line_group_id, group_name").eq(CATEGORY_COLUMN[category], true);
    if (group_id) q = q.eq("id", group_id);
    const { data: groups } = await q;

    const results: any[] = [];
    for (const g of groups || []) {
      try {
        await pushMessage(token, g.line_group_id, [msg]);
        results.push({ id: g.id, ok: true });
        await sb.from("line_vault_groups").update({ last_notified_at: new Date().toISOString() }).eq("id", g.id);
      } catch (e) {
        console.error("push failed", g.group_name, e);
        results.push({ id: g.id, ok: false, error: String(e).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results, test: !!test, isCron }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
