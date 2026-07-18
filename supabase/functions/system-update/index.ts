// System Update Bundle: export/apply config across deployments
// POST /system-update { action: "export" } -> returns bundle JSON
// POST /system-update { action: "apply", source: "url"|"inline", url?, bundle? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Whitelist tables that can be synced via bundles (no PII / no secret values).
// Each entry: table name + primary-key columns for upsert.
const SYNC_TABLES: { table: string; pk: string[]; sanitize?: (row: any) => any }[] = [
  { table: "school_settings", pk: ["id"] },
  { table: "cms_settings", pk: ["key"] },
  { table: "cms_pages", pk: ["slug"] },
  { table: "cms_menu_items", pk: ["id"] },
  // app_secrets: sync only key/description/category — never values
  {
    table: "app_secrets",
    pk: ["key"],
    sanitize: (r) => ({ key: r.key, description: r.description, category: r.category }),
  },
  // News & content
  { table: "news_posts", pk: ["id"] },
  { table: "academic_events", pk: ["id"] },
  // Academic structure
  { table: "subjects", pk: ["id"] },
  { table: "classrooms", pk: ["id"] },
  { table: "assessment_criteria", pk: ["id"] },
  { table: "subject_indicators", pk: ["id"] },
  // Integrations meta (no secret values)
  {
    table: "google_chat_webhooks",
    pk: ["id"],
    sanitize: (r) => ({ id: r.id, name: r.name, category: r.category, enabled: r.enabled }),
  },
  {
    table: "district_api_keys",
    pk: ["id"],
    sanitize: (r) => ({ id: r.id, name: r.name, scopes: r.scopes, enabled: r.enabled }),
  },
];

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Auth: must be admin/director
    const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "director");
    if (!ok) return json({ error: "forbidden" }, 403);

    const admin = createClient(supaUrl, srv);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "export") {
      const out: Record<string, any[]> = {};
      for (const t of SYNC_TABLES) {
        const { data } = await admin.from(t.table).select("*");
        out[t.table] = (data || []).map((row: any) => (t.sanitize ? t.sanitize(row) : row));
      }
      return json({
        version: new Date().toISOString(),
        generator: "smart-school-config-bundle",
        tables: out,
      });
    }

    if (action === "apply") {
      let bundle: any = body.bundle;
      let sourceUrl: string | null = null;
      if (!bundle && body.url) {
        sourceUrl = String(body.url);
        // SSRF guard: only allow https URLs to public hosts; block private/link-local ranges.
        let parsed: URL;
        try { parsed = new URL(sourceUrl); } catch { return json({ error: "invalid url" }, 400); }
        if (parsed.protocol !== "https:") return json({ error: "only https urls allowed" }, 400);
        const host = parsed.hostname.toLowerCase();
        const blockedHost =
          host === "localhost" ||
          host.endsWith(".local") ||
          host.endsWith(".internal") ||
          /^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
          /^::1$|^fc|^fd|^fe80/i.test(host) ||
          /^\[/.test(host); // raw IPv6 literal
        if (blockedHost) return json({ error: "host not allowed" }, 400);
        const r = await fetch(sourceUrl, { redirect: "error" });
        if (!r.ok) return json({ error: `fetch failed ${r.status}` }, 400);
        bundle = await r.json();
      }
      if (!bundle || typeof bundle !== "object" || !bundle.tables) {
        return json({ error: "invalid bundle format" }, 400);
      }

      const report: Record<string, { upserted: number; error?: string }> = {};
      for (const t of SYNC_TABLES) {
        const rows: any[] = bundle.tables[t.table];
        if (!Array.isArray(rows)) continue;
        const payload = rows.map((r) => (t.sanitize ? t.sanitize(r) : r));
        if (payload.length === 0) { report[t.table] = { upserted: 0 }; continue; }
        try {
          const { error } = await admin.from(t.table).upsert(payload, { onConflict: t.pk.join(",") });
          report[t.table] = error ? { upserted: 0, error: error.message } : { upserted: payload.length };
        } catch (e) {
          report[t.table] = { upserted: 0, error: (e as Error)?.message || "upsert_failed" };
        }
      }

      await admin.from("config_bundles").insert({
        version: bundle.version || new Date().toISOString(),
        source_url: sourceUrl,
        content: bundle,
        applied_at: new Date().toISOString(),
        applied_by: user.id,
        status: Object.values(report).some((r) => r.error) ? "partial" : "applied",
        notes: JSON.stringify(report),
      });

      return json({ ok: true, report });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("system-update error:", e);
    return json({ error: (e as Error)?.message || "internal_error" }, 500);
  }
});
