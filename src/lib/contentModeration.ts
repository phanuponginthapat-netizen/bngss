// Content moderation: profanity filter (Thai + English) + image moderation via edge function
import { supabase } from "@/integrations/supabase/client";

// Thai + English profanity / slurs / sexual / drug / violence keywords (school-safe baseline).
// เพิ่ม/ลบได้ตามนโยบายโรงเรียน
const BAD_WORDS_TH = [
  "ควย","เหี้ย","สัส","สัตว์เลว","เย็ด","หี","แตด","กระหรี่","อีดอก","อีตอแหล",
  "ไอ้เหี้ย","อีเหี้ย","ไอ้สัตว์","อีสัตว์","ระยำ","เชี่ย","เชี้ย","ชิบหาย","ฉิบหาย",
  "มึงตาย","กูจะฆ่า","ฆ่าตัวตาย","ฆ่ามัน","ไอ้ควาย","อีควาย","โง่ฉิบหาย",
  "หน้าหี","หน้าควย","แม่ง","แม่มึง","พ่อมึงตาย",
  "ยาบ้า","ยาไอซ์","กัญชา","เฮโรอีน","ขายยา",
  "โป๊","อนาจาร","หนังโป๊","คลิปหลุด",
];
const BAD_WORDS_EN = [
  "fuck","fucking","fucker","shit","bitch","bastard","asshole","dick","pussy",
  "cunt","whore","slut","motherfucker","nigger","faggot","retard",
  "kill yourself","kys","suicide","rape","porn","xxx","sex",
  "cocaine","heroin","meth",
];

const ALL_BAD = [...BAD_WORDS_TH, ...BAD_WORDS_EN].map((w) => w.toLowerCase());

// Normalize: lowercase + remove zero-width chars + collapse repeated chars (fuuuck → fuck)
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\.\-_\*\s]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1");
}

export interface ModerationResult {
  ok: boolean;
  reason?: string;
  matches?: string[];
}

/** ตรวจคำหยาบในข้อความ — คืน {ok:false} ถ้าพบ */
export function checkProfanity(text: string): ModerationResult {
  if (!text) return { ok: true };
  const norm = " " + normalize(text) + " ";
  const found: string[] = [];
  for (const w of ALL_BAD) {
    const nw = normalize(w);
    if (!nw) continue;
    // For Thai (no spaces) → substring; for English → word-ish boundary
    const isThai = /[\u0E00-\u0E7F]/.test(nw);
    if (isThai) {
      if (norm.includes(nw)) found.push(w);
    } else {
      const re = new RegExp(`(^|[^a-z0-9])${nw.replace(/\s+/g, "\\s*")}([^a-z0-9]|$)`, "i");
      if (re.test(norm)) found.push(w);
    }
  }
  if (found.length) {
    return {
      ok: false,
      reason: `พบคำที่ไม่เหมาะสม: ${Array.from(new Set(found)).slice(0, 3).join(", ")}`,
      matches: found,
    };
  }
  return { ok: true };
}

/** กรอง: แทนคำหยาบด้วย *** (สำหรับกรณีต้องการเซ็นเซอร์แทนการบล็อก) */
export function maskProfanity(text: string): string {
  if (!text) return text;
  let out = text;
  for (const w of ALL_BAD) {
    if (!w) continue;
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, (m) => "*".repeat(Math.max(2, m.length)));
  }
  return out;
}

/** ตรวจรูปภาพไม่เหมาะสมผ่าน edge function (Lovable AI vision) */
export async function moderateImage(imageUrlOrDataUrl: string): Promise<ModerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("moderate-image", {
      body: { image: imageUrlOrDataUrl },
    });
    if (error) {
      // Fail-open on infra error เพื่อไม่บล็อกผู้ใช้ทั้งหมด แต่ log
      console.warn("moderate-image error", error);
      return { ok: true };
    }
    const safe = (data as any)?.safe;
    if (safe === false) {
      return { ok: false, reason: (data as any)?.reason || "พบเนื้อหารูปภาพไม่เหมาะสม" };
    }
    return { ok: true };
  } catch (e) {
    console.warn("moderate-image exception", e);
    return { ok: true };
  }
}

/** Helper: read File → data URL (สำหรับส่งเข้า vision API) */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
