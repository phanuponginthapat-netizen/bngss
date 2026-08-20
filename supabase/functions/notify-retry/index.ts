// Periodic retry worker for transient push delivery failures.
// Scans notification_delivery_log for `failed` push rows in the last 60 minutes
// that have NOT been retried yet, and attempts one more delivery.
// Mark each processed row with `retried_at` (in the reason text) so we never retry twice.

import { pushOne } from "../_shared/webPush.ts";
import { sendFcm } from "../_shared/fcmPush.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  const admin = makeAdmin();

  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: failed } = await admin
      .from("notification_delivery_log")
      .select("id,user_id,notification_type,title,reference_id,reference_type,reason")
      .eq("channel", "push")
      .eq("status", "failed")
      .gte("created_at", since)
      .limit(200);

    if (!failed || failed.length === 0) {
      return new Response(JSON.stringify({ ok: true, retried: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter rows that have NOT already been retried (look for "retry:" marker in reason)
    const candidates = failed.filter((r: any) => !String(r.reason || "").includes("retry:"));
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, retried: 0, skipped: failed.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(candidates.map((r: any) => r.user_id).filter(Boolean))];
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,provider,device_token")
      .in("user_id", userIds);

    const subsByUser = new Map<string, any[]>();
    for (const s of subs ?? []) {
      const arr = subsByUser.get(s.user_id) || [];
      arr.push(s);
      subsByUser.set(s.user_id, arr);
    }

    let retried = 0, success = 0;
    const newLogs: any[] = [];
    const processedIds: string[] = [];

    // Look up latest matching notification row per user to recover body/url
    const refIds = [...new Set(candidates.map((r: any) => r.reference_id).filter(Boolean))];
    const { data: notifRows } = refIds.length > 0
      ? await admin.from("notifications").select("reference_id,message,type").in("reference_id", refIds)
      : { data: [] as any[] };
    const bodyByRef = new Map<string, { message: string | null; type: string | null }>();
    (notifRows ?? []).forEach((n: any) => bodyByRef.set(n.reference_id, { message: n.message, type: n.type }));

    for (const row of candidates) {
      const userSubs = subsByUser.get(row.user_id) || [];
      processedIds.push(row.id);
      const notif = row.reference_id ? bodyByRef.get(row.reference_id) : null;
      for (const s of userSubs) {
        retried++;
        const isFcm = s.provider === "fcm" && !!s.device_token;
        const payload = {
          title: row.title || "การแจ้งเตือน",
          body: notif?.message || "",
          url: "/dashboard",
          tag: row.notification_type || notif?.type || "general",
        };
        const r = isFcm ? await sendFcm(s.device_token, payload) : await pushOne(s, payload);
        if (r.ok) {
          success++;
          newLogs.push({
            user_id: row.user_id, channel: "push", status: "sent",
            reason: `retry:${row.id}`,
            notification_type: row.notification_type, title: row.title,
            reference_id: row.reference_id, reference_type: row.reference_type,
          });
        } else {
          if (r.gone) await admin.from("push_subscriptions").delete().eq("id", s.id);
          newLogs.push({
            user_id: row.user_id, channel: "push", status: r.gone ? "gone" : "dlq",
            reason: `retry:${row.id}:${r.status ?? "?"}:${(r.error ?? "").slice(0, 100)}`,
            notification_type: row.notification_type, title: row.title,
            reference_id: row.reference_id, reference_type: row.reference_type,
          });
        }
      }
      // Mark the original row as already retried (append marker to reason)
      await admin
        .from("notification_delivery_log")
        .update({ reason: `${row.reason || ""} | retry:done` })
        .eq("id", row.id);
    }

    if (newLogs.length > 0) await admin.from("notification_delivery_log").insert(newLogs);

    return new Response(
      JSON.stringify({ ok: true, processed: processedIds.length, retried, success }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
