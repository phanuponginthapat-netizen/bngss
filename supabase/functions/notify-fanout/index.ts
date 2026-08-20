// Unified fan-out notification edge function.
// One call → fans out to: in-app (notifications table), Web Push (PWA), LINE, Google Chat.
// Respects per-user notification_preferences (channel toggle, quiet hours, per-type opt-out, min severity).
// Logs every delivery to notification_delivery_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { pushOne } from "../_shared/webPush.ts";
import { sendFcm } from "../_shared/fcmPush.ts";

import { corsHeaders } from "../_shared/cors.ts";

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
  channels?: Array<"in_app" | "push" | "line" | "gchat" | "gchat_dm">;  // optional override
  // Google Chat
  gchat_categories?: string[];              // webhook categories to also post to
  fields?: Record<string, string>;          // extra key/value details rendered in the gchat card
  image_url?: string | null;                // preview image (gchat card, in-app)

  // dedup
  dedup_key?: string;                       // prevent duplicate within 60s
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, success: 0, warning: 1, critical: 2 };

type RoutingCategory =
  | "critical" | "score" | "health" | "ict" | "attendance"
  | "behavior" | "homework" | "eform" | "leave" | "news" | "other";

// LINE push messages ใช้โควตาจาก LINE OA (นับเป็น "token") ดังนั้น default
// เปิดเฉพาะประเภทที่ "ต้องรู้ทันที / ต้องดำเนินการ" เท่านั้น
// ประเภทข้อมูลทั่วไป (ข่าว/การบ้าน/คะแนน/เข้าเรียน/พฤติกรรม/สุขภาพ/ict/อื่นๆ)
// จะไม่ push ผ่าน LINE — ผู้ใช้ยังเห็นใน in-app + PWA push อยู่ และเข้ามาถาม
// บอทเมื่อไรก็ได้ผ่าน webhook reply (ไม่กินโควตา)
const DEFAULT_ROUTING: Record<"gchat" | "line", Record<RoutingCategory, boolean>> = {
  gchat: { critical: true, score: true, health: true, ict: true, attendance: true, behavior: true, homework: true, eform: true, leave: true, news: true, other: true },
  line:  { critical: true, score: false, health: false, ict: false, attendance: false, behavior: false, homework: false, eform: true, leave: true, news: false, other: false },
};

function categoryOf(type: string, severity: Severity): RoutingCategory {
  const t = (type || "").toLowerCase();
  if (severity === "critical" || t.includes("emergency")) return "critical";
  if (t.includes("grade") || t.includes("score") || t.includes("assessment")) return "score";
  if (t.includes("health") || t.includes("vaccine") || t.includes("measurement")) return "health";
  if (t.includes("ict") || t.includes("loan") || t.includes("asset")) return "ict";
  if (t.includes("attendance") || t.startsWith("face_scan")) return "attendance";
  if (t.includes("behavior")) return "behavior";
  if (t.includes("homework")) return "homework";
  if (t.includes("eform") || t.includes("document")) return "eform";
  if (t.includes("leave")) return "leave";
  if (t.includes("news")) return "news";
  return "other";
}

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    // Require authentication: either the service-role key (internal callers like
    // other edge functions / cron) or a valid authenticated user JWT.
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (token !== serviceKey) {
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = (await req.json()) as FanoutRequest;
    if (!payload?.title || !Array.isArray(payload.user_ids)) {
      return new Response(JSON.stringify({ error: "title and user_ids[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channels = new Set<string>(payload.channels ?? ["in_app", "push", "line"]);
    // Google Workspace personal DM (LINE-OA style) — auto-enabled when the service
    // account secrets exist, unless the caller explicitly listed channels without it.
    if (Deno.env.get("GOOGLE_CHAT_SA_JSON") && Deno.env.get("GOOGLE_CHAT_IMPERSONATE_USER") && !payload.channels) {
      channels.add("gchat_dm");
    }
    const type = payload.type || "notification";
    const severity: Severity = payload.severity ?? "info";
    const sevRank = SEVERITY_RANK[severity] ?? 0;
    // Critical events always fan out to Google Chat so admins/directors see them,
    // even if the caller didn't opt-in to gchat.
    if (severity === "critical") channels.add("gchat");

    // School-wide per-category routing (admin controlled). Skip channel entirely
    // when this category is disabled in school_settings.channel_category_routing.
    const category = categoryOf(type, severity);
    let routing = DEFAULT_ROUTING;
    try {
      const { data: routingRow } = await admin
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "channel_category_routing")
        .maybeSingle();
      const v = routingRow?.setting_value as any;
      if (v && typeof v === "object") {
        routing = {
          gchat: { ...DEFAULT_ROUTING.gchat, ...(v.gchat || {}) },
          line:  { ...DEFAULT_ROUTING.line,  ...(v.line  || {}) },
        };
      }
    } catch (_) { /* fall back to defaults */ }
    if (routing.gchat[category] === false) { channels.delete("gchat"); channels.delete("gchat_dm"); }
    if (channels.has("line")  && routing.line[category]  === false) channels.delete("line");

    const userIds = [...new Set(payload.user_ids.filter(Boolean))];


    // Dedup (best-effort) — auto-generate dedup_key ถ้า caller ไม่ส่งมา
    // ใช้ hash จาก type + reference + title เพื่อกันซ้ำภายใน 60 วิ
    const autoDedupKey = payload.dedup_key
      || (payload.reference_id ? `${type}:${payload.reference_type || ""}:${payload.reference_id}` : null)
      || `${type}:${payload.title}:${userIds.slice(0, 3).join(",")}`;
    if (autoDedupKey) {
      const { data: existing } = await admin
        .from("notification_delivery_log")
        .select("id")
        .eq("notification_type", type)
        .eq("reason", `dedup:${autoDedupKey}`)
        .gte("created_at", new Date(Date.now() - 60_000).toISOString())
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ deduped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load user preferences, roles, matrix, and LINE IDs in parallel.
    const [prefsRes, rolesRes, matrixRes, profileLineRes, studentLineRes] = await Promise.all([
      admin.from("notification_preferences").select("*").in("user_id", userIds),
      admin.from("user_roles").select("user_id,role").in("user_id", userIds),
      admin.from("role_notification_defaults").select("role,category,in_app,push,line,gchat,min_severity").eq("category", category),
      admin.from("profiles").select("id,line_user_id").in("id", userIds).not("line_user_id", "is", null),
      admin
        .from("students")
        .select("auth_user_id,line_user_id,line_user_id_2,line_user_id_3")
        .in("auth_user_id", userIds)
        .not("auth_user_id", "is", null),
    ]);
    const prefsMap = new Map<string, any>((prefsRes.data ?? []).map((p: any) => [p.user_id, p]));
    const roleByUser = new Map<string, string>();
    (rolesRes.data ?? []).forEach((r: any) => {
      // ถ้าผู้ใช้มีหลาย role เก็บสิทธิ์สูงสุด (admin > director > teacher > parent > student > alumni)
      const rank: Record<string, number> = { admin: 6, director: 5, teacher: 4, parent: 3, student: 2, alumni: 1 };
      const cur = roleByUser.get(r.user_id);
      if (!cur || (rank[r.role] ?? 0) > (rank[cur] ?? 0)) roleByUser.set(r.user_id, r.role);
    });
    const matrixByRole = new Map<string, any>((matrixRes.data ?? []).map((m: any) => [m.role, m]));

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
    if (autoDedupKey) {
      logRows.push({
        user_id: null, channel: "system", status: "skipped",
        reason: `dedup:${autoDedupKey}`,
        notification_type: type, title: payload.title,
      });
    }

    let inAppCount = 0, pushCount = 0, lineCount = 0;

    // Helper: should send to a channel for this user
    // Precedence: user preference (explicit off) → role matrix default → true
    const shouldSend = (uid: string, ch: "in_app" | "push" | "line" | "gchat") => {
      // 1) Role matrix default (baseline)
      const role = roleByUser.get(uid);
      const matrix = role ? matrixByRole.get(role) : null;
      if (matrix) {
        if (ch === "in_app" && matrix.in_app === false) return false;
        if (ch === "push"   && matrix.push   === false) return false;
        if (ch === "line"   && matrix.line   === false) return false;
        if (ch === "gchat"  && matrix.gchat  === false) return false;
        const minRank = SEVERITY_RANK[(matrix.min_severity as Severity) || "info"];
        if (sevRank < minRank && severity !== "critical") return false;
      }
      // 2) Per-user preference (can further disable, cannot re-enable if matrix says off)
      const p = prefsMap.get(uid);
      if (!p) return true;
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
    // We set push_sent=true so the DB trigger (trigger_push_notification) skips
    // firing a duplicate push — this call handles push directly with the full URL.
    const willSendPush = channels.has("push");
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
          push_sent: willSendPush && shouldSend(u, "push"),
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
          .select("id,user_id,endpoint,p256dh,auth,provider,device_token")
          .in("user_id", pushUsers);
        const pushPayload = {
          title: payload.title,
          body: payload.body ?? "",
          url: payload.url ?? "/dashboard",
          tag: type,
          severity,
          urgent: severity === "critical" || severity === "warning",
        };

        // Batch push in chunks of 50 to avoid overwhelming push service / CPU spikes
        // when a single fanout targets hundreds of subscriptions.
        const PUSH_CHUNK = 50;
        const allSubs = subs ?? [];
        const goneIds: string[] = [];
        for (let i = 0; i < allSubs.length; i += PUSH_CHUNK) {
          const chunk = allSubs.slice(i, i + PUSH_CHUNK);
          await Promise.all(chunk.map(async (s: any) => {
            // FCM (Android APK) → Firebase HTTP v1; Web Push → pushOne
            const isFcm = s.provider === "fcm" && !!s.device_token;
            let r = isFcm
              ? await sendFcm(s.device_token, pushPayload)
              : await pushOne(s, pushPayload);
            if (!r.ok && !r.gone && (r.status === 429 || (r.status && r.status >= 500))) {
              await new Promise((res) => setTimeout(res, 400));
              r = isFcm
                ? await sendFcm(s.device_token, pushPayload)
                : await pushOne(s, pushPayload);
            }
            if (r.ok) {
              pushCount++;
              log(s.user_id, "push", "sent");
            } else {
              if (r.gone) goneIds.push(s.id);
              if (!r.skipped) log(s.user_id, "push", r.gone ? "gone" : "failed", `${r.status ?? "?"}: ${r.error ?? "unknown"}`);
            }
          }));
        }
        // Batch-delete dead subscriptions once instead of N deletes
        if (goneIds.length > 0) {
          try { await admin.from("push_subscriptions").delete().in("id", goneIds); } catch (_) {}
        }
      }
    }

    // 3+4) LINE + Google Chat + delivery log — run in background AFTER response.
    // In-app + Web Push (steps 1-2) already fired synchronously above, so users see
    // the notification "ปุ๊บปั๊บ" while slower channels finish out-of-band.
    const runSlowChannels = async () => {
      // LINE
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
          const lineBody: string = (() => {
            const parts: string[] = [payload.body || payload.title];
            if (payload.fields) {
              const entries = Object.entries(payload.fields).filter(([, v]) => v != null && String(v).length > 0);
              if (entries.length > 0) parts.push(entries.map(([k, v]) => `• ${k}: ${v}`).join("\n"));
            }
            return parts.join("\n\n");
          })();
          const doPost = () => fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-line`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
            },
            body: JSON.stringify({
              message: lineBody,
              title: payload.title,
              line_user_ids: uniqueLineIds,
              notification_type: type,
              severity,
              use_flex: true,
              action_url: payload.url ?? undefined,
              action_label: payload.url ? "เปิดดู" : undefined,
            }),
          });
          try {
            let res = await doPost();
            if (!res.ok && (res.status === 429 || res.status >= 500)) {
              await new Promise((r) => setTimeout(r, 500));
              res = await doPost();
            }
            const lineResult = await res.json().catch(() => null);
            if (res.ok) {
              if (lineResult?.message === "LINE notifications are disabled") {
                lineRecipients.forEach((entry) => log(entry.user_id, "line", "skipped", "LINE notifications disabled"));
              } else {
                const sent = Number(lineResult?.sent ?? uniqueLineIds.length) || 0;
                lineRecipients.forEach((entry) => log(entry.user_id, "line", sent > 0 ? "sent" : "skipped", sent > 0 ? undefined : "LINE sent 0 recipients"));
              }
            } else {
              const text = typeof lineResult === "string" ? lineResult : JSON.stringify(lineResult);
              lineRecipients.forEach((entry) => log(entry.user_id, "line", "failed", `status:${res.status} ${text}`.slice(0, 200)));
            }
          } catch (e: any) {
            lineRecipients.forEach((entry) => log(entry.user_id, "line", "failed", e?.message));
          }
        }
      }

      // Google Chat
      if (channels.has("gchat")) {
        const categories = payload.gchat_categories && payload.gchat_categories.length > 0
          ? [...new Set(payload.gchat_categories)]
          : ["all"];
        await Promise.all(categories.map(async (dept) => {
          try {
            const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-google-chat`, {
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
                image_url: payload.image_url,
                department: dept,
                fields: payload.fields,
                reference_id: payload.reference_id,
                reference_table: payload.reference_type,
              }),
            });
            log(null, "gchat", res.ok ? "sent" : "failed", res.ok ? `dept:${dept}` : `dept:${dept} status:${res.status}`);
          } catch (e: any) {
            log(null, "gchat", "failed", `dept:${dept} ${e?.message}`);
          }
        }));
      }

      // Google Chat personal DM (Workspace users) — respects the same per-user gchat preference
      if (channels.has("gchat_dm")) {
        const dmUsers = userIds.filter((u) => shouldSend(u, "gchat"));
        if (dmUsers.length > 0) {
          try {
            const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-google-chat-dm`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
              },
              body: JSON.stringify({
                user_ids: dmUsers,
                title: payload.title,
                message: payload.body || payload.title,
                notification_type: type,
                severity,
                url: payload.url,
                image_url: payload.image_url,
                fields: payload.fields,
              }),
            });
            const out = await res.json().catch(() => ({}));
            const sent = Number(out?.sent ?? 0);
            dmUsers.forEach((u) =>
              log(u, "gchat", res.ok && sent > 0 ? "sent" : "skipped", res.ok ? `dm sent:${sent}` : `dm status:${res.status}`)
            );
          } catch (e: any) {
            dmUsers.forEach((u) => log(u, "gchat", "failed", `dm ${e?.message}`));
          }
        }
      }



      if (logRows.length > 0) {
        try { await admin.from("notification_delivery_log").insert(logRows); } catch (_) {}
      }
    };

    // Deno Deploy: keep the isolate alive to finish slow channels after we respond.
    const anyRuntime = (globalThis as any).EdgeRuntime;
    if (anyRuntime?.waitUntil) {
      anyRuntime.waitUntil(runSlowChannels());
    } else {
      // Fallback for local dev without EdgeRuntime — fire and forget
      runSlowChannels().catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, recipients: userIds.length, in_app: inAppCount, push: pushCount, line_deferred: channels.has("line"), gchat_deferred: channels.has("gchat") }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

