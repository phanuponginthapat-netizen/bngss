// Send Magic Link + Install link to LINE user after successful account linking
// Triggered by line-webhook on successful link command
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ensureParentAccount } from "../_shared/parentAccount.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { authorizeCaller } from "../_shared/callerAuth.ts";

async function getSetting(sb: any, key: string): Promise<string> {
  const { data } = await sb.from("school_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value || "";
}

async function linePush(token: string, to: string, messages: any[]) {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!r.ok) console.error("LINE push failed", r.status, await r.text());
}

function buildWelcomeFlex(opts: {
  displayName: string;
  magicUrl?: string;
  installUrl: string;
  guideUrl?: string;
}) {
  const contents: any[] = [
    { type: "text", text: "🎉 เชื่อมบัญชีสำเร็จ!", weight: "bold", size: "lg", color: "#10b981" },
    { type: "text", text: opts.displayName, size: "sm", color: "#555555", wrap: true, margin: "xs" },
    { type: "separator", margin: "md" },
    {
      type: "text",
      text: "ติดตั้งแอปและเปิดแจ้งเตือน เพื่อรับข่าวสารแบบเรียลไทม์ (ฟรี ไม่จำกัด)",
      size: "xs",
      color: "#888888",
      wrap: true,
      margin: "md",
    },
  ];

  if (opts.magicUrl) {
    contents.push({
      type: "button",
      style: "primary",
      color: "#10b981",
      margin: "md",
      action: { type: "uri", label: "🔐 เข้าระบบอัตโนมัติ", uri: opts.magicUrl },
    });
  }
  contents.push({
    type: "button",
    style: opts.magicUrl ? "secondary" : "primary",
    color: opts.magicUrl ? undefined : "#2563eb",
    margin: "sm",
    action: { type: "uri", label: "📱 ติดตั้งแอปบนมือถือ", uri: opts.installUrl },
  });
  if (opts.guideUrl) {
    contents.push({
      type: "button",
      style: "link",
      margin: "sm",
      action: { type: "uri", label: "📖 คู่มือผู้ใช้", uri: opts.guideUrl },
    });
  }
  if (opts.magicUrl) {
    contents.push({
      type: "text",
      text: "💡 ลิงก์เข้าระบบหมดอายุใน 1 ชั่วโมง\nแนะนำให้เปิดในเบราว์เซอร์ (Safari/Chrome) เพื่อให้ระบบจดจำการเข้าสู่ระบบ",
      size: "xxs",
      color: "#aaaaaa",
      align: "center",
      margin: "md",
      wrap: true,
    });
  }

  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", spacing: "none", contents },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Internal only: invoked by line-webhook with the service key after a verified link.
  const caller = await authorizeCaller(req, corsHeaders, { roles: ["__internal_only__"] });
  if (caller instanceof Response) return caller;

  try {
    const body = await req.json();
    const { line_user_id, student_id, personnel_id, display_name } = body || {};

    if (!line_user_id || typeof line_user_id !== "string") {
      return new Response(JSON.stringify({ error: "missing line_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // เช็คว่าระบบเปิด magic-link ไหม (default = เปิด)
    const enabled = await getSetting(sb, "line_magic_link_enabled");
    if (enabled === "false") {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineToken = await getSetting(sb, "line_channel_access_token");
    if (!lineToken) {
      return new Response(JSON.stringify({ error: "no line token configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // site_url สำหรับสร้างลิงก์ — fallback ใช้ project domain
    const siteUrl = (
      (await getSetting(sb, "site_url")) ||
      Deno.env.get("PUBLIC_ORIGIN") ||
      Deno.env.get("APP_URL") ||
      ""
    ).replace(/\/+$/, "");
    if (!siteUrl) {
      return new Response(JSON.stringify({ error: "site_url is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const installUrl = `${siteUrl}/install?ref=line`;
    const guideUrl = `${siteUrl}/dashboard`;

    let displayLabel = display_name || "ยินดีต้อนรับ";
    let userEmail: string | null = null;

    // ----- หา user_id + email -----
    if (personnel_id) {
      const { data: p } = await sb
        .from("personnel")
        .select("user_id, email, prefix, first_name, last_name")
        .eq("id", personnel_id)
        .maybeSingle();
      // The LINE account must already be linked to this staff member's profile.
      let bound = false;
      if (p?.user_id) {
        const { data: prof } = await sb.from("profiles").select("line_user_id").eq("id", p.user_id).maybeSingle();
        bound = prof?.line_user_id === line_user_id;
      }
      if (p && bound) {
        displayLabel = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim() || displayLabel;
        if (p.user_id) {
          const { data: u } = await sb.auth.admin.getUserById(p.user_id);
          userEmail = u.user?.email || p.email || null;
        }
      }
    } else if (student_id) {
      const { data: s } = await sb
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, school_id, status, parent_user_id, parent_user_id_2, auth_user_id, line_user_id, line_user_id_2, line_user_id_3")
        .eq("id", student_id)
        .maybeSingle();
      // The LINE account must already be linked to this student record.
      const bound = !!s && [s.line_user_id, s.line_user_id_2, s.line_user_id_3].includes(line_user_id);
      if (s && bound) {
        displayLabel = `ผู้ปกครองของ ${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
        {
          // LINE registration via student_id is always the parent → parent's own account, never the student's.
          const ensured = await ensureParentAccount(sb, s);
          if (!("error" in ensured)) {
            await sb.from("profiles").update({ line_user_id }).eq("id", ensured.parentUserId).is("line_user_id", null);
            const { data: u } = await sb.auth.admin.getUserById(ensured.parentUserId);
            userEmail = u.user?.email || null;
          } else console.error("[line-magic-link] parent account", ensured.error);
        }
      }
    }

    // ----- สร้าง magic link (เฉพาะเมื่อมี email) -----
    let magicUrl: string | undefined;
    if (userEmail) {
      try {
        const { data: link, error } = await sb.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
          options: { redirectTo: `${siteUrl}/dashboard` },
        });
        if (error) {
          console.error("generateLink error", error);
        } else {
          magicUrl = (link as any)?.properties?.action_link;
        }
      } catch (e) {
        console.error("magic link failed", e);
      }
    }

    // ----- ส่ง Flex Message -----
    const flex = buildWelcomeFlex({ displayName: displayLabel, magicUrl, installUrl, guideUrl });
    await linePush(lineToken, line_user_id, [
      { type: "flex", altText: "🎉 เชื่อมบัญชีสำเร็จ — ติดตั้งแอป + เข้าระบบ", contents: flex },
    ]);

    return new Response(
      JSON.stringify({ success: true, sent_magic_link: !!magicUrl, has_email: !!userEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("line-magic-link error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
