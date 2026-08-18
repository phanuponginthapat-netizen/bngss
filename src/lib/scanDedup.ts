import { supabase } from "@/integrations/supabase/client";
import { todayBangkok } from "@/lib/dateBE";

/**
 * ตรวจสอบร่วมกันระหว่าง "สแกนใบหน้า" และ "สแกน QR"
 * ทั้งสองวิธีบันทึกลงตาราง face_scan_logs เดียวกัน (unique: student_id + scan_date + scan_type)
 * ฟังก์ชันนี้ทำให้ทุกหน้าจอ/ทุกอุปกรณ์เช็คได้ว่านักเรียนคนนี้เคยสแกนเข้า/ออกวันนี้แล้วหรือยัง
 * โดยไม่สนว่าจะสแกนด้วยวิธีใด (face / qr / manual)
 */
export interface TodayScanState {
  entry: boolean;
  exit: boolean;
  entryMethod?: string | null;
  exitMethod?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
}

const EMPTY: TodayScanState = { entry: false, exit: false };
const cache = new Map<string, { at: number; date: string; state: TodayScanState }>();
const TTL = 20_000;

export const methodLabel = (m?: string | null) =>
  m === "qr" ? "สแกน QR" : m === "manual" ? "บันทึกด้วยมือ" : m === "face" ? "สแกนใบหน้า" : "การสแกน";

/** อ่านสถานะสแกนวันนี้ของนักเรียน (ร่วมกันทั้งใบหน้า + QR) */
export async function checkTodayScan(studentId: string, force = false): Promise<TodayScanState> {
  if (!studentId) return EMPTY;
  const today = todayBangkok();
  const hit = cache.get(studentId);
  if (!force && hit && hit.date === today && Date.now() - hit.at < TTL) return hit.state;
  try {
    const { data, error } = await supabase
      .from("face_scan_logs")
      .select("scan_type, entry_method, scan_time")
      .eq("student_id", studentId)
      .eq("scan_date", today);
    if (error) return hit?.state ?? EMPTY;
    const state: TodayScanState = { entry: false, exit: false };
    (data || []).forEach((r: any) => {
      if (r.scan_type === "exit") {
        state.exit = true;
        state.exitMethod = r.entry_method;
        state.exitTime = r.scan_time;
      } else {
        state.entry = true;
        state.entryMethod = r.entry_method;
        state.entryTime = r.scan_time;
      }
    });
    cache.set(studentId, { at: Date.now(), date: today, state });
    return state;
  } catch {
    return hit?.state ?? EMPTY;
  }
}

/** บันทึกลง cache ทันทีหลังสแกนสำเร็จ เพื่อให้หน้าจออื่นในเครื่องเดียวกันเห็นผลทันที */
export function markScanned(studentId: string, scanType: "entry" | "exit", method?: string | null) {
  const today = todayBangkok();
  const hit = cache.get(studentId);
  const state: TodayScanState = hit && hit.date === today ? { ...hit.state } : { entry: false, exit: false };
  if (scanType === "exit") {
    state.exit = true;
    state.exitMethod = method ?? state.exitMethod;
    state.exitTime = new Date().toISOString();
  } else {
    state.entry = true;
    state.entryMethod = method ?? state.entryMethod;
    state.entryTime = new Date().toISOString();
  }
  cache.set(studentId, { at: Date.now(), date: today, state });
}

export function clearScanDedupCache(studentId?: string) {
  if (studentId) cache.delete(studentId);
  else cache.clear();
}
