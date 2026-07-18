// Shared LINE leave-request conversation flow.
// The webhook injects its reply/quickReply/user-lookup helpers via `deps`
// so this module stays free of edge-function-specific globals.

import { setSession, clearSession, normalizeDob, todayPlus } from "./lineSession.ts";
import { buildInfoCard } from "./lineFlex.ts";

export type LeaveDeps = {
  replyText: (token: string, rt: string, text: string, qr?: any) => Promise<any>;
  replyFlex: (token: string, rt: string, alt: string, bubble: any, qr?: any) => Promise<any>;
  findLinkedUser: (sb: any, lineUserId: string) => Promise<any>;
  downloadLineContent: (token: string, messageId: string) => Promise<{ data: Uint8Array; mime: string } | null>;
  qrDefault: any;
  qrFor: (userType?: string, isAdmin?: boolean) => any;
};

export async function startLeaveFlow(sb: any, token: string, rt: string, lineUserId: string, deps: LeaveDeps) {
  const user = await deps.findLinkedUser(sb, lineUserId);
  if (!user) return deps.replyText(token, rt, `❌ ต้องเชื่อมบัญชีก่อนถึงจะส่งใบลาได้`, deps.qrDefault);
  await setSession(sb, lineUserId, "leave", "type", { userType: user.type, userId: user.id, personnelId: (user as any).personnel_id });
  await deps.replyText(token, rt, `📝 ส่งใบลา (ขั้น 1/5)\nเลือกประเภทการลา`, {
    items: [
      { type: "action", action: { type: "message", label: "🤒 ลาป่วย", text: "ป่วย" } },
      { type: "action", action: { type: "message", label: "📋 ลากิจ", text: "กิจ" } },
      { type: "action", action: { type: "message", label: "🌴 ลาพักผ่อน", text: "พักผ่อน" } },
      { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
    ],
  });
}

export async function continueLeaveFlow(sb: any, token: string, rt: string, lineUserId: string, session: any, text: string, deps: LeaveDeps) {
  const t = text.trim();
  if (/^(ยกเลิก|cancel)$/i.test(t)) {
    await clearSession(sb, lineUserId);
    return deps.replyText(token, rt, `❌ ยกเลิกการส่งใบลาแล้ว`, deps.qrFor(session.payload?.userType));
  }

  if (session.step === "type") {
    const typeMap: Record<string, string> = { "ป่วย": "ลาป่วย", "กิจ": "ลากิจ", "พักผ่อน": "ลาพักผ่อน", "อื่นๆ": "ลาอื่นๆ" };
    const leaveType = typeMap[t] || t;
    await setSession(sb, lineUserId, "leave", "start_date", { ...session.payload, leave_type: leaveType });
    return deps.replyText(token, rt, `📝 ส่งใบลา (ขั้น 2/5)\nวันที่เริ่มลา? (YYYY-MM-DD หรือเลือก)`, {
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
    if (!n) return deps.replyText(token, rt, `❌ วันที่ไม่ถูกต้อง ลองใหม่ (เช่น 2026-05-20 หรือ 20/05/2569)`);
    await setSession(sb, lineUserId, "leave", "end_date", { ...session.payload, start_date: n });
    return deps.replyText(token, rt, `📝 ส่งใบลา (ขั้น 3/5)\nวันที่สิ้นสุด?`, {
      items: [
        { type: "action", action: { type: "message", label: "วันเดียวกัน", text: n } },
        { type: "action", action: { type: "message", label: "วันถัดไป", text: todayPlus(1) } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "end_date") {
    const n = normalizeDob(t);
    if (!n) return deps.replyText(token, rt, `❌ วันที่ไม่ถูกต้อง ลองใหม่`);
    if (n < session.payload.start_date) return deps.replyText(token, rt, `❌ วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่ม`);
    await setSession(sb, lineUserId, "leave", "reason", { ...session.payload, end_date: n });
    return deps.replyText(token, rt, `📝 ส่งใบลา (ขั้น 4/5)\nเหตุผลการลา? (พิมพ์ข้อความสั้นๆ)`, {
      items: [{ type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } }],
    });
  }

  if (session.step === "reason") {
    if (t.length < 3) return deps.replyText(token, rt, `❌ กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร`);
    await setSession(sb, lineUserId, "leave", "attachment", { ...session.payload, reason: t });
    return deps.replyText(token, rt, `📝 ส่งใบลา (ขั้น 5/5)\n📎 แนบใบรับรองแพทย์/หลักฐาน (ส่งรูปหรือไฟล์) หรือพิมพ์ "ข้าม" เพื่อข้าม`, {
      items: [
        { type: "action", action: { type: "message", label: "⏭️ ข้าม", text: "ข้าม" } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "attachment") {
    if (/^(ข้าม|skip|ไม่มี)$/i.test(t)) {
      await setSession(sb, lineUserId, "leave", "confirm", session.payload);
      return showLeaveConfirm(token, rt, session.payload, deps);
    }
    return deps.replyText(token, rt, `📎 กรุณาส่งรูป/ไฟล์ที่ต้องการแนบ หรือพิมพ์ "ข้าม"`, {
      items: [
        { type: "action", action: { type: "message", label: "⏭️ ข้าม", text: "ข้าม" } },
        { type: "action", action: { type: "message", label: "❌ ยกเลิก", text: "ยกเลิก" } },
      ],
    });
  }

  if (session.step === "confirm") {
    if (!/^(ยืนยัน|confirm|ok|ใช่)$/i.test(t)) return deps.replyText(token, rt, `พิมพ์ "ยืนยัน" เพื่อส่ง หรือ "ยกเลิก"`);
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
        return deps.replyText(token, rt, `❌ ไม่พบข้อมูลบุคลากรของคุณ`);
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
        lineUserId, userType: p.userType, userId: p.userId,
        personnelId: p.personnelId, leaveType: p.leave_type,
        startDate: p.start_date, endDate: p.end_date, error: insertError,
      });
      return deps.replyText(token, rt, `❌ ระบบยังไม่รับใบลานี้เข้ามา ลองกดยืนยันใหม่อีกครั้ง หรือพิมพ์ "ลา" เพื่อเริ่มใหม่`, deps.qrFor(p.userType));
    }

    await clearSession(sb, lineUserId);
    return deps.replyFlex(token, rt, "ส่งใบลาสำเร็จ",
      buildInfoCard("✅ ส่งใบลาแล้ว", [
        { label: "ประเภท", value: p.leave_type },
        { label: "วันที่", value: `${p.start_date} ถึง ${p.end_date}` },
        { label: "ไฟล์แนบ", value: p.attachment_url ? "✅ มี" : "—" },
        { label: "สถานะ", value: "⏳ รออนุมัติ" },
      ], "#10b981"), deps.qrFor(p.userType));
  }
}

export function showLeaveConfirm(token: string, rt: string, p: any, deps: LeaveDeps) {
  return deps.replyFlex(token, rt, "ยืนยันการส่งใบลา",
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
    ]},
  );
}

export async function handleLeaveAttachmentMessage(sb: any, token: string, rt: string, lineUserId: string, session: any, event: any, deps: LeaveDeps) {
  const msg = event.message;
  if (!msg || (msg.type !== "image" && msg.type !== "file" && msg.type !== "video")) {
    return deps.replyText(token, rt, `📎 กรุณาส่งรูป/ไฟล์ หรือพิมพ์ "ข้าม"`);
  }
  const content = await deps.downloadLineContent(token, msg.id);
  if (!content) return deps.replyText(token, rt, `❌ ดาวน์โหลดไฟล์ไม่สำเร็จ ลองใหม่ หรือพิมพ์ "ข้าม"`);

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
    contentType: content.mime, upsert: false,
  });
  if (upErr) {
    console.error("upload leave attachment fail", upErr);
    return deps.replyText(token, rt, `❌ อัปโหลดไม่สำเร็จ ลองใหม่ หรือพิมพ์ "ข้าม"`);
  }
  const { data: signed } = await sb.storage.from("leave-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  const url = signed?.signedUrl || path;
  const newPayload = { ...session.payload, attachment_url: url, attachment_path: path };
  await setSession(sb, lineUserId, "leave", "confirm", newPayload);
  return showLeaveConfirm(token, rt, newPayload, deps);
}
