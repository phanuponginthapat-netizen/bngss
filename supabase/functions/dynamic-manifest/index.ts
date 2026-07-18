// Serves PWA manifest.json dynamically from CMS settings
// Public endpoint — browsers fetch it without auth before install prompt
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
        "school_name", "school_short_name", "school_logo", "school_logo_512",
        "theme_primary_color", "theme_secondary_color", "theme_accent_color",
        "primary_color", "theme_color", "background_color", "school_description",
      ]),
      admin.from("schools").select("school_name, short_name, logo_url").eq("is_active", true).limit(1).maybeSingle(),
    ]);

    const map: Record<string, string> = {};
    (cmsRes.data || []).forEach((r: any) => { if (r?.value) map[r.key] = r.value; });
    const school: any = schoolRes.data || {};

    const name = map.school_name || school.school_name || "ระบบจัดการโรงเรียน";
    const shortName = map.school_short_name || school.short_name || (name.length > 12 ? name.slice(0, 12) : name);
    const themeColor = map.theme_primary_color || map.theme_color || map.primary_color || "#2563EB";
    const bgColor = map.background_color || "#FFFFFF";
    const description = map.school_description || `${name} — ระบบบริหารจัดการโรงเรียน`;
    const logo = map.school_logo_512 || map.school_logo || school.logo_url || "/icon-512.png";
    const logo192 = map.school_logo || school.logo_url || "/icon-192.png";

    const manifest = {
      name,
      short_name: shortName,
      description,
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: bgColor,
      theme_color: themeColor,
      lang: "th",
      icons: [
        { src: logo192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };

    return new Response(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/manifest+json; charset=utf-8",
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
