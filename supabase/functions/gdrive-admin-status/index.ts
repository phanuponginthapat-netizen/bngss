// Reports Google Drive App User Connector health for admin settings UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: roleRow, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "director"])
      .limit(1)
      .maybeSingle();

    if (roleError) {
      console.error("gdrive admin role check failed", roleError);
      return json({ error: "role_check_failed" }, 500);
    }
    if (!roleRow) return json({ error: "forbidden" }, 403);

    const { error: tableError } = await admin
      .from("app_user_connections")
      .select("id", { count: "exact", head: true })
      .eq("connector_id", "google_drive")
      .limit(1);

    return json({
      clientConfigured: Boolean(Deno.env.get("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY")),
      connectionKeySecretConfigured: !tableError,
      lovableApiKeyConfigured: Boolean(Deno.env.get("LOVABLE_API_KEY")),
      callbackUrl: "https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("gdrive-admin-status failed", error);
    return json({ error: String(error) }, 500);
  }
});