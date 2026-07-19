import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { getLineToken } from "../_shared/lineApi.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = makeAdmin();

    // AuthN + AuthZ: admin/director only
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("director")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getLineToken(supabase);
    if (!token) {
      // Graceful: return empty quota so UI can render a "not configured" state
      return new Response(JSON.stringify({
        configured: false,
        quota: { type: "none", value: 0 },
        consumption: { totalUsage: 0 },
        breakdown: {},
        totals: { sent: 0, failed: 0, skipped: 0 },
        period_start: new Date().toISOString(),
        message: "ยังไม่ได้ตั้งค่า LINE Channel Access Token",
      }), {
        status: 200,
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
      return new Response(JSON.stringify({
        configured: false,
        quota: { type: "none", value: 0 },
        consumption: { totalUsage: 0 },
        breakdown: {},
        totals: { sent: 0, failed: 0, skipped: 0 },
        period_start: new Date().toISOString(),
        message: `LINE token ไม่ถูกต้องหรือหมดอายุ (${quotaRes.status}): ${text}`,
      }), {
        status: 200,
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
