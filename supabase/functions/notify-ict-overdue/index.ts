import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { fanout } from "../_shared/fanout.ts";

import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: loans, error } = await sb
      .from("ict_loans")
      .select("id, device_id, student_id, personnel_id, expected_return_at, borrowed_at, ict_devices(name), students(prefix,first_name,last_name,auth_user_id), personnel(prefix,first_name,last_name,user_id)")
      .eq("status", "active")
      .lt("expected_return_at", new Date().toISOString())
      .is("overdue_notified_at", null)
      .limit(500);
    if (error) throw error;

    // Pre-load admin/director/teacher recipients once
    const { data: admins } = await sb.from("user_roles").select("user_id").in("role", ["admin", "director", "teacher"]);
    const adminIds = [...new Set((admins ?? []).map((r: any) => r.user_id))].filter(Boolean);

    let notified = 0;
    for (const l of loans || []) {
      const stu: any = (l as any).students;
      const per: any = (l as any).personnel;
      const dev: any = (l as any).ict_devices;
      const borrowerUid = stu?.auth_user_id || per?.user_id || null;
      const borrowerName = stu
        ? `${stu.prefix || ""}${stu.first_name} ${stu.last_name}`
        : per
        ? `${per.prefix || ""}${per.first_name} ${per.last_name}`
        : "ผู้ยืม";
      const dueStr = new Date(l.expected_return_at).toLocaleDateString("th-TH");

      // Notify borrower (warning severity → multi-channel)
      if (borrowerUid) {
        await fanout({
          user_ids: [borrowerUid],
          title: "⏰ ครบกำหนดคืนอุปกรณ์ ICT",
          body: `กรุณาคืน "${dev?.name || "อุปกรณ์"}" โดยด่วน (กำหนด ${dueStr})`,
          type: "ict_loan",
          severity: "warning",
          reference_type: "ict_loan",
          reference_id: l.id,
          url: "/dashboard/hr/ict",
          dedup_key: `ict-overdue-borrower-${l.id}`,
        });
      }

      // Notify admins (in-app only — quieter)
      if (adminIds.length > 0) {
        await fanout({
          user_ids: adminIds,
          title: "⏰ มีอุปกรณ์ ICT เกินกำหนดคืน",
          body: `${borrowerName} ยังไม่คืน "${dev?.name || "อุปกรณ์"}" (กำหนด ${dueStr})`,
          type: "ict_loan",
          severity: "info",
          reference_type: "ict_loan",
          reference_id: l.id,
          url: "/dashboard/hr/ict",
          channels: ["in_app"],
          dedup_key: `ict-overdue-admin-${l.id}`,
        });
      }

      await sb.from("ict_loans").update({ overdue_notified_at: new Date().toISOString() }).eq("id", l.id);
      notified++;
    }

    return new Response(JSON.stringify({ ok: true, notified, total: loans?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
