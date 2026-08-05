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

/** origin ที่อนุญาตให้ redirect กลับ — อ่านจาก env ของ backend โรงเรียนเท่านั้น */
function allowedOrigins(): string[] {
  const raw = [
    Deno.env.get("APP_URL"),
    Deno.env.get("PUBLIC_ORIGIN"),
    ...(Deno.env.get("ALLOWED_RETURN_ORIGINS") ?? "").split(","),
  ];
  const out: string[] = [];
  for (const v of raw) {
    const t = (v ?? "").trim();
    if (!t) continue;
    try { out.push(new URL(t).origin); } catch { /* ignore */ }
  }
  return out;
}

function isAllowedReturnUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com") || hostname.endsWith(".lovable.dev")) return true; // โดเมนที่ใช้โฮสต์หน้าเว็บ/พรีวิว
    return allowedOrigins().includes(url.origin);
  } catch {
    return false;
  }
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
      return new Response(JSON.stringify({ error: "return_url required", received: returnUrl, hint: "must be http(s) and localhost or the APP_URL / ALLOWED_RETURN_ORIGINS origin" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const functionUrl = new URL(req.url);

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
