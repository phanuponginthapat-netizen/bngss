// Starts the Google Drive App User OAuth flow.
// Returns { authorize_url } that the frontend should redirect the user to.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildAuthorizeUrl, hasNativeGoogleOAuth } from "../_shared/googleOauth.ts";
import { signState } from "../_shared/oauthState.ts";
import { NO_LOVABLE_DRIVE_MSG } from "../_shared/standalone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive",
];

function isAllowedReturnUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".lovable.app")) return true;
    if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
    if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
    if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
    const appUrl = Deno.env.get("APP_URL");
    if (appUrl && url.origin === new URL(appUrl).origin) return true;
    return false;
  } catch {
    return false;
  }
}

async function signGatewayState(userId: string, returnUrl: string, expiresAt: string) {
  const secret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
      return new Response(JSON.stringify({ error: "return_url required", received: returnUrl, hint: "must be http(s) and localhost, *.lovable.app, *.lovableproject.com, or APP_URL origin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const functionUrl = new URL(req.url);
    const finishUrl = new URL(`${functionUrl.origin}/functions/v1/gdrive-connect-finish`);
    const stateExpiresAt = String(Date.now() + 15 * 60 * 1000);
    finishUrl.searchParams.set("return_to", returnUrl);
    finishUrl.searchParams.set("lovable_app_user_id", user.id);
    finishUrl.searchParams.set("state_exp", stateExpiresAt);
    finishUrl.searchParams.set("state_sig", await signGatewayState(user.id, returnUrl, stateExpiresAt));

    // === Standalone: Google OAuth ของโรงเรียนเอง (ค่าเริ่มต้น) ===
    if (await hasNativeGoogleOAuth()) {
      const redirectUri = `${functionUrl.origin}/functions/v1/gdrive-connect-finish`;
      const state = await signState({ u: user.id, r: returnUrl, e: Date.now() + 15 * 60 * 1000 });
      const authorizeUrl = await buildAuthorizeUrl({ redirectUri, state, scopes: SCOPES, loginHint: user.email ?? undefined });
      return new Response(JSON.stringify({ authorize_url: authorizeUrl, mode: "google_oauth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "google_oauth_not_configured", message: NO_LOVABLE_DRIVE_MSG }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
