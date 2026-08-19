// Daily calendar digest → LINE Vault groups with notify_calendar = true
// Reads today's + tomorrow's academic_events and sends flex message.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { pushMessage } from "../_shared/lineApi.ts";
import { buildInfoCard } from "../_shared/lineFlex.ts";

function bkkDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);
  // Convert to Asia/Bangkok (UTC+7)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bkk = new Date(utc + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

async function getVaultToken(sb: any): Promise<string | null> {
  const env = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim();
  if (env) return env;
  const { data } = await sb.from("app_secrets").select("value").eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return (data?.value as string) || null;
}

function thDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const denied = await requireCronOrAdmin(req, corsHeaders);
    if (denied) return denied;

    const sb = makeAdmin();
    const today = bkkDate(0);
    const tomorrow = bkkDate(1);
    const in7 = bkkDate(7);

    const { data: todayEvents } = await sb.from("academic_events")
      .select("id, title, event_date, end_date, location, event_type")
      .lte("event_date", today).or(`end_date.gte.${today},end_date.is.null`)
      .order("event_date");
    const { data: upcomingEvents } = await sb.from("academic_events")
      .select("id, title, event_date, location, event_type")
      .gt("event_date", today).lte("event_date", in7)
      .order("event_date");

    const token = await getVaultToken(sb);
    if (!token) return new Response(JSON.stringify({ error: "token missing" }), { status: 500, headers: corsHeaders });

    const { data: groups } = await sb.from("line_vault_groups")
      .select("id, line_group_id, group_name, last_calendar_digest_date").eq("notify_calendar", true);

    const title = `📅 ปฏิทินวันที่ ${thDate(today)}`;
    const rows: any[] = [];
    if ((todayEvents || []).length === 0) {
      rows.push({ label: "วันนี้", value: "ไม่มีกิจกรรม" });
    } else {
      for (const e of (todayEvents || []).slice(0, 6)) {
        rows.push({ label: "วันนี้", value: `${e.title}${e.location ? ` @ ${e.location}` : ""}` });
      }
    }
    if ((upcomingEvents || []).length > 0) {
      for (const e of upcomingEvents!.slice(0, 6)) {
        rows.push({ label: thDate(e.event_date), value: `${e.title}${e.location ? ` @ ${e.location}` : ""}` });
      }
    }

    const msg = { type: "flex", altText: title, contents: buildInfoCard(title, rows, "#0EA5E9", undefined, "กิจกรรมของโรงเรียน 7 วันข้างหน้า") };

    const results: any[] = [];
    for (const g of groups || []) {
      // dedupe: skip if already sent today
      if (g.last_calendar_digest_date === today) { results.push({ id: g.id, skipped: true }); continue; }
      try {
        await pushMessage(token, g.line_group_id, [msg]);
        await sb.from("line_vault_groups").update({ last_calendar_digest_date: today, last_notified_at: new Date().toISOString() }).eq("id", g.id);
        results.push({ id: g.id, ok: true });
      } catch (e) {
        console.error("digest push failed", g.group_name, e);
        results.push({ id: g.id, ok: false, error: String(e).slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: true, date: today, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
