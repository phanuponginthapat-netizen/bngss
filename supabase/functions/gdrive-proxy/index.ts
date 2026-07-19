// Proxies Google Drive API v3 calls on behalf of the signed-in user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin
      .from("app_user_connections")
      .select("connection_key")
      .eq("user_id", user.id)
      .eq("connector_id", "google_drive")
      .is("revoked_at", null)
      .maybeSingle();

    if (!conn?.connection_key) {
      return new Response(JSON.stringify({ error: "not_connected" }), { status: 428, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { path, method = "GET", query = {}, headers = {}, body: reqBody, upload_url } = body;
    if (!path && !upload_url) {
      return new Response(JSON.stringify({ error: "path required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const baseUrl = upload_url
      ? `${GATEWAY}/google_drive${upload_url}`
      : `${GATEWAY}/google_drive/drive/v3${path}`;
    const url = new URL(baseUrl);
    Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));

    const upstreamHeaders: Record<string, string> = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": conn.connection_key,
      ...headers,
    };
    if (reqBody && !upstreamHeaders["Content-Type"]) upstreamHeaders["Content-Type"] = "application/json";

    const upstream = await fetch(url.toString(), {
      method,
      headers: upstreamHeaders,
      body: reqBody ? (typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody)) : undefined,
    });

    // Update last_used
    admin.from("app_user_connections").update({ last_used_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("connector_id", "google_drive").then(() => {});

    const contentType = upstream.headers.get("Content-Type") ?? "application/json";
    // Stream download responses directly
    if (contentType.startsWith("application/json") || contentType.startsWith("text/")) {
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
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
