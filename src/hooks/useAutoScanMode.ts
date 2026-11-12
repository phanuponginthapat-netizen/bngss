import { useEffect, useMemo, useRef, useState } from "react";
import { useSchoolSetting } from "@/hooks/useSchoolSetting";
import { evaluateSchoolScan } from "../../supabase/functions/_shared/schoolScanPolicy";

export type ScanMode = "entry" | "exit";
/**
 * โหมดที่ผู้ใช้เลือกได้:
 *  - "entry"  → บันทึก "เข้าโรงเรียน" อย่างเดียว (ใช้กล้อง/คีออสรับเข้าอย่างเดียว)
 *  - "auto"   → สลับ "เข้า → ออก" อัตโนมัติตามเวลาที่ตั้งไว้
 */
export type ScanModeSelection = "entry" | "auto";

const LS_KEY = "face_scan_mode_selection";

export type WindowCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

// Parse "HH:MM-HH:MM" → {start, end} in minutes-of-day, or null when invalid/empty.
function parseWindow(raw: string | null | undefined): { start: number; end: number; label: string } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*[-–~]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sh = Math.min(23, parseInt(m[1], 10));
  const sm = Math.min(59, parseInt(m[2], 10));
  const eh = Math.min(23, parseInt(m[3], 10));
  const em = Math.min(59, parseInt(m[4], 10));
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start) return null;
  const fmt = (h: number, mm: number) => `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return { start, end, label: `${fmt(sh, sm)}–${fmt(eh, em)}` };
}

function nowBangkokMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hh * 60 + mm;
}

/**
 * Time-based auto-switch between entry/exit modes + allowed scan windows.
 *
 * - cutoff (HH:MM): `face_scan_mode_cutoff` (default "12:00") — auto mode flip.
 * - entry window: `face_scan_entry_window` (e.g. "06:00-10:00") — empty = ไม่จำกัด.
 * - exit window:  `face_scan_exit_window`  (e.g. "14:00-18:00") — empty = ไม่จำกัด.
 *   นอกช่วงเวลา → ระบบจะปฏิเสธการสแกน (กันเด็กสแกนตอนพักเที่ยง/กลางคืน)
 */
export function useAutoScanMode() {
  const { value: cutoffSetting, isLoading, error } = useSchoolSetting("face_scan_mode_cutoff");
  const { value: entryWindowSetting } = useSchoolSetting("face_scan_entry_window");
  const { value: exitWindowSetting } = useSchoolSetting("face_scan_exit_window");
  const cutoff = (cutoffSetting && /^\d{1,2}:\d{2}$/.test(cutoffSetting)) ? cutoffSetting : "12:00";

  const entryWindow = useMemo(() => parseWindow(entryWindowSetting), [entryWindowSetting]);
  const exitWindow = useMemo(() => parseWindow(exitWindowSetting), [exitWindowSetting]);

  const [selection, setSelectionState] = useState<ScanModeSelection>(() => {
    const v = (typeof localStorage !== "undefined" && localStorage.getItem(LS_KEY)) as string | null;
    return v === "entry" ? "entry" : "auto";
  });
  const setSelection = (m: ScanModeSelection) => {
    setSelectionState(m);
    try { localStorage.setItem(LS_KEY, m); } catch { /* ignore */ }
  };

  // Recompute "now" so the effective mode flips automatically.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const effective: ScanMode = useMemo(() => {
    if (selection !== "auto") return selection;
    const [h, m] = cutoff.split(":").map((x) => parseInt(x, 10) || 0);
    const cutoffMinutes = h * 60 + m;
    const nowMin = nowBangkokMinutes();
    return nowMin < cutoffMinutes ? "entry" : "exit";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, cutoff, tick]);

  const effectiveRef = useRef<ScanMode>(effective);
  useEffect(() => { effectiveRef.current = effective; }, [effective]);

  // Refs ที่ใช้ใน callback (ไม่ trigger re-render)
  const entryWindowRef = useRef(entryWindow);
  const exitWindowRef = useRef(exitWindow);
  useEffect(() => { entryWindowRef.current = entryWindow; }, [entryWindow]);
  useEffect(() => { exitWindowRef.current = exitWindow; }, [exitWindow]);
  const settingsRef = useRef({ cutoffSetting, entryWindowSetting, exitWindowSetting, isLoading, error });
  settingsRef.current = { cutoffSetting, entryWindowSetting, exitWindowSetting, isLoading, error };

  /** เช็คว่าตอนนี้อยู่ในช่วงเวลาที่อนุญาตของโหมดนี้หรือไม่ */
  const checkWindow = (mode: ScanMode): WindowCheck => {
    const current = settingsRef.current;
    if (current.isLoading || current.error) return { allowed: false, reason: "ยังอ่านกฎการสแกนไม่สำเร็จ กรุณาลองใหม่" };
    try {
      const result = evaluateSchoolScan({ face_scan_mode_cutoff: current.cutoffSetting ?? "12:00", face_scan_entry_window: current.entryWindowSetting, face_scan_exit_window: current.exitWindowSetting }, nowBangkokMinutes(), mode === "entry" ? "in" : "out");
      return result.allowed ? { allowed: true } : { allowed: false, reason: result.reason };
    } catch {
      return { allowed: false, reason: "ค่าช่วงเวลาสแกนไม่ถูกต้อง กรุณาตรวจการตั้งค่า" };
    }
  };

  return {
    selection,
    setSelection,
    effective,
    effectiveRef,
    cutoff,
    entryWindow,
    exitWindow,
    checkWindow,
  };
}
