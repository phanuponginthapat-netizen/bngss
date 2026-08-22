import { corsHeadersWithCron } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { sendFcm } from "../_shared/fcmPush.ts";
import { pushOne } from "../_shared/webPush.ts";

type AbsentStudent = {
  student_id: string;
  student_name: string;
  status: string;
};

type RequestBody = {
  attendance_date: string;
  absent_students: AbsentStudent[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersWithCron });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeadersWithCron, "Content-Type": "application/json" },
      });
    }

    const authCheck = await requireCronOrAdmin(req, corsHeadersWithCron);
    if (authCheck) return authCheck;

    const body: RequestBody = await req.json();
    const { attendance_date, absent_students } = body;

    if (!attendance_date || !absent_students?.length) {
      return new Response(
        JSON.stringify({ error: "attendance_date and absent_students required" }),
        { status: 400, headers: { ...corsHeadersWithCron, "Content-Type": "application/json" } },
      );
    }

    const admin = makeAdmin();

    const studentIds = absent_students.map((s) => s.student_id);
    const { data: students, error: studentErr } = await admin
      .from("students")
      .select("id, parent_user_id, parent_user_id_2")
      .in("id", studentIds);

    if (studentErr) throw studentErr;

    const parentMap = new Map<string, string[]>();
    for (const s of students ?? []) {
      const ids: string[] = [];
      if (s.parent_user_id) ids.push(s.parent_user_id);
      if (s.parent_user_id_2) ids.push(s.parent_user_id_2);
      if (ids.length) parentMap.set(s.id, ids);
    }

    const allParentIds = [...new Set([...parentMap.values()].flat())];

    if (!allParentIds.length) {
      return new Response(
        JSON.stringify({ sent: 0, total: 0, message: "No parent user IDs found" }),
        { headers: { ...corsHeadersWithCron, "Content-Type": "application/json" } },
      );
    }

    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, provider, device_token, user_id")
      .in("user_id", allParentIds);

    if (subErr) throw subErr;

    const statusLabel = (s: string) => (s === "late" ? "มาสาย" : "ขาดเรียน");

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const notifications: Array<{
      user_id: string;
      title: string;
      body: string;
      type: string;
      severity: string;
      url: string;
      read: boolean;
    }> = [];

    for (const student of absent_students) {
      const parentIds = parentMap.get(student.student_id) ?? [];
      const label = statusLabel(student.status);

      for (const parentId of parentIds) {
        notifications.push({
          user_id: parentId,
          title: "📋 แจ้งเตือนการขาดเรียน",
          body: `${student.student_name} — ${label} วันที่ ${attendance_date}`,
          type: "attendance_absent",
          severity: "warning",
          url: "/dashboard/parent/attendance",
          read: false,
        });
      }
    }

    if (notifications.length) {
      const { error: notifErr } = await admin.from("notifications").insert(notifications);
      if (notifErr) console.error("Notification insert error:", notifErr);
    }

    const pushResults = await Promise.all(
      (subs ?? []).map(async (s: any) => {
        const isFcm = s.provider === "fcm" && !!s.device_token;

        const matchingStudent = absent_students.find((st) => {
          const pids = parentMap.get(st.student_id) ?? [];
          return pids.includes(s.user_id);
        });

        const label = matchingStudent ? statusLabel(matchingStudent.status) : "ขาดเรียน";
        const name = matchingStudent?.student_name ?? "นักเรียน";

        const payload = {
          title: "📋 แจ้งเตือนการขาดเรียน",
          body: `${name} — ${label} วันที่ ${attendance_date}`,
          url: "/dashboard/parent/attendance",
          tag: "attendance-absent",
        };

        const r = isFcm
          ? await sendFcm(s.device_token, payload)
          : await pushOne(s, payload);

        if (r.ok) {
          sent++;
        } else {
          failed++;
          if (r.gone) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
          if (r.error && errors.length < 5) {
            errors.push(`${r.status ?? "?"}: ${r.error}`);
          }
        }
      }),
    );

    return new Response(
      JSON.stringify({ sent, failed, total: subs?.length ?? 0, notifications: notifications.length, errors }),
      { headers: { ...corsHeadersWithCron, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeadersWithCron, "Content-Type": "application/json" },
    });
  }
});
