// Landing page after gateway OAuth completes.
// Gateway redirects here after OAuth completes.
// The App User Connector gateway returns a short-lived exchange `code` to this
// app callback. Exchange it with the connector gateway before storing the
// permanent per-user connection key used by X-Connection-Api-Key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exchangeCode as googleExchangeCode, fetchGoogleUserInfo, hasNativeGoogleOAuth } from "../_shared/googleOauth.ts";
import { verifyState } from "../_shared/oauthState.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function readCallbackBody(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return {} as Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) return await req.json();
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      return Object.fromEntries(form.entries());
    }
  } catch (error) {
    console.warn("could not parse gdrive callback body", error);
  }
  return {} as Record<string, unknown>;
}

function nestedValue(source: unknown, path: string[]) {
  let current = source as Record<string, unknown> | undefined;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key] as Record<string, unknown> | undefined;
  }
  return typeof current === "string" ? current : undefined;
}

function pickParam(url: URL, body: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const fromUrl = url.searchParams.get(name);
    if (fromUrl) return fromUrl;
    const fromBody = body[name];
    if (typeof fromBody === "string" && fromBody) return fromBody;
  }
  for (const root of ["data", "connection", "credential", "app_user_connection"]) {
    for (const name of names) {
      const value = nestedValue(body, [root, name]);
      if (value) return value;
    }
  }
  return null;
}

function pickBodyParam(body: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const fromBody = body[name];
    if (typeof fromBody === "string" && fromBody) return fromBody;
  }
  for (const root of ["data", "connection", "credential", "app_user_connection"]) {
    for (const name of names) {
      const value = nestedValue(body, [root, name]);
      if (value) return value;
    }
  }
  return null;
}

async function signState(userId: string, returnUrl: string, expiresAt: string) {
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

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sanitizeReturnUrl(value: string | null, fallbackOrigin: string) {
  const fallback = `${fallbackOrigin}/dashboard/my-drive`;
  if (!value) return fallback;
  try {
    const url = new URL(value.startsWith("http") ? value : `${fallbackOrigin}${value.startsWith("/") ? value : `/${value}`}`);
    const hostname = url.hostname.toLowerCase();
    const envOrigins = [
      Deno.env.get("APP_URL"),
      Deno.env.get("PUBLIC_ORIGIN"),
      ...(Deno.env.get("ALLOWED_RETURN_ORIGINS") ?? "").split(","),
    ]
      .map((v) => (v ?? "").trim())
      .filter(Boolean)
      .map((v) => { try { return new URL(v).origin; } catch { return ""; } });
    const allowed = hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.endsWith(".lovable.app")
      || envOrigins.includes(url.origin);
    return allowed ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const body = await readCallbackBody(req);
  const directConnectionKey = pickParam(url, body, [
    "connection_key",
    "app_user_connection_key",
    "credential_key",
    "key",
  ]);
  const exchangeCode = pickParam(url, body, ["code", "connection_code", "authorization_code"]);
  const appUserId = pickParam(url, body, ["lovable_app_user_id", "app_user_id", "user_id"]);
  const externalUserId = pickParam(url, body, ["external_user_id", "provider_user_id", "provider_account_id"]);
  const errorParam = pickParam(url, body, ["error", "error_code"]);
  const returnTo = pickParam(url, body, ["return_to", "return_url"]);
  const stateExpiresAt = pickParam(url, body, ["state_exp"]);
  const stateSignature = pickParam(url, body, ["state_sig"]);

  const { getPublicOrigin } = await import("../_shared/appConfig.ts");
  const appOrigin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? await getPublicOrigin();
  const back = (msg: string) => {
    const u = new URL(sanitizeReturnUrl(returnTo, appOrigin));
    u.searchParams.set("drive_status", msg);
    return Response.redirect(u.toString(), 302);
  };

  // === Standalone: callback จาก Google OAuth โดยตรง ===
  const nativeState = url.searchParams.get("state");
  if (nativeState && await hasNativeGoogleOAuth()) {
    const parsed = await verifyState(nativeState);
    if (!parsed) return back("error:bad_state");
    const nativeBack = (msg: string) => {
      const u = new URL(sanitizeReturnUrl(parsed.r, appOrigin));
      u.searchParams.set("drive_status", msg);
      return Response.redirect(u.toString(), 302);
    };
    if (errorParam) return nativeBack(`error:${errorParam}`);
    const code = url.searchParams.get("code");
    if (!code) return nativeBack("error:no_code");
    try {
      const redirectUri = `${url.origin}${url.pathname}`;
      const tokens = await googleExchangeCode(code, redirectUri);
      const info = await fetchGoogleUserInfo(tokens.access_token);
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await admin.from("app_user_connections").upsert({
        user_id: parsed.u,
        connector_id: "google_drive",
        auth_mode: "google_oauth",
        connection_key: null,
        refresh_token: tokens.refresh_token ?? null,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        external_user_id: info?.sub ?? parsed.u,
        account_email: info?.email ?? null,
        account_name: info?.name ?? null,
        scopes: tokens.scope ? tokens.scope.split(" ") : null,
        connected_at: new Date().toISOString(),
        revoked_at: null,
      }, { onConflict: "user_id,connector_id" });
      if (error) {
        console.error("db upsert failed", error);
        return nativeBack(`error:${error.code ?? "db"}`);
      }
      return nativeBack("connected");
    } catch (e) {
      console.error("google oauth finish failed", e);
      return nativeBack("error:exchange_failed");
    }
  }

  if (errorParam) return back(`error:${errorParam}`);

  // Standalone: ไม่รองรับ callback แบบ connector gateway อีกต่อไป
  console.warn("gdrive finish: non-native callback rejected", {
    queryKeys: Array.from(url.searchParams.keys()),
    bodyKeys: Object.keys(body),
  });
  return back("error:google_oauth_not_configured");
});
