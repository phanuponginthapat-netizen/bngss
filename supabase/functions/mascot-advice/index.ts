// Mascot speech-bubble advice — on-demand endpoint with weekly cache
// ⚡ ใช้ cache รายสัปดาห์ — ยิง AI แค่ 1 ครั้ง/คน/7 วัน เพื่อประหยัด token
// refresh แบบ batch ทำผ่าน cron `refresh-mascot-advice-weekly`
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateMascotMessages } from "../_shared/mascotAdvice.ts";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const role = body.role || "student";
    const force = !!body.force;

    const auth = req.headers.get("Authorization") || "";
    const supa = svc();
    let userId: string | null = null;
    if (auth.startsWith("Bearer ")) {
      const { data: { user } } = await supa.auth.getUser(auth.slice(7));
      userId = user?.id || null;
    }

    // 1) อ่าน cache ก่อน — ถ้ายังไม่ครบ 7 วัน → คืนเลย (ไม่แตะ AI)
    if (userId && !force) {
      const { data: cached } = await supa
        .from("mascot_advice_cache")
        .select("messages, next_refresh_at, generated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (cached && cached.next_refresh_at && new Date(cached.next_refresh_at) > new Date()) {
        return new Response(JSON.stringify({
          messages: Array.isArray(cached.messages) ? cached.messages : [],
          cached: true,
          generated_at: cached.generated_at,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 2) cache หมดอายุ/ไม่มี → เรียก AI 1 ครั้ง แล้วเก็บลง cache
    const messages = await generateMascotMessages(body, role);

    if (userId) {
      const next = new Date(Date.now() + 7 * 86400_000).toISOString();
      await supa.from("mascot_advice_cache").upsert({
        user_id: userId,
        role,
        messages,
        context_snapshot: body,
        generated_at: new Date().toISOString(),
        next_refresh_at: next,
      }, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({ messages, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ messages: [], error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
