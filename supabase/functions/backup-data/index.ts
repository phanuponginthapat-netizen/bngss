import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ตารางที่ backup ได้ (ข้อมูลโรงเรียนหลัก ไม่รวม auth/storage)
const BACKUP_TABLES = [
  "students", "personnel", "classrooms", "enrollments",
  "subjects", "schedules", "attendance", "behavior_records",
  "homeroom_records", "academic_events", "news_posts",
  "leave_requests", "documents", "eforms", "eform_recipients",
  "assets", "budget_transactions", "account_balances", "action_plans",
  "school_settings", "user_roles", "profiles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ตรวจ caller ว่าเป็น admin
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if ((roleRow as any)?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const requested = url.searchParams.get("tables");
    const tables = requested ? requested.split(",").filter((t) => BACKUP_TABLES.includes(t)) : BACKUP_TABLES;

    const backup: Record<string, any> = {
      version: 1,
      created_at: new Date().toISOString(),
      created_by: user.email,
      tables: {},
    };

    for (const table of tables) {
      const { data, error } = await admin.from(table as any).select("*").limit(50000);
      if (error) {
        backup.tables[table] = { error: error.message, rows: [] };
      } else {
        backup.tables[table] = { count: data?.length || 0, rows: data || [] };
      }
    }

    const body = JSON.stringify(backup, null, 2);
    const filename = `backup_${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});