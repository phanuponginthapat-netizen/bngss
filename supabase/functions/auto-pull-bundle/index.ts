// Auto-pull bundle from upstream URL and apply via system-update logic.
// Triggered by pg_cron every 6 hours, or manually by admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersWithCronAndMethods as corsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_SUFFIXES = [
  ".supabase.co", ".supabase.in",
  ".lovable.app", ".lovable.dev",
  ".githubusercontent.com", ".github.io",
];

function isAllowedUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.includes(":") || host.startsWith("[")) return false;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    return ALLOWED_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, srv);

    // Auth: allow cron secret OR admin/director JWT
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    let isAuthorized = !!(cronSecret && provided && provided === cronSecret);

    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
          isAuthorized = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
        }
      }
    }
    if (!isAuthorized) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const onlyId: string | undefined = body.id;

    // Load active subscriptions
    let q = admin.from("upstream_subscription").select("*").eq("auto_pull", true);
    if (onlyId) q = admin.from("upstream_subscription").select("*").eq("id", onlyId);
    const { data: subs, error: subErr } = await q;
    if (subErr) return json({ error: subErr.message }, 500);

    const results: any[] = [];
    for (const sub of subs || []) {
      const url = sub.bundle_url as string;
      if (!isAllowedUrl(url)) {
        await admin.from("upstream_subscription").update({
          last_status: "error", last_error: "url not allowed", last_pulled_at: new Date().toISOString(),
        }).eq("id", sub.id);
        results.push({ id: sub.id, status: "error", error: "url not allowed" });
        continue;
      }

      try {
        const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        const bundle = await r.json();
        const version = bundle?.version || "";

        if (sub.last_version && sub.last_version === version) {
          await admin.from("upstream_subscription").update({
            last_status: "up_to_date", last_error: null, last_pulled_at: new Date().toISOString(),
          }).eq("id", sub.id);
          results.push({ id: sub.id, status: "up_to_date", version });
          continue;
        }

        // Inline upsert using the SAME SYNC_TABLES whitelist as system-update
        const SYNC_TABLES: { table: string; pk: string[]; sanitize?: (row: any) => any }[] = [
          { table: "school_settings", pk: ["id"] },
          { table: "cms_settings", pk: ["key"] },
          { table: "cms_pages", pk: ["slug"] },
          { table: "cms_menu_items", pk: ["id"] },
          { table: "app_secrets", pk: ["key"], sanitize: (r) => ({ key: r.key, description: r.description, category: r.category }) },
          { table: "news_posts", pk: ["id"] },
          { table: "academic_events", pk: ["id"] },
          { table: "subjects", pk: ["id"] },
          { table: "classrooms", pk: ["id"] },
          { table: "assessment_criteria", pk: ["id"] },
          { table: "subject_indicators", pk: ["id"] },
          { table: "google_chat_webhooks", pk: ["id"], sanitize: (r) => ({ id: r.id, name: r.name, category: r.category, enabled: r.enabled }) },
          { table: "district_api_keys", pk: ["id"], sanitize: (r) => ({ id: r.id, name: r.name, scopes: r.scopes, enabled: r.enabled }) },
        ];

        const report: Record<string, any> = {};
        if (!bundle?.tables) throw new Error("invalid bundle");
        for (const t of SYNC_TABLES) {
          const rows: any[] = bundle.tables[t.table];
          if (!Array.isArray(rows) || rows.length === 0) { report[t.table] = { upserted: 0 }; continue; }
          const payload = rows.map((row) => (t.sanitize ? t.sanitize(row) : row));
          const { error } = await admin.from(t.table).upsert(payload, { onConflict: t.pk.join(",") });
          report[t.table] = error ? { upserted: 0, error: error.message } : { upserted: payload.length };
        }

        const hasErr = Object.values(report).some((r: any) => r.error);
        await admin.from("config_bundles").insert({
          version: version || new Date().toISOString(),
          source_url: url,
          content: bundle,
          applied_at: new Date().toISOString(),
          status: hasErr ? "partial" : "applied",
          notes: JSON.stringify({ via: "auto-pull", report }),
        });

        await admin.from("upstream_subscription").update({
          last_version: version,
          last_status: hasErr ? "partial" : "applied",
          last_error: hasErr ? "some tables failed" : null,
          last_pulled_at: new Date().toISOString(),
        }).eq("id", sub.id);

        results.push({ id: sub.id, status: hasErr ? "partial" : "applied", version, report });
      } catch (e: any) {
        await admin.from("upstream_subscription").update({
          last_status: "error", last_error: e?.message || "pull failed", last_pulled_at: new Date().toISOString(),
        }).eq("id", sub.id);
        results.push({ id: sub.id, status: "error", error: e?.message });
      }
    }

    return json({ ok: true, results });
  } catch (e: any) {
    console.error("auto-pull-bundle error:", e);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
