// LINE Vault quota status.
// Returns the Messaging API monthly message quota and how much has been used.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";

const LINE_BASE = "https://api.line.me/v2/bot/message";

async function getVaultToken(sb: any): Promise<string | null> {
  const env = Deno.env.get("LINE_VAULT_CHANNEL_ACCESS_TOKEN")?.trim();
  if (env) return env;
  const { data } = await sb.from("app_secrets").select("value").eq("key", "LINE_VAULT_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return (data?.value as string) || null;
}

async function lineGet(path: string, token: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${LINE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text().catch(() => "");
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* ignore */ }
  return { status: res.status, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const denied = await requireCronOrAdmin(req, corsHeaders);
    if (denied) return denied;

    const sb = makeAdmin();
    const token = await getVaultToken(sb);
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "LINE_VAULT_CHANNEL_ACCESS_TOKEN not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [quota, consumption] = await Promise.all([
      lineGet("quota", token),
      lineGet("quota/consumption", token),
    ]);

    if (quota.status === 401 || consumption.status === 401) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_token", quota: quota.json, consumption: consumption.json }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const q = quota.json ?? {};
    const c = consumption.json ?? {};
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
