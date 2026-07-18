// LIFF leave submission — service-role insert + ผูก lineUserId กับ student/personnel
// ผู้ใช้ LIFF ไม่ได้ sign-in Supabase Auth จึง insert ผ่าน anon client ไม่ได้ (RLS บล็อก)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeadersPost as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      leave_type,
      start_date,
      end_date,
      reason,
      attachment_url,
    } = body || {};

    if (!leave_type || !start_date || !end_date) {
      return json({ error: "missing required fields" }, 400);
    }

    // Verify LINE access token from Authorization header — derive line_user_id server-side
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!accessToken) {
      return json({ error: "missing_line_access_token" }, 401);
    }

    // Validate token audience/expiry via LINE verify endpoint
    const verifyRes = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!verifyRes.ok) {
      return json({ error: "invalid_line_access_token" }, 401);
    }
    const verifyData = await verifyRes.json().catch(() => null) as
      | { client_id?: string; expires_in?: number }
      | null;
    if (!verifyData || typeof verifyData.expires_in !== "number" || verifyData.expires_in <= 0) {
      return json({ error: "invalid_line_access_token" }, 401);
    }
    const expectedChannelId = Deno.env.get("LINE_LIFF_CHANNEL_ID") || Deno.env.get("LINE_LOGIN_CHANNEL_ID") || "";
    if (expectedChannelId && verifyData.client_id && verifyData.client_id !== expectedChannelId) {
      return json({ error: "invalid_line_access_token_audience" }, 401);
    }

    // Derive the LINE user id from the verified token (never trust client-supplied value)
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return json({ error: "invalid_line_access_token" }, 401);
    }
    const profile = await profileRes.json().catch(() => null) as { userId?: string } | null;
    const line_user_id = profile?.userId || "";
    if (!/^U[0-9a-f]{32}$/i.test(line_user_id)) {
      return json({ error: "invalid_line_user_id" }, 401);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) หา student ตาม lineUserId (3 slot) — แยก query ละ slot กัน filter-injection
    const { data: students } = await sb
      .from("students")
      .select("id, prefix, first_name, last_name, classroom_id, line_user_id, line_user_id_2, line_user_id_3")
      .or(
        `line_user_id.eq.${line_user_id},line_user_id_2.eq.${line_user_id},line_user_id_3.eq.${line_user_id}`,
      )
      .limit(1);

    const student = students?.[0];

    if (student) {
      const { data: stl, error } = await sb
        .from("student_leaves")
        .insert({
          student_id: student.id,
          leave_type,
          start_date,
          end_date,
          reason: reason || null,
          attachment_url: attachment_url || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 400);

      // แจ้งเตือน admin/director/teacher ผ่าน notify-fanout
      await fanout(sb, {
        roles: ["admin", "director", "teacher"],
        title: `📩 ใบลานักเรียน: ${student.prefix || ""}${student.first_name} ${student.last_name}`,
        body: `${leave_type} • ${start_date} ถึง ${end_date}`,
        type: "student_leave",
        severity: "info",
        reference_id: stl?.id,
        reference_type: "student_leaves",
        url: "/dashboard/student/leave",
      });

      return json({ ok: true, kind: "student", id: stl?.id });
    }

    // 2) staff path — หา personnel จาก line_user_id ผ่าน profiles
    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .eq("line_user_id", line_user_id)
      .maybeSingle();
    const { data: per } = prof
      ? await sb.from("personnel").select("id, first_name, last_name").eq("user_id", prof.id).maybeSingle()
      : { data: null as any };

    if (!per) return json({ error: "ยังไม่ได้ผูกบัญชี LINE กับนักเรียน/บุคลากร" }, 403);

    const { data: stl, error } = await sb
      .from("staff_leaves")
      .insert({
        personnel_id: per.id,
        leave_type,
        start_date,
        end_date,
        reason: reason || null,
        attachment_url: attachment_url || null,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 400);

    await fanout(sb, {
      roles: ["admin", "director"],
      title: `📩 ใบลาบุคลากร: ${per.first_name || ""} ${per.last_name || ""}`.trim(),
      body: `${leave_type} • ${start_date} ถึง ${end_date}`,
      type: "staff_leave",
      severity: "info",
      reference_id: stl?.id,
      reference_type: "staff_leaves",
      url: "/dashboard/hr/leave",
    });

    return json({ ok: true, kind: "staff", id: stl?.id });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fanout(sb: any, payload: any) {
  try {
    // หา user_ids ตาม role
    const { data: roleRows } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", payload.roles);
    const userIds = [...new Set((roleRows ?? []).map((r: any) => r.user_id))].filter(Boolean);
    if (!userIds.length) return;

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-fanout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
      body: JSON.stringify({
        user_ids: userIds,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        severity: payload.severity,
        reference_id: payload.reference_id,
        reference_type: payload.reference_type,
        url: payload.url,
      }),
    });
  } catch (e) {
    console.error("fanout failed", e);
  }
}
