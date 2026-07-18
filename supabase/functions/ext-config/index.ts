import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const keys = [
    "browser_blocklist", "browser_ad_domains", "browser_block_message", "browser_default_homepage",
    "browser_time_rules", "browser_login_url",
    "school_name", "school_name_en", "school_logo", "footer_school_name",
    "app_name", "app_short_name", "app_favicon_url", "theme_color", "primary_color",
  ];
  const { data } = await supabase.from("cms_settings").select("key, value").in("key", keys);
  const out: Record<string, any> = {};
  for (const row of data ?? []) out[(row as any).key] = (row as any).value ?? "";

  // Shortcuts (Google-style app grid)
  const { data: shortcuts } = await supabase
    .from("browser_shortcuts")
    .select("id,label_th,label_en,icon,logo_url,target_url,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  out.browser_shortcuts = shortcuts ?? [];

  return new Response(JSON.stringify(out), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
});
