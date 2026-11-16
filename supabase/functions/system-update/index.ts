// Config bundle export/apply — lets one school export its configuration
// (CMS, settings, templates, menus) and apply it to another site from a file
// or a URL. Admin/director only. Never touches student or personnel data.
import { allowedTables, validateBundleRows } from "../_shared/bundleValidation.ts";
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
  academic_periods: "id",
  subjects: "id",
  classrooms: "id",
};

const CONFIG_FIELDS: Record<string, string[]> = {
 cms_settings: ['id','key','value','is_public'],
 cms_pages: ['id','slug','title','content','is_published','sort_order'],
 cms_menu_items: ['id','label','url','page_id','sort_order','is_visible'],
 cms_nav_menu: ['id','parent_id','label','url','icon','description','sort_order','is_published','open_in_new_tab'],
 cms_faqs: ['id','question','answer','category','sort_order','is_published'],
 cms_school_info: ['id','section_key','title','subtitle','content','cover_image','sort_order','is_published'],
 form_templates: ['id','code','title','content_html'],
 eform_templates: ['id','name','description','category','content_html','fields','page_size','font_family','font_size_pt','is_active'],
 print_templates: ['id','code','name','description','paper','orientation','margin_top','margin_right','margin_bottom','margin_left','header_html','body_html','footer_html','css','variables','sample_data','is_default','is_active','background_url','overlay_mode','source_pdf_path','source_pdf_pages','field_map','category'],
 pdf_templates: ['id','name','category','description','source_pdf_url','source_pdf_path','page_count','page_width','page_height','fields','data_schema','is_active'],
 assessment_criteria: ['id','category','title','description','academic_year','sort_order','is_active'],
 role_notification_defaults: ['id','role','category','in_app','push','line','gchat','min_severity'],
 dashboard_shortcuts: ['id','label_th','label_en','icon','logo_url','bg_class','target_url','open_in_new_tab','visible_roles','sort_order','is_active'],
 browser_shortcuts: ['id','label_th','label_en','icon','logo_url','bg_class','target_url','sort_order','is_active','visible_roles'],
 budget_categories: ['id','code','name','sort_order','description','is_active'],
 duty_locations: ['id','name','description','order_index','active'],
 exercise_catalog: ['id','name','category','met','icon','is_active'],
 food_catalog: ['id','name','category','kcal_per_serving','serving_label','protein_g','carb_g','fat_g','is_active'],
 garbage_items: ['id','name','unit','points_per_unit','is_active','description','image_url'],
 garbage_rewards: ['id','name','image_url','points_cost','stock','is_active','description'],
 fitness_rewards: ['id','name','description','image_url','cost_points','stock','is_active'],
 academic_periods: ['id','academic_year_be','semester','start_date','end_date','midterm_date','final_date','note','fix_window_open'],
 subjects: ['id','code','name_th','name_en','credits','subject_type','grade_level','semester','academic_year','hours_per_week','weight_assignment','weight_midterm','weight_final','weight_attendance','weeks_per_semester','pp5_period_dates'],
 classrooms: ['id','name','grade_level','academic_year','capacity','reference_grade_level'],
};

const PAGE = 1000;
// Hosts a config bundle may be fetched from (prevents server-side requests to arbitrary sites).
const BUNDLE_HOSTS = ["raw.githubusercontent.com", "github.com", "objects.githubusercontent.com", "bngss.online", "bngss.lovable.app"];

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
            const { data, error } = await admin.from(table).select(CONFIG_FIELDS[table].join(",")).order(spec[table]).range(from, from + PAGE - 1);
            if (error) throw new Error(error.message);
            rows.push(...(data || []));
            if ((data || []).length < PAGE) break;
          }
          content[table] = table === "cms_settings" ? rows.filter(row => row.is_public === true) : rows;
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
        let host = "";
        try { host = new URL(sourceUrl).hostname.toLowerCase(); } catch { /* invalid */ }
        const backendHost = (() => { try { return new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname; } catch { return ""; } })();
        const allowedHost = host && (host === backendHost || BUNDLE_HOSTS.some((h) => host === h || host.endsWith("." + h)));
        if (!allowedHost) return json({ error: "อนุญาตเฉพาะไฟล์จาก GitHub หรือพื้นที่เก็บไฟล์ของระบบ" }, 400);
        const res = await fetch(sourceUrl, { redirect: "error" });
        const len = Number(res.headers.get("content-length") || 0);
        if (len > 20 * 1024 * 1024) return json({ error: "ไฟล์ใหญ่เกินไป" }, 413);
        if (!res.ok) return json({ error: `ดึงไฟล์ไม่สำเร็จ: HTTP ${res.status}` }, 400);
        bundle = await res.json();
      }
      if (!bundle?.content || typeof bundle.content !== "object") {
        return json({ error: "bundle ไม่ถูกต้อง" }, 400);
      }

      const spec: Record<string, string> = { ...TEMPLATE_TABLES, ...FULL_EXTRA };
      try {
        allowedTables(Object.keys(bundle.content), spec);
        for (const [table, rows] of Object.entries(bundle.content)) {
          validateBundleRows(table, rows, CONFIG_FIELDS);
          if (table === "cms_settings" && (rows as any[]).some(row => row.is_public !== true)) throw new Error("private settings cannot be imported");
        }
      } catch { return json({ error: "นำเข้าได้เฉพาะตารางและฟิลด์การตั้งค่าที่อนุญาต" }, 400); }
      const applied: Record<string, any> = {};
      let failed = 0;

      for (const [table, rowsRaw] of Object.entries(bundle.content as Record<string, any[]>)) {
        if (!spec[table]) { applied[table] = "skipped (ไม่อยู่ในรายการที่อนุญาต)"; continue; }
        const rows = validateBundleRows(table, rowsRaw, CONFIG_FIELDS);
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
