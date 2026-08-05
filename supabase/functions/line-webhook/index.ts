import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { getSecret } from "../_shared/getSecret.ts";
import { getSession, setSession, clearSession, normalizeDob, dobMatches, todayPlus } from "../_shared/lineSession.ts";
import {
  startLeaveFlow as _startLeaveFlow,
  continueLeaveFlow as _continueLeaveFlow,
  handleLeaveAttachmentMessage as _handleLeaveAttachmentMessage,
  type LeaveDeps,
} from "../_shared/lineLeaveFlow.ts";
// (LINE Vault group capture moved to line-vault-webhook — separate OA channel)

import { corsHeaders } from "../_shared/cors.ts";
import { todayBangkokISO, bkkDateISO } from "../_shared/thaiDate.ts";

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
// Shared design system lives in ../_shared/lineFlex.ts so all LINE functions
// (notify-line, setup-line-richmenu, line-webhook) speak one visual language.
import {
  BRAND,
  shade,
  headerBox,
  buildInfoCard,
  buildListCard,
  buildProfileCard,
  buildSectionCard,
  buildCarousel,
} from "../_shared/lineFlex.ts";



// ============ SPIDER-WEB SYNC ============

async function syncLineUserIdAcross(sb: any, lineUserId: string, opts: { studentId?: string; profileId?: string }) {
  const { studentId, profileId } = opts;
  if (studentId) {
    const { data: s } = await sb.from("students").select("auth_user_id").eq("id", studentId).maybeSingle();
    if (s?.auth_user_id) {
      const { error } = await sb.from("profiles").update({ line_user_id: lineUserId }).eq("id", s.auth_user_id);
      if (error) console.error("[syncLineUserIdAcross] profiles update failed", error);
    }
  }
  if (profileId) {
    const { data: s } = await sb.from("students").select("id").eq("auth_user_id", profileId).eq("status", "active").maybeSingle();
    if (s) {
      const { error } = await sb.from("students").update({ line_user_id: lineUserId }).eq("id", s.id);
      if (error) console.error("[syncLineUserIdAcross] students update failed", error);
    }
  }
}

async function clearLineUserIdEverywhere(sb: any, lineUserId: string) {
  const results = await Promise.all([
    sb.from("students").update({ line_user_id: null }).eq("line_user_id", lineUserId),
    sb.from("students").update({ line_user_id_2: null }).eq("line_user_id_2", lineUserId),
    sb.from("students").update({ line_user_id_3: null }).eq("line_user_id_3", lineUserId),
    sb.from("profiles").update({ line_user_id: null }).eq("line_user_id", lineUserId),
    sb.from("line_sessions").delete().eq("line_user_id", lineUserId),
  ]);
  const errs = results.map((r: any) => r?.error).filter(Boolean);
  if (errs.length) console.error("[clearLineUserIdEverywhere] errors", errs);
  return errs.length === 0;
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
    const isAdmin = roleList.some((r) => ["admin", "director"].includes(r));
    return { type: "teacher" as const, ...profile, prefix: personnel?.prefix, position: personnel?.position, department: personnel?.department, personnel_id: personnel?.id, roles: roleList, isAdmin };
  }
  return null;
}

// ============ SESSION ============

// Session store, DOB normalizer, and todayPlus() come from ../_shared/lineSession.ts



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
      const { error: linkErr } = await sb.from("profiles").update({ line_user_id: lineUserId }).eq("id", prof.id);
      if (linkErr) {
        console.error("[link personnel] profiles update failed", linkErr);
        return replyText(token, rt, `❌ เชื่อมบัญชีไม่สำเร็จ: ${linkErr.message}`, qrDefault);
      }
      await syncLineUserIdAcross(sb, lineUserId, { profileId: prof.id });
      // เลือก rich menu ตาม role: director → director menu, admin → admin menu, ไม่งั้น teacher
      const { data: rlist } = await sb.from("user_roles").select("role").eq("user_id", prof.id);
      const rr = (rlist || []).map((x: any) => x.role);
      const menuKey = rr.includes("director") ? "line_richmenu_director"
        : (rr.includes("admin") ) ? "line_richmenu_admin"
        : "line_richmenu_teacher";
      if (richMenus[menuKey]) await linkRichMenuToUser(token, lineUserId, richMenus[menuKey]);
      else if (richMenus.line_richmenu_teacher) await linkRichMenuToUser(token, lineUserId, richMenus.line_richmenu_teacher);

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
  const ok = await clearLineUserIdEverywhere(sb, lineUserId);
  if (!ok) return replyText(token, rt, `❌ ยกเลิกการเชื่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`, qrDefault);
  const stillLinked = await findLinkedUser(sb, lineUserId);
  if (stillLinked) {
    console.error("[unlink] still linked after clear", { lineUserId });
    return replyText(token, rt, `❌ ยกเลิกการเชื่อมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`, qrDefault);
  }
  if (richMenus.line_richmenu_default) await linkRichMenuToUser(token, lineUserId, richMenus.line_richmenu_default);
  await replyText(token, rt, `✅ ยกเลิกการเชื่อมบัญชีแล้ว`, qrDefault);
}

// ============ LEAVE FLOW (thin wrappers → ../_shared/lineLeaveFlow.ts) ============

function leaveDeps(): LeaveDeps {
  return {
    replyText, replyFlex, findLinkedUser, downloadLineContent,
    qrDefault, qrFor,
  };
}
const startLeaveFlow = (sb: any, token: string, rt: string, lineUserId: string) =>
  _startLeaveFlow(sb, token, rt, lineUserId, leaveDeps());
const continueLeaveFlow = (sb: any, token: string, rt: string, lineUserId: string, session: any, text: string) =>
  _continueLeaveFlow(sb, token, rt, lineUserId, session, text, leaveDeps());
const handleLeaveAttachmentMessage = (sb: any, token: string, rt: string, lineUserId: string, session: any, event: any) =>
  _handleLeaveAttachmentMessage(sb, token, rt, lineUserId, session, event, leaveDeps());

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
  const today = todayBangkokISO();
  const { data: subs } = await sb.from("substitute_teaching").select("teaching_date, period, subjects(name_th, name_en), classrooms(name), original_teacher, status")
    .eq("substitute_teacher", teacherName).gte("teaching_date", today).order("teaching_date").limit(10);
  if (!subs?.length) return replyText(token, rt, `🔁 ไม่มีคาบสอนแทนที่กำลังจะมาถึง`, qrTeacher);
  const items = subs.map((s: any) => `${s.teaching_date} ${s.period} - ${s.subjects?.name_th || s.subjects?.name_en || "-"} ห้อง ${s.classrooms?.name || "-"} (แทน ${s.original_teacher || "-"})`);
  await replyFlex(token, rt, "คาบสอนแทน", buildListCard("🔁 คาบสอนแทน", items, "#E17055"), qrTeacher);
}

async function handleAttendanceList(sb: any, token: string, rt: string, classroomId: string, subjectId?: string, period?: string) {
  const { data: students } = await sb.from("students").select("id, prefix, first_name, last_name, student_code").eq("classroom_id", classroomId).eq("status", "active").order("student_code").limit(40);
  if (!students?.length) return replyText(token, rt, `ไม่พบนักเรียนในห้อง`);
  const today = todayBangkokISO();
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
  let saved: any = null; let saveErr: any = null;
  try {
    const r = await sb.from("attendance").upsert(row, { onConflict: "student_id,attendance_date,subject_id" }).select("id").maybeSingle();
    saved = r.data; saveErr = r.error;
  } catch (e) { saveErr = e; }
  if (saveErr) {
    const r2 = await sb.from("attendance").insert(row).select("id").maybeSingle();
    saved = r2.data; saveErr = r2.error;
  }
  if (saveErr || !saved) {
    console.error("[markAttendance] failed", { row, saveErr });
    return replyText(token, rt, `❌ บันทึกเช็คชื่อไม่สำเร็จ: ${saveErr?.message || "unknown"}`, qrTeacher);
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
          { type: "text", text: `ห้อง ${r.classrooms?.name || "-"}`, size: "sm", color: "#666666" },
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
  const today = todayBangkokISO();
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
  const today = todayBangkokISO();
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
  const today = todayBangkokISO();
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
  const today = todayBangkokISO();
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
  const today = todayBangkokISO();
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
  const today = todayBangkokISO();
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
  const { error: behErr } = await sb.from("behavior_records").insert({
    student_id: s.id, behavior_type: pts >= 0 ? "positive" : "negative",
    description: reason, points: Math.abs(pts), record_date: todayBangkokISO(),
    recorded_by: `${user.first_name} ${user.last_name}`.trim(),
  });
  if (behErr) {
    console.error("[behaviorRecord] insert failed", behErr);
    return replyText(token, rt, `❌ บันทึกไม่สำเร็จ: ${behErr.message}`, qrTeacher);
  }
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
        { type: "text", text: `${l.leave_type} ${l.start_date}→${l.end_date}`, size: "xs", color: "#666666" },
        { type: "text", text: l.reason || "-", size: "xs", color: "#888888", wrap: true },
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
  const isAdmin = !!(user && (user as any).isAdmin);
  if (!user || user.type !== "teacher") {
    console.warn("[approveLeave] not linked teacher/admin", { lineUserId, kind, leaveId });
    return replyText(token, rt, `❌ ไม่ได้รับอนุญาต (ยังไม่ได้ผูกบัญชีบุคลากร)`, qrDefault);
  }
  if (kind === "staff" && !isAdmin) {
    return replyText(token, rt, `❌ อนุมัติใบลาบุคลากรต้องเป็นผู้บริหาร/แอดมิน`, qrTeacher);
  }

  const table = kind === "staff" ? "staff_leaves" : "student_leaves";
  const status = approve ? "approved" : "rejected";
  const upd: any = { status };
  if (table === "staff_leaves") {
    upd.approved_by = user.id;
    upd.approved_at = new Date().toISOString();
  } else {
    upd.approved_by = user.id;
  }

  console.log("[approveLeave] update", { table, leaveId, status, actor: user.id, isAdmin });
  const { data: rows, error } = await sb.from(table).update(upd).eq("id", leaveId).select("id, status");
  if (error) {
    console.error("[approveLeave] update failed", error);
    return replyText(token, rt, `❌ อัปเดตไม่สำเร็จ: ${error.message}`, qrTeacher);
  }
  if (!rows || rows.length === 0) {
    console.warn("[approveLeave] zero rows matched", { table, leaveId });
    return replyText(token, rt, `⚠️ ไม่พบใบลานี้ในระบบ หรืออาจถูกอนุมัติ/ลบไปแล้ว`, qrTeacher);
  }
  if (rows[0].status !== status) {
    console.error("[approveLeave] status did not change", { table, leaveId, expected: status, actual: rows[0].status });
    return replyText(token, rt, `❌ อัปเดตไม่สำเร็จ: ระบบยังเป็นสถานะ ${rows[0].status}`, qrTeacher);
  }
  return replyText(token, rt, `${approve ? "✅ อนุมัติ" : "❌ ปฏิเสธ"}ใบลาเรียบร้อย (${rows[0].status})`, qrTeacher);
}

async function handleTodaySummaryForTeacher(sb: any, token: string, rt: string, lineUserId: string) {
  const user = await findLinkedUser(sb, lineUserId);
  if (!user || user.type !== "teacher") return replyText(token, rt, `❌ คำสั่งนี้สำหรับครู`, qrDefault);
  const today = new Date();
  const day = today.getDay();
  const isoDate = bkkDateISO(today);
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
  const today = todayBangkokISO();
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
        { type: "text", text: `${l.leave_type} ${l.start_date}→${l.end_date}`, size: "xs", color: "#666666" },
        { type: "text", text: l.reason || "-", size: "xs", color: "#888888", wrap: true },
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
  const { error: bcErr } = await sb.from("emergency_broadcasts").insert({
    title: "ประกาศจากผู้บริหาร",
    message,
    severity: "info",
    is_active: true,
    sent_at: new Date().toISOString(),
    sent_by: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
    author_id: user.id,
  });
  if (bcErr) {
    console.error("[adminBroadcast] insert failed", bcErr);
    return replyText(token, rt, `❌ ส่งประกาศไม่สำเร็จ: ${bcErr.message}`, qrAdmin);
  }
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
  const { getPublicOrigin } = await import("../_shared/appConfig.ts");
  const siteUrl: string = siteRow?.setting_value || (await getPublicOrigin());

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
  if (!user) {
    return replyFlex(token, rt, "ยังไม่ได้เชื่อมบัญชี", buildInfoCard(
      "🔗 ยังไม่ได้เชื่อมบัญชี",
      [
        { label: "ขั้นที่ 1", value: "รับรหัสที่โรงเรียน" },
        { label: "ขั้นที่ 2", value: "พิมพ์: เชื่อม [รหัส] [ววดดปปปป]" },
        { label: "ตัวอย่าง", value: "เชื่อม 12345 12052553" },
      ],
      "#F43F5E",
      { type: "button", action: { type: "message", label: "📋 ดูเมนู", text: "เมนู" } },
      "เชื่อมบัญชีเพื่อดูข้อมูลของคุณ",
    ), qrDefault);
  }
  if (user.type === "student") {
    const name = `${user.prefix||""}${user.first_name} ${user.last_name}`;
    return replyFlex(token, rt, `สถานะ - ${name}`, buildProfileCard({
      name, roleLabel: "นักเรียน / ผู้ปกครอง", roleColor: "#6366F1", avatarEmoji: "🎓",
      rows: [
        { label: "รหัสประจำตัว", value: user.student_code },
        { label: "ห้องเรียน", value: (user as any).classrooms?.name || "-" },
        { label: "สถานะ", value: "✅ เชื่อมบัญชีแล้ว" },
      ],
      footerAction: { type: "button", action: { type: "message", label: "📊 ดูผลการเรียน", text: "ผลการเรียน" } },
    }), qrParent);
  }
  const name = `${user.prefix||""}${user.first_name||""} ${user.last_name||""}`.trim();
  const isAdmin = !!(user as any)?.isAdmin;
  return replyFlex(token, rt, `สถานะ - ${name}`, buildProfileCard({
    name,
    roleLabel: isAdmin ? "ผู้บริหาร / แอดมิน" : "ครู / บุคลากร",
    roleColor: isAdmin ? "#F59E0B" : "#10B981",
    avatarEmoji: isAdmin ? "🏫" : "👨‍🏫",
    rows: [
      { label: "รหัสบุคลากร", value: user.employee_code || "-" },
      ...((user as any).position ? [{ label: "ตำแหน่ง", value: (user as any).position }] : []),
      { label: "สถานะ", value: "✅ เชื่อมบัญชีแล้ว" },
    ],
    footerAction: { type: "button", action: { type: "message", label: "📅 ตารางวันนี้", text: "ตารางวันนี้" } },
  }), isAdmin ? qrAdmin : qrTeacher);
}


// ============ SMART NATURAL-LANGUAGE Q&A (student/parent) ============
// ตอบคำถามแบบเป็นธรรมชาติ เช่น "เข้าเรียนกี่โมง", "ขาดเรียนวันไหน", "ลาวันไหนบ้าง"
// คืน true ถ้าจับ intent ได้ — เพื่อไม่ให้ตกไปที่ AI fallback (ซึ่งไม่มีข้อมูลส่วนตัว)
async function handleSmartQuery(sb: any, token: string, rt: string, lineUserId: string, t: string): Promise<boolean> {
  // ต้องเป็นคำถาม (มีคำชี้ความ) เพื่อกันชนคำสั่งสั้น
  if (!/วัน|ไหน|กี่|เมื่อ|โมง|บ้าง|เวลา|ตอน|ครั้ง|อะไร|ทำไม|เท่าไร|เท่าไหร่|มี|ใคร|อย่างไร|ยังไง|\?|？/i.test(t)) return false;
  const user = await findLinkedUser(sb, lineUserId);
  if (!user) return false;
  const isAdmin = !!(user as any)?.isAdmin;
  const isTeacher = user.type === "teacher";
  const isStudent = user.type === "student";


  // ขอบเขตเวลา
  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth(), 1);
  let to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let label = "เดือนนี้";
  if (/เดือนที่แล้ว|เดือนก่อน/.test(t)) {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
    label = "เดือนที่แล้ว";
  } else if (/ภาคเรียน|เทอม|ภาคนี้/.test(t)) {
    const m = now.getMonth();
    if (m >= 4 && m <= 9) { from = new Date(now.getFullYear(), 4, 1); to = new Date(now.getFullYear(), 9, 30); label = "เทอม 1"; }
    else { const y = m >= 10 ? now.getFullYear() : now.getFullYear() - 1; from = new Date(y, 10, 1); to = new Date(y + 1, 2, 31); label = "เทอม 2"; }
  } else if (/อาทิตย์นี้|สัปดาห์นี้|7\s*วัน/.test(t)) {
    from = new Date(now); from.setDate(from.getDate() - 6); label = "7 วันล่าสุด";
  } else if (/วันนี้|today/i.test(t)) {
    from = new Date(now); to = new Date(now); label = "วันนี้";
  }
  const fStr = bkkDateISO(from);
  const tStr = bkkDateISO(to);

  // ─── STUDENT / PARENT queries ─────────────────────────────────────────
  if (isStudent) {
    // 1) เวลาเข้า-ออกโรงเรียน (face scan)
    if (/(เข้าเรียน|มาโรงเรียน|สแกน|เช็คอิน|เช็คเอาท์|check[\s-]?(in|out)).*(กี่โมง|เวลา|ตอนไหน|ตอนกี่)/i.test(t)
        || /(กี่โมง|เวลา|ตอนไหน).*(เข้า|มา|ออก|กลับ)/i.test(t)) {
      const { data: scans } = await sb.from("face_scan_logs")
        .select("scan_date, scan_time, scan_type")
        .eq("student_id", user.id)
        .gte("scan_date", fStr).lte("scan_date", tStr)
        .order("scan_time", { ascending: false }).limit(20);
      if (!scans?.length) { await replyText(token, rt, `📋 ไม่มีบันทึกเวลาเข้า-ออก ${label}`, qrParent); return true; }
      const items = scans.map((s: any) => {
        const tm = new Date(s.scan_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
        return `${s.scan_date} ${tm} ${s.scan_type === "in" ? "🟢เข้า" : "🔴ออก"}`;
      });
      await replyFlex(token, rt, "เวลาเข้า-ออก", buildListCard(`⏰ เวลาเข้า-ออก ${label}`, items, "#0984E3"), qrParent);
      return true;
    }

    // 2) ขาด / สาย / ป่วย วันไหนบ้าง
    const askAbsent = /ขาด(เรียน|งาน)?/.test(t);
    const askLate = /(มา\s*สาย|สาย)/.test(t) && !/ป่วย|ขาด/.test(t);
    const askSick = /ป่วย/.test(t);
    if (askAbsent || askLate || askSick) {
      const status = askAbsent ? "absent" : askLate ? "late" : "sick";
      const stLabel = askAbsent ? "❌ ขาดเรียน" : askLate ? "⏰ มาสาย" : "🤒 ป่วย";
      const { data: rows } = await sb.from("attendance")
        .select("attendance_date, notes")
        .eq("student_id", user.id).eq("status", status)
        .gte("attendance_date", fStr).lte("attendance_date", tStr)
        .order("attendance_date", { ascending: false }).limit(40);
      if (!rows?.length) { await replyText(token, rt, `📋 ไม่มีวัน${stLabel} ${label} 🎉`, qrParent); return true; }
      const items = rows.map((r: any) => `• ${r.attendance_date}${r.notes ? ` — ${r.notes}` : ""}`);
      await replyFlex(token, rt, stLabel, buildListCard(`${stLabel} ${label} (${rows.length} วัน)`, items, "#E17055"), qrParent);
      return true;
    }

    // 3) ลาวันไหน / ลากี่ครั้ง
    if (/ลา/.test(t)) {
      const { data: leaves } = await sb.from("student_leaves")
        .select("leave_type, start_date, end_date, reason, status")
        .eq("student_id", user.id)
        .gte("start_date", fStr).lte("start_date", tStr)
        .order("start_date", { ascending: false }).limit(20);
      if (!leaves?.length) { await replyText(token, rt, `📋 ไม่มีการลา ${label}`, qrParent); return true; }
      const sm: Record<string, string> = { pending: "⏳", approved: "✅", rejected: "❌" };
      const items = leaves.map((l: any) => `${sm[l.status] || ""} ${l.leave_type} ${l.start_date}${l.end_date !== l.start_date ? `→${l.end_date}` : ""}${l.reason ? ` — ${l.reason}` : ""}`);
      await replyFlex(token, rt, "การลา", buildListCard(`📋 การลา ${label} (${leaves.length} ครั้ง)`, items, "#E17055"), qrParent);
      return true;
    }

    // 4) การบ้านที่ต้องส่ง / เหลืออะไรบ้าง
    if (/(การบ้าน|งาน|homework).*(อะไร|บ้าง|เหลือ|ต้องส่ง|กี่)/.test(t) || /(เหลือ|ต้องส่ง).*(การบ้าน|งาน)/.test(t)) {
      const { data: hws } = await sb.from("homework_assignments")
        .select("title, due_date, subjects(name_th,name)")
        .gte("due_date", todayBangkokISO())
        .order("due_date", { ascending: true }).limit(15);
      if (!hws?.length) { await replyText(token, rt, `🎉 ไม่มีการบ้านค้างส่ง`, qrParent); return true; }
      const items = hws.map((h: any) => `• ${h.due_date} — ${h.subjects?.name_th || h.subjects?.name || ""} : ${h.title}`);
      await replyFlex(token, rt, "การบ้านค้าง", buildListCard(`📚 การบ้านที่ยังไม่ถึงกำหนด (${hws.length})`, items, "#8B5CF6"), qrParent);
      return true;
    }
  }

  // ─── TEACHER queries ──────────────────────────────────────────────────
  if (isTeacher) {
    // นักเรียนขาด/สายวันนี้ในห้องที่ปรึกษา
    if (/(ห้อง|ชั้น|เด็ก|นักเรียน).*(ขาด|สาย|ป่วย).*(วันนี้|กี่|บ้าง)/.test(t)
        || /(ใคร|กี่คน).*(ขาด|สาย|ป่วย)/.test(t)) {
      const today = todayBangkokISO();
      const { data: cls } = await sb.from("classrooms")
        .select("id,name,grade_level,section").eq("homeroom_teacher_id", user.id).limit(3);
      if (!cls?.length) { await replyText(token, rt, "ยังไม่ได้เป็นครูประจำชั้น", qrTeacher); return true; }
      const lines: string[] = [];
      for (const c of cls) {
        const { data: att } = await sb.from("attendance")
          .select("status, students!inner(first_name,last_name,classroom_id)")
          .eq("attendance_date", today).in("status", ["absent","late","sick"])
          .eq("students.classroom_id", c.id);
        const label = c.name || `${c.grade_level}/${c.section}`;
        if (!att?.length) { lines.push(`✅ ${label}: มาครบ`); continue; }
        lines.push(`📌 ${label} (${att.length} คน)`);
        att.slice(0,10).forEach((r: any) => {
          const em = r.status === "absent" ? "❌" : r.status === "late" ? "⏰" : "🤒";
          lines.push(`  ${em} ${r.students?.first_name || ""} ${r.students?.last_name || ""}`);
        });
      }
      await replyFlex(token, rt, "สรุปเช็คชื่อวันนี้", buildListCard(`📋 นักเรียนขาด/สาย/ป่วย วันนี้`, lines, "#F59E0B"), qrTeacher);
      return true;
    }
    // ใบลารออนุมัติ
    if (/(ใบลา|ลา).*(รอ|กี่|บ้าง)/.test(t)) {
      const { data: cls } = await sb.from("classrooms").select("id").eq("homeroom_teacher_id", user.id);
      const clsIds = (cls || []).map((c: any) => c.id);
      if (!clsIds.length) { await replyText(token, rt, "ยังไม่ได้เป็นครูประจำชั้น", qrTeacher); return true; }
      const { data: pend } = await sb.from("student_leaves")
        .select("leave_type,start_date,end_date,students!inner(first_name,last_name,classroom_id)")
        .eq("status", "pending").in("students.classroom_id", clsIds).limit(20);
      if (!pend?.length) { await replyText(token, rt, "✅ ไม่มีใบลารออนุมัติ", qrTeacher); return true; }
      const items = pend.map((l: any) => `⏳ ${l.students?.first_name} ${l.students?.last_name} — ${l.leave_type} ${l.start_date}${l.end_date !== l.start_date ? `→${l.end_date}` : ""}`);
      await replyFlex(token, rt, "ใบลารออนุมัติ", buildListCard(`📋 ใบลารออนุมัติ (${pend.length})`, items, "#F59E0B"), qrTeacher);
      return true;
    }
  }

  // ─── ADMIN / DIRECTOR queries ─────────────────────────────────────────
  if (isAdmin) {
    if (/(นักเรียน|ครู|บุคลากร|ผู้ใช้).*(กี่|เท่าไร|เท่าไหร่|มีกี่)/.test(t)) {
      const [{ count: stu }, { count: tch }, { count: pu }] = await Promise.all([
        sb.from("students").select("id", { count: "exact", head: true }),
        sb.from("personnel").select("id", { count: "exact", head: true }),
        sb.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      await replyFlex(token, rt, "สถิติผู้ใช้", buildListCard("📊 สถิติผู้ใช้ในระบบ", [
        `🎓 นักเรียน: ${stu ?? 0} คน`,
        `👨‍🏫 บุคลากร: ${tch ?? 0} คน`,
        `👥 ผู้ใช้ทั้งหมด: ${pu ?? 0} คน`,
      ], "#F59E0B"), qrAdmin);
      return true;
    }
    if (/(ขาด|สาย|ป่วย).*(วันนี้|กี่คน|บ้าง)/.test(t)) {
      const today = todayBangkokISO();
      const { data: att } = await sb.from("attendance").select("status").eq("attendance_date", today);
      const c = { absent: 0, late: 0, sick: 0, present: 0 } as any;
      (att || []).forEach((r: any) => { c[r.status] = (c[r.status] || 0) + 1; });
      await replyFlex(token, rt, "สรุปวันนี้", buildListCard("📊 การมาเรียนทั้งโรงเรียน วันนี้", [
        `✅ มาเรียน: ${c.present}`,
        `❌ ขาด: ${c.absent}`,
        `⏰ สาย: ${c.late}`,
        `🤒 ป่วย: ${c.sick}`,
      ], "#F59E0B"), qrAdmin);
      return true;
    }
  }

  return false;
}


// ============ MAIN TEXT ROUTER ============

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

  // 7. Contact — beautiful card with call/map buttons when phone is present
  if (/ติดต่อ|โทร|contact|เบอร์|แผนที่|ที่อยู่/i.test(t)) {
    const { data: s } = await sb.from("school_settings").select("setting_key,setting_value").in("setting_key", ["school_name","school_phone","school_address","school_email","school_website","school_facebook"]);
    const m: Record<string,string> = {}; s?.forEach((x: any) => m[x.setting_key] = x.setting_value || "");
    const rows = [
      { label: "โรงเรียน", value: m.school_name || "-" },
      { label: "โทร", value: m.school_phone || "-" },
      { label: "อีเมล", value: m.school_email || "-" },
      { label: "ที่อยู่", value: m.school_address || "-" },
      ...(m.school_website ? [{ label: "เว็บไซต์", value: m.school_website }] : []),
    ];
    const footerAction = m.school_phone
      ? { type: "button", action: { type: "uri", label: "📞 โทรหาโรงเรียน", uri: `tel:${m.school_phone.replace(/[^0-9+]/g, "")}` } }
      : undefined;
    return replyFlex(token, rt, "ติดต่อโรงเรียน", buildInfoCard("📞 ติดต่อโรงเรียน", rows, "#0EA5E9", footerAction, "ช่องทางติดต่อทั้งหมด"));
  }


  // 8. Help / menu — beautiful role-aware carousel
  if (/^(?:help|เมนู|ช่วยเหลือ|คำสั่ง|menu|start|เริ่ม)$/i.test(t)) {
    try { await clearSession(sb, lineUserId); } catch { /* ignore */ }
    const user = await findLinkedUser(sb, lineUserId);
    const isTeacher = user?.type === "teacher";
    const isStudent = user?.type === "student";
    const isAdmin = !!(user as any)?.isAdmin;

    const bubbles: any[] = [];
    // Cover bubble — greeting + primary CTA
    const greetName = user ? `${user.prefix || ""}${user.first_name || ""}`.trim() : "แขก";
    bubbles.push(buildProfileCard({
      name: `สวัสดี ${greetName || "ครับ"} 👋`,
      roleLabel: isAdmin ? "ผู้บริหาร / แอดมิน" : isTeacher ? "ครู / บุคลากร" : isStudent ? "นักเรียน / ผู้ปกครอง" : "แขก",
      roleColor: isAdmin ? "#F59E0B" : isTeacher ? "#10B981" : isStudent ? "#6366F1" : "#64748B",
      avatarEmoji: isAdmin ? "🏫" : isTeacher ? "👨‍🏫" : isStudent ? "🎓" : "✨",
      rows: [
        { label: "สถานะ", value: user ? "✅ เชื่อมบัญชีแล้ว" : "⏳ ยังไม่เชื่อม" },
        { label: "เมนูล่าง", value: "ใช้ Rich Menu ก็ได้" },
        { label: "คำสั่งเร็ว", value: "พิมพ์คำในการ์ดถัดไป" },
      ],
      footerAction: user
        ? { type: "button", action: { type: "message", label: "📊 ดูข้อมูลของฉัน", text: isTeacher ? "ตารางวันนี้" : "ผลการเรียน" } }
        : { type: "button", action: { type: "message", label: "🔗 วิธีเชื่อมบัญชี", text: "เชื่อม" } },
    }));

    if (isStudent) {
      bubbles.push(buildSectionCard({
        icon: "📊", title: "การเรียน", color: "#6366F1",
        lines: ["ผลการเรียน — เกรดรายวิชา", "การเข้าเรียน — สรุปเดือนนี้", "การบ้าน / สอบ — สิ่งที่ต้องทำ"],
        ctas: [
          { label: "📊 ผลการเรียน", text: "ผลการเรียน" },
          { label: "✅ การเข้าเรียน", text: "การเข้าเรียน" },
          { label: "📚 การบ้าน", text: "การบ้าน" },
        ],
      }));
      bubbles.push(buildSectionCard({
        icon: "🌿", title: "ชีวิตในโรงเรียน", color: "#10B981",
        lines: ["พฤติกรรม / SDQ", "สุขภาพ / อาหารกลางวัน", "เงินอุดหนุน / เยี่ยมบ้าน"],
        ctas: [
          { label: "⭐ พฤติกรรม", text: "พฤติกรรม" },
          { label: "🏥 สุขภาพ", text: "สุขภาพ" },
          { label: "🍱 อาหาร", text: "อาหาร" },
        ],
      }));
      bubbles.push(buildSectionCard({
        icon: "📝", title: "การลา / ปฏิทิน", color: "#F43F5E",
        lines: ["ลา — ส่งใบลาออนไลน์", "ประวัติลา — ดูสถานะ", "ปฏิทิน — กิจกรรมโรงเรียน"],
        ctas: [
          { label: "📝 ส่งใบลา", text: "ลา" },
          { label: "📋 ประวัติลา", text: "ประวัติลา" },
          { label: "📅 ปฏิทิน", text: "ปฏิทิน" },
        ],
      }));
    }

    if (isTeacher) {
      bubbles.push(buildSectionCard({
        icon: "✅", title: "งานประจำวัน", color: "#10B981",
        lines: ["เช็คเข้าแถว — ครูประจำชั้น", "เช็ครายคาบ — เลือกคาบสอน", "สรุปวันนี้ — งานทั้งหมด"],
        ctas: [
          { label: "🚩 เช็คเข้าแถว", text: "เช็คเข้าแถว" },
          { label: "🕐 เช็ครายคาบ", text: "เช็ครายคาบ" },
          { label: "📊 สรุปวันนี้", text: "สรุปวันนี้" },
        ],
      }));
      bubbles.push(buildSectionCard({
        icon: "📚", title: "การสอน", color: "#8B5CF6",
        lines: ["วิชาที่สอน / สรุปห้อง", "การบ้านที่มอบหมาย", "งานสอนแทน / บันทึกพฤติกรรม"],
        ctas: [
          { label: "📚 วิชาฉัน", text: "วิชาฉัน" },
          { label: "📝 การบ้านฉัน", text: "การบ้านฉัน" },
          { label: "🔁 สอนแทน", text: "สอนแทน" },
        ],
      }));
      bubbles.push(buildSectionCard({
        icon: "📋", title: "การลา", color: "#F59E0B",
        lines: ["ส่งใบลา — แนบไฟล์ได้", "อนุมัติลา — ห้องที่ปรึกษา", "ประวัติลา — ของฉัน"],
        ctas: [
          { label: "📝 ส่งใบลา", text: "ลา" },
          { label: "📋 อนุมัติลา", text: "อนุมัติลา" },
          { label: "📅 ตารางวันนี้", text: "ตารางวันนี้" },
        ],
      }));
    }

    if (isAdmin) {
      bubbles.push(buildSectionCard({
        icon: "🏫", title: "ภาพรวมโรงเรียน", color: "#F59E0B",
        lines: ["ภาพรวม — สถิติวันนี้", "สถิติผู้ใช้ในระบบ", "ประกาศฉุกเฉิน"],
        ctas: [
          { label: "📊 ภาพรวม", text: "ภาพรวม" },
          { label: "👥 ผู้ใช้", text: "ผู้ใช้" },
          { label: "📣 ประกาศ", text: "ประกาศ" },
        ],
      }));
      bubbles.push(buildSectionCard({
        icon: "📋", title: "งานอนุมัติ", color: "#EC4899",
        lines: ["ใบลาครูรออนุมัติ", "ข่าวรอเผยแพร่", "ปฏิทินโรงเรียน"],
        ctas: [
          { label: "📋 ลารออนุมัติ", text: "ลารออนุมัติ" },
          { label: "📰 ข่าวรอเผยแพร่", text: "ข่าวรอเผยแพร่" },
          { label: "📅 ปฏิทิน", text: "ปฏิทิน" },
        ],
      }));
    }

    if (!user) {
      bubbles.push(buildSectionCard({
        icon: "🔗", title: "เชื่อมบัญชี", color: "#6366F1",
        lines: ["รับรหัสจากโรงเรียน", "พิมพ์: เชื่อม [รหัส] [ววดดปปปป]", "ตัวอย่าง: เชื่อม 12345 12052553"],
        ctas: [
          { label: "📰 ข่าว", text: "ข่าว" },
          { label: "📞 ติดต่อ", text: "ติดต่อ" },
          { label: "📅 ปฏิทิน", text: "ปฏิทิน" },
        ],
      }));
    }

    // Always end with common utilities
    bubbles.push(buildSectionCard({
      icon: "🔧", title: "ทั่วไป", color: "#64748B",
      lines: ["ตาราง / ข่าว / ปฏิทิน", "ติดต่อโรงเรียน", "ประกาศฉุกเฉิน"],
      ctas: [
        { label: "📅 ตาราง", text: "ตาราง" },
        { label: "📰 ข่าว", text: "ข่าว" },
        { label: "📞 ติดต่อ", text: "ติดต่อ" },
      ],
    }));

    return replyFlex(token, rt, "📚 เมนู Smart School", buildCarousel(bubbles), qrFor(user?.type, isAdmin));
  }

  // 8.5 Smart Q&A — ตอบคำถามจากข้อมูลจริงก่อนตกไปที่ AI fallback
  try { if (await handleSmartQuery(sb, token, rt, lineUserId, t)) return; } catch (e) { console.error("smartQuery", e); }

  // 9. AI fallback — ใช้ webhook reply (ไม่กินโควตา push ของ LINE)
  //    ปรับให้ตอบยาวขึ้น ครอบคลุมมากขึ้น และเข้าใจ role ของผู้ใช้
  if (t.length >= 2 && t.length <= 800) {
    try {
      const uCtx = await findLinkedUser(sb, lineUserId);
      const isAdminCtx = !!(uCtx as any)?.isAdmin;
      const roleCtx = isAdminCtx ? "ผู้บริหาร/แอดมิน" : uCtx?.type === "teacher" ? "ครู/บุคลากร" : uCtx?.type === "student" ? "นักเรียน/ผู้ปกครอง" : "ผู้ใช้ทั่วไป (ยังไม่เชื่อมบัญชี)";
      const nameCtx = uCtx ? `${uCtx.prefix || ""}${uCtx.first_name || ""} ${uCtx.last_name || ""}`.trim() : "";
      const commonCmds = "เมนู | ตาราง | ข่าว | ปฏิทิน | ติดต่อ | สถานะ | ยกเลิกเชื่อม | ฉุกเฉิน";
      const studentCmds = "ผลการเรียน | การเข้าเรียน | พฤติกรรม | SDQ | การบ้าน | สอบ | สุขภาพ | อาหาร | เงินอุดหนุน | เยี่ยมบ้าน | ลา | ประวัติลา";
      const teacherCmds = "เช็คเข้าแถว | เช็ครายคาบ | เช็คชื่อ | สรุปห้อง | วิชาฉัน | การบ้านฉัน | สอนแทน | บันทึกพฤติกรรม | อนุมัติลา | สรุปวันนี้ | ตารางวันนี้";
      const adminCmds = "ภาพรวม | ผู้ใช้ | ลารออนุมัติ | ข่าวรอเผยแพร่ | ประกาศ [ข้อความ]";
      const cmdList = isAdminCtx ? `${adminCmds} | ${teacherCmds} | ${studentCmds} | ${commonCmds}`
        : uCtx?.type === "teacher" ? `${teacherCmds} | ${studentCmds} | ${commonCmds}`
        : uCtx?.type === "student" ? `${studentCmds} | ${commonCmds}`
        : commonCmds;

      const system = [
        "คุณคือ 'Smart School Assistant' — ผู้ช่วย AI ทางการของโรงเรียนใน LINE OA",
        "หน้าที่: ตอบคำถามผู้ใช้เกี่ยวกับระบบโรงเรียน แนะนำคำสั่งบอท ให้คำแนะนำเรื่องการเรียน/การสอน/บริหารจัดการ",
        "ตอบเป็นภาษาไทยชัดเจน อ่านง่าย 4-10 บรรทัด ใช้ bullet/อีโมจิเมื่อช่วยให้เข้าใจง่าย",
        "ห้ามแต่งข้อมูลส่วนบุคคล ห้ามให้ตัวเลข/คะแนน/เกรด/ชื่อ ที่ไม่มีในบริบท",
        "ถ้าคำถามต้องดูข้อมูลจริง ให้บอกคำสั่งที่ผู้ใช้พิมพ์เอง (เช่น 'ผลการเรียน', 'สรุปวันนี้')",
        "ถ้าเป็นคำถามทั่วไป (ทำการบ้าน/วิธีเรียน/แนวข้อสอบ/เทคนิคสอน/นโยบายการศึกษา) ให้ตอบเต็มที่",
        "ถ้าไม่รู้ ให้บอกตรง ๆ และเสนอคำสั่งที่ใกล้เคียง",
        `บริบทผู้ใช้: บทบาท=${roleCtx}${nameCtx ? ` ชื่อ=${nameCtx}` : ""}`,
        `คำสั่งที่ใช้ได้: ${cmdList}`,
      ].join("\n");

      const { aiCall } = await import("../_shared/aiCall.ts");
      const out = await aiCall({
        messages: [
          { role: "system", content: system },
          { role: "user", content: t },
        ],
        temperature: 0.7,
        max_tokens: 900,
        functionName: "line-webhook",
      });
      const reply = out.content?.trim();
      if (reply) {
        return replyText(token, rt, reply, qrFor(uCtx?.type, isAdminCtx));
      }
    } catch (e) { console.error("AI fallback", e); }
  }



  // 10. Fallback — beautiful "did you mean" card with suggestions instead of a lone text line
  const u = await findLinkedUser(sb, lineUserId);
  const isAdmin = !!(u as any)?.isAdmin;
  const suggestions = isAdmin
    ? [{ label: "📊 ภาพรวมโรงเรียน", text: "ภาพรวม" }, { label: "📋 ลารออนุมัติ", text: "ลารออนุมัติ" }, { label: "📰 ข่าวรอเผยแพร่", text: "ข่าวรอเผยแพร่" }]
    : u?.type === "teacher"
      ? [{ label: "🚩 เช็คเข้าแถว", text: "เช็คเข้าแถว" }, { label: "📅 ตารางวันนี้", text: "ตารางวันนี้" }, { label: "📊 สรุปวันนี้", text: "สรุปวันนี้" }]
      : u?.type === "student"
        ? [{ label: "📊 ผลการเรียน", text: "ผลการเรียน" }, { label: "✅ การเข้าเรียน", text: "การเข้าเรียน" }, { label: "📝 ส่งใบลา", text: "ลา" }]
        : [{ label: "🔗 เชื่อมบัญชี", text: "เชื่อม" }, { label: "📰 ข่าว", text: "ข่าว" }, { label: "📞 ติดต่อ", text: "ติดต่อ" }];

  const bubble = {
    type: "bubble", size: "kilo",
    header: headerBox("🤖 ไม่พบคำสั่งที่ตรง", "#64748B", `ลองคำสั่งที่แนะนำด้านล่าง หรือพิมพ์ "เมนู"`),
    body: {
      type: "box", layout: "vertical", paddingAll: "16px", spacing: "sm", backgroundColor: BRAND.surface,
      contents: [
        { type: "text", text: `คุณพิมพ์: "${t.slice(0, 60)}"`, size: "xs", color: BRAND.muted, wrap: true },
        { type: "separator", color: BRAND.hair },
        { type: "text", text: "💡 คำสั่งแนะนำ", size: "sm", weight: "bold", color: BRAND.ink },
        ...suggestions.map((s) => ({
          type: "button", height: "sm", style: "secondary",
          action: { type: "message", label: s.label, text: s.text },
        })),
      ],
    },
    footer: {
      type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: BRAND.soft,
      contents: [{ type: "button", height: "sm", style: "primary", color: BRAND.accent,
        action: { type: "message", label: "📋 ดูเมนูทั้งหมด", text: "เมนู" } }],
    },
  };
  return replyFlex(token, rt, "คำสั่งไม่ตรง", bubble, qrFor(u?.type, isAdmin));
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
        // Group / room events are handled by the dedicated line-vault-webhook (separate LINE OA).
        // The chatbot OA should be a 1:1 bot; ignore any accidental group traffic here.
        if (event.source?.type === "group" || event.source?.type === "room") {
          continue;
        }
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
          // Attach role-aware rich menu if the user is already linked; else default
          let linked: any = null;
          try {
            linked = uid ? await findLinkedUser(sb, uid) : null;
            const roles: string[] = ((linked as any)?.roles || []) as string[];
            const isDirector = roles.includes("director");
            const isAdminRole = roles.includes("admin");
            const menuKey = isDirector ? "line_richmenu_director"
              : isAdminRole ? "line_richmenu_admin"
              : linked?.type === "teacher" ? "line_richmenu_teacher"
              : linked?.type === "student" ? "line_richmenu_parent"
              : "line_richmenu_default";
            const rmId = settings[menuKey] || settings.line_richmenu_default;
            if (rmId) await linkRichMenuToUser(token, uid, rmId);
          } catch (_) { if (settings.line_richmenu_default) await linkRichMenuToUser(token, uid, settings.line_richmenu_default); }

          if (linked) {
            // Already linked — show usage guide, not linking instructions
            const name = linked.type === "student"
              ? `${linked.prefix || ""}${linked.first_name || ""} ${linked.last_name || ""}`.trim()
              : `${linked.prefix || ""}${linked.first_name || ""} ${linked.last_name || ""}`.trim();
            const roleLabel = linked.type === "student" ? "ผู้ปกครอง"
              : (linked as any).isAdmin ? "ผู้บริหาร/แอดมิน" : "บุคลากร";
            const rows = linked.type === "student"
              ? [
                  { label: "บัญชี", value: name || "-" },
                  { label: "เช็คชื่อ", value: 'พิมพ์ "สถานะ"' },
                  { label: "ส่งใบลา", value: 'พิมพ์ "ลา"' },
                  { label: "ข่าว/ปฏิทิน", value: 'พิมพ์ "ข่าว" หรือ "ปฏิทิน"' },
                  { label: "เมนูทั้งหมด", value: 'พิมพ์ "เมนู"' },
                ]
              : [
                  { label: "บัญชี", value: name || "-" },
                  { label: "อนุมัติใบลา", value: 'พิมพ์ "ใบลา"' },
                  { label: "สรุปวันนี้", value: 'พิมพ์ "วันนี้"' },
                  { label: "บันทึกพฤติกรรม", value: 'บันทึก [รหัส] [+/-คะแนน] [เหตุผล]' },
                  { label: "เมนูทั้งหมด", value: 'พิมพ์ "เมนู"' },
                ];
            await replyFlex(token, event.replyToken, `🎉 ยินดีต้อนรับกลับ ${name}`.trim(), buildProfileCard({
              name: `ยินดีต้อนรับกลับ 🎉`,
              roleLabel,
              roleColor: "#10b981",
              avatarEmoji: linked.type === "student" ? "👨‍👩‍👧" : "🧑‍🏫",
              rows,
              footerAction: { type: "button", action: { type: "message", label: "📋 ดูเมนูทั้งหมด", text: "เมนู" } },
            }), qrFor(linked.type));
          } else {
            await replyFlex(token, event.replyToken, "🎉 ยินดีต้อนรับสู่ Smart School", buildProfileCard({
              name: "ยินดีต้อนรับ 🎉",
              roleLabel: "Smart School Bot",
              roleColor: "#6366F1",
              avatarEmoji: "🏫",
              rows: [
                { label: "ขั้นที่ 1", value: "รับรหัสที่โรงเรียน" },
                { label: "ขั้นที่ 2", value: "พิมพ์: เชื่อม [รหัส] [ววดดปปปป]" },
                { label: "ตัวอย่าง", value: "เชื่อม 12345 12052553" },
                { label: "ต้องการเมนู", value: 'พิมพ์ "เมนู"' },
              ],
              footerAction: { type: "button", action: { type: "message", label: "📋 ดูเมนูทั้งหมด", text: "เมนู" } },
            }), qrDefault);
          }


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
