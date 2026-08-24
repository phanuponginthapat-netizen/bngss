// Fallback error sink for the web client when direct insert into error_logs is
// blocked by RLS (e.g. anonymous visitors). Never throws back to the caller.
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").slice(0, 2000);
    if (!message) return json({ ok: false, reason: "empty message" });

    const admin = makeAdmin();

    // Resolve the caller (optional — anonymous errors are still recorded)
    let userId: string | null = null;
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(auth.slice(7));
      userId = data?.user?.id ?? null;
    }

    const { error } = await admin.from("error_logs").insert({
      message,
      stack: body?.stack ? String(body.stack).slice(0, 8000) : null,
      component_stack: body?.componentStack ? String(body.componentStack).slice(0, 8000) : null,
      source: String(body?.source ?? "client").slice(0, 100),
      url: body?.url ? String(body.url).slice(0, 1000) : null,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      context: body?.context ?? null,
      user_id: userId,
    });
    if (error) return json({ ok: false, reason: error.message });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, reason: String(e) });
  }
});
