import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow } = await supabase
      .from("school_settings")
      .select("setting_value")
      .eq("setting_key", "line_channel_access_token")
      .maybeSingle();

    const token = tokenRow?.setting_value;
    if (!token) {
      return new Response(JSON.stringify({ error: "LINE token not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = { Authorization: `Bearer ${token}` };

    const [quotaRes, consumptionRes] = await Promise.all([
      fetch("https://api.line.me/v2/bot/message/quota", { headers }),
      fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers }),
    ]);

    if (!quotaRes.ok) {
      const text = await quotaRes.text();
      return new Response(JSON.stringify({ error: `LINE API error: ${text}` }), {
        status: quotaRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quota = await quotaRes.json(); // { type: "limited"|"none", value }
    const consumption = consumptionRes.ok ? await consumptionRes.json() : { totalUsage: 0 };

    // Breakdown from delivery logs (current month)
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: breakdownRaw } = await supabase
      .from("notification_delivery_log")
      .select("notification_type, status")
      .eq("channel", "line")
      .gte("created_at", monthStart.toISOString());

    const breakdown: Record<string, { sent: number; failed: number; skipped: number }> = {};
    let totals = { sent: 0, failed: 0, skipped: 0 };
    (breakdownRaw || []).forEach((r: any) => {
      const t = r.notification_type || "other";
      if (!breakdown[t]) breakdown[t] = { sent: 0, failed: 0, skipped: 0 };
      const s = (r.status === "sent" || r.status === "success") ? "sent"
              : (r.status === "failed" || r.status === "error") ? "failed" : "skipped";
      breakdown[t][s] += 1;
      totals[s] += 1;
    });

    return new Response(JSON.stringify({
      quota,                    // { type, value }
      consumption,              // { totalUsage }
      breakdown,
      totals,
      period_start: monthStart.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
