// Starts the Google Drive App User OAuth flow.
// Returns { authorize_url } that the frontend should redirect the user to.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CLIENT_API_KEY = Deno.env.get("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY")!;

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl: string = body.return_url ?? "";
    if (!returnUrl.startsWith("http")) {
      return new Response(JSON.stringify({ error: "return_url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ask gateway to start OAuth authorization for this app user.
    // Body/response shape mirrors documented gateway conventions.
    const authRes = await fetch(`${GATEWAY}/api/v1/app-users/oauth2/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Client-Api-Key": CLIENT_API_KEY,
      },
      body: JSON.stringify({
        connector_id: "google_drive",
        external_user_id: user.id,
        redirect_url_after_callback: returnUrl,
        credentials_configuration: { scopes: SCOPES },
      }),
    });

    const text = await authRes.text();
    if (!authRes.ok) {
      console.error("gateway authorize failed", authRes.status, text);
      return new Response(JSON.stringify({ error: "gateway_error", status: authRes.status, details: text }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = JSON.parse(text);
    const authorizeUrl = data.authorize_url ?? data.authorization_url ?? data.url;
    if (!authorizeUrl) {
      return new Response(JSON.stringify({ error: "no_authorize_url", raw: data }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ authorize_url: authorizeUrl, raw: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
