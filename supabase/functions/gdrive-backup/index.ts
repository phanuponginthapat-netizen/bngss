// Push a snapshot of all configured tables to a user-deployed Google Apps Script Web App
// which writes the data to Google Sheets (formatted) and JSON snapshots to Google Drive.
// The admin pastes the GAS Web App URL + shared secret in school_settings (no Lovable secret needed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_TABLES = [
  "profiles", "user_roles", "personnel", "students", "alumni",
  "classrooms", "subjects", "schedules", "enrollments",
  "attendance", "behavior_records", "homeroom_records", "student_leaves",
  "student_scores",
  "documents", "document_recipients",
  "eforms", "eform_recipients",
  "news_posts", "emergency_broadcasts",
  "assets", "asset_damage_reports",
  "budget_transactions",
  "clubs", "club_members", "club_attendance", "club_works", "club_feed_posts",
  "school_settings", "academic_periods",
];

const PAGE = 1000;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Admin/director only
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!ok) return json({ error: "Forbidden: admin/director only" }, 403);

    // Read GAS config from school_settings
    const { data: cfg } = await admin
      .from("school_settings")
      .select("setting_key,setting_value")
      .in("setting_key", ["gas_webapp_url", "gas_shared_secret"]);
    const cfgMap = Object.fromEntries((cfg ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    const gasUrl = cfgMap["gas_webapp_url"];
    const gasSecret = cfgMap["gas_shared_secret"];
    if (!gasUrl || !gasSecret) return json({ error: "ยังไม่ได้ตั้งค่า GAS Web App URL / Shared Secret" }, 400);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const tables: string[] = Array.isArray(body.tables) && body.tables.length > 0 ? body.tables : DEFAULT_TABLES;

    // Pull all rows per table
    const tablesPayload: Record<string, any[]> = {};
    const summary: any[] = [];
    for (const t of tables) {
      try {
        const rows: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await admin.from(t).select("*").range(from, from + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          rows.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        tablesPayload[t] = rows;
        summary.push({ table: t, rows: rows.length, ok: true });
      } catch (e: any) {
        summary.push({ table: t, ok: false, error: String(e?.message ?? e) });
      }
    }

    // POST to GAS
    const gasRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "backup",
        secret: gasSecret,
        snapshot_at: new Date().toISOString(),
        tables: tablesPayload,
      }),
      redirect: "follow",
    });
    const gasText = await gasRes.text();
    let gasJson: any = null;
    try { gasJson = JSON.parse(gasText); } catch { /* GAS may return HTML on script error */ }
    if (!gasRes.ok || gasJson?.error) {
      return json({ error: `GAS error: ${gasJson?.error || gasText.slice(0, 300)}` }, 502);
    }

    await admin.from("school_settings").upsert({
      setting_key: "last_gdrive_backup",
      setting_value: JSON.stringify({
        ran_at: new Date().toISOString(),
        ok: summary.filter((s) => s.ok).length,
        failed: summary.filter((s) => !s.ok).length,
        results: summary,
        gas_summary: gasJson?.summary ?? null,
      }),
    }, { onConflict: "setting_key" });

    return json({ success: true, summary, gas: gasJson });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
