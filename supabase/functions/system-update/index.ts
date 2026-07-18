// System Update Bundle: export/apply config across deployments
// POST /system-update { action: "export" } -> returns bundle JSON
// POST /system-update { action: "apply", source: "url"|"inline", url?, bundle? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

// Whitelist tables that can be synced via bundles (no PII / no secret values).
// Each entry: table name + primary-key columns for upsert.
type SyncTable = { table: string; pk: string[]; sanitize?: (row: any) => any };

// TEMPLATE-SAFE: เหมือนกันทุก รร. ปลอดภัยที่จะ push ลงทุกแห่ง (default scope)
const TEMPLATE_TABLES: SyncTable[] = [
  { table: "assessment_criteria", pk: ["id"] },
  { table: "subject_indicators", pk: ["id"] },
  // app_secrets: sync แค่ key/description/category ไม่มี value
  {
    table: "app_secrets",
    pk: ["key"],
    sanitize: (r) => ({ key: r.key, description: r.description, category: r.category }),
  },
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

// SCHOOL-SPECIFIC: ของแต่ละ รร. ห้าม push ทับ — รวมเฉพาะ scope=full (สำหรับ clone ครั้งแรก)
const SCHOOL_TABLES: SyncTable[] = [
  { table: "school_settings", pk: ["id"] },
  { table: "cms_settings", pk: ["key"] },
  { table: "cms_pages", pk: ["slug"] },
  { table: "cms_menu_items", pk: ["id"] },
  { table: "news_posts", pk: ["id"] },
  { table: "academic_events", pk: ["id"] },
  { table: "subjects", pk: ["id"] },
  { table: "classrooms", pk: ["id"] },
];

const getTables = (scope: string): SyncTable[] =>
  scope === "full" ? [...TEMPLATE_TABLES, ...SCHOOL_TABLES] : TEMPLATE_TABLES;

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
      const scope = (body.scope as string) || "template";
      const tables = getTables(scope);
      const out: Record<string, any[]> = {};
      for (const t of tables) {
        const { data } = await admin.from(t.table).select("*");
        out[t.table] = (data || []).map((row: any) => (t.sanitize ? t.sanitize(row) : row));
      }
      return json({
        version: new Date().toISOString(),
        generator: "smart-school-config-bundle",
        scope,
        tables: out,
      });
    }

    if (action === "apply") {
      let bundle: any = body.bundle;
      let sourceUrl: string | null = null;
      if (!bundle && body.url) {
        // SSRF guard: only allow https:// to trusted hostnames, reject IP literals & private ranges.
        let parsed: URL;
        try { parsed = new URL(body.url); }
        catch { return json({ error: "invalid_url" }, 400); }
        if (parsed.protocol !== "https:") {
          return json({ error: "only https urls allowed" }, 400);
        }
        const host = parsed.hostname.toLowerCase();
        // Block IP-literal hosts (IPv4 / IPv6 / link-local / loopback)
        const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
        const isIPv6 = host.includes(":") || host.startsWith("[");
        const isLocal = host === "localhost" || host.endsWith(".local") || host.endsWith(".internal");
        if (isIPv4 || isIPv6 || isLocal) {
          return json({ error: "host not allowed" }, 400);
        }
        // Allow-list: only well-known trusted domains for config bundles
        const ALLOWED_SUFFIXES = [
          ".supabase.co", ".supabase.in",
          ".lovable.app", ".lovable.dev",
          ".githubusercontent.com", ".github.io",
        ];
        const allowed = ALLOWED_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
        if (!allowed) {
          return json({ error: "host not in allow-list" }, 400);
        }
        sourceUrl = parsed.toString();
        const r = await fetch(sourceUrl);
        if (!r.ok) return json({ error: `fetch failed ${r.status}` }, 400);
        bundle = await r.json();
      }
      if (!bundle || typeof bundle !== "object" || !bundle.tables) {
        return json({ error: "invalid bundle format" }, 400);
      }

      // Apply: honour bundle's own scope; default = template-safe only (never overwrite school identity)
      const applyScope = (bundle.scope as string) === "full" ? "full" : "template";
      const report: Record<string, { upserted: number; error?: string }> = {};
      for (const t of getTables(applyScope)) {
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
