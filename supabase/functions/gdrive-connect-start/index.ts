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

function isAllowedReturnUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".lovable.app")) return true;
    const appUrl = Deno.env.get("APP_URL");
    if (appUrl && url.origin === new URL(appUrl).origin) return true;
    return false;
  } catch {
    return false;
  }
}

async function signState(userId: string, returnUrl: string, expiresAt: string) {
  const secret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("LOVABLE_API_KEY") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${returnUrl}:${expiresAt}`),
  );
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

    const rawBody = await req.text();
    let body: any = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }
    const url = new URL(req.url);
    let returnUrl: string = body.return_url ?? body.returnUrl ?? url.searchParams.get("return_url") ?? "";
    // Fallback: derive from Origin/Referer header if client failed to include it
    if (!returnUrl) {
      const origin = req.headers.get("origin") ?? "";
      const referer = req.headers.get("referer") ?? "";
      if (origin) returnUrl = `${origin}/dashboard/my-drive?tab=settings`;
      else if (referer) {
        try { const r = new URL(referer); returnUrl = `${r.origin}/dashboard/my-drive?tab=settings`; } catch {}
      }
    }
    if (!isAllowedReturnUrl(returnUrl)) {
      console.error("return_url invalid", { returnUrl, rawBody, origin: req.headers.get("origin"), referer: req.headers.get("referer") });
      return new Response(JSON.stringify({ error: "return_url required", received: returnUrl, hint: "must be http(s) and localhost or *.lovable.app or APP_URL origin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const functionUrl = new URL(req.url);
    const finishUrl = new URL(`${functionUrl.origin}/functions/v1/gdrive-connect-finish`);
    const stateExpiresAt = String(Date.now() + 15 * 60 * 1000);
    finishUrl.searchParams.set("return_to", returnUrl);
    finishUrl.searchParams.set("lovable_app_user_id", user.id);
    finishUrl.searchParams.set("state_exp", stateExpiresAt);
    finishUrl.searchParams.set("state_sig", await signState(user.id, returnUrl, stateExpiresAt));

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
        app_user_id: user.id,
        return_url: finishUrl.toString(),
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
