// District Feed Outbox Worker — processes queued deliveries with exponential backoff.
// Trigger via cron (every 1-5 min) OR manually by admin.
// Body (optional): { id?: string } to retry a specific item; otherwise processes due batch.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";

const BATCH_SIZE = 20;

function backoffMs(attempt: number): number {
  // 30s, 2m, 8m, 30m, 2h — capped
  const base = 30_000 * Math.pow(4, Math.max(0, attempt - 1));
  return Math.min(base, 2 * 60 * 60 * 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let specificId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      specificId = body?.id ?? null;
    }
  } catch (_) { /* ignore */ }

  let query = supabase
    .from("district_feed_outbox")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (specificId) query = supabase.from("district_feed_outbox").select("*").eq("id", specificId);

  const { data: items, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: Array<{ id: string; status: string; code?: number }> = [];

  for (const item of items || []) {
    // mark sending
    await supabase.from("district_feed_outbox")
      .update({ status: "sending", last_attempt_at: new Date().toISOString() })
      .eq("id", item.id);

    let status = "failed";
    let code: number | undefined;
    let bodyText = "";
    let errMsg: string | null = null;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const apiKey = Deno.env.get("DISTRICT_HUB_API_KEY");
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      if (item.headers && typeof item.headers === "object") {
        for (const [k, v] of Object.entries(item.headers)) headers[k] = String(v);
      }
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20_000);
      const resp = await fetch(item.endpoint, {
        method: item.method || "POST",
        headers,
        body: JSON.stringify(item.payload),
        signal: controller.signal,
      });
      clearTimeout(t);
      code = resp.status;
      bodyText = (await resp.text()).slice(0, 4000);
      if (resp.ok) status = "success";
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }

    const attempts = (item.attempts || 0) + 1;
    if (status === "success") {
      await supabase.from("district_feed_outbox").update({
        status: "success",
        attempts,
        last_status_code: code,
        response_body: bodyText,
        last_error: null,
      }).eq("id", item.id);
    } else {
      const dead = attempts >= (item.max_attempts || 5);
      await supabase.from("district_feed_outbox").update({
        status: dead ? "dead" : "failed",
        attempts,
        last_status_code: code ?? null,
        last_error: errMsg ?? `HTTP ${code} ${bodyText.slice(0, 200)}`,
        response_body: bodyText,
        next_attempt_at: dead ? item.next_attempt_at : new Date(Date.now() + backoffMs(attempts)).toISOString(),
      }).eq("id", item.id);
      status = dead ? "dead" : "failed";
    }

    processed.push({ id: item.id, status, code });
  }

  return new Response(JSON.stringify({ ok: true, processed_count: processed.length, processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
