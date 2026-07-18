import { isAuthorizedCron, unauthorized } from "../_shared/cronAuth.ts";
// รายงานการมาโรงเรียนประจำวัน — แยกระดับชั้น / ชาย-หญิง / รวมประจำวัน
// ส่งให้ admin ทุกวันเวลา 09:00 น. (Asia/Bangkok) ผ่าน pg_cron
// ผลลัพธ์: บันทึก notifications ให้ admin + ส่ง Google Chat card สวย ๆ
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRADE_ORDER = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

function bangkokToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
}

type Cell = { total: number; present: number; absent: number; late: number; leave: number };
const newCell = (): Cell => ({ total: 0, present: 0, absent: 0, late: 0, leave: 0 });

function pad(s: string | number, w: number, right = false) {
  const str = String(s);
  // นับความกว้างคร่าว ๆ (ตัวอักษรไทย ~1)
  const len = [...str].length;
  const space = " ".repeat(Math.max(0, w - len));
  return right ? space + str : str + space;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!(await isAuthorizedCron(req))) return unauthorized();


  try {
    const body = await req.json().catch(() => ({}));
    const targetDate: string = body.date || bangkokToday();
    const sendChat: boolean = body.send_chat !== false;
    const sendNotif: boolean = body.send_notification !== false;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) นักเรียน active
    const { data: students, error: stuErr } = await sb
      .from("students")
      .select("id, gender, classroom_id, classrooms(grade_level)")
      .eq("status", "active");
    if (stuErr) throw stuErr;

    // 2) attendance ของวัน
    const { data: atts, error: attErr } = await sb
      .from("attendance")
      .select("student_id, status")
      .eq("attendance_date", targetDate);
    if (attErr) throw attErr;

    // map: latest status per student (priority: present > late > leave > absent — present wins)
    const statusOf = new Map<string, string>();
    const priority: Record<string, number> = { present: 4, late: 3, leave: 2, absent: 1 };
    for (const a of (atts || []) as any[]) {
      const prev = statusOf.get(a.student_id);
      if (!prev || (priority[a.status] || 0) > (priority[prev] || 0)) {
        statusOf.set(a.student_id, a.status);
      }
    }

    // 3) จัดกลุ่ม grade x gender
    const grid = new Map<string, { male: Cell; female: Cell; other: Cell }>();
    const ensure = (g: string) => {
      if (!grid.has(g)) grid.set(g, { male: newCell(), female: newCell(), other: newCell() });
      return grid.get(g)!;
    };

    const total = newCell();
    const totalM = newCell();
    const totalF = newCell();

    for (const s of (students || []) as any[]) {
      const grade = s.classrooms?.grade_level || "ไม่ระบุ";
      const row = ensure(grade);
      const cell = s.gender === "ชาย" ? row.male : s.gender === "หญิง" ? row.female : row.other;
      const bucket = s.gender === "ชาย" ? totalM : s.gender === "หญิง" ? totalF : null;

      cell.total++; total.total++; if (bucket) bucket.total++;
      const st = statusOf.get(s.id);
      const key = st === "present" ? "present"
        : st === "late" ? "late"
        : st === "leave" ? "leave"
        : "absent";
      (cell as any)[key]++; (total as any)[key]++; if (bucket) (bucket as any)[key]++;
    }

    // 4) สร้างตาราง (เรียง grade ตาม GRADE_ORDER)
    const grades = Array.from(grid.keys()).sort((a, b) => {
      const ia = GRADE_ORDER.indexOf(a); const ib = GRADE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    // ตารางแบบ monospace สำหรับข้อความทั่วไป
    const head = `${pad("ชั้น", 8)}│${pad("ชาย", 18, true)}│${pad("หญิง", 18, true)}│${pad("รวม", 20, true)}`;
    const sub  = `${pad("",     8)}│${pad("ม/ส/ล/ข",18,true)}│${pad("ม/ส/ล/ข",18,true)}│${pad("ม/ส/ล/ข/ทั้งหมด",20,true)}`;
    const sep  = "─".repeat(8) + "┼" + "─".repeat(18) + "┼" + "─".repeat(18) + "┼" + "─".repeat(20);
    const fmtCell = (c: Cell) => `${c.present}/${c.late}/${c.leave}/${c.absent}`;
    const fmtTot  = (c: Cell) => `${c.present}/${c.late}/${c.leave}/${c.absent}/${c.total}`;

    const rows = grades.map((g) => {
      const r = grid.get(g)!;
      return `${pad(g,8)}│${pad(fmtCell(r.male),18,true)}│${pad(fmtCell(r.female),18,true)}│${pad(fmtTot({
        total: r.male.total + r.female.total + r.other.total,
        present: r.male.present + r.female.present + r.other.present,
        late: r.male.late + r.female.late + r.other.late,
        leave: r.male.leave + r.female.leave + r.other.leave,
        absent: r.male.absent + r.female.absent + r.other.absent,
      }),20,true)}`;
    });

    const grandRow = `${pad("รวม",8)}│${pad(fmtCell(totalM),18,true)}│${pad(fmtCell(totalF),18,true)}│${pad(fmtTot(total),20,true)}`;

    const dateTH = new Date(targetDate + "T00:00:00+07:00").toLocaleDateString("th-TH", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const pct = total.total > 0 ? Math.round(((total.present + total.late) / total.total) * 100) : 0;

    const tableText = ["📋 สรุปการมาโรงเรียน (มา/สาย/ลา/ขาด)",
      "```", head, sub, sep, ...rows, sep, grandRow, "```"].join("\n");

    const summary = [
      `📅 ${dateTH}`,
      `👥 นักเรียนทั้งหมด ${total.total} คน`,
      `✅ มาเรียน ${total.present + total.late} คน (${pct}%) — ตรงเวลา ${total.present} • สาย ${total.late}`,
      `🏖️ ลา ${total.leave} คน  •  ❌ ขาด ${total.absent} คน`,
      `👦 ชาย: มา ${totalM.present + totalM.late}/${totalM.total} • ขาด ${totalM.absent}`,
      `👧 หญิง: มา ${totalF.present + totalF.late}/${totalF.total} • ขาด ${totalF.absent}`,
    ].join("\n");

    const fullMessage = `${summary}\n\n${tableText}`;

    // 5) แจ้ง admin ในระบบ
    let notifCount = 0;
    if (sendNotif) {
      const { data: admins } = await sb.from("user_roles").select("user_id").in("role", ["admin","director"]);
      const ids = Array.from(new Set((admins || []).map((a: any) => a.user_id).filter(Boolean)));
      if (ids.length > 0) {
        const rows = ids.map((uid) => ({
          user_id: uid,
          title: `📊 รายงานการมาโรงเรียน ${dateTH}`,
          message: summary,
          type: "attendance_daily_report",
          reference_type: "attendance_report",
          reference_id: null,
        }));
        const { error: nErr } = await sb.from("notifications").insert(rows);
        if (!nErr) notifCount = ids.length;
      }
    }

    // 6) Google Chat
    let chatResult: any = { skipped: true };
    if (sendChat) {
      // ส่งผ่าน notify-google-chat function (Card V2 + monospace table ใน description)
      const fields: Record<string, string> = {
        "นักเรียนทั้งหมด": `${total.total} คน`,
        "มาเรียน": `${total.present + total.late} (${pct}%)`,
        "ตรงเวลา": `${total.present}`,
        "สาย": `${total.late}`,
        "ลา": `${total.leave}`,
        "ขาด": `${total.absent}`,
        "ชาย (มา/ทั้งหมด)": `${totalM.present + totalM.late}/${totalM.total}`,
        "หญิง (มา/ทั้งหมด)": `${totalF.present + totalF.late}/${totalF.total}`,
      };

      // ตารางสำหรับ Google Chat (ใช้ <font face="monospace">)
      const chatTable = `<font face="monospace">${[head, sub, sep, ...rows, sep, grandRow].join("\n")}</font>`;

      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-google-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          notification_type: "attendance_daily_report",
          title: `📊 รายงานการมาโรงเรียน ${dateTH}`,
          message: `${summary}\n\n${chatTable}`,
          department: "all",
          severity: pct >= 90 ? "success" : pct >= 75 ? "info" : "warning",
          fields,
        }),
      });
      chatResult = await resp.json().catch(() => ({ ok: resp.ok, status: resp.status }));
    }

    return new Response(JSON.stringify({
      ok: true,
      date: targetDate,
      totals: { ...total, male: totalM, female: totalF, percent: pct },
      by_grade: grades.map((g) => ({ grade: g, ...grid.get(g)! })),
      notified_admins: notifCount,
      chat: chatResult,
      preview: fullMessage,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("attendance-daily-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
