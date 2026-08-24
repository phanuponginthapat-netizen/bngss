// Config bundle export/apply — lets one school export its configuration
// (CMS, settings, templates, menus) and apply it to another site from a file
// or a URL. Admin/director only. Never touches student or personnel data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

// table -> conflict target used when applying a bundle
const TEMPLATE_TABLES: Record<string, string> = {
  cms_settings: "key",
  cms_pages: "id",
  cms_menu_items: "id",
  cms_nav_menu: "id",
  cms_faqs: "id",
  cms_school_info: "id",
  form_templates: "id",
  eform_templates: "id",
  print_templates: "id",
  pdf_templates: "id",
  assessment_criteria: "id",
  role_notification_defaults: "id",
  dashboard_shortcuts: "id",
  browser_shortcuts: "id",
  budget_categories: "id",
  duty_locations: "id",
  exercise_catalog: "id",
  food_catalog: "id",
  garbage_items: "id",
  garbage_rewards: "id",
  fitness_rewards: "id",
};

// only exported for scope=full (still configuration, not personal data)
const FULL_EXTRA: Record<string, string> = {
  school_settings: "setting_key",
  academic_periods: "id",
  subjects: "id",
  classrooms: "id",
};

const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const admin = makeAdmin();
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: any) => ["admin", "director"].includes(String(r.role)))) {
      return json({ error: "forbidden — เฉพาะผู้ดูแลระบบ" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "export");

    if (action === "export") {
      const scope = body?.scope === "full" ? "full" : "template";
      const spec = scope === "full" ? { ...TEMPLATE_TABLES, ...FULL_EXTRA } : TEMPLATE_TABLES;
      const content: Record<string, any[]> = {};

      for (const table of Object.keys(spec)) {
        try {
          const rows: any[] = [];
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await admin.from(table).select("*").range(from, from + PAGE - 1);
            if (error) throw new Error(error.message);
            rows.push(...(data || []));
            if ((data || []).length < PAGE) break;
          }
          content[table] = rows;
        } catch {
          // table not present in this deployment — skip silently
        }
      }

      const bundle = {
        version: `${scope}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`,
        scope,
        exported_at: new Date().toISOString(),
        conflict_targets: spec,
        content,
      };

      await admin.from("config_bundles").insert({
        version: bundle.version,
        content: { scope, tables: Object.fromEntries(Object.entries(content).map(([k, v]) => [k, v.length])) },
        status: "exported",
        applied_by: uid,
        notes: `export ${scope}`,
      });

      return json(bundle);
    }

    if (action === "apply") {
      let bundle = body?.bundle;
      const sourceUrl = body?.url ? String(body.url) : null;

      if (!bundle && sourceUrl) {
        if (!/^https:\/\//i.test(sourceUrl)) return json({ error: "URL ต้องเป็น https" }, 400);
        const res = await fetch(sourceUrl);
        if (!res.ok) return json({ error: `ดึงไฟล์ไม่สำเร็จ: HTTP ${res.status}` }, 400);
        bundle = await res.json();
      }
      if (!bundle?.content || typeof bundle.content !== "object") {
        return json({ error: "bundle ไม่ถูกต้อง" }, 400);
      }

      const spec: Record<string, string> = { ...TEMPLATE_TABLES, ...FULL_EXTRA, ...(bundle.conflict_targets || {}) };
      const applied: Record<string, any> = {};
      let failed = 0;

      for (const [table, rowsRaw] of Object.entries(bundle.content as Record<string, any[]>)) {
        if (!spec[table]) { applied[table] = "skipped (ไม่อยู่ในรายการที่อนุญาต)"; continue; }
        const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
        if (rows.length === 0) { applied[table] = 0; continue; }
        try {
          for (let i = 0; i < rows.length; i += 200) {
            const { error } = await admin.from(table)
              .upsert(rows.slice(i, i + 200), { onConflict: spec[table] });
            if (error) throw new Error(error.message);
          }
          applied[table] = rows.length;
        } catch (e) {
          failed++;
          applied[table] = `error: ${String(e).slice(0, 200)}`;
        }
      }

      await admin.from("config_bundles").insert({
        version: String(bundle.version || "unknown"),
        source_url: sourceUrl,
        content: applied,
        status: failed ? "applied_with_errors" : "applied",
        applied_at: new Date().toISOString(),
        applied_by: uid,
      });

      return json({ ok: failed === 0, failed, applied });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
