// Public endpoint: 302-redirects to the current CMS school logo so social
// crawlers (Facebook, LINE, Twitter) always get the latest logo without
// needing to update index.html.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const [cmsRes, schoolRes] = await Promise.all([
      admin.from("cms_settings").select("key, value").in("key", [
        "og_image", "school_logo_512", "school_logo",
      ]),
      admin.from("schools").select("logo_url").eq("is_active", true).limit(1).maybeSingle(),
    ]);

    const map: Record<string, string> = {};
    (cmsRes.data || []).forEach((r: any) => { if (r?.value) map[r.key] = r.value; });
    const school: any = schoolRes.data || {};
    const origin = new URL(req.url).origin;
    const target =
      map.og_image ||
      map.school_logo_512 ||
      map.school_logo ||
      school.logo_url ||
      `${origin.replace(/\/functions\/v1.*$/, "")}/icon-512.png`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: target,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
