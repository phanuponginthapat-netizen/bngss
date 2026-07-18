// Unified fan-out notification edge function.
// One call → fans out to: in-app (notifications table), Web Push (PWA), LINE, Google Chat.
// Respects per-user notification_preferences (channel toggle, quiet hours, per-type opt-out, min severity).
// Logs every delivery to notification_delivery_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { pushOne } from "../_shared/webPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "success" | "warning" | "critical";
type LinePrefKey = "face_scan_alerts" | "attendance_alerts" | "behavior_alerts" | "grade_alerts" | "news_alerts";

interface FanoutRequest {
  user_ids: string[];                       // recipients (in-app + push + LINE)
  title: string;
  body?: string;
  type?: string;                            // homework | eform | leave | news | substitute | ...
  severity?: Severity;
  reference_id?: string | null;
  reference_type?: string | null;
  url?: string | null;                      // deep link (e.g. /dashboard/inbox)
  channels?: Array<"in_app" | "push" | "line" | "gchat">;  // optional override
  // Google Chat
  gchat_categories?: string[];              // webhook categories to also post to
  // dedup
  dedup_key?: string;                       // prevent duplicate within 60s
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, success: 0, warning: 1, critical: 2 };

function getLinePrefKey(type: string): LinePrefKey | null {
  const normalized = type.toLowerCase();
  if (normalized.startsWith("face_scan")) return "face_scan_alerts";
  if (normalized.includes("attendance")) return "attendance_alerts";
  if (normalized.includes("behavior")) return "behavior_alerts";
  if (normalized === "news" || normalized.startsWith("news_")) return "news_alerts";
  if (normalized.includes("grade") || normalized.includes("score")) return "grade_alerts";
  return null;
}

function addLineIds(map: Map<string, string[]>, userId: string | null | undefined, candidates: Array<string | null | undefined>) {
  if (!userId) return;
  const existing = new Set(map.get(userId) ?? []);
  candidates.forEach((candidate) => {
    if (typeof candidate === "string" && candidate.trim()) existing.add(candidate.trim());
  });
  if (existing.size > 0) map.set(userId, Array.from(existing));
}

function inQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  // Bangkok time
  const bkk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const cur = bkk.getHours() * 60 + bkk.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  // wraps midnight
  return cur >= s || cur < e;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = (await req.json()) as FanoutRequest;
    if (!payload?.title || !Array.isArray(payload.user_ids)) {
      return new Response(JSON.stringify({ error: "title and user_ids[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: LINE push is intentionally OFF by default to save LINE Messaging API quota/tokens.
    // Reactive replies still go out via the line-webhook chatbot (free).
    // Callers may still opt-in per call by passing `channels: [..., "line"]`.
    const channels = new Set(payload.channels ?? ["in_app", "push"]);
    const type = payload.type || "notification";
    const severity: Severity = payload.severity ?? "info";
    const sevRank = SEVERITY_RANK[severity] ?? 0;

    const userIds = [...new Set(payload.user_ids.filter(Boolean))];

    // Dedup (best-effort)
    if (payload.dedup_key) {
      const { data: existing } = await admin
        .from("notification_delivery_log")
        .select("id")
        .eq("notification_type", type)
        .eq("reason", `dedup:${payload.dedup_key}`)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ deduped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load user preferences and resolve LINE IDs from the actual linked profile/student records.
    const [prefsRes, profileLineRes, studentLineRes] = await Promise.all([
      admin.from("notification_preferences").select("*").in("user_id", userIds),
      admin.from("profiles").select("id,line_user_id").in("id", userIds).not("line_user_id", "is", null),
      admin
        .from("students")
        .select("auth_user_id,line_user_id,line_user_id_2,line_user_id_3")
        .in("auth_user_id", userIds)
        .not("auth_user_id", "is", null),
    ]);
    const prefsMap = new Map<string, any>((prefsRes.data ?? []).map((p: any) => [p.user_id, p]));
    const lineIdsByUser = new Map<string, string[]>();
    (profileLineRes.data ?? []).forEach((row: any) => {
      addLineIds(lineIdsByUser, row.id, [row.line_user_id]);
    });
    (studentLineRes.data ?? []).forEach((row: any) => {
      addLineIds(lineIdsByUser, row.auth_user_id, [row.line_user_id, row.line_user_id_2, row.line_user_id_3]);
    });

    const allResolvedLineIds = [...new Set(Array.from(lineIdsByUser.values()).flat())];
    const linePrefKey = getLinePrefKey(type);
    const linePrefsRes = allResolvedLineIds.length > 0
      ? await admin.from("line_user_preferences").select("*").in("line_user_id", allResolvedLineIds)
      : { data: [] as any[] };
    const linePrefMap = new Map<string, any>((linePrefsRes.data ?? []).map((p: any) => [p.line_user_id, p]));

    const logRows: any[] = [];
    const log = (user_id: string | null, channel: string, status: string, reason?: string) => {
      logRows.push({
        user_id, channel, status,
        reason: reason ?? null,
        notification_type: type,
        title: payload.title,
        reference_id: payload.reference_id ?? null,
        reference_type: payload.reference_type ?? null,
      });
    };

    // For dedup marker
    if (payload.dedup_key) {
      logRows.push({
        user_id: null, channel: "system", status: "skipped",
        reason: `dedup:${payload.dedup_key}`,
        notification_type: type, title: payload.title,
      });
    }

    let inAppCount = 0, pushCount = 0, lineCount = 0;

    // Helper: should send to a channel for this user
    const shouldSend = (uid: string, ch: "in_app" | "push" | "line") => {
      const p = prefsMap.get(uid);
      if (!p) return true; // default on
      const override = (p.type_overrides as Record<string, boolean> | null)?.[type];
      if (override === false) return false;
      if (ch === "in_app" && p.in_app_enabled === false) return false;
      if (ch === "push") {
        if (p.push_enabled === false) return false;
        const minRank = SEVERITY_RANK[(p.min_push_severity as Severity) || "info"];
        if (sevRank < minRank) return false;
        if (inQuietHours(p.quiet_hours_start, p.quiet_hours_end) && severity !== "critical") return false;
      }
      if (ch === "line") {
        if (p.line_enabled === false) return false;
        if (inQuietHours(p.quiet_hours_start, p.quiet_hours_end) && severity !== "critical") return false;
      }
      return true;
    };

    // 1) In-app inserts (batch)
    if (channels.has("in_app")) {
      const rows = userIds
        .filter((u) => shouldSend(u, "in_app"))
        .map((u) => ({
          user_id: u,
          title: payload.title,
          message: payload.body ?? null,
          type,
          reference_id: payload.reference_id ?? null,
          reference_type: payload.reference_type ?? null,
        }));
      if (rows.length > 0) {
        const { error } = await admin.from("notifications").insert(rows);
        if (error) {
          userIds.forEach((u) => log(u, "in_app", "failed", error.message));
        } else {
          inAppCount = rows.length;
          rows.forEach((r) => log(r.user_id, "in_app", "sent"));
        }
      }
    }

    // 2) Push (per user) — with 1 retry on 429/5xx
    if (channels.has("push")) {
      const pushUsers = userIds.filter((u) => shouldSend(u, "push"));
      if (pushUsers.length > 0) {
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth")
          .in("user_id", pushUsers);
        const pushPayload = {
          title: payload.title,
          body: payload.body ?? "",
          url: payload.url ?? "/dashboard",
          tag: type,
        };
        await Promise.all((subs ?? []).map(async (s: any) => {
          let r = await pushOne(s, pushPayload);
          // retry once on transient failure
          if (!r.ok && !r.gone && (r.status === 429 || (r.status && r.status >= 500))) {
            await new Promise((res) => setTimeout(res, 400));
            r = await pushOne(s, pushPayload);
          }
          if (r.ok) {
            pushCount++;
            log(s.user_id, "push", "sent");
          } else {
            if (r.gone) await admin.from("push_subscriptions").delete().eq("id", s.id);
            log(s.user_id, "push", r.gone ? "gone" : "failed", `${r.status ?? "?"}: ${r.error ?? "unknown"}`);
          }
        }));
      }
    }

    // 3) LINE — forward to notify-line with line_user_ids
    if (channels.has("line")) {
      const lineRecipients = userIds
        .filter((u) => shouldSend(u, "line"))
        .map((u) => {
          const line_user_ids = (lineIdsByUser.get(u) ?? []).filter((lineUserId) => {
            if (!linePrefKey) return true;
            const prefs = linePrefMap.get(lineUserId);
            return prefs?.[linePrefKey] !== false;
          });
          return { user_id: u, line_user_ids };
        })
        .filter((entry) => entry.line_user_ids.length > 0);
      const usersWithoutLineLink = userIds
        .filter((u) => shouldSend(u, "line"))
        .filter((u) => (lineIdsByUser.get(u) ?? []).length === 0);
      usersWithoutLineLink.forEach((u) => log(u, "line", "skipped", "no linked LINE account"));

      if (lineRecipients.length > 0) {
        const uniqueLineIds = [...new Set(lineRecipients.flatMap((entry) => entry.line_user_ids))];
        try {
          const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-line`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            },
            body: JSON.stringify({
              message: payload.body || payload.title,
              title: payload.title,
              line_user_ids: uniqueLineIds,
              notification_type: type,
              severity,
              use_flex: true,
              action_url: payload.url ?? undefined,
              action_label: payload.url ? "เปิดดู" : undefined,
            }),
          });
          const lineResult = await res.json().catch(() => null);
          if (res.ok) {
            if (lineResult?.message === "LINE notifications are disabled") {
              lineRecipients.forEach((entry) => log(entry.user_id, "line", "skipped", "LINE notifications disabled"));
            } else {
              lineCount = Number(lineResult?.sent ?? uniqueLineIds.length) || 0;
              lineRecipients.forEach((entry) => log(entry.user_id, "line", lineCount > 0 ? "sent" : "skipped", lineCount > 0 ? undefined : "LINE sent 0 recipients"));
            }
          } else {
            const text = typeof lineResult === "string" ? lineResult : JSON.stringify(lineResult);
            lineRecipients.forEach((entry) => log(entry.user_id, "line", "failed", text.slice(0, 200)));
          }
        } catch (e: any) {
          lineRecipients.forEach((entry) => log(entry.user_id, "line", "failed", e?.message));
        }
      }
    }

    // 4) Google Chat (department-based broadcast)
    if (channels.has("gchat")) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-google-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({
            title: payload.title,
            message: payload.body || payload.title,
            notification_type: type,
            severity,
            url: payload.url,
            department: payload.gchat_categories?.[0] || "all",
            reference_id: payload.reference_id,
            reference_table: payload.reference_type,
          }),
        });
        log(null, "gchat", "sent");
      } catch (e: any) {
        log(null, "gchat", "failed", e?.message);
      }
    }

    // Write logs (non-blocking semantics OK)
    if (logRows.length > 0) {
      await admin.from("notification_delivery_log").insert(logRows);
    }

    return new Response(
      JSON.stringify({ ok: true, recipients: userIds.length, in_app: inAppCount, push: pushCount, line: lineCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
