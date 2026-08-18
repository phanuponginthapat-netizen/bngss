/**
 * Adaptive Face Learning — ระบบ "เรียนรู้ใบหน้าอัตโนมัติ" ทุกครั้งที่สแกนสำเร็จ
 *
 * แนวคิด: ใบหน้าที่ลงทะเบียนครั้งแรกมักถ่ายในแสง/มุม/กล้องเดียว
 * เมื่อสแกนจริงหน้างาน (แสงเช้า/เย็น, กล้องคีออส, ใส่แว่น, ทรงผมเปลี่ยน)
 * ระบบจะเก็บ descriptor ใหม่เข้าคลังของนักเรียนคนนั้น → รอบถัดไปแม่นขึ้นเรื่อย ๆ
 *
 * เงื่อนไขความปลอดภัย (กันเรียนรู้ผิดคน — เรียนรู้ผิด = พังทั้งระบบ):
 *   1. ต้องเป็น match ระดับ "ยืนยันได้" (confidence สูง + margin ห่างคนอันดับสองมาก)
 *   2. คุณภาพภาพต้องดี (คมชัด, ใบหน้าใหญ่พอ, ไม่เอียง/ก้มเงยเกิน)
 *   3. descriptor ใหม่ต้อง "ต่างพอที่จะมีประโยชน์" แต่ "ไม่ต่างจนน่าสงสัย"
 *   4. จำกัดจำนวนต่อคนต่อวัน และมีเพดานรวมต่อคน (ตัดตัวที่ซ้ำซ้อนที่สุดทิ้ง)
 */
import { supabase } from "@/integrations/supabase/client";
import { BANK_GRADE, type MatchResult } from "@/lib/faceApi";
import { cosineDistance } from "@/lib/arcface";

export const ADAPTIVE = {
  /** ต้องมั่นใจอย่างน้อยเท่านี้ถึงจะยอมเรียนรู้ */
  MIN_CONFIDENCE: 0.74,
  /** ระยะห่างจากคนอันดับสอง — ยิ่งมากยิ่งมั่นใจว่าไม่ใช่คนอื่น */
  MIN_MARGIN: 0.10,
  /** ระยะจากตัวที่ match ต้องแน่นกว่าเกณฑ์ปกติ */
  MAX_DISTANCE: 0.26,
  /** ความคมชัดขั้นต่ำของใบหน้าในเฟรม */
  MIN_SHARPNESS: 75,
  /** ขนาดใบหน้าขั้นต่ำ (px) */
  MIN_FACE_PX: Math.max(BANK_GRADE.MIN_FACE_SIZE_SCAN, 120),
  /** ใหม่เกินไป (เหมือนของเดิมเป๊ะ) = ไม่มีประโยชน์ ไม่ต้องเก็บ */
  NOVELTY_MIN: 0.08,
  /** ต่างมากเกินไป = เสี่ยงเป็นคนอื่น ไม่เก็บ */
  NOVELTY_MAX: 0.26,
  /** เรียนรู้ได้กี่ครั้งต่อคนต่อวัน */
  PER_STUDENT_PER_DAY: 2,
  /** เพดาน descriptor ต่อคน */
  MAX_PER_STUDENT: BANK_GRADE.MAX_DESCRIPTORS_PER_STUDENT ?? 12,
  /**
   * ครั้งแรกที่อุปกรณ์ใหม่ (เช่น kiosk) จับคู่ได้สำเร็จ — ผ่อนเกณฑ์ลงชั่วคราว
   * เพราะคนที่ลงทะเบียนจากกล้องหน้ามือถือแล้วมาสแกนที่กล้องคีออส ระยะห่าง
   * มักกว้าง (มุม/แสง/เลนส์ต่างกัน) จนไม่ผ่านเกณฑ์เข้มของครั้งถัดไป
   * เมื่อเก็บ descriptor กล้องคีออสครั้งแรกได้แล้ว รอบถัดไปจะ match แน่นขึ้นเอง
   */
  FIRST_SOURCE: {
    MIN_CONFIDENCE: 0.55,
    MIN_MARGIN: 0.05,
    MAX_DISTANCE: 0.55,
    NOVELTY_MIN: 0.05,
    NOVELTY_MAX: 0.48,
  } as const,
} as const;

export interface LearnInput {
  studentId: string;
  descriptor: Float32Array | number[];
  match: MatchResult;
  /** ความคมชัดที่วัดได้จากเฟรม */
  sharpness?: number;
  /** ขนาดใบหน้า (px, ด้านสั้น) */
  faceSize?: number;
  /** ป้ายชื่ออุปกรณ์ เช่น kiosk / tablet-gate */
  source?: string;
}

export type LearnResult =
  | { learned: true; total: number; novelty: number }
  | { learned: false; reason: string };

// ── feature flag (cache 10 นาที) ────────────────────────────────
let flagCache: { value: boolean; at: number } | null = null;
async function isEnabled(): Promise<boolean> {
  if (flagCache && Date.now() - flagCache.at < 10 * 60_000) return flagCache.value;
  try {
    const { data } = await supabase
      .from("school_settings")
      .select("setting_value")
      .eq("setting_key", "face_adaptive_learning")
      .maybeSingle();
    const v = (data as any)?.setting_value;
    const enabled = v === null || v === undefined ? true : v !== "false";
    flagCache = { value: enabled, at: Date.now() };
    return enabled;
  } catch {
    flagCache = { value: true, at: Date.now() };
    return true;
  }
}

export function clearAdaptiveFlagCache() {
  flagCache = null;
}

// ── โควตารายวันต่อคน (เก็บใน localStorage กันยิง DB ถี่) ─────────
const QUOTA_KEY = "face_adaptive_quota_v1";
function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
function readQuota(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(QUOTA_KEY) || "{}");
    if (raw.day !== todayKey()) return {};
    return raw.counts || {};
  } catch { return {}; }
}
function bumpQuota(studentId: string) {
  const counts = readQuota();
  counts[studentId] = (counts[studentId] || 0) + 1;
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ day: todayKey(), counts }));
  } catch { /* ignore */ }
}

const inFlight = new Set<string>();

/**
 * เรียนรู้ใบหน้าจากการสแกนที่สำเร็จ — เรียกแบบ fire-and-forget ได้
 * คืนค่าเหตุผลเสมอเพื่อใช้ debug/แสดงผลได้ถ้าต้องการ
 */
export async function learnFromScan(input: LearnInput): Promise<LearnResult> {
  const { studentId, descriptor, match } = input;
  if (!studentId || !descriptor) return { learned: false, reason: "no-input" };
  if (inFlight.has(studentId)) return { learned: false, reason: "in-flight" };

  // 1) คุณภาพภาพ
  if (input.sharpness !== undefined && input.sharpness < ADAPTIVE.MIN_SHARPNESS)
    return { learned: false, reason: "blurry" };
  if (input.faceSize !== undefined && input.faceSize < ADAPTIVE.MIN_FACE_PX)
    return { learned: false, reason: "face-too-small" };

  // 2) โควตารายวัน
  if ((readQuota()[studentId] || 0) >= ADAPTIVE.PER_STUDENT_PER_DAY)
    return { learned: false, reason: "daily-quota" };

  if (!(await isEnabled())) return { learned: false, reason: "disabled" };

  inFlight.add(studentId);
  try {
    const { data: rows, error } = await supabase
      .from("student_face_descriptors")
      .select("id, descriptor, quality_score, created_at, sample_index, source")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });
    if (error) return { learned: false, reason: error.message };

    const existing = (rows || []).filter((r: any) => Array.isArray(r.descriptor));
    if (existing.length === 0) return { learned: false, reason: "no-template" };

    const probe = Array.from(descriptor as any) as number[];

    // 2.5) เลือกเกณฑ์: ครั้งแรกจากอุปกรณ์ใหม่ (เช่น คีออส) ที่ยังไม่เคยเก็บ descriptor
    // ของกล้องนั้น → ผ่อนเกณฑ์ให้เก็บ template ไว้ รอบถัดไปจะ match แน่นขึ้นเอง
    // (คนที่ลงทะเบียนจากมือถือแล้วมาสแกนที่คีออส ระยะห่างมักกว้างเพราะมุม/แสง/เลนส์ต่างกัน)
    const srcPrefix = input.source ? `auto_learn:${input.source}` : null;
    const hasLearnedFromSource = srcPrefix
      ? existing.some((r: any) => typeof r.source === "string" && r.source.startsWith(srcPrefix))
      : true;
    const cfg = hasLearnedFromSource || !srcPrefix ? ADAPTIVE : ADAPTIVE.FIRST_SOURCE;

    // 3) เกณฑ์ความมั่นใจ
    if (match.studentId !== studentId) return { learned: false, reason: "match-mismatch" };
    if (match.confidence < cfg.MIN_CONFIDENCE) return { learned: false, reason: "low-confidence" };
    if (match.margin < cfg.MIN_MARGIN) return { learned: false, reason: "low-margin" };
    if (match.distance > cfg.MAX_DISTANCE) return { learned: false, reason: "far-distance" };

    // 4) ความแปลกใหม่ — ต้องต่างพอที่จะเพิ่มมุมมองใหม่ แต่ไม่ต่างจนน่าสงสัย
    let minDist = Infinity;
    for (const r of existing) {
      const d = cosineDistance(probe, (r as any).descriptor as number[]);
      if (d < minDist) minDist = d;
    }
    if (minDist < cfg.NOVELTY_MIN) return { learned: false, reason: "redundant" };
    if (minDist > cfg.NOVELTY_MAX) return { learned: false, reason: "too-different" };

    // 5) ถ้าเต็มเพดาน → ตัดตัวที่ "ซ้ำซ้อนที่สุด" (ใกล้เพื่อนบ้านที่สุด) ทิ้งก่อน
    if (existing.length >= ADAPTIVE.MAX_PER_STUDENT) {
      let victim: any = null;
      let victimDist = Infinity;
      for (let i = 0; i < existing.length; i++) {
        let nearest = Infinity;
        for (let j = 0; j < existing.length; j++) {
          if (i === j) continue;
          const d = cosineDistance(
            (existing[i] as any).descriptor as number[],
            (existing[j] as any).descriptor as number[],
          );
          if (d < nearest) nearest = d;
        }
        if (nearest < victimDist) { victimDist = nearest; victim = existing[i]; }
      }
      if (victim) {
        await supabase.from("student_face_descriptors").delete().eq("id", victim.id);
      }
    }

    const { data: auth } = await supabase.auth.getUser();
    const nextIdx = Math.max(-1, ...existing.map((r: any) => r.sample_index ?? -1)) + 1;
    const quality = Math.round(Math.min(100, match.confidence * 100));
    const { error: insErr } = await supabase.from("student_face_descriptors").insert({
      student_id: studentId,
      sample_index: nextIdx,
      descriptor: probe,
      captured_by: auth?.user?.id ?? null,
      quality_score: quality,
      source: input.source ? `auto_learn:${input.source}` : "auto_learn",
    } as any);
    if (insErr) return { learned: false, reason: insErr.message };

    bumpQuota(studentId);
    return { learned: true, total: existing.length + 1, novelty: minDist };
  } catch (e: any) {
    return { learned: false, reason: e?.message || "error" };
  } finally {
    inFlight.delete(studentId);
  }
}
