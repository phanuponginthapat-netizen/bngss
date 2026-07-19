// Landing page after gateway OAuth completes.
// Gateway redirects here with connection_key (and/or a token) as query params.
// This function stores the connection_key and redirects the user back to /my-drive.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
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

function sanitizeReturnUrl(value: string | null, fallbackOrigin: string) {
  const fallback = `${fallbackOrigin}/dashboard/my-drive`;
  if (!value) return fallback;
  try {
    const url = new URL(value.startsWith("http") ? value : `${fallbackOrigin}${value.startsWith("/") ? value : `/${value}`}`);
    const appUrl = Deno.env.get("APP_URL");
    const allowed = url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname.endsWith(".lovable.app")
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
  const connectionKey = pickParam(url, body, ["connection_key", "app_user_connection_key", "credential_key", "key"]);
  const appUserId = pickParam(url, body, ["lovable_app_user_id", "app_user_id", "user_id"]);
  const externalUserId = pickParam(url, body, ["external_user_id", "provider_user_id", "provider_account_id"]);
  const errorParam = pickParam(url, body, ["error", "error_code"]);
  const returnTo = pickParam(url, body, ["return_to", "return_url"]);

  const appOrigin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "https://bngss.lovable.app";
  const back = (msg: string) => {
    const u = new URL(sanitizeReturnUrl(returnTo, appOrigin));
    u.searchParams.set("drive_status", msg);
    return Response.redirect(u.toString(), 302);
  };

  if (errorParam) return back(`error:${errorParam}`);
  if (!connectionKey) return back("error:no_key");
  if (!appUserId) return back("error:no_user");

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
    external_user_id: externalUserId ?? appUserId,
    account_email: email,
    account_name: name,
    connected_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "user_id,connector_id" });

  if (error) {
    console.error("db upsert failed", error);
    return back(`error:${error.code ?? "db"}`);
  }
  return back("connected");
});
