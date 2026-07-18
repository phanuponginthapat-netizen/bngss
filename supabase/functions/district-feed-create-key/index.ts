// Generate API Key for District Feed (admin only)
// POST -> creates a new API key, returns plaintext key ONCE
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "dfk_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const jsonResp = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResp({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonResp({ error: "unauthorized" }, 401);

    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return jsonResp({ error: "forbidden" }, 403);

    if (req.method !== "POST") return jsonResp({ error: "method_not_allowed" }, 405);

    const body = await req.json().catch(() => ({}));
    const name = (body?.name as string)?.trim();
    const description = body?.description as string | undefined;
    const scopes = Array.isArray(body?.scopes) && body.scopes.length > 0 ? body.scopes : ["schools", "stats", "reports"];
    const expires_at = body?.expires_at || null;

    if (!name) return jsonResp({ error: "name_required" }, 400);

    const plaintext = randomKey();
    const key_hash = await sha256(plaintext);
    const key_prefix = plaintext.substring(0, 12);

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await adminClient
      .from("district_api_keys")
      .insert({ name, description, key_hash, key_prefix, scopes, expires_at, created_by: user.id })
      .select("id, name, key_prefix, scopes, expires_at, created_at")
      .maybeSingle();

    if (error) return jsonResp({ error: error.message }, 500);

    // Derive project endpoint info for one-click Hub setup
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = (supabaseUrl.match(/https?:\/\/([^.]+)\./)?.[1]) || "";
    const functionsBaseUrl = `${supabaseUrl}/functions/v1/district-feed-api`;

    const { data: school } = await adminClient
      .from("schools")
      .select("id, school_name, school_code, obec_code, latitude, longitude")
      .limit(1).maybeSingle();

    return jsonResp({
      key: plaintext,
      record: data,
      endpoint: {
        project_ref: projectRef,
        supabase_url: supabaseUrl,
        functions_base_url: functionsBaseUrl,
        openapi_url: `${functionsBaseUrl}/openapi.json`,
        health_url: `${functionsBaseUrl}/health`,
        auth_header: "x-api-key",
      },
      school: school || null,
      hub_config: {
        // Paste this object into the Hub's "Add School" form
        school_name: school?.school_name ?? null,
        school_code: school?.school_code ?? school?.obec_code ?? null,
        latitude: school?.latitude ?? null,
        longitude: school?.longitude ?? null,
        api_base_url: functionsBaseUrl,
        api_key: plaintext,
        project_ref: projectRef,
      },
    }, 200);
  } catch (e) {
    console.error("district-feed-create-key error:", e);
    return jsonResp({ error: (e as Error)?.message || "internal_error" }, 500);
  }
});
