// Landing page after gateway OAuth completes.
// Gateway redirects here after OAuth completes.
// The App User Connector gateway returns a short-lived exchange `code` to this
// app callback. Exchange it with the connector gateway before storing the
// permanent per-user connection key used by X-Connection-Api-Key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CLIENT_API_KEY = Deno.env.get("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY")!;
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

async function exchangeConnectionCode(code: string) {
  const exchangeRes = await fetch(`${GATEWAY}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Client-Api-Key": CLIENT_API_KEY,
    },
    body: JSON.stringify({ code }),
  });

  const text = await exchangeRes.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!exchangeRes.ok) {
    console.error("gdrive exchange failed", {
      status: exchangeRes.status,
      type: typeof data.type === "string" ? data.type : undefined,
      title: typeof data.title === "string" ? data.title : undefined,
    });
    throw new Error(typeof data.type === "string" ? data.type : "exchange_failed");
  }

  const connectionKey = pickBodyParam(data, [
    "connection_key",
    "connectionKey",
    "app_user_connection_key",
    "appUserConnectionKey",
    "credential_key",
    "connection_api_key",
    "api_key",
    "key",
  ]);

  return {
    connectionKey,
    externalUserId: pickBodyParam(data, ["external_user_id", "provider_user_id", "provider_account_id"]),
    accountEmail: pickBodyParam(data, ["account_email", "email"]),
    accountName: pickBodyParam(data, ["account_name", "name"]),
    scopes: Array.isArray(data.scopes) ? data.scopes : Array.isArray((data.data as Record<string, unknown> | undefined)?.scopes) ? (data.data as Record<string, unknown>).scopes : undefined,
  };
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
    const appUrl = Deno.env.get("APP_URL");
    const allowed = hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname.endsWith(".lovable.app")
      || hostname === "lovableproject.com"
      || hostname.endsWith(".lovableproject.com")
      || hostname === "lovableproject-dev.com"
      || hostname.endsWith(".lovableproject-dev.com")
      || hostname === "beta.lovable.dev"
      || hostname.endsWith(".beta.lovable.dev")
      || (appUrl && url.origin === new URL(appUrl).origin);
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

  if (errorParam) return back(`error:${errorParam}`);
  if (!directConnectionKey && !exchangeCode) {
    console.warn("gdrive finish missing connection handle", {
      queryKeys: Array.from(url.searchParams.keys()),
      bodyKeys: Object.keys(body),
      success: pickParam(url, body, ["success"]),
    });
    return back("error:no_key");
  }
  if (!appUserId) return back("error:no_user");
  if (!returnTo || !stateExpiresAt || !stateSignature || Number(stateExpiresAt) < Date.now()) {
    return back("error:bad_state");
  }
  const expectedSignature = await signState(appUserId, returnTo, stateExpiresAt);
  if (!timingSafeEqual(expectedSignature, stateSignature)) return back("error:bad_state");

  let connectionKey = directConnectionKey;
  let exchanged: Awaited<ReturnType<typeof exchangeConnectionCode>> | null = null;
  if (!connectionKey && exchangeCode) {
    try {
      exchanged = await exchangeConnectionCode(exchangeCode);
      connectionKey = exchanged.connectionKey;
    } catch (error) {
      return back(`error:${error instanceof Error ? error.message : "exchange_failed"}`);
    }
  }
  if (!connectionKey) return back("error:no_connection_key");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch identity info from Google via gateway so we can display email
  let email: string | null = null;
  let name: string | null = null;
  try {
    const meRes = await fetch(`${GATEWAY}/google_drive/oauth2/v2/userinfo`, {
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": connectionKey,
      },
    });
    if (meRes.ok) {
      const j = await meRes.json();
      email = j.email ?? null;
      name = j.name ?? null;
    }
  } catch (_) { /* non-fatal */ }

  const { error } = await admin.from("app_user_connections").upsert({
    user_id: appUserId,
    connector_id: "google_drive",
    connection_key: connectionKey,
    external_user_id: exchanged?.externalUserId ?? externalUserId ?? appUserId,
    account_email: exchanged?.accountEmail ?? email,
    account_name: exchanged?.accountName ?? name,
    scopes: exchanged?.scopes,
    connected_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "user_id,connector_id" });

  if (error) {
    console.error("db upsert failed", error);
    return back(`error:${error.code ?? "db"}`);
  }
  return back("connected");
});
