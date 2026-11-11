import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { safeVisit } from "../_shared/extensionPolicy.ts";
Deno.serve(async (req) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return reply({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return reply({ error: "บริการยังไม่พร้อม" }, 503);
  const db = createClient(url, key, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return reply({ error: "Unauthorized" }, 401);
  let visit;
  try {
    const text = await req.text();
    if (text.length > 12000) return reply({ error: "ข้อมูลยาวเกินไป" }, 413);
    visit = safeVisit(JSON.parse(text));
  } catch { return reply({ error: "ข้อมูลประวัติไม่ถูกต้อง" }, 400); }
  const result = await db.from("browser_logs").insert({ ...visit, user_id: data.user.id, user_agent: req.headers.get("user-agent")?.slice(0, 512) || null });
  if (result.error) return reply({ error: "บันทึกประวัติไม่สำเร็จ" }, 503);
  return reply({ ok: true });
});