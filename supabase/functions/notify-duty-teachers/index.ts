// Notifies duty teachers of tomorrow's duty schedule.
// Runs daily via pg_cron. Sends via notify-fanout (in-app + push + LINE + gchat)
// and also emails through send-transactional-email when available.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { bkkDateISO } from "../_shared/thaiDate.ts";

const DOW_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // "mode" = today | tomorrow (default = tomorrow at evening cron)
  let mode: "today" | "tomorrow" = "tomorrow";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === "today") mode = "today";
  } catch { /* ignore */ }

  const now = new Date();
  const target = new Date(now);
  if (mode === "tomorrow") target.setDate(target.getDate() + 1);
  const iso = bkkDateISO(target);
  const dow = target.getDay();

  // fetch duty for target date OR matching day_of_week (weekly template)
  const { data: assigns, error } = await supabase
    .from("duty_assignments")
    .select("id, teacher_id, start_time, end_time, role_label, duty_date, day_of_week, duty_locations(name), personnel:teacher_id(first_name,last_name,email,user_id)")
    .or(`duty_date.eq.${iso},and(duty_date.is.null,day_of_week.eq.${dow})`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // group per teacher
  const byUser = new Map<string, { name: string; email?: string | null; items: string[] }>();
  for (const a of (assigns ?? []) as any[]) {
    const p = a.personnel;
    if (!p?.user_id) continue;
    const line = `• ${a.duty_locations?.name ?? "-"} ${a.start_time ?? ""}${a.end_time ? `–${a.end_time}` : ""}${a.role_label ? ` (${a.role_label})` : ""}`;
    const entry = byUser.get(p.user_id) ?? { name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), email: p.email, items: [] };
    entry.items.push(line);
    byUser.set(p.user_id, entry);
  }

  const label = mode === "today" ? "วันนี้" : "พรุ่งนี้";
  const dateLabel = `${label} (${DOW_TH[dow]} ${iso})`;

  let notified = 0;
  let emailed = 0;

  for (const [userId, info] of byUser) {
    const body = `ตารางเวร${dateLabel}:\n${info.items.join("\n")}`;

    // 1) fan-out (in-app + push + LINE)
    try {
      await supabase.functions.invoke("notify-fanout", {
        body: {
          user_ids: [userId],
          title: `แจ้งเตือนครูเวร${label}`,
          body,
          type: "duty_schedule",
          severity: "info",
          url: "/dashboard/admin/duty-teachers",
          dedup_key: `duty_${mode}_${iso}_${userId}`,
          channels: ["in_app", "push", "line"],
        },
      });
      notified++;
    } catch (e) {
      console.error("fanout failed", userId, e);
    }

    // 2) email (best-effort, template optional)
    if (info.email) {
      try {
        const res = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "duty-schedule-notice",
            recipientEmail: info.email,
            idempotencyKey: `duty-${mode}-${iso}-${userId}`,
            templateData: {
              name: info.name,
              dateLabel,
              items: info.items,
            },
          },
        });
        if (!res.error) emailed++;
      } catch (e) {
        console.warn("email failed (template may not exist)", e);
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, mode, date: iso, teachers: byUser.size, notified, emailed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
