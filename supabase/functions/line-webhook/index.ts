import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getSecret } from "../_shared/getSecret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ SETTINGS ============

async function getLineSettings(sb: any): Promise<Record<string, string>> {
  const { data } = await sb.from("school_settings").select("setting_key, setting_value").like("setting_key", "line_%");
  const map: Record<string, string> = {};
  data?.forEach((d: any) => { map[d.setting_key] = d.setting_value || ""; });
  return map;
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    return base64Encode(sig as ArrayBuffer) === signature;
  } catch { return false; }
}

// ============ LINE API ============

// Map replyToken → lineUserId so we can push-fallback if reply token is invalid
// (e.g. LINE OA auto-reply already consumed it, or >30s elapsed)
const replyTokenToUser = new Map<string, string>();
function rememberReplyToken(rt: string, uid: string) {
  if (!rt || !uid) return;
  replyTokenToUser.set(rt, uid);
  setTimeout(() => replyTokenToUser.delete(rt), 60_000);
}

// Track users whose reply tokens are being intercepted by LINE OA auto-reply.
// After 1 failure, we skip the reply API entirely for that user for 10 minutes
// and use push directly — eliminates the broken-quick-reply loop.
const pushOnlyUsers = new Map<string, number>();
const processedEventKeys = new Map<string, number>();
function shouldPushOnly(uid: string): boolean {
  const exp = pushOnlyUsers.get(uid);
  if (!exp) return false;
  if (Date.now() > exp) { pushOnlyUsers.delete(uid); return false; }
  return true;
}
function markPushOnly(uid: string) { pushOnlyUsers.set(uid, Date.now() + 10 * 60_000); }

function rememberProcessedEvent(eventKey: string) {
  processedEventKeys.set(eventKey, Date.now() + 10 * 60_000);
}

function hasProcessedEvent(eventKey: string): boolean {
  const exp = processedEventKeys.get(eventKey);
  if (!exp) return false;
  if (Date.now() > exp) {
    processedEventKeys.delete(eventKey);
    return false;
  }
  return true;
}

async function lineReply(token: string, replyToken: string, messages: any[]) {
  try {
    const hasQr = messages.some((m: any) => m && m.quickReply);
    if (!hasQr && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last && typeof last === "object") last.quickReply = qrDefault;
    }
  } catch { /* noop */ }

  const uid = replyTokenToUser.get(replyToken);

  // If this user's reply tokens are being intercepted, go straight to push.
  if (uid && shouldPushOnly(uid)) {
    try { await linePush(token, uid, messages); }
    catch (e) { console.error("Push (push-only mode) failed", e); }
    return;
  }

  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("LINE reply error", res.status, errText, "uid=", uid || "?");
    if (uid && (res.status === 400 || res.status === 410)) {
      console.warn("Falling back to push for", uid, "— enabling push-only for 10 min");
      markPushOnly(uid);
      try { await linePush(token, uid, messages); } catch (e) { console.error("Push fallback failed", e); }
    }
  }
}

async function linePush(token: string, to: string, messages: any[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) console.error("LINE push error", res.status, await res.text());
}

async function linkRichMenuToUser(token: string, lineUserId: string, richMenuId: string) {
  if (!richMenuId) return;
  try {
    await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/richmenu/${richMenuId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) { console.error("linkRichMenu failed", e); }
}

const replyText = (token: string, rt: string, text: string, quickReply?: any) =>
  lineReply(token, rt, [{ type: "text", text, ...(quickReply ? { quickReply } : {}) }]);

const replyFlex = (token: string, rt: string, altText: string, contents: any, quickReply?: any) =>
  lineReply(token, rt, [{ type: "flex", altText, contents, ...(quickReply ? { quickReply } : {}) }]);

// ============ QUICK REPLIES BY ROLE ============

const qrParent = {
  items: [
    { type: "action", action: { type: "message", label: "📊 คะแนน", text: "ผลการเรียน" } },
    { type: "action", action: { type: "message", label: "✅ เข้าเรียน", text: "การเข้าเรียน" } },
    { type: "action", action: { type: "message", label: "📚 การบ้าน", text: "การบ้าน" } },
    { type: "action", action: { type: "message", label: "📝 สอบ", text: "สอบ" } },
    { type: "action", action: { type: "message", label: "✏️ ลา", text: "ลา" } },
    { type: "action", action: { type: "message", label: "⭐ พฤติกรรม", text: "พฤติกรรม" } },
    { type: "action", action: { type: "message", label: "🏥 สุขภาพ", text: "สุขภาพ" } },
    { type: "action", action: { type: "message", label: "🍱 อาหาร", text: "อาหาร" } },
    { type: "action", action: { type: "message", label: "📅 ตาราง", text: "ตาราง" } },
    { type: "action", action: { type: "message", label: "❓ เมนู", text: "เมนู" } },
  ],
};

const qrTeacher = {
  items: [
    { type: "action", action: { type: "message", label: "🚩 เช็คเข้าแถว", text: "เช็คเข้าแถว" } },
    { type: "action", action: { type: "message", label: "🕐 เช็ครายคาบ", text: "เช็ครายคาบ" } },
    { type: "action", action: { type: "message", label: "📚 วิชาฉัน", text: "วิชาฉัน" } },
    { type: "action", action: { type: "message", label: "📊 สรุปห้อง", text: "สรุปห้อง" } },
    { type: "action", action: { type: "message", label: "📅 ตารางวันนี้", text: "ตารางวันนี้" } },
    { type: "action", action: { type: "message", label: "📝 การบ้าน", text: "การบ้านฉัน" } },
    { type: "action", action: { type: "message", label: "⭐ บันทึก", text: "บันทึก" } },
    { type: "action", action: { type: "message", label: "🔁 สอนแทน", text: "สอนแทน" } },
    { type: "action", action: { type: "message", label: "✏️ ลา", text: "ลา" } },
    { type: "action", action: { type: "message", label: "📋 อนุมัติลา", text: "อนุมัติลา" } },
    { type: "action", action: { type: "message", label: "❓ เมนู", text: "เมนู" } },
  ],
};

const qrAdmin = {
  items: [
    { type: "action", action: { type: "message", label: "📊 ภาพรวม", text: "ภาพรวม" } },
    { type: "action", action: { type: "message", label: "📋 ลารออนุมัติ", text: "ลารออนุมัติ" } },
    { type: "action", action: { type: "message", label: "📰 ข่าวรอเผยแพร่", text: "ข่าวรอเผยแพร่" } },
    { type: "action", action: { type: "message", label: "👥 ผู้ใช้", text: "ผู้ใช้" } },
    { type: "action", action: { type: "message", label: "📣 ประกาศ", text: "ประกาศ" } },
    { type: "action", action: { type: "message", label: "📅 ตาราง", text: "ตาราง" } },
    { type: "action", action: { type: "message", label: "❓ เมนู", text: "เมนู" } },
  ],
};

const qrDefault = {
  items: [
    { type: "action", action: { type: "message", label: "🔗 เชื่อมบัญชี", text: "เชื่อม" } },
    { type: "action", action: { type: "message", label: "📰 ข่าว", text: "ข่าว" } },
    { type: "action", action: { type: "message", label: "📞 ติดต่อ", text: "ติดต่อ" } },
    { type: "action", action: { type: "message", label: "❓ เมนู", text: "เมนู" } },
  ],
};

function qrFor(userType?: string, isAdmin?: boolean) {
  if (isAdmin) return qrAdmin;
  if (userType === "teacher") return qrTeacher;
  if (userType === "student") return qrParent;
  return qrDefault;
}

// ============ FLEX BUILDERS ============

function buildInfoCard(title: string, items: { label: string; value: string }[], color = "#1DB446", footerAction?: any): any {
  const bubble: any = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: color, paddingAll: "16px",
      contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true }],
    },
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: items.length > 0 ? items.map((it) => ({
        type: "box", layout: "horizontal",
        contents: [
          { type: "text", text: it.label, size: "sm", color: "#666666", flex: 4, wrap: true },
          { type: "text", text: it.value, size: "sm", color: "#111111", flex: 6, align: "end", wrap: true },
        ],
      })) : [{ type: "text", text: "ไม่มีข้อมูล", size: "sm", color: "#999999" }],
    },
  };
  if (footerAction) {
    bubble.footer = { type: "box", layout: "vertical", contents: [footerAction] };
  }
  return bubble;
}

function buildListCard(title: string, items: string[], color = "#27ACB2"): any {
  return {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: color, paddingAll: "16px",
      contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true }],
    },
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: items.length > 0
        ? items.slice(0, 12).map((t, i) => ({ type: "text", text: `${i + 1}. ${t}`, size: "sm", color: "#333333", wrap: true }))
        : [{ type: "text", text: "ไม่มีข้อมูล", size: "sm", color: "#999999" }],
    },
  };
}

function buildCarousel(bubbles: any[]) { return { type: "carousel", contents: bubbles.slice(0, 10) }; }

// ============ SPIDER-WEB SYNC ============

async function syncLineUserIdAcross(sb: any, lineUserId: string, opts: { studentId?: string; profileId?: string }) {
  const { studentId, profileId } = opts;
  if (studentId) {
    const { data: s } = await sb.from("students").select("auth_user_id").eq("id", studentId).maybeSingle();
    if (s?.auth_user_id) await sb.from("profiles").update({ line_user_id: lineUserId }).eq("id", s.auth_user_id);
  }
  if (profileId) {
    const { data: s } = await sb.from("students").select("id").eq("auth_user_id", profileId).eq("status", "active").maybeSingle();
    if (s) await sb.from("students").update({ line_user_id: lineUserId }).eq("id", s.id);
  }
}

async function clearLineUserIdEverywhere(sb: any, lineUserId: string) {
  await Promise.all([
    sb.from("students").update({ line_user_id: null }).eq("line_user_id", lineUserId),
    sb.from("students").update({ line_user_id_2: null }).eq("line_user_id_2", lineUserId),
    sb.from("students").update({ line_user_id_3: null }).eq("line_user_id_3", lineUserId),
    sb.from("profiles").update({ line_user_id: null }).eq("line_user_id", lineUserId),
    sb.from("line_sessions").delete().eq("line_user_id", lineUserId),
  ]);
}

// ============ LOOKUP ============

async function findLinkedUser(sb: any, lineUserId: string) {
  // Try as student in any of 3 slots
  const { data: students } = await sb
    .from("students")
    .select("id, student_code, prefix, first_name, last_name, classroom_id, auth_user_id, line_user_id, line_user_id_2, line_user_id_3, classrooms(name)")
    .or(`line_user_id.eq.${lineUserId},line_user_id_2.eq.${lineUserId},line_user_id_3.eq.${lineUserId}`)
    .eq("status", "active")
    .limit(1);
  const student = students?.[0];
  if (student) return { type: "student" as const, ...student };

  // Try as teacher/staff via profile
  const { data: profile } = await sb
    .from("profiles")
    .select("id, employee_code, first_name, last_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (profile) {
    const { data: personnel } = await sb
      .from("personnel")
      .select("id, prefix, position, department")
      .eq("user_id", profile.id)
      .maybeSingle();
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", profile.id);
    const roleList: string[] = (roles || []).map((r: any) => r.role);
    const isAdmin = roleList.some((r) => ["admin", "director", "super_admin"].includes(r));
    return { type: "teacher" as const, ...profile, prefix: personnel?.prefix, position: personnel?.position, department: personnel?.department, personnel_id: personnel?.id, roles: roleList, isAdmin };
  }
  return null;
}

// ============ SESSION ============

async function getSession(sb: any, lineUserId: string) {
  try { await sb.rpc("cleanup_expired_line_sessions"); } catch { /* ignore */ }
  const { data } = await sb.from("line_sessions").select("*").eq("line_user_id", lineUserId).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await sb.from("line_sessions").delete().eq("line_user_id", lineUserId);
    return null;
  }
  return data;
}

async function setSession(sb: any, lineUserId: string, intent: string, step: string, payload: any) {
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await sb.from("line_sessions").upsert({ line_user_id: lineUserId, intent, step, payload, expires_at }, { onConflict: "line_user_id" });
  if (error) { console.error("[setSession] failed", { uid: lineUserId, intent, step, error }); throw error; }
  console.log("[setSession]", { uid: lineUserId, intent, step });
}

async function clearSession(sb: any, lineUserId: string) {
  const { error } = await sb.from("line_sessions").delete().eq("line_user_id", lineUserId);
  if (error) throw error;
}

// ============ DOB NORMALIZE (for link command) ============

function normalizeDob(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // DDMMYYYY พ.ศ. (8 หลัก ไม่มีขีด) — รูปแบบหลัก
  const ddmmyyyy = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (ddmmyyyy) {
    const d = +ddmmyyyy[1], m = +ddmmyyyy[2], y = +ddmmyyyy[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = +iso[1], m = +iso[2], d = +iso[3];
    const yy = y > 2400 ? y - 543 : y;
    return `${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    const yy = y > 2400 ? y - 543 : y;
    if (m < 1 || m > 12) return null;
    return `${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  return null;
}
const dobMatches = (stored: any, given: string) => {
  const n = normalizeDob(given);
  return n && stored && String(stored).slice(0,10) === n;
};

// ============ LINK / UNLINK ============

async function handleLinkCommand(sb: any, token: string, rt: string, code: string, dobInput: string | null, lineUserId: string, richMenus: Record<string,string>) {
  if (!dobInput) {
    return replyText(token, rt, `🔐 ต้องยืนยันตัวตนด้วยวันเกิด (พ.ศ. 8 หลัก)\n\nรูปแบบ: เชื่อม [รหัส] [ววดดปปปป]\nเช่น:\n• เชื่อม 12345 12052553`, qrDefault);
  }
  if (!normalizeDob(dobInput)) {
    return replyText(token, rt, `❌ รูปแบบวันเกิดไม่ถูกต้อง\nใช้ ววดดปปปป (พ.ศ. 8 หลัก) เช่น 12052553`, qrDefault);
  }

  const existing = await findLinkedUser(sb, lineUserId);
  if (existing) {
    const name = existing.type === "student"
      ? `${existing.prefix || ""}${existing.first_name} ${existing.last_name}`
      : `${existing.first_name || ""} ${existing.last_name || ""}`.trim();
    return replyText(token, rt, `ℹ️ LINE ของคุณเชื่อมกับ ${name} อยู่แล้ว\nพิมพ์ "ยกเลิก" ก่อน หากต้องการเปลี่ยน`, qrFor(existing.type));
  }

  // Try student
  const { data: student } = await sb
    .from("students")
    .select("id, student_code, prefix, first_name, last_name, date_of_birth, classrooms(name)")
    .eq("student_code", code.trim())
    .eq("status", "active")
    .maybeSingle();

  if (student) {
    if (!dobMatches(student.date_of_birth, dobInput))
      return replyText(token, rt, `🔐 วันเกิดไม่ตรงกับข้อมูลในระบบ`, qrDefault);
    const { data: slot, error } = await sb.rpc("link_line_to_student_slot", { _student_id: student.id, _line_user_id: lineUserId });
    if (error) return replyText(token, rt, `⚠️ ${error.message || "ครบ 3 บัญชีแล้ว"}`);
    if (slot === 1 || slot === 0) await syncLineUserIdAcross(sb, lineUserId, { studentId: student.id });
    if (richMenus.line_richmenu_parent) await linkRichMenuToUser(token, lineUserId, richMenus.line_richmenu_parent);

    const name = `${student.prefix || ""}${student.first_name} ${student.last_name}`;
    // ส่ง magic link + install link ผ่าน push แยก (best-effort, ไม่ block reply)
    sb.functions.invoke("line-magic-link", {
      body: { line_user_id: lineUserId, student_id: student.id, display_name: `ผู้ปกครองของ ${name}` },
    }).catch((e: any) => console.error("magic-link invoke fail", e));

    return replyFlex(token, rt, `เชื่อมบัญชีสำเร็จ - ${name}`,
      buildInfoCard("✅ เชื่อมบัญชีสำเร็จ", [
        { label: "ชื่อ", value: name },
        { label: "รหัส", value: student.student_code },
        { label: "ห้อง", value: (student as any).classrooms?.name || "-" },
      ], "#10b981"), qrParent);
  }

  // Try personnel/profile
  const { data: personnel } = await sb
    .from("personnel")
    .select("id, employee_code, prefix, first_name, last_name, user_id, position")
    .eq("employee_code", code.trim())
    .eq("status", "active")
    .maybeSingle();
  if (personnel?.user_id) {
    const { data: prof } = await sb.from("profiles").select("id, line_user_id, date_of_birth").eq("id", personnel.user_id).maybeSingle();
    if (prof) {
      if (prof.line_user_id && prof.line_user_id !== lineUserId)
        return replyText(token, rt, `⚠️ รหัส ${code} ถูกใช้กับ LINE อื่นแล้ว`);
      if (!dobMatches(prof.date_of_birth, dobInput))
        return replyText(token, rt, `🔐 วันเกิดไม่ตรงกับข้อมูลในระบบ`);
      await sb.from("profiles").update({ line_user_id: lineUserId }).eq("id", prof.id);
      await syncLineUserIdAcross(sb, lineUserId, { profileId: prof.id });
      if (richMenus.line_richmenu_teacher) await linkRichMenuToUser(token, lineUserId, richMenus.line_richmenu_teacher);

      const name = `${personnel.prefix || ""}${personnel.first_name} ${personnel.last_name}`;
      sb.functions.invoke("line-magic-link", {
        body: { line_user_id: lineUserId, personnel_id: personnel.id, display_name: name },
      }).catch((e: any) => console.error("magic-link invoke fail", e));

      return replyFlex(token, rt, `เชื่อมสำเร็จ - ${name}`,
        buildInfoCard("✅ เชื่อมบัญชีสำเร็จ", [
          { label: "ชื่อ", value: name },
          { label: "รหัส", value: personnel.employee_code || "-" },
          ...(personnel.position ? [{ label: "ตำแหน่ง", value: personnel.position }] : []),
        ], "#6C5CE7"), qrTeacher);
    }
  }

  return replyText(token, rt, `❌ ไม่พบรหัส "${code}" ในระบบ\nกรุณาตรวจสอบรหัสนักเรียน/บุคลากรอีกครั้ง`, qrDefault);
}

async function handleUnlinkCommand(sb: any, token: string, rt: string, lineUserId: string, richMenus: Record<string,string>) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user) return replyText(token, rt, `ℹ️ ไม่พบบัญชีที่เชื่อมไว้`, qrDefault);
  await clearLineUserIdEverywhere(sb, lineUserId);
  if (richMenus.line_richmenu_default) await linkRichMenuToUser(token, lineUserId, richMenus.line_richmenu_default);
  await replyText(token, rt, `✅ ยกเลิกการเชื่อมบัญชีแล้ว`, qrDefault);
}

// ============ LEAVE FLOW (Conversation) ============

async function startLeaveFlow(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user) return replyText(token, rt, `❌ ต้องเชื่อมบัญชีก่อนถึงจะส่งใบลาได้`, qrDefault);
  await setSession(sb, lineUserId, "leave", "type", { userType: user.type, userId: user.id, personnelId: (user as any).personnel_id });
  await replyText(token, rt, `📝 ส่งใบลา (ขั้น 1/5)\nเลือกประเภทการลา`, {
    items: [
      { type: "action", action: { type: "message", label: "🤒 ลาป่วย", text: "ป่วย" } },
      { type: "action", action: { type: "message", label: "📋 ลากิจ", text: "กิจ" } },
      { type: "action", action: { type: "message", label: "🌴 ลาพักผ่อน", text: "พักผ่อน" } },
      { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
    ],
  });
}

function todayPlus(d: number) {
  const t = new Date(); t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
}

async function continueLeaveFlow(sb: any, token: string, rt: string, lineUserId: string, session: any, text: string) {
  const t = text.trim();
  if (/^(ยกเลิก|cancel)$/i.test(t)) {
    await clearSession(sb, lineUserId);
    return replyText(token, rt, `❌ ยกเลิกการส่งใบลาแล้ว`, qrFor(session.payload?.userType));
  }

  if (session.step === "type") {
    const typeMap: Record<string,string> = { "ป่วย": "ลาป่วย", "กิจ": "ลากิจ", "พักผ่อน": "ลาพักผ่อน", "อื่นๆ": "ลาอื่นๆ" };
    const leaveType = typeMap[t] || t;
    await setSession(sb, lineUserId, "leave", "start_date", { ...session.payload, leave_type: leaveType });
    return replyText(token, rt, `📝 ส่งใบลา (ขั้น 2/5)\nวันที่เริ่มลา? (YYYY-MM-DD หรือเลือก)`, {
      items: [
        { type: "action", action: { type: "message", label: "วันนี้", text: todayPlus(0) } },
        { type: "action", action: { type: "message", label: "พรุ่งนี้", text: todayPlus(1) } },
        { type: "action", action: { type: "message", label: "มะรืน", text: todayPlus(2) } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "start_date") {
    const n = normalizeDob(t);
    if (!n) return replyText(token, rt, `❌ วันที่ไม่ถูกต้อง ลองใหม่ (เช่น 2026-05-20 หรือ 20/05/2569)`);
    await setSession(sb, lineUserId, "leave", "end_date", { ...session.payload, start_date: n });
    return replyText(token, rt, `📝 ส่งใบลา (ขั้น 3/5)\nวันที่สิ้นสุด?`, {
      items: [
        { type: "action", action: { type: "message", label: "วันเดียวกัน", text: n } },
        { type: "action", action: { type: "message", label: "วันถัดไป", text: todayPlus(1) } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "end_date") {
    const n = normalizeDob(t);
    if (!n) return replyText(token, rt, `❌ วันที่ไม่ถูกต้อง ลองใหม่`);
    if (n < session.payload.start_date) return replyText(token, rt, `❌ วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่ม`);
    await setSession(sb, lineUserId, "leave", "reason", { ...session.payload, end_date: n });
    return replyText(token, rt, `📝 ส่งใบลา (ขั้น 4/5)\nเหตุผลการลา? (พิมพ์ข้อความสั้นๆ)`, {
      items: [{ type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } }],
    });
  }

  if (session.step === "reason") {
    if (t.length < 3) return replyText(token, rt, `❌ กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร`);
    await setSession(sb, lineUserId, "leave", "attachment", { ...session.payload, reason: t });
    return replyText(token, rt, `📝 ส่งใบลา (ขั้น 5/5)\n📎 แนบใบรับรองแพทย์/หลักฐาน (ส่งรูปหรือไฟล์) หรือพิมพ์ "ข้าม" เพื่อข้าม`, {
      items: [
        { type: "action", action: { type: "message", label: "⏭️ ข้าม", text: "ข้าม" } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "attachment") {
    // Text path: ข้าม = no attachment, anything else asks to upload or skip
    if (/^(ข้าม|skip|ไม่มี)$/i.test(t)) {
      await setSession(sb, lineUserId, "leave", "confirm", session.payload);
      return showLeaveConfirm(sb, token, rt, lineUserId, session.payload);
    }
    return replyText(token, rt, `📎 กรุณาส่งรูป/ไฟล์ที่ต้องการแนบ หรือพิมพ์ "ข้าม"`, {
      items: [
        { type: "action", action: { type: "message", label: "⏭️ ข้าม", text: "ข้าม" } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "confirm") {
    if (!/^(ยืนยัน|confirm|ok|ใช่)$/i.test(t)) return replyText(token, rt, `พิมพ์ "ยืนยัน" เพื่อส่ง หรือ "ยกเลิก"`);
    const p = session.payload;
    const isStudent = p.userType === "student";
    let insertError: any = null;

    if (isStudent) {
      const { error } = await sb.from("student_leaves").insert({
        student_id: p.userId,
        leave_type: p.leave_type,
        start_date: p.start_date,
        end_date: p.end_date,
        reason: p.reason,
        attachment_url: p.attachment_url || null,
        status: "pending",
      });
      insertError = error;
    } else {
      if (!p.personnelId) {
        await clearSession(sb, lineUserId);
        return replyText(token, rt, `❌ ไม่พบข้อมูลบุคลากรของคุณ`);
      }
      const { error } = await sb.from("staff_leaves").insert({
        personnel_id: p.personnelId,
        leave_type: p.leave_type,
        start_date: p.start_date,
        end_date: p.end_date,
        reason: p.reason,
        attachment_url: p.attachment_url || null,
        status: "pending",
      });
      insertError = error;
    }

    if (insertError) {
      console.error("leave insert failed", {
        lineUserId,
        userType: p.userType,
        userId: p.userId,
        personnelId: p.personnelId,
        leaveType: p.leave_type,
        startDate: p.start_date,
        endDate: p.end_date,
        error: insertError,
      });
      return replyText(token, rt, `❌ ระบบยังไม่รับใบลานี้เข้ามา ลองกดยืนยันใหม่อีกครั้ง หรือพิมพ์ "ลา" เพื่อเริ่มใหม่`, qrFor(p.userType));
    }

    await clearSession(sb, lineUserId);
    return replyFlex(token, rt, "ส่งใบลาสำเร็จ",
      buildInfoCard("✅ ส่งใบลาแล้ว", [
        { label: "ประเภท", value: p.leave_type },
        { label: "วันที่", value: `${p.start_date} ถึง ${p.end_date}` },
        { label: "ไฟล์แนบ", value: p.attachment_url ? "✅ มี" : "—" },
        { label: "สถานะ", value: "⏳ รออนุมัติ" },
      ], "#10b981"), qrFor(p.userType));
  }
}

function showLeaveConfirm(_sb: any, token: string, rt: string, _lineUserId: string, p: any) {
  return replyFlex(token, rt, "ยืนยันการส่งใบลา",
    buildInfoCard("📝 ยืนยันใบลา", [
      { label: "ประเภท", value: p.leave_type },
      { label: "เริ่ม", value: p.start_date },
      { label: "ถึง", value: p.end_date },
      { label: "เหตุผล", value: p.reason },
      { label: "ไฟล์แนบ", value: p.attachment_url ? "✅ แนบแล้ว" : "— ไม่มี" },
    ], "#0984E3"),
    { items: [
      { type: "action", action: { type: "message", label: "✅ ยืนยันส่ง", text: "ยืนยัน" } },
      { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
    ]}
  );
}

// ============ LINE CONTENT DOWNLOAD ============

async function downloadLineContent(token: string, messageId: string): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { console.error("LINE content fetch fail", res.status); return null; }
    const mime = res.headers.get("content-type") || "application/octet-stream";
    const buf = new Uint8Array(await res.arrayBuffer());
    return { data: buf, mime };
  } catch (e) { console.error("downloadLineContent", e); return null; }
}

async function handleLeaveAttachmentMessage(sb: any, token: string, rt: string, lineUserId: string, session: any, event: any) {
  const msg = event.message;
  if (!msg || (msg.type !== "image" && msg.type !== "file" && msg.type !== "video")) {
    return replyText(token, rt, `📎 กรุณาส่งรูป/ไฟล์ หรือพิมพ์ "ข้าม"`);
  }
  const content = await downloadLineContent(token, msg.id);
  if (!content) return replyText(token, rt, `❌ ดาวน์โหลดไฟล์ไม่สำเร็จ ลองใหม่ หรือพิมพ์ "ข้าม"`);

  const ext = (() => {
    if (msg.type === "image") return content.mime.includes("png") ? "png" : "jpg";
    if (msg.type === "video") return "mp4";
    const fn = (msg.fileName as string) || "";
    const m = fn.match(/\.([a-zA-Z0-9]{1,8})$/);
    return m ? m[1].toLowerCase() : "bin";
  })();
  const userId = session.payload.userType === "student" ? session.payload.userId : (session.payload.personnelId || lineUserId);
  const path = `line/${userId}/${Date.now()}_${msg.id}.${ext}`;

  const { error: upErr } = await sb.storage.from("leave-attachments").upload(path, content.data, {
    contentType: content.mime,
    upsert: false,
  });
  if (upErr) {
    console.error("upload leave attachment fail", upErr);
    return replyText(token, rt, `❌ อัปโหลดไม่สำเร็จ ลองใหม่ หรือพิมพ์ "ข้าม"`);
  }
  const { data: signed } = await sb.storage.from("leave-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  const url = signed?.signedUrl || path;
  const newPayload = { ...session.payload, attachment_url: url, attachment_path: path };
  await setSession(sb, lineUserId, "leave", "confirm", newPayload);
  return showLeaveConfirm(sb, token, rt, lineUserId, newPayload);
}

// ============ STUDENT/PARENT COMMANDS ============

async function handleGradesCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.ที่เชื่อมบัญชีแล้ว`, qrDefault);

  const { data: enrollments } = await sb
    .from("enrollments")
    .select("subject_id, subjects(name_th, name_en, code), midterm_score, final_score, total_score, grade")
    .eq("student_id", user.id).eq("status", "active").limit(10);

  if (!enrollments?.length) return replyText(token, rt, `📊 ยังไม่มีข้อมูลผลการเรียน`, qrParent);

  const name = `${user.prefix || ""}${user.first_name} ${user.last_name}`;
  const bubbles = enrollments.map((e: any) => buildInfoCard(
    (e.subjects?.name_th || e.subjects?.name_en || "วิชา").substring(0, 30),
    [
      { label: "รหัสวิชา", value: e.subjects?.code || "-" },
      { label: "กลางภาค", value: e.midterm_score != null ? String(e.midterm_score) : "-" },
      { label: "ปลายภาค", value: e.final_score != null ? String(e.final_score) : "-" },
      { label: "รวม", value: e.total_score != null ? String(e.total_score) : "-" },
      { label: "เกรด", value: e.grade || "-" },
    ], "#6C5CE7"
  ));
  await lineReply(token, rt, [{ type: "flex", altText: `ผลการเรียน ${name}`, contents: buildCarousel(bubbles), quickReply: qrParent }]);
}

async function handleAttendanceCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);

  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const last = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`;
  const { data: rows } = await sb.from("attendance").select("status, attendance_date").eq("student_id", user.id).gte("attendance_date", first).lte("attendance_date", last);
  const c = (s: string) => rows?.filter((r: any) => r.status === s).length || 0;
  const name = `${user.prefix || ""}${user.first_name} ${user.last_name}`;
  await replyFlex(token, rt, `เข้าเรียน ${name}`,
    buildInfoCard(`📋 การเข้าเรียน เดือนนี้\n${name}`, [
      { label: "✅ มาเรียน", value: `${c("present")} วัน` },
      { label: "⏰ สาย", value: `${c("late")} วัน` },
      { label: "❌ ขาด", value: `${c("absent")} วัน` },
      { label: "🤒 ป่วย", value: `${c("sick")} วัน` },
      { label: "📋 รวม", value: `${rows?.length || 0} วัน` },
    ], "#0984E3"), qrParent);
}

async function handleBehaviorCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const { data: rs } = await sb.from("behavior_records").select("behavior_type, description, points, record_date").eq("student_id", user.id).order("record_date", { ascending: false }).limit(5);
  if (!rs?.length) return replyText(token, rt, `📋 ยังไม่มีบันทึกพฤติกรรม`, qrParent);
  const pos = rs.filter((r: any) => r.behavior_type === "positive").reduce((s: number, r: any) => s + (r.points || 0), 0);
  const neg = rs.filter((r: any) => r.behavior_type === "negative").reduce((s: number, r: any) => s + (r.points || 0), 0);
  const items = rs.map((r: any) => `${r.behavior_type === "positive" ? "✅" : "⚠️"} ${r.record_date}: ${r.description} (${r.points || 0})`);
  await replyFlex(token, rt, "พฤติกรรม", buildListCard(`⭐ พฤติกรรม +${pos} | ${neg}`, items, "#0ea5e9"), qrParent);
}

async function handleLeaveStatusCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user) return replyText(token, rt, `❌ กรุณาเชื่อมบัญชีก่อน`, qrDefault);
  if (user.type === "student") {
    const { data: leaves } = await sb.from("student_leaves").select("leave_type, start_date, end_date, status").eq("student_id", user.id).order("start_date", { ascending: false }).limit(5);
    if (!leaves?.length) return replyText(token, rt, `📋 ไม่มีประวัติการลา\n\nพิมพ์ "ลา" เพื่อส่งใบลาใหม่`, qrParent);
    const sm: Record<string,string> = { pending:"⏳", approved:"✅", rejected:"❌" };
    const items = leaves.map((l: any) => `${sm[l.status]||l.status} ${l.leave_type} ${l.start_date}-${l.end_date}`);
    return replyFlex(token, rt, "ประวัติลา", buildListCard("📋 ประวัติการลา", items, "#E17055"), qrParent);
  } else {
    const pid = (user as any).personnel_id;
    if (!pid) return replyText(token, rt, `ไม่พบข้อมูลบุคลากร`, qrTeacher);
    const { data: leaves } = await sb.from("staff_leaves").select("leave_type, start_date, end_date, status").eq("personnel_id", pid).order("start_date", { ascending: false }).limit(5);
    if (!leaves?.length) return replyText(token, rt, `📋 ไม่มีประวัติการลา\n\nพิมพ์ "ลา" เพื่อส่งใบลาใหม่`, qrTeacher);
    const sm: Record<string,string> = { pending:"⏳", approved:"✅", rejected:"❌" };
    const items = leaves.map((l: any) => `${sm[l.status]||l.status} ${l.leave_type} ${l.start_date}-${l.end_date}`);
    return replyFlex(token, rt, "ประวัติลา", buildListCard("📋 ประวัติการลา", items, "#E17055"), qrTeacher);
  }
}

// ============ TEACHER COMMANDS ============

async function handleTeacherClassrooms(sb: any, token: string, rt: string, lineUserId: string, action: "checkin"|"summary") {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครูเท่านั้น`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const personnelId = (user as any).personnel_id;

  // Homeroom classes (try teacher_id first, fall back to name match)
  let homeRooms: any[] = [];
  if (personnelId) {
    const { data } = await sb.from("classrooms").select("id, name").eq("homeroom_teacher_id", personnelId).limit(10);
    homeRooms = data || [];
  }
  if (!homeRooms.length) {
    const { data } = await sb.from("classrooms").select("id, name")
      .or(`homeroom_teacher.eq.${teacherName},homeroom_teacher.eq.${user.first_name} ${user.last_name}`).limit(10);
    homeRooms = data || [];
  }

  // Classes taught (schedules.teacher_id = personnel.id)
  let taughtRows: any[] = [];
  if (personnelId) {
    const { data } = await sb.from("schedules").select("classroom_id, classrooms(id, name)").eq("teacher_id", personnelId).limit(100);
    taughtRows = data || [];
  }
  if (!taughtRows.length) {
    const { data } = await sb.from("schedules").select("classroom_id, classrooms(id, name)").eq("teacher_name", teacherName).limit(100);
    taughtRows = data || [];
  }

  const classMap = new Map<string, string>();
  homeRooms.forEach((c: any) => classMap.set(c.id, c.name + " (ที่ปรึกษา)"));
  taughtRows.forEach((r: any) => { if (r.classroom_id && r.classrooms?.name) classMap.set(r.classroom_id, classMap.get(r.classroom_id) || r.classrooms.name); });

  if (classMap.size === 0) return replyText(token, rt, `ℹ️ ไม่พบห้องที่คุณรับผิดชอบ`, qrTeacher);

  const bubbles = Array.from(classMap.entries()).slice(0, 10).map(([id, name]) => ({
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: name, weight: "bold", size: "lg", wrap: true },
        {
          type: "button", style: "primary", color: "#0984E3",
          action: { type: "postback", label: action === "checkin" ? "เช็คชื่อ" : "สรุปห้อง",
            data: `${action === "checkin" ? "att:list" : "summary:room"}:${id}`,
            displayText: `${action === "checkin" ? "เช็คชื่อ" : "สรุป"} ${name}` },
        },
      ],
    },
  }));
  await lineReply(token, rt, [{ type: "flex", altText: action === "checkin" ? "เลือกห้อง" : "สรุปห้อง", contents: buildCarousel(bubbles), quickReply: qrTeacher }]);
}

async function handleTeacherSubjects(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const personnelId = (user as any).personnel_id;

  let subs: any[] = [];
  if (personnelId) {
    const { data } = await sb.from("schedules").select("subjects(id, name_th, name_en, code), classroom_id, classrooms(name)").eq("teacher_id", personnelId).limit(100);
    subs = data || [];
  }
  if (!subs.length) {
    const { data } = await sb.from("schedules").select("subjects(id, name_th, name_en, code), classroom_id, classrooms(name)").eq("teacher_name", teacherName).limit(100);
    subs = data || [];
  }
  if (!subs.length) return replyText(token, rt, `ℹ️ ไม่พบวิชาที่คุณสอน`, qrTeacher);
  const seen = new Set<string>();
  const uniq = subs.filter((s: any) => { const k = `${s.subjects?.id}-${s.classroom_id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const items = uniq.slice(0, 12).map((s: any) => `${s.subjects?.code || ""} ${s.subjects?.name_th || s.subjects?.name_en || ""} - ห้อง ${s.classrooms?.name || ""}`);
  await replyFlex(token, rt, "วิชาที่สอน", buildListCard("📚 วิชาที่สอน", items, "#6C5CE7"), qrTeacher);
}

async function handleTeacherSubstitute(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const today = new Date().toISOString().slice(0,10);
  const { data: subs } = await sb.from("substitute_teaching").select("teaching_date, period, subjects(name_th, name_en), classrooms(name), original_teacher, status")
    .eq("substitute_teacher", teacherName).gte("teaching_date", today).order("teaching_date").limit(10);
  if (!subs?.length) return replyText(token, rt, `🔁 ไม่มีคาบสอนแทนที่กำลังจะมาถึง`, qrTeacher);
  const items = subs.map((s: any) => `${s.teaching_date} ${s.period} - ${s.subjects?.name_th || s.subjects?.name_en || "-"} ห้อง ${s.classrooms?.name || "-"} (แทน ${s.original_teacher || "-"})`);
  await replyFlex(token, rt, "คาบสอนแทน", buildListCard("🔁 คาบสอนแทน", items, "#E17055"), qrTeacher);
}

async function handleAttendanceList(sb: any, token: string, rt: string, classroomId: string, subjectId?: string, period?: string) {
  const { data: students } = await sb.from("students").select("id, prefix, first_name, last_name, student_code").eq("classroom_id", classroomId).eq("status", "active").order("student_code").limit(40);
  if (!students?.length) return replyText(token, rt, `ไม่พบนักเรียนในห้อง`);
  const today = new Date().toISOString().slice(0,10);
  const ids = students.map((s: any) => s.id);
  let q = sb.from("attendance").select("student_id, status").in("student_id", ids).eq("attendance_date", today);
  q = subjectId ? q.eq("subject_id", subjectId) : q.is("subject_id", null);
  const { data: existing } = await q;
  const statusMap = new Map<string, string>();
  existing?.forEach((a: any) => statusMap.set(a.student_id, a.status));

  const sfx = subjectId ? `:${subjectId}:${period || "-"}` : "";
  const headerText = subjectId ? `🕐 รายคาบ • คาบ ${period || "-"}` : `🚩 เข้าแถว`;

  const bubbles = students.slice(0, 10).map((s: any) => {
    const cur = statusMap.get(s.id);
    const indicator = cur === "present" ? "✅" : cur === "absent" ? "❌" : cur === "late" ? "⏰" : cur === "sick" ? "🤒" : "—";
    return {
      type: "bubble", size: "kilo",
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: headerText, size: "xs", color: "#6C5CE7", weight: "bold" },
          { type: "text", text: `${s.prefix||""}${s.first_name} ${s.last_name}`, weight: "bold", wrap: true },
          { type: "text", text: `รหัส ${s.student_code} ${indicator}`, size: "xs", color: "#888888" },
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: [
              { type: "button", style: "primary", color: "#10b981", height: "sm",
                action: { type: "postback", label: "มา", data: `att:mark:present:${s.id}:${today}${sfx}`, displayText: `✅ ${s.first_name} มา` } },
              { type: "button", style: "primary", color: "#ef4444", height: "sm",
                action: { type: "postback", label: "ขาด", data: `att:mark:absent:${s.id}:${today}${sfx}`, displayText: `❌ ${s.first_name} ขาด` } },
            ],
          },
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: [
              { type: "button", style: "secondary", height: "sm",
                action: { type: "postback", label: "สาย", data: `att:mark:late:${s.id}:${today}${sfx}`, displayText: `⏰ ${s.first_name} สาย` } },
              { type: "button", style: "secondary", height: "sm",
                action: { type: "postback", label: "ป่วย", data: `att:mark:sick:${s.id}:${today}${sfx}`, displayText: `🤒 ${s.first_name} ป่วย` } },
            ],
          },
        ],
      },
    };
  });
  await lineReply(token, rt, [{ type: "flex", altText: headerText, contents: buildCarousel(bubbles), quickReply: qrTeacher }]);
}

async function handleMarkAttendance(sb: any, token: string, rt: string, lineUserId: string, status: string, studentId: string, date: string, subjectId?: string, period?: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ ไม่ได้รับอนุญาต`);
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth() + 1;
  const semester = month >= 5 && month <= 10 ? 1 : 2;
  const sid = subjectId && subjectId !== "-" ? subjectId : null;
  const row: any = {
    student_id: studentId, attendance_date: date, status,
    academic_year: year, semester, recorded_by: user.id, subject_id: sid,
  };
  if (period && period !== "-") row.notes = `period:${period}`;
  try {
    await sb.from("attendance").upsert(row, { onConflict: "student_id,attendance_date,subject_id" });
  } catch {
    await sb.from("attendance").insert(row);
  }
  const { data: s } = await sb.from("students").select("first_name, last_name").eq("id", studentId).maybeSingle();
  const label: Record<string,string> = { present:"✅ มา", absent:"❌ ขาด", late:"⏰ สาย", sick:"🤒 ป่วย" };
  const ctx = sid ? ` คาบ ${period || "-"}` : ` (เข้าแถว)`;
  await replyText(token, rt, `${label[status] || status}: ${s?.first_name || ""} ${s?.last_name || ""} (${date}${ctx})`, qrTeacher);
}

// ============ TEACHER: PER-PERIOD & HOMEROOM ASSEMBLY ============

async function handleTeacherPeriods(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const personnelId = (user as any).personnel_id;
  const dow = new Date().getDay();

  let q = sb.from("schedules")
    .select("period, start_time, end_time, classroom_id, subject_id, classrooms(name), subjects(name_th, name_en)")
    .eq("day_of_week", dow).order("period");
  q = personnelId ? q.eq("teacher_id", personnelId) : q.eq("teacher_name", teacherName);
  const { data: rows } = await q.limit(15);

  if (!rows?.length) return replyText(token, rt, `📅 วันนี้คุณไม่มีคาบสอนในตาราง`, qrTeacher);

  const bubbles = rows.slice(0, 10).map((r: any) => {
    const subjName = r.subjects?.name_th || r.subjects?.name_en || "วิชา";
    const time = `${(r.start_time || "").slice(0,5)}-${(r.end_time || "").slice(0,5)}`;
    return {
      type: "bubble", size: "kilo",
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: `คาบ ${r.period}  ${time}`, weight: "bold", size: "md", color: "#6C5CE7" },
          { type: "text", text: subjName, weight: "bold", wrap: true },
          { type: "text", text: `ห้อง ${r.classrooms?.name || "-"}`, size: "sm", color: "#666" },
          { type: "button", style: "primary", color: "#0984E3", height: "sm",
            action: { type: "postback", label: "✅ เช็คคาบนี้",
              data: `period:pick:${r.classroom_id}:${r.subject_id || "-"}:${r.period}`,
              displayText: `เช็คคาบ ${r.period} ${subjName}` } },
        ],
      },
    };
  });
  await lineReply(token, rt, [{ type: "flex", altText: "เลือกคาบ", contents: buildCarousel(bubbles), quickReply: qrTeacher }]);
}

async function handleHomeroomAssembly(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const personnelId = (user as any).personnel_id;

  let homeRooms: any[] = [];
  if (personnelId) {
    const { data } = await sb.from("classrooms").select("id, name").eq("homeroom_teacher_id", personnelId).limit(10);
    homeRooms = data || [];
  }
  if (!homeRooms.length) {
    const { data } = await sb.from("classrooms").select("id, name")
      .or(`homeroom_teacher.eq.${teacherName},homeroom_teacher.eq.${user.first_name} ${user.last_name}`).limit(10);
    homeRooms = data || [];
  }
  if (!homeRooms.length) return replyText(token, rt, `❌ คุณยังไม่ได้เป็นครูประจำชั้น (เช็คเข้าแถวต้องเป็นครูที่ปรึกษา)`, qrTeacher);

  if (homeRooms.length === 1) {
    return handleAttendanceList(sb, token, rt, homeRooms[0].id);
  }
  const bubbles = homeRooms.slice(0, 10).map((c: any) => ({
    type: "bubble",
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: `🚩 ${c.name}`, weight: "bold", size: "lg" },
        { type: "button", style: "primary", color: "#0984E3",
          action: { type: "postback", label: "เช็คเข้าแถว", data: `att:list:${c.id}`, displayText: `เช็คเข้าแถว ${c.name}` } },
      ],
    },
  }));
  await lineReply(token, rt, [{ type: "flex", altText: "เลือกห้องเข้าแถว", contents: buildCarousel(bubbles), quickReply: qrTeacher }]);
}

async function handleRoomSummary(sb: any, token: string, rt: string, classroomId: string) {
  const { data: cr } = await sb.from("classrooms").select("name").eq("id", classroomId).maybeSingle();
  const { data: students } = await sb.from("students").select("id").eq("classroom_id", classroomId).eq("status", "active");
  const ids = students?.map((s: any) => s.id) || [];
  const today = new Date().toISOString().slice(0,10);
  const monthStart = today.slice(0,7) + "-01";

  const [att, beh, lv] = await Promise.all([
    sb.from("attendance").select("status").in("student_id", ids).eq("attendance_date", today),
    sb.from("behavior_records").select("behavior_type").in("student_id", ids).gte("record_date", monthStart),
    sb.from("student_leaves").select("status").in("student_id", ids).gte("start_date", monthStart),
  ]);
  const c = (arr: any[], k: string, v: string) => arr?.filter((x: any) => x[k] === v).length || 0;

  await replyFlex(token, rt, `สรุปห้อง ${cr?.name || ""}`,
    buildInfoCard(`📊 ห้อง ${cr?.name || ""}`, [
      { label: "จำนวนนักเรียน", value: `${ids.length} คน` },
      { label: "วันนี้ มาเรียน", value: `${c(att.data, "status", "present")} คน` },
      { label: "วันนี้ ขาด", value: `${c(att.data, "status", "absent")} คน` },
      { label: "วันนี้ สาย", value: `${c(att.data, "status", "late")} คน` },
      { label: "เดือนนี้ พฤติกรรมดี", value: `${c(beh.data, "behavior_type", "positive")} ครั้ง` },
      { label: "เดือนนี้ พฤติกรรมลบ", value: `${c(beh.data, "behavior_type", "negative")} ครั้ง` },
      { label: "เดือนนี้ ลา", value: `${lv.data?.length || 0} ครั้ง` },
    ], "#6C5CE7"), qrTeacher);
}

// ============ EXTRA STUDENT/PARENT COMMANDS ============

async function handleHomeworkCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const cid = (user as any).classroom_id;
  if (!cid) return replyText(token, rt, `ℹ️ ยังไม่ได้กำหนดห้องเรียน`, qrParent);
  const today = new Date().toISOString().slice(0, 10);
  const { data: hw } = await sb.from("homework_assignments")
    .select("title, description, due_date, assigned_by, subjects(name_th, name_en)")
    .eq("classroom_id", cid).gte("due_date", today).order("due_date").limit(10);
  if (!hw?.length) return replyText(token, rt, `📚 ไม่มีการบ้านที่กำลังจะถึงกำหนด`, qrParent);
  const items = hw.map((h: any) => `📅 ${h.due_date} | ${h.subjects?.name_th || h.subjects?.name_en || "-"}: ${h.title}`);
  await replyFlex(token, rt, "การบ้าน", buildListCard("📚 การบ้านที่ใกล้ครบกำหนด", items, "#0984E3"), qrParent);
}

async function handleExamsCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const cid = (user as any).classroom_id;
  const today = new Date().toISOString().slice(0, 10);
  const { data: ev } = await sb.from("academic_events")
    .select("title, event_date, end_date, location, event_type")
    .gte("event_date", today)
    .or("event_type.eq.exam,event_type.eq.test,event_type.ilike.%สอบ%")
    .order("event_date").limit(8);
  if (!ev?.length) return replyText(token, rt, `📝 ไม่มีตารางสอบที่กำลังจะมาถึง`, qrParent);
  const items = ev.map((e: any) => `📅 ${e.event_date} ${e.title}${e.location ? ` (${e.location})` : ""}`);
  await replyFlex(token, rt, "ตารางสอบ", buildListCard("📝 ตารางสอบ", items, "#E84393"), qrParent);
}

async function handleHealthCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const { data: rs } = await sb.from("health_records")
    .select("visit_date, symptoms, treatment, nurse_name, follow_up_needed")
    .eq("student_id", user.id).order("visit_date", { ascending: false }).limit(5);
  if (!rs?.length) return replyText(token, rt, `🏥 ยังไม่มีบันทึกสุขภาพ`, qrParent);
  const items = rs.map((r: any) => `${r.visit_date} ${r.symptoms || "-"}${r.follow_up_needed ? " ⚠️ติดตาม" : ""}`);
  await replyFlex(token, rt, "บันทึกสุขภาพ", buildListCard("🏥 บันทึกห้องพยาบาล", items, "#10b981"), qrParent);
}

async function handleLunchCommand(sb: any, token: string, rt: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: m } = await sb.from("school_lunch_records")
    .select("lunch_date, menu_name, menu_description, nutrition_info")
    .gte("lunch_date", today).order("lunch_date").limit(5);
  if (!m?.length) return replyText(token, rt, `🍱 ยังไม่มีเมนูอาหารกลางวันล่วงหน้า`, qrParent);
  const items = m.map((x: any) => `${x.lunch_date}: ${x.menu_name || "-"}`);
  await replyFlex(token, rt, "อาหารกลางวัน", buildListCard("🍱 เมนูอาหารกลางวัน", items, "#f59e0b"), qrParent);
}

async function handleSubsidyCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const { data: rs } = await sb.from("student_subsidies")
    .select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(5);
  if (!rs?.length) return replyText(token, rt, `💰 ยังไม่มีข้อมูลเงินอุดหนุน`, qrParent);
  const items = rs.map((r: any) => `${r.subsidy_type || r.category || "-"} ${r.amount ? r.amount + " บ." : ""} ${r.academic_year || ""}`);
  await replyFlex(token, rt, "เงินอุดหนุน", buildListCard("💰 เงินอุดหนุน/ทุน", items, "#10b981"), qrParent);
}

async function handleHomeVisitCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") return replyText(token, rt, `❌ คำสั่งนี้สำหรับนักเรียน/ผปค.`, qrDefault);
  const { data: rs } = await sb.from("home_visits")
    .select("visit_date, visitor_name, recommendations").eq("student_id", user.id)
    .order("visit_date", { ascending: false }).limit(5);
  if (!rs?.length) return replyText(token, rt, `🏠 ยังไม่มีประวัติการเยี่ยมบ้าน`, qrParent);
  const items = rs.map((r: any) => `${r.visit_date} โดย ${r.visitor_name || "-"}`);
  await replyFlex(token, rt, "เยี่ยมบ้าน", buildListCard("🏠 ประวัติเยี่ยมบ้าน", items, "#6C5CE7"), qrParent);
}

async function handleCalendarCommand(sb: any, token: string, rt: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: ev } = await sb.from("academic_events")
    .select("title, event_date, event_type, location").gte("event_date", today)
    .order("event_date").limit(8);
  if (!ev?.length) return replyText(token, rt, `📅 ยังไม่มีกิจกรรมที่จะมาถึง`);
  const items = ev.map((e: any) => `${e.event_date} ${e.title}${e.location ? ` @${e.location}` : ""}`);
  await replyFlex(token, rt, "ปฏิทินกิจกรรม", buildListCard("📅 ปฏิทินโรงเรียน", items, "#0984E3"));
}

async function handleEmergencyCommand(sb: any, token: string, rt: string) {
  const { data: rs } = await sb.from("emergency_broadcasts")
    .select("title, message, severity, sent_at").eq("is_active", true)
    .order("sent_at", { ascending: false }).limit(3);
  if (!rs?.length) return replyText(token, rt, `🟢 ไม่มีประกาศฉุกเฉินในขณะนี้`);
  const bubbles = rs.map((r: any) => buildInfoCard(`🚨 ${r.title}`, [
    { label: "ระดับ", value: r.severity || "-" },
    { label: "เวลา", value: (r.sent_at || "").slice(0, 16).replace("T", " ") },
    { label: "ข้อความ", value: (r.message || "").slice(0, 200) },
  ], "#ef4444"));
  await lineReply(token, rt, [{ type: "flex", altText: "ฉุกเฉิน", contents: buildCarousel(bubbles) }]);
}

// ============ EXTRA TEACHER COMMANDS ============

async function handleTeacherHomework(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();
  const today = new Date().toISOString().slice(0, 10);
  const { data: hw } = await sb.from("homework_assignments")
    .select("title, due_date, classrooms(name), subjects(name_th)")
    .eq("assigned_by", teacherName).gte("due_date", today).order("due_date").limit(10);
  if (!hw?.length) return replyText(token, rt, `📚 ไม่มีการบ้านที่คุณมอบหมายและยังไม่ครบกำหนด`, qrTeacher);
  const items = hw.map((h: any) => `${h.due_date} | ${h.classrooms?.name || "-"} ${h.subjects?.name_th || ""}: ${h.title}`);
  await replyFlex(token, rt, "การบ้านฉัน", buildListCard("📚 การบ้านที่ฉันมอบหมาย", items, "#6C5CE7"), qrTeacher);
}

async function handleBehaviorRecord(sb: any, token: string, rt: string, lineUserId: string, raw: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  // รูปแบบ: บันทึก [รหัสนักเรียน] [+/-คะแนน] [เหตุผล...]
  const m = raw.match(/^(?:บันทึก|behavior)\s+(\S+)\s+([+\-]?\d+)\s+(.+)$/i);
  if (!m) {
    return replyText(token, rt, `📝 บันทึกพฤติกรรม\nรูปแบบ: บันทึก [รหัสนักเรียน] [+คะแนน/-คะแนน] [เหตุผล]\n\nเช่น:\n• บันทึก 12345 +5 ช่วยเหลือเพื่อน\n• บันทึก 12345 -2 มาสาย`, qrTeacher);
  }
  const [, code, ptsStr, reason] = m;
  const pts = parseInt(ptsStr, 10);
  const { data: s } = await sb.from("students").select("id, first_name, last_name").eq("student_code", code).eq("status", "active").maybeSingle();
  if (!s) return replyText(token, rt, `❌ ไม่พบนักเรียนรหัส ${code}`, qrTeacher);
  await sb.from("behavior_records").insert({
    student_id: s.id, behavior_type: pts >= 0 ? "positive" : "negative",
    description: reason, points: Math.abs(pts), record_date: new Date().toISOString().slice(0, 10),
    recorded_by: `${user.first_name} ${user.last_name}`.trim(),
  });
  return replyText(token, rt, `✅ บันทึก ${pts >= 0 ? "+" : "-"}${Math.abs(pts)} ให้ ${s.first_name} ${s.last_name}\nเหตุผล: ${reason}`, qrTeacher);
}

async function handlePendingLeavesForTeacher(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const personnelId = (user as any).personnel_id;
  let classroomIds: string[] = [];
  if (personnelId) {
    const { data } = await sb.from("classrooms").select("id").eq("homeroom_teacher_id", personnelId);
    classroomIds = (data || []).map((c: any) => c.id);
  }
  if (!classroomIds.length) return replyText(token, rt, `ℹ️ ไม่พบห้องที่ปรึกษา`, qrTeacher);
  const { data: students } = await sb.from("students").select("id").in("classroom_id", classroomIds).eq("status", "active");
  const sids = (students || []).map((s: any) => s.id);
  if (!sids.length) return replyText(token, rt, `ℹ️ ไม่มีนักเรียนในห้องที่ปรึกษา`, qrTeacher);
  const { data: leaves } = await sb.from("student_leaves")
    .select("id, leave_type, start_date, end_date, reason, students(prefix, first_name, last_name, student_code)")
    .in("student_id", sids).eq("status", "pending").order("start_date").limit(10);
  if (!leaves?.length) return replyText(token, rt, `✅ ไม่มีใบลารออนุมัติ`, qrTeacher);
  const bubbles = leaves.map((l: any) => ({
    type: "bubble", size: "kilo",
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: `${l.students?.prefix || ""}${l.students?.first_name} ${l.students?.last_name}`, weight: "bold", wrap: true },
        { type: "text", text: `${l.leave_type} ${l.start_date}→${l.end_date}`, size: "xs", color: "#666" },
        { type: "text", text: l.reason || "-", size: "xs", color: "#888", wrap: true },
        { type: "box", layout: "horizontal", spacing: "xs", contents: [
          { type: "button", style: "primary", color: "#10b981", height: "sm",
            action: { type: "postback", label: "✅ อนุมัติ", data: `leave:approve:student:${l.id}`, displayText: `อนุมัติใบลา ${l.students?.first_name}` } },
          { type: "button", style: "primary", color: "#ef4444", height: "sm",
            action: { type: "postback", label: "❌ ปฏิเสธ", data: `leave:reject:student:${l.id}`, displayText: `ปฏิเสธใบลา ${l.students?.first_name}` } },
        ]},
      ],
    },
  }));
  await lineReply(token, rt, [{ type: "flex", altText: "ใบลารออนุมัติ", contents: buildCarousel(bubbles), quickReply: qrTeacher }]);
}

async function handleApproveLeave(sb: any, token: string, rt: string, lineUserId: string, kind: string, leaveId: string, approve: boolean) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ ไม่ได้รับอนุญาต`);
  const table = kind === "staff" ? "staff_leaves" : "student_leaves";
  const status = approve ? "approved" : "rejected";
  const upd: any = { status };
  if (table === "staff_leaves") {
    upd.approved_by = user.id;
    upd.approved_at = new Date().toISOString();
  }
  const { error } = await sb.from(table).update(upd).eq("id", leaveId);
  if (error) return replyText(token, rt, `❌ ${error.message}`);
  return replyText(token, rt, `${approve ? "✅ อนุมัติ" : "❌ ปฏิเสธ"}ใบลาเรียบร้อย`, qrTeacher);
}

async function handleTodaySummaryForTeacher(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const today = new Date();
  const day = today.getDay();
  const isoDate = today.toISOString().slice(0, 10);
  const personnelId = (user as any).personnel_id;
  const teacherName = `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim();

  let schedQ = sb.from("schedules").select("period, start_time, end_time, subjects(name_th), classrooms(name)").eq("day_of_week", day).order("period");
  schedQ = personnelId ? schedQ.eq("teacher_id", personnelId) : schedQ.eq("teacher_name", teacherName);
  const { data: rows } = await schedQ.limit(15);

  let subRows: any[] = [];
  const { data: sub } = await sb.from("substitute_teaching").select("period, classrooms(name), subjects(name_th)")
    .eq("substitute_teacher", teacherName).eq("teaching_date", isoDate);
  subRows = sub || [];

  const items = [
    { label: "วันที่", value: isoDate },
    { label: "คาบที่สอน", value: `${rows?.length || 0} คาบ` },
    { label: "คาบสอนแทน", value: `${subRows.length} คาบ` },
  ];
  if (rows?.length) {
    rows.slice(0, 6).forEach((r: any) => items.push({ label: `คาบ ${r.period}`, value: `${r.subjects?.name_th || "-"} (${r.classrooms?.name || "-"})` }));
  }
  await replyFlex(token, rt, "สรุปวันนี้", buildInfoCard("📊 สรุปวันนี้", items, "#0984E3"), qrTeacher);
}

// ============ ADMIN/DIRECTOR COMMANDS ============

async function handleSchoolOverview(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || !(user as any).isAdmin) return replyText(token, rt, `❌ คำสั่งนี้สำหรับผู้บริหาร/แอดมิน`, qrDefault);
  const today = new Date().toISOString().slice(0, 10);
  const [students, staff, attToday, pendingS, pendingT, news] = await Promise.all([
    sb.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("personnel").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("attendance").select("status").eq("attendance_date", today),
    sb.from("student_leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("staff_leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("news_posts").select("id", { count: "exact", head: true }).eq("is_published", false),
  ]);
  const cnt = (arr: any[], k: string) => arr?.filter((x: any) => x.status === k).length || 0;
  await replyFlex(token, rt, "ภาพรวมโรงเรียน",
    buildInfoCard("📊 ภาพรวมโรงเรียน", [
      { label: "วันที่", value: today },
      { label: "นักเรียน", value: `${students.count || 0} คน` },
      { label: "บุคลากร", value: `${staff.count || 0} คน` },
      { label: "วันนี้ มาเรียน", value: `${cnt(attToday.data, "present")} คน` },
      { label: "วันนี้ ขาด", value: `${cnt(attToday.data, "absent")} คน` },
      { label: "วันนี้ สาย", value: `${cnt(attToday.data, "late")} คน` },
      { label: "ใบลานักเรียนรออนุมัติ", value: `${pendingS.count || 0}` },
      { label: "ใบลาครูรออนุมัติ", value: `${pendingT.count || 0}` },
      { label: "ข่าวร่าง", value: `${news.count || 0}` },
    ], "#6C5CE7"), qrAdmin);
}

async function handleAdminPendingLeaves(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || !(user as any).isAdmin) return replyText(token, rt, `❌ คำสั่งนี้สำหรับผู้บริหาร/แอดมิน`, qrDefault);
  const { data: staffL } = await sb.from("staff_leaves")
    .select("id, leave_type, start_date, end_date, reason, personnel(prefix, first_name, last_name)")
    .eq("status", "pending").order("start_date").limit(8);
  if (!staffL?.length) return replyText(token, rt, `✅ ไม่มีใบลาครูรออนุมัติ`, qrAdmin);
  const bubbles = staffL.map((l: any) => ({
    type: "bubble", size: "kilo",
    body: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "text", text: `${l.personnel?.prefix || ""}${l.personnel?.first_name} ${l.personnel?.last_name}`, weight: "bold", wrap: true },
        { type: "text", text: `${l.leave_type} ${l.start_date}→${l.end_date}`, size: "xs", color: "#666" },
        { type: "text", text: l.reason || "-", size: "xs", color: "#888", wrap: true },
        { type: "box", layout: "horizontal", spacing: "xs", contents: [
          { type: "button", style: "primary", color: "#10b981", height: "sm",
            action: { type: "postback", label: "✅ อนุมัติ", data: `leave:approve:staff:${l.id}`, displayText: "อนุมัติ" } },
          { type: "button", style: "primary", color: "#ef4444", height: "sm",
            action: { type: "postback", label: "❌ ปฏิเสธ", data: `leave:reject:staff:${l.id}`, displayText: "ปฏิเสธ" } },
        ]},
      ],
    },
  }));
  await lineReply(token, rt, [{ type: "flex", altText: "ใบลาครูรออนุมัติ", contents: buildCarousel(bubbles), quickReply: qrAdmin }]);
}

async function handleAdminPendingNews(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || !(user as any).isAdmin) return replyText(token, rt, `❌ คำสั่งนี้สำหรับผู้บริหาร/แอดมิน`, qrDefault);
  const { data: rs } = await sb.from("news_posts").select("title, created_at").eq("is_published", false).order("created_at", { ascending: false }).limit(8);
  if (!rs?.length) return replyText(token, rt, `✅ ไม่มีข่าวร่างรอเผยแพร่`, qrAdmin);
  const items = rs.map((n: any) => `${(n.created_at || "").slice(0, 10)} ${n.title}`);
  await replyFlex(token, rt, "ข่าวร่าง", buildListCard("📰 ข่าวรอเผยแพร่", items, "#E84393"), qrAdmin);
}

async function handleAdminBroadcast(sb: any, token: string, rt: string, lineUserId: string, raw: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || !(user as any).isAdmin) return replyText(token, rt, `❌ คำสั่งนี้สำหรับผู้บริหาร/แอดมิน`, qrDefault);
  const m = raw.match(/^(?:ประกาศ|broadcast)\s+(.+)$/i);
  if (!m) return replyText(token, rt, `📣 ประกาศฉุกเฉิน\nรูปแบบ: ประกาศ [ข้อความ]\n\nเช่น: ประกาศ ปิดเรียนพรุ่งนี้เนื่องจากฝนตกหนัก`, qrAdmin);
  const message = m[1].trim();
  await sb.from("emergency_broadcasts").insert({
    title: "ประกาศจากผู้บริหาร",
    message,
    severity: "info",
    is_active: true,
    sent_at: new Date().toISOString(),
    sent_by: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    author_id: user.id,
  });
  return replyText(token, rt, `✅ ส่งประกาศแล้ว: ${message.slice(0, 100)}`, qrAdmin);
}

async function handleAdminUserStats(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || !(user as any).isAdmin) return replyText(token, rt, `❌ คำสั่งนี้สำหรับผู้บริหาร/แอดมิน`, qrDefault);
  const [linkedS, linkedP, totalS, totalP] = await Promise.all([
    sb.from("students").select("id", { count: "exact", head: true }).not("line_user_id", "is", null),
    sb.from("profiles").select("id", { count: "exact", head: true }).not("line_user_id", "is", null),
    sb.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("personnel").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  await replyFlex(token, rt, "สถิติผู้ใช้",
    buildInfoCard("👥 สถิติผู้ใช้ LINE", [
      { label: "นักเรียน/ผปค.เชื่อม LINE", value: `${linkedS.count || 0}/${totalS.count || 0}` },
      { label: "บุคลากรเชื่อม LINE", value: `${linkedP.count || 0}/${totalP.count || 0}` },
    ], "#6C5CE7"), qrAdmin);
}

// ============ COMMON COMMANDS ============

async function handleScheduleCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  const today = new Date();
  const day = today.getDay();
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

  let q = sb.from("schedules").select("period, start_time, end_time, teacher_name, subjects(name_th, name_en), classrooms(name)").eq("day_of_week", day).order("period").limit(15);
  if (user?.type === "student" && user.classroom_id) q = q.eq("classroom_id", user.classroom_id);
  if (user?.type === "teacher") q = q.eq("teacher_name", `${user.prefix || ""}${user.first_name} ${user.last_name}`.trim());

  const { data: rows } = await q;
  if (!rows?.length) return replyText(token, rt, `📅 วัน${days[day]}นี้ไม่มีตารางเรียน`, qrFor(user?.type));
  const items = rows.map((s: any) => ({
    label: `คาบ ${s.period} ${s.start_time || ""}`,
    value: `${s.subjects?.name_th || s.subjects?.name_en || "-"}${user?.type === "teacher" ? ` (${s.classrooms?.name || ""})` : ""}`,
  }));
  const title = user?.type === "teacher" ? `📅 ตารางสอนวัน${days[day]}` : `📅 ตารางเรียนวัน${days[day]}`;
  await replyFlex(token, rt, title, buildInfoCard(title, items, "#0984E3"), qrFor(user?.type));
}

async function handleNewsCommand(sb: any, token: string, rt: string) {
  const { data: news } = await sb.from("news_posts").select("title, published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(5);
  if (!news?.length) return replyText(token, rt, `📰 ยังไม่มีข่าวสาร`, qrDefault);
  await replyFlex(token, rt, "ข่าวสาร", buildListCard("📰 ข่าวสารล่าสุด", news.map((n: any) => n.title), "#E84393"));
}

async function handleSDQCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "student") {
    return replyText(token, rt, `❌ คำสั่ง SDQ ใช้ได้เฉพาะบัญชีนักเรียน/ผู้ปกครองที่เชื่อมแล้ว\nพิมพ์ "เชื่อม [รหัส] [วันเกิด]" เพื่อเชื่อมบัญชี`, qrDefault);
  }

  // Check SDQ enabled in CMS
  const { data: enabledRow } = await sb.from("cms_settings").select("value").eq("key", "sdq_enabled").maybeSingle();
  if (enabledRow?.value !== "true") {
    return replyText(token, rt, `ℹ️ ขณะนี้โรงเรียนยังไม่เปิดระบบประเมิน SDQ\nกรุณาติดต่อโรงเรียน`, qrParent);
  }

  // Resolve site URL
  const { data: siteRow } = await sb.from("school_settings").select("setting_value").eq("setting_key", "site_url").maybeSingle();
  const projectId = Deno.env.get("SUPABASE_PROJECT_ID") || "";
  const siteUrl: string = siteRow?.setting_value || (projectId ? `https://${projectId}.lovableproject.com` : "https://bngss.lovable.app");

  const sid = (user as any).id;
  const studentName = `${(user as any).prefix || ""}${(user as any).first_name} ${(user as any).last_name}`;
  const parentUrl = `${siteUrl}/sdq-assess/${sid}?type=parent`;
  const studentUrl = `${siteUrl}/sdq-assess/${sid}?type=student`;

  return replyFlex(token, rt, "แบบประเมิน SDQ", {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#6C5CE7", paddingAll: "16px",
      contents: [
        { type: "text", text: "📋 แบบประเมิน SDQ", color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: studentName, color: "#FFFFFF", size: "sm", wrap: true },
      ],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: "กรุณาเลือกแบบประเมินที่ต้องการทำ", size: "sm", color: "#555555", wrap: true },
        { type: "text", text: "• ผู้ปกครอง: ประเมินบุตรหลานของท่าน\n• นักเรียน: ประเมินตนเอง", size: "xs", color: "#888888", wrap: true },
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "sm",
      contents: [
        { type: "button", style: "primary", color: "#6C5CE7",
          action: { type: "uri", label: "📝 ประเมินโดยผู้ปกครอง", uri: parentUrl } },
        { type: "button", style: "secondary",
          action: { type: "uri", label: "🎓 ประเมินโดยนักเรียน", uri: studentUrl } },
      ],
    },
  }, qrParent);
}


async function handleStatusCommand(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user) return replyText(token, rt, `❌ ยังไม่ได้เชื่อมบัญชี\nพิมพ์ "เชื่อม [รหัส] [วันเกิด]"`, qrDefault);
  if (user.type === "student") {
    const name = `${user.prefix||""}${user.first_name} ${user.last_name}`;
    return replyFlex(token, rt, `สถานะ - ${name}`, buildInfoCard("🔗 บัญชีที่เชื่อม", [
      { label: "ประเภท", value: "นักเรียน/ผปค." },
      { label: "ชื่อ", value: name },
      { label: "รหัส", value: user.student_code },
      { label: "ห้อง", value: (user as any).classrooms?.name || "-" },
    ], "#6C5CE7"), qrParent);
  }
  const name = `${user.prefix||""}${user.first_name||""} ${user.last_name||""}`.trim();
  return replyFlex(token, rt, `สถานะ - ${name}`, buildInfoCard("🔗 บัญชีที่เชื่อม", [
    { label: "ประเภท", value: "บุคลากร" },
    { label: "ชื่อ", value: name },
    { label: "รหัส", value: user.employee_code || "-" },
    ...((user as any).position ? [{ label: "ตำแหน่ง", value: (user as any).position }] : []),
  ], "#6C5CE7"), qrTeacher);
}

// ============ MAIN TEXT ROUTER ============

// ============ AI INTENT CLASSIFIER + RESPONSE CACHE ============
// Map of intent slug → handler dispatcher. Runs after keyword matching.
// Uses mascot_advice_cache table for 24h dedup so repeat questions don't spend AI tokens.

const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const _inMemAiCache = new Map<string, { reply: string; ts: number }>();

function _cacheKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

async function getCachedAiReply(_sb: any, text: string): Promise<string | null> {
  const k = _cacheKey(text);
  const mem = _inMemAiCache.get(k);
  if (mem && Date.now() - mem.ts < AI_CACHE_TTL_MS) return mem.reply;
  return null;
}

async function setCachedAiReply(_sb: any, text: string, reply: string) {
  const k = _cacheKey(text);
  _inMemAiCache.set(k, { reply, ts: Date.now() });
  // Trim to keep memory bounded
  if (_inMemAiCache.size > 500) {
    const oldestKey = _inMemAiCache.keys().next().value;
    if (oldestKey) _inMemAiCache.delete(oldestKey);
  }
}

const INTENT_LIST = [
  "grades", "attendance", "behavior", "sdq", "homework", "exams", "health",
  "lunch", "subsidy", "home_visit", "calendar", "emergency", "schedule",
  "news", "contact", "leave_new", "leave_history",
  "teacher_assembly", "teacher_periods", "teacher_summary", "teacher_subjects",
  "teacher_substitute", "teacher_homework", "teacher_pending_leaves", "teacher_today",
  "admin_overview", "admin_pending_leaves", "admin_pending_news", "admin_users",
  "help", "unknown",
] as const;
type IntentSlug = typeof INTENT_LIST[number];

async function classifyIntent(text: string): Promise<IntentSlug> {
  const cacheKey = `intent:${_cacheKey(text)}`;
  const mem = _inMemAiCache.get(cacheKey);
  if (mem && Date.now() - mem.ts < AI_CACHE_TTL_MS) return mem.reply as IntentSlug;

  try {
    const { aiCall } = await import("../_shared/aiCall.ts");
    const out = await aiCall({
      messages: [
        {
          role: "system",
          content:
            `จำแนกเจตนาข้อความผู้ใช้ในระบบโรงเรียน ตอบเป็น slug เดียวจากรายการนี้เท่านั้น (ห้ามอธิบาย):
grades, attendance, behavior, sdq, homework, exams, health, lunch, subsidy, home_visit, calendar, emergency, schedule, news, contact, leave_new, leave_history, teacher_assembly, teacher_periods, teacher_summary, teacher_subjects, teacher_substitute, teacher_homework, teacher_pending_leaves, teacher_today, admin_overview, admin_pending_leaves, admin_pending_news, admin_users, help, unknown

ตัวอย่าง:
- "อยากดูเกรดหน่อย" → grades
- "ลูกมาโรงเรียนไหมวันนี้" → attendance
- "ครูขอลาป่วยพรุ่งนี้" → leave_new
- "การบ้านวิชาไทย" → homework
- "สรุปวันนี้" → teacher_today
- "ภาพรวมโรงเรียน" → admin_overview
- "สวัสดี" → unknown`,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 20,
      functionName: "line-webhook-intent",
    });
    const raw = (out.content || "").trim().toLowerCase().replace(/[^a-z_]/g, "");
    const slug = (INTENT_LIST as readonly string[]).includes(raw) ? (raw as IntentSlug) : "unknown";
    _inMemAiCache.set(cacheKey, { reply: slug, ts: Date.now() });
    return slug;
  } catch (e) {
    console.error("classifyIntent", e);
    return "unknown";
  }
}

async function classifyAndRoute(
  sb: any, token: string, rt: string, text: string, lineUserId: string,
): Promise<Response | null> {
  const intent = await classifyIntent(text);
  if (intent === "unknown") return null;
  console.log("[intent]", { text: text.slice(0, 60), intent });

  switch (intent) {
    case "grades": return handleGradesCommand(sb, token, rt, lineUserId);
    case "attendance": return handleAttendanceCommand(sb, token, rt, lineUserId);
    case "behavior": return handleBehaviorCommand(sb, token, rt, lineUserId);
    case "sdq": return handleSDQCommand(sb, token, rt, lineUserId);
    case "homework": return handleHomeworkCommand(sb, token, rt, lineUserId);
    case "exams": return handleExamsCommand(sb, token, rt, lineUserId);
    case "health": return handleHealthCommand(sb, token, rt, lineUserId);
    case "lunch": return handleLunchCommand(sb, token, rt);
    case "subsidy": return handleSubsidyCommand(sb, token, rt, lineUserId);
    case "home_visit": return handleHomeVisitCommand(sb, token, rt, lineUserId);
    case "calendar": return handleCalendarCommand(sb, token, rt);
    case "emergency": return handleEmergencyCommand(sb, token, rt);
    case "schedule": return handleScheduleCommand(sb, token, rt, lineUserId);
    case "news": return handleNewsCommand(sb, token, rt);
    case "leave_new": return startLeaveFlow(sb, token, rt, lineUserId);
    case "leave_history": return handleLeaveStatusCommand(sb, token, rt, lineUserId);
    case "teacher_assembly": return handleHomeroomAssembly(sb, token, rt, lineUserId);
    case "teacher_periods": return handleTeacherPeriods(sb, token, rt, lineUserId);
    case "teacher_summary": return handleTeacherClassrooms(sb, token, rt, lineUserId, "summary");
    case "teacher_subjects": return handleTeacherSubjects(sb, token, rt, lineUserId);
    case "teacher_substitute": return handleTeacherSubstitute(sb, token, rt, lineUserId);
    case "teacher_homework": return handleTeacherHomework(sb, token, rt, lineUserId);
    case "teacher_pending_leaves": return handlePendingLeavesForTeacher(sb, token, rt, lineUserId);
    case "teacher_today": return handleTodaySummaryForTeacher(sb, token, rt, lineUserId);
    case "admin_overview": return handleSchoolOverview(sb, token, rt, lineUserId);
    case "admin_pending_leaves": return handleAdminPendingLeaves(sb, token, rt, lineUserId);
    case "admin_pending_news": return handleAdminPendingNews(sb, token, rt, lineUserId);
    case "admin_users": return handleAdminUserStats(sb, token, rt, lineUserId);
    default: return null;
  }
}

async function handleTextMessage(sb: any, token: string, rt: string, text: string, lineUserId: string, richMenus: Record<string,string>) {
  const t = text.trim();
  console.log("[handleTextMessage]", { uid: lineUserId, text: t.slice(0, 80) });

  // 1. Active session takes priority (unless user explicitly asks for menu)
  const session = await getSession(sb, lineUserId);
  if (session) console.log("[session]", { intent: session.intent, step: session.step });
  if (session && !/^(เมนู|menu|help)$/i.test(t)) {
    if (session.intent === "leave") return continueLeaveFlow(sb, token, rt, lineUserId, session, t);
  }

  // 2. Link command
  const link = t.match(/^(?:เชื่อม|link)\s+(\S+)(?:\s+(.+))?$/i);
  if (link) return handleLinkCommand(sb, token, rt, link[1], link[2]?.trim() || null, lineUserId, richMenus);

  if (/^(?:ยกเลิกเชื่อม|unlink)$/i.test(t)) return handleUnlinkCommand(sb, token, rt, lineUserId, richMenus);
  if (/^(?:สถานะ|status|บัญชี)$/i.test(t)) return handleStatusCommand(sb, token, rt, lineUserId);

  // 3. Leave flow start
  if (/^(?:ลา|ส่งใบลา|แจ้งลา)$/i.test(t)) return startLeaveFlow(sb, token, rt, lineUserId);
  if (/^(?:ประวัติลา|ใบลา|สถานะลา)$/i.test(t)) return handleLeaveStatusCommand(sb, token, rt, lineUserId);

  // 4. Student/parent
  if (/^(?:ผลการเรียน|เกรด|คะแนน|grades?|score)$/i.test(t)) return handleGradesCommand(sb, token, rt, lineUserId);
  if (/^(?:การเข้าเรียน|เข้าเรียน|attendance|เช็คชื่อนักเรียน)$/i.test(t)) return handleAttendanceCommand(sb, token, rt, lineUserId);
  if (/^(?:พฤติกรรม|behavior)$/i.test(t)) return handleBehaviorCommand(sb, token, rt, lineUserId);
  if (/^(?:sdq|ประเมิน\s*sdq|แบบประเมิน(?:\s*sdq)?)$/i.test(t)) return handleSDQCommand(sb, token, rt, lineUserId);
  if (/^(?:การบ้าน|homework|hw)$/i.test(t)) return handleHomeworkCommand(sb, token, rt, lineUserId);
  if (/^(?:สอบ|ตารางสอบ|exam)$/i.test(t)) return handleExamsCommand(sb, token, rt, lineUserId);
  if (/^(?:สุขภาพ|พยาบาล|health)$/i.test(t)) return handleHealthCommand(sb, token, rt, lineUserId);
  if (/^(?:อาหาร|เมนู\s*อาหาร|อาหารกลางวัน|lunch)$/i.test(t)) return handleLunchCommand(sb, token, rt);
  if (/^(?:เงินอุดหนุน|ทุน|อุดหนุน|subsidy)$/i.test(t)) return handleSubsidyCommand(sb, token, rt, lineUserId);
  if (/^(?:เยี่ยมบ้าน|home\s*visit)$/i.test(t)) return handleHomeVisitCommand(sb, token, rt, lineUserId);
  if (/^(?:ปฏิทิน|กิจกรรม|calendar|events?)$/i.test(t)) return handleCalendarCommand(sb, token, rt);
  if (/^(?:ฉุกเฉิน|emergency|ประกาศฉุกเฉิน)$/i.test(t)) return handleEmergencyCommand(sb, token, rt);

  // 5. Teacher
  if (/^(?:เช็คเข้าแถว|เข้าแถว|assembly)$/i.test(t)) return handleHomeroomAssembly(sb, token, rt, lineUserId);
  if (/^(?:เช็ครายคาบ|รายคาบ|เช็คคาบ|periods?)$/i.test(t)) return handleTeacherPeriods(sb, token, rt, lineUserId);
  if (/^(?:เช็คชื่อ|checkin)$/i.test(t)) return handleTeacherClassrooms(sb, token, rt, lineUserId, "checkin");
  if (/^(?:สรุปห้อง|summary)$/i.test(t)) return handleTeacherClassrooms(sb, token, rt, lineUserId, "summary");
  if (/^(?:วิชาฉัน|วิชา)$/i.test(t)) return handleTeacherSubjects(sb, token, rt, lineUserId);
  if (/^(?:สอนแทน)$/i.test(t)) return handleTeacherSubstitute(sb, token, rt, lineUserId);
  if (/^(?:การบ้านฉัน|การบ้านที่สอน|hw\s*me)$/i.test(t)) return handleTeacherHomework(sb, token, rt, lineUserId);
  if (/^(?:บันทึก|behavior)\b/i.test(t)) return handleBehaviorRecord(sb, token, rt, lineUserId, t);
  if (/^(?:อนุมัติลา|ลารออนุมัติห้อง|รออนุมัติ)$/i.test(t)) return handlePendingLeavesForTeacher(sb, token, rt, lineUserId);
  if (/^(?:สรุปวันนี้|วันนี้|today)$/i.test(t)) return handleTodaySummaryForTeacher(sb, token, rt, lineUserId);
  if (/^(?:ตารางวันนี้)$/i.test(t)) return handleScheduleCommand(sb, token, rt, lineUserId);

  // 5b. Admin/Director
  if (/^(?:ภาพรวม|สรุปโรงเรียน|overview|dashboard)$/i.test(t)) return handleSchoolOverview(sb, token, rt, lineUserId);
  if (/^(?:ลารออนุมัติ|ลาครูรออนุมัติ|pending\s*leave)$/i.test(t)) return handleAdminPendingLeaves(sb, token, rt, lineUserId);
  if (/^(?:ข่าวรอเผยแพร่|ข่าวร่าง|draft\s*news)$/i.test(t)) return handleAdminPendingNews(sb, token, rt, lineUserId);
  if (/^(?:ผู้ใช้|สถิติผู้ใช้|users?)$/i.test(t)) return handleAdminUserStats(sb, token, rt, lineUserId);
  if (/^(?:ประกาศ|broadcast)\b/i.test(t)) return handleAdminBroadcast(sb, token, rt, lineUserId, t);

  // 6. Common
  if (/ตารางสอน|ตารางเรียน|ตาราง|schedule/i.test(t)) return handleScheduleCommand(sb, token, rt, lineUserId);
  if (/^ข่าว|news/i.test(t)) return handleNewsCommand(sb, token, rt);

  // 7. Contact
  if (/ติดต่อ|โทร|contact/i.test(t)) {
    const { data: s } = await sb.from("school_settings").select("setting_key,setting_value").in("setting_key", ["school_name","school_phone","school_address","school_email"]);
    const m: Record<string,string> = {}; s?.forEach((x: any) => m[x.setting_key] = x.setting_value || "");
    return replyFlex(token, rt, "ติดต่อ", buildInfoCard("📞 ติดต่อโรงเรียน", [
      { label: "ชื่อ", value: m.school_name || "-" },
      { label: "โทร", value: m.school_phone || "-" },
      { label: "ที่อยู่", value: m.school_address || "-" },
      { label: "อีเมล", value: m.school_email || "-" },
    ], "#0984E3"));
  }

  // 8. Help
  if (/^(?:help|เมนู|ช่วยเหลือ|คำสั่ง|menu)$/i.test(t)) {
    try { await clearSession(sb, lineUserId); } catch { /* ignore */ }
    const user = await findLinkedUser(sb, lineUserId);
    const isTeacher = user?.type === "teacher";
    const isStudent = user?.type === "student";
    const isAdmin = !!(user as any)?.isAdmin;
    return replyFlex(token, rt, "เมนู Smart School", {
      type: "bubble", size: "giga",
      header: { type: "box", layout: "vertical", backgroundColor: "#6C5CE7", paddingAll: "16px",
        contents: [{ type: "text", text: "📚 Smart School Bot", color: "#FFFFFF", weight: "bold", size: "lg" }] },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "🔗 บัญชี", weight: "bold", size: "sm" },
          { type: "text", text: "• เชื่อม [รหัส] [ววดดปปปป]\n• สถานะ — ดูบัญชี\n• ยกเลิกเชื่อม", size: "xs", color: "#555", wrap: true },
          { type: "separator" },
          ...(isStudent ? [
            { type: "text", text: "👩‍🎓 นักเรียน/ผู้ปกครอง", weight: "bold", size: "sm" },
            { type: "text", text: "• ผลการเรียน / การเข้าเรียน / พฤติกรรม\n• การบ้าน / สอบ / สุขภาพ / อาหาร\n• เงินอุดหนุน / เยี่ยมบ้าน / sdq\n• ลา (ส่งใบลา) / ประวัติลา\n• ปฏิทิน / ฉุกเฉิน", size: "xs", color: "#555", wrap: true },
            { type: "separator" },
          ] : []),
          ...(isTeacher ? [
            { type: "text", text: "👨‍🏫 ครู", weight: "bold", size: "sm" },
            { type: "text", text: "• เช็คเข้าแถว (ครูประจำชั้น) / เช็ครายคาบ (เลือกคาบ)\n• สรุปห้อง / วิชาฉัน / สอนแทน\n• การบ้านฉัน / สรุปวันนี้ / ตารางวันนี้\n• บันทึก [รหัส] [+-คะแนน] [เหตุผล]\n• อนุมัติลา (ห้องที่ปรึกษา)\n• ลา (แนบรูป/ไฟล์ได้) / ประวัติลา", size: "xs", color: "#555", wrap: true },
            { type: "separator" },
          ] : []),
          ...(isAdmin ? [
            { type: "text", text: "🏫 ผู้บริหาร/แอดมิน", weight: "bold", size: "sm" },
            { type: "text", text: "• ภาพรวม — สถิติโรงเรียนวันนี้\n• ลารออนุมัติ — ใบลาครู\n• ข่าวรอเผยแพร่ / ผู้ใช้\n• ประกาศ [ข้อความ] — แจ้งฉุกเฉิน", size: "xs", color: "#555", wrap: true },
            { type: "separator" },
          ] : []),
          { type: "text", text: "📋 ทั่วไป", weight: "bold", size: "sm" },
          { type: "text", text: "• ตาราง / ข่าว / ปฏิทิน / ติดต่อ / ฉุกเฉิน", size: "xs", color: "#555", wrap: true },
        ],
      },
    }, qrFor(user?.type, isAdmin));
  }

  // 9. AI-powered intent classifier — map ภาษาธรรมชาติ → command แล้ว dispatch ทันที
  //    (เช่น "อยากดูเกรดหน่อย" → grades, "ครูขา ลาป่วยพรุ่งนี้ได้ไหม" → leave)
  //    ใช้ AI pool (ฟรี) + cache ผลลัพธ์ 24 ชม. เพื่อประหยัดการเรียกซ้ำ
  if (t.length >= 2 && t.length <= 500) {
    try {
      const routed = await classifyAndRoute(sb, token, rt, t, lineUserId);
      if (routed) return routed;
    } catch (e) { console.error("intent classify", e); }

    // 9b. AI free-form fallback (พูดคุยทั่วไป) — ยังใช้ pool ฟรี, cache 24 ชม.
    try {
      const cached = await getCachedAiReply(sb, t);
      if (cached) {
        const u0 = await findLinkedUser(sb, lineUserId);
        return replyText(token, rt, cached, qrFor(u0?.type, !!(u0 as any)?.isAdmin));
      }
      const { aiCall } = await import("../_shared/aiCall.ts");
      const out = await aiCall({
        messages: [
          { role: "system", content: "คุณคือผู้ช่วย AI โรงเรียน Smart School ตอบไทยกระชับ ไม่เกิน 4-6 บรรทัด ห้ามแต่งข้อมูลส่วนบุคคล แนะนำคำสั่งของบอท เช่น เมนู, ผลการเรียน, การเข้าเรียน, ลา, การบ้าน, สอบ, สุขภาพ, ภาพรวม, ลารออนุมัติ" },
          { role: "user", content: t },
        ],
        temperature: 0.4,
        max_tokens: 300,
        functionName: "line-webhook",
      });
      const reply = out.content?.trim();
      if (reply) {
        await setCachedAiReply(sb, t, reply).catch(() => {});
        const u = await findLinkedUser(sb, lineUserId);
        return replyText(token, rt, reply, qrFor(u?.type, !!(u as any)?.isAdmin));
      }
    } catch (e) { console.error("AI fallback", e); }
  }


  // 10. Welcome fallback
  const u = await findLinkedUser(sb, lineUserId);
  return replyText(token, rt, `สวัสดีครับ 👋\nพิมพ์ "เมนู" เพื่อดูคำสั่ง หรือใช้ Rich Menu ด้านล่าง`, qrFor(u?.type, !!(u as any)?.isAdmin));
}

// ============ POSTBACK HANDLER ============

async function handlePostback(sb: any, token: string, rt: string, data: string, lineUserId: string) {
  const parts = data.split(":");
  const [domain, action, ...rest] = parts;

  if (domain === "att" && action === "list") {
    return handleAttendanceList(sb, token, rt, rest[0]);
  }
  if (domain === "att" && action === "mark") {
    const [status, studentId, date, subjectId, period] = rest;
    return handleMarkAttendance(sb, token, rt, lineUserId, status, studentId, date, subjectId, period);
  }
  if (domain === "period" && action === "pick") {
    const [classroomId, subjectId, period] = rest;
    return handleAttendanceList(sb, token, rt, classroomId, subjectId, period);
  }
  if (domain === "summary" && action === "room") {
    return handleRoomSummary(sb, token, rt, rest[0]);
  }
  if (domain === "leave" && action === "start") {
    return startLeaveFlow(sb, token, rt, lineUserId);
  }
  if (domain === "leave" && (action === "approve" || action === "reject")) {
    const [kind, leaveId] = rest;
    return handleApproveLeave(sb, token, rt, lineUserId, kind, leaveId, action === "approve");
  }
  await replyText(token, rt, `🤔 คำสั่งไม่รู้จัก: ${data}`);
}

// ============ SERVE ============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("OK", { status: 200, headers: corsHeaders });

  // Rate limit: 120 webhook events / minute / IP (LINE bursts allowed but cap abuse)
  const { rateLimit } = await import("../_shared/rateLimit.ts");
  const rl = await rateLimit(req, { name: "line-webhook", limit: 120, windowMs: 60_000 });
  if (rl.blocked && rl.response) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const bodyText = await req.text();
    const settings = await getLineSettings(sb);

    if (settings.line_bot_enabled !== "true") {
      return new Response(JSON.stringify({ message: "Bot disabled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = settings.line_channel_access_token;
    if (!token) return new Response(JSON.stringify({ error: "Token not configured" }), { status: 200, headers: corsHeaders });

    const signature = req.headers.get("x-line-signature");
    const secret = settings.line_channel_secret;
    if (!secret) {
      return new Response(JSON.stringify({ error: "Bot not configured" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!signature || !(await verifySignature(bodyText, signature, secret))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = JSON.parse(bodyText);
    const events = body.events || [];

    for (const event of events) {
      const uid = event.source?.userId || "";
      const eventKey = [
        event.webhookEventId,
        event.deliveryContext?.isRedelivery ? "redelivery" : "primary",
        event.type,
        event.timestamp,
        uid,
        event.message?.id,
        event.postback?.data,
      ].filter(Boolean).join(":");

      if (eventKey && hasProcessedEvent(eventKey)) {
        console.log("[skip duplicate event]", { eventKey, uid, type: event.type });
        continue;
      }
      if (eventKey) rememberProcessedEvent(eventKey);

      if (event.replyToken && uid) rememberReplyToken(event.replyToken, uid);
      try {
        if (event.type === "message" && event.message?.type === "text") {
          await handleTextMessage(sb, token, event.replyToken, event.message.text, uid, settings);
        } else if (event.type === "message" && ["image","file","video"].includes(event.message?.type)) {
          // ถ้าอยู่ใน leave attachment flow → อัปโหลดเป็นไฟล์แนบ
          const sess = await getSession(sb, uid);
          if (sess?.intent === "leave" && sess.step === "attachment") {
            await handleLeaveAttachmentMessage(sb, token, event.replyToken, uid, sess, event);
          } else {
            await replyText(token, event.replyToken, `📎 ได้รับไฟล์แล้ว แต่ตอนนี้ยังไม่ได้อยู่ในขั้นตอนแนบไฟล์\nพิมพ์ "ลา" เพื่อเริ่มส่งใบลาพร้อมไฟล์แนบ`);
          }
        } else if (event.type === "postback") {
          await handlePostback(sb, token, event.replyToken, event.postback?.data || "", uid);
        } else if (event.type === "follow") {
          if (settings.line_richmenu_default) await linkRichMenuToUser(token, uid, settings.line_richmenu_default);
          await replyFlex(token, event.replyToken, "ยินดีต้อนรับ!", {
            type: "bubble",
            header: { type: "box", layout: "vertical", backgroundColor: "#10b981", paddingAll: "16px",
              contents: [{ type: "text", text: "🎉 ยินดีต้อนรับ", color: "#FFFFFF", weight: "bold", size: "xl" }] },
            body: {
              type: "box", layout: "vertical", spacing: "md",
              contents: [
                { type: "text", text: "Smart School Bot พร้อมให้บริการ", weight: "bold" },
                { type: "text", text: "🔗 เชื่อมบัญชี: พิมพ์\n  เชื่อม [รหัส] [ววดดปปปป]\n  เช่น: เชื่อม 12345 12052553", size: "sm", color: "#555555", wrap: true },
                { type: "text", text: "📋 พิมพ์ \"เมนู\" เพื่อดูคำสั่งทั้งหมด", size: "sm", color: "#888888", wrap: true },
              ],
            },
          }, qrDefault);
        } else if (event.type === "unfollow") {
          if (uid) await clearLineUserIdEverywhere(sb, uid);
        }
      } catch (evErr: any) {
        console.error("Event error", event.type, evErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Webhook error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
