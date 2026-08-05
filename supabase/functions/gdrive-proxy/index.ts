// Proxies Google Drive API v3 calls on behalf of the signed-in user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { refreshAccessToken } from "../_shared/googleOauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingAppUserCredential(status: number, bodyText: string) {
  if (status === 401) return true;
  return status === 401 && /App user credential not found|app_user_credential_missing/i.test(bodyText);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin
      .from("app_user_connections")
      .select("connection_key, auth_mode, refresh_token, access_token, access_token_expires_at")
      .eq("user_id", user.id)
      .eq("connector_id", "google_drive")
      .is("revoked_at", null)
      .maybeSingle();

    const isNative = conn?.auth_mode === "google_oauth";
    if (!conn || (isNative ? !conn.refresh_token && !conn.access_token : !conn.connection_key)) {
      return json({
        error: "not_connected",
        code: "GOOGLE_DRIVE_NOT_CONNECTED",
        message: "ยังไม่ได้เชื่อม Google Drive หรือการเชื่อมต่อเดิมหมดอายุ กรุณากดเชื่อมใหม่",
        reconnect_required: true,
      }, 428);
    }

    const body = await req.json();
    const { path, method = "GET", query = {}, headers = {}, body: reqBody, body_b64, upload_url } = body;
    if (!path && !upload_url) {
      return json({ error: "path required" }, 400);
    }

    // โหมด standalone: ต่อ Google API โดยตรงด้วย access token ของผู้ใช้
    let nativeAccessToken: string | null = null;
    if (isNative) {
      const expMs = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
      if (conn.access_token && expMs - 60_000 > Date.now()) {
        nativeAccessToken = conn.access_token;
      } else if (conn.refresh_token) {
        try {
          const t = await refreshAccessToken(conn.refresh_token);
          nativeAccessToken = t.access_token;
          await admin.from("app_user_connections").update({
            access_token: t.access_token,
            access_token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
          }).eq("user_id", user.id).eq("connector_id", "google_drive");
        } catch (e) {
          console.error("refresh failed", e);
          return json({
            error: "app_user_credential_missing",
            code: "APP_USER_CREDENTIAL_MISSING",
            message: "การเชื่อม Google Drive หมดอายุ กรุณากดเชื่อมใหม่อีกครั้ง",
            reconnect_required: true,
          }, 428);
        }
      }
      if (!nativeAccessToken) {
        return json({ error: "not_connected", code: "GOOGLE_DRIVE_NOT_CONNECTED", reconnect_required: true }, 428);
      }
    }

    const baseUrl = isNative
      ? (upload_url ? `https://www.googleapis.com${upload_url}` : `https://www.googleapis.com/drive/v3${path}`)
      : (upload_url ? `${GATEWAY}/google_drive${upload_url}` : `${GATEWAY}/google_drive/drive/v3${path}`);
    const url = new URL(baseUrl);
    Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));

    const upstreamHeaders: Record<string, string> = isNative
      ? { "Authorization": `Bearer ${nativeAccessToken}`, ...headers }
      : {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": conn.connection_key as string,
        ...headers,
      };

    let finalBody: BodyInit | undefined;
    if (body_b64) {
      // decode base64 → Uint8Array for binary uploads
      const bin = atob(body_b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      finalBody = bytes;
    } else if (reqBody != null) {
      if (!upstreamHeaders["Content-Type"]) upstreamHeaders["Content-Type"] = "application/json";
      finalBody = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
    }

    const upstream = await fetch(url.toString(), {
      method,
      headers: upstreamHeaders,
      body: finalBody,
    });

    // Update last_used
    admin.from("app_user_connections").update({ last_used_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("connector_id", "google_drive").then(() => {});

    const contentType = upstream.headers.get("Content-Type") ?? "application/json";
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      if (isMissingAppUserCredential(upstream.status, text)) {
        await admin.from("app_user_connections")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("connector_id", "google_drive")
          .is("revoked_at", null);

        return json({
          error: "app_user_credential_missing",
          code: "APP_USER_CREDENTIAL_MISSING",
          message: "บัญชี Google Drive ที่เชื่อมไว้ใช้ไม่ได้แล้ว กรุณากดเชื่อม Google Drive ใหม่อีกครั้ง",
          reconnect_required: true,
        }, 428);
      }

      return json({
        error: "Provider request failed",
        status: upstream.status,
        details: text,
      }, upstream.status);
    }

    // Stream download responses directly
    if (contentType.startsWith("application/json") || contentType.startsWith("text/") || contentType.includes("+json")) {
      const text = await upstream.text();
      return new Response(text, { status: upstream.status, headers: { ...corsHeaders, "Content-Type": contentType } });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": upstream.headers.get("Content-Disposition") ?? "",
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
