import { isAuthorizedCron, unauthorized } from "../_shared/cronAuth.ts";
// Google Chat summary report: daily / monthly / term
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Period = "daily" | "monthly" | "term";

function bkkNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}

function rangeFor(period: Period): { from: string; to: string; label: string } {
  const now = bkkNow();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (period === "daily") {
    const day = new Date(Date.UTC(y, m, d));
    const next = new Date(Date.UTC(y, m, d + 1));
    return {
      from: day.toISOString(),
      to: next.toISOString(),
      label: `วันที่ ${day.toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}`,
    };
  }
  if (period === "monthly") {
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 1));
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `เดือน ${from.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" })}`,
    };
  }
  // term: semester 1 = May-Oct, semester 2 = Nov-Apr
  const sem = m >= 4 && m <= 9 ? 1 : 2;
  let from: Date, to: Date;
  if (sem === 1) {
    from = new Date(Date.UTC(y, 4, 1)); // May 1
    to = new Date(Date.UTC(y, 10, 1)); // Nov 1
  } else {
    const yr = m >= 10 ? y : y - 1;
    from = new Date(Date.UTC(yr, 10, 1));
    to = new Date(Date.UTC(yr + 1, 4, 1));
  }
  return { from: from.toISOString(), to: to.toISOString(), label: `ภาคเรียนที่ ${sem}/${y + 543}` };
}

async function notify(supabaseUrl: string, serviceKey: string, body: any) {
  await fetch(`${supabaseUrl}/functions/v1/notify-google-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!(await isAuthorizedCron(req))) return unauthorized();


  try {
    const { period = "daily" } = await req.json().catch(() => ({}));
    const p = (["daily", "monthly", "term"].includes(period) ? period : "daily") as Period;
    const { from, to, label } = rangeFor(p);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const count = async (table: string, col = "created_at", extra?: (q: any) => any) => {
      let q = supabase.from(table).select("*", { count: "exact", head: true }).gte(col, from).lt(col, to);
      if (extra) q = extra(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [
      att_present, att_absent, att_late, att_leave,
      beh_pos, beh_neg, face_scans,
      docs, eforms_sent, eforms_done,
      news_count, emergency_count,
      staff_leaves_req, staff_leaves_apr,
      student_leaves_req,
      ict_borrow, ict_return,
      damage_reports,
      garbage_dep, garbage_red,
    ] = await Promise.all([
      count("attendance", "created_at", (q) => q.eq("status", "present")),
      count("attendance", "created_at", (q) => q.eq("status", "absent")),
      count("attendance", "created_at", (q) => q.eq("status", "late")),
      count("attendance", "created_at", (q) => q.eq("status", "leave")),
      count("behavior_records", "created_at", (q) => q.eq("behavior_type", "positive")),
      count("behavior_records", "created_at", (q) => q.eq("behavior_type", "negative")),
      count("face_scan_logs", "created_at"),
      count("documents"),
      count("eforms"),
      count("eforms", "created_at", (q) => q.eq("status", "completed")),
      count("news_posts", "created_at", (q) => q.eq("is_published", true)),
      count("emergency_broadcasts"),
      count("staff_leaves"),
      count("staff_leaves", "created_at", (q) => q.eq("status", "approved")),
      count("student_leaves"),
      count("ict_loans", "borrowed_at"),
      count("ict_loans", "returned_at"),
      count("asset_damage_reports"),
      count("garbage_deposits"),
      count("garbage_redemptions"),
    ]);

    const periodLabel = p === "daily" ? "📅 รายงานประจำวัน" : p === "monthly" ? "📊 รายงานประจำเดือน" : "📈 รายงานประจำภาคเรียน";

    const sections: Array<{ dept: string; title: string; fields: Record<string, string> }> = [
      {
        dept: "student_affairs",
        title: `${periodLabel} • กิจการนักเรียน`,
        fields: {
          "มาเรียน": String(att_present),
          "ขาด": String(att_absent),
          "สาย": String(att_late),
          "ลา": String(att_leave),
          "พฤติกรรมดี": String(beh_pos),
          "พฤติกรรมควรปรับปรุง": String(beh_neg),
          "สแกนหน้า": String(face_scans),
          "คำขอลานักเรียน": String(student_leaves_req),
        },
      },
      {
        dept: "general_admin",
        title: `${periodLabel} • บริหารทั่วไป`,
        fields: {
          "เอกสารใหม่": String(docs),
          "E-Form ส่งออก": String(eforms_sent),
          "E-Form สำเร็จ": String(eforms_done),
          "ข่าวประกาศ": String(news_count),
          "ประกาศฉุกเฉิน": String(emergency_count),
        },
      },
      {
        dept: "hr",
        title: `${periodLabel} • บุคลากร`,
        fields: {
          "คำขอลาบุคลากร": String(staff_leaves_req),
          "อนุมัติแล้ว": String(staff_leaves_apr),
        },
      },
      {
        dept: "all",
        title: `${periodLabel} • พัสดุ/ICT/ขยะ`,
        fields: {
          "ยืม ICT": String(ict_borrow),
          "คืน ICT": String(ict_return),
          "แจ้งชำรุด": String(damage_reports),
          "ฝากขยะ": String(garbage_dep),
          "แลกของรางวัล": String(garbage_red),
        },
      },
    ];

    let sent = 0;
    for (const s of sections) {
      await notify(supabaseUrl, serviceKey, {
        notification_type: "summary",
        department: s.dept,
        title: s.title,
        message: label,
        severity: "info",
        fields: s.fields,
      });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, period: p, range: { from, to }, sections: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("gchat-summary error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
