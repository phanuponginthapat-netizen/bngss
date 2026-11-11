import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { EXT_CONFIG_KEYS } from "../_shared/extensionPolicy.ts";

Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("บริการยังไม่พร้อม");
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from("cms_settings").select("key,value").in("key", EXT_CONFIG_KEYS);
    if (error) throw error;
    const config = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    let roles: string[] = [];
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: user, error: authError } = await db.auth.getUser(token);
      if (authError || !user.user) return reply({ error: "กรุณาเข้าสู่ระบบใหม่" }, 401);
      const result = await db.from("user_roles").select("role").eq("user_id", user.user.id);
      if (result.error) throw result.error;
      roles = (result.data || []).map(r => r.role);
    }
    const shortcuts: Record<string, unknown>[] = [];
    if (roles.length) {
      for (let from = 0; ; from += 500) {
        const result = await db.from("browser_shortcuts").select("id,label_th,label_en,icon,logo_url,target_url,visible_roles,sort_order").eq("is_active", true).order("sort_order").order("id").range(from, from + 499);
        if (result.error) throw result.error;
        for (const row of result.data || []) {
          if (row.visible_roles?.length && !roles.some(r => row.visible_roles.includes(r))) continue;
          if (!/^https?:\/\//i.test(row.target_url)) continue;
          const { visible_roles: _roles, ...publicRow } = row; shortcuts.push(publicRow);
        }
        if ((result.data || []).length < 500) break;
        if (from >= 10000) throw new Error("รายการทางลัดมากเกินขอบเขต");
      }
    }
    return reply({ ...config, browser_shortcuts: shortcuts });
  } catch { return reply({ error: "อ่านนโยบายส่วนขยายไม่สำเร็จ กรุณาลองใหม่" }, 503); }
});