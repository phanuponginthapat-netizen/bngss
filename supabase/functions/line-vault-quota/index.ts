// LINE Vault quota status.
// Returns the Messaging API monthly message quota and how much has been used.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { getSecret } from "../_shared/getSecret.ts";
import { readLineQuota } from "../_shared/lineQuota.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const denied = await requireCronOrAdmin(req, corsHeaders);
    if (denied) return denied;

    const token = await getSecret("LINE_VAULT_CHANNEL_ACCESS_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "LINE_VAULT_CHANNEL_ACCESS_TOKEN not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quota: q, consumption: c } = await readLineQuota(token);
    const limit = typeof q.value === "number" ? q.value : null;
    const used = typeof c.totalUsage === "number" ? c.totalUsage : null;
    const quotaType = typeof q.type === "string" ? q.type : null;

    return new Response(JSON.stringify({
      ok: true,
      quota_type: quotaType ?? "limited",
      quota_limit: limit,
      total_usage: used,
      remaining: limit !== null && used !== null ? Math.max(0, limit - used) : null,
      percent_used: limit !== null && used !== null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null,
      reset: "monthly",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
