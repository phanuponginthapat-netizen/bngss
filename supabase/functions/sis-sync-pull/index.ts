import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = makeAdmin();
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).maybeSingle();
      if (!role || !["admin","director"].includes((role as any).role)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: queue, error } = await admin.from("sis_sync_queue").select("*").eq("direction","inbound").eq("status","pending").limit(100);
    if (error) throw error;
    let processed = 0, failed = 0;
    for (const item of (queue as any[]) || []) {
      try {
        await admin.from("sis_sync_queue").update({ status: "processing" }).eq("id", item.id);
        const p = item.payload || {};
        if (item.entity_type === "student") {
          const dmc = p.dmc || p;
          // dmc is array from XLSX: map to students columns if possible
          if (Array.isArray(dmc) && dmc.length >= 5) {
            const [student_code, school_code, prefix, first_name, last_name] = dmc;
            if (student_code) {
              await admin.from("students").upsert({ student_code: String(student_code), prefix: prefix || "", first_name: first_name || "", last_name: last_name || "", school_code: school_code || null } as any, { onConflict: "student_code" });
            }
          } else if (p.student_code) {
            await admin.from("students").upsert(p as any, { onConflict: "student_code" });
          }
        } else if (item.entity_type === "staff") {
          if (p.employee_code) await admin.from("personnel").upsert(p as any, { onConflict: "employee_code" });
        }
        await admin.from("sis_sync_queue").update({ status: "completed", processed_at: new Date().toISOString(), error_message: null }).eq("id", item.id);
        processed++;
      } catch (e: any) {
        await admin.from("sis_sync_queue").update({ status: "failed", error_message: String(e?.message || e) }).eq("id", item.id);
        failed++;
      }
    }
    return new Response(JSON.stringify({ processed, failed, total: queue?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
