/**
 * โปรไฟล์ประสิทธิภาพของโหมดคีออส — ลดภาระ CPU บนเครื่อง Linux สเปกต่ำ
 * เก็บค่าไว้ใน localStorage เพื่อให้ตู้จำค่าเดิมหลังรีบูต
 */
export type KioskPerfMode = "low" | "balanced" | "high";

export const KIOSK_PERF_KEY = "face_kiosk_perf_mode";

export interface KioskPerfProfile {
  /** ขนาด input ของตัวตรวจจับใบหน้า (ยิ่งเล็กยิ่งเร็ว) */
  inputSize: 320 | 416 | 512 | 608;
  /** ความกว้างสูงสุดของเฟรมที่นำไป preprocess */
  maxWidth: number;
  /** ระยะเวลาพักระหว่างรอบตรวจจับ (ms) */
  loopDelayMs: number;
  /** ประเมินความคมชัดของใบหน้าทุกเฟรมหรือไม่ (กินซีพียู) */
  checkSharpness: boolean;
  /** ความละเอียดวิดีโอที่ขอจากกล้อง */
  videoWidth: number;
  videoHeight: number;
  frameRate: number;
  label: string;
}

export const KIOSK_PERF_PROFILES: Record<KioskPerfMode, KioskPerfProfile> = {
  low: {
    inputSize: 320,
    maxWidth: 480,
    loopDelayMs: 450,
    checkSharpness: false,
    videoWidth: 640,
    videoHeight: 480,
    frameRate: 15,
    label: "ประหยัด (เครื่องสเปกต่ำ)",
  },
  balanced: {
    inputSize: 416,
    maxWidth: 640,
    loopDelayMs: 280,
    checkSharpness: true,
    videoWidth: 1280,
    videoHeight: 720,
    frameRate: 24,
    label: "สมดุล",
  },
  high: {
    inputSize: 608,
    maxWidth: 960,
    loopDelayMs: 200,
    checkSharpness: true,
    videoWidth: 1920,
    videoHeight: 1080,
    frameRate: 30,
    label: "ละเอียดสูง (เครื่องแรง)",
  },
};

/** เดาโปรไฟล์ที่เหมาะสมจากสเปกเครื่อง (ใช้เมื่อยังไม่เคยตั้งค่า) */
export function detectKioskPerfMode(): KioskPerfMode {
  try {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as any).deviceMemory || 4;
    const isLinux = /Linux/i.test(navigator.platform || navigator.userAgent) && !/Android/i.test(navigator.userAgent);
    if (cores <= 4 || mem <= 4) return "low";
    if (isLinux && cores <= 8) return "balanced";
    return "balanced";
  } catch {
    return "balanced";
  }
}

export function loadKioskPerfMode(): KioskPerfMode {
  try {
    const saved = localStorage.getItem(KIOSK_PERF_KEY) as KioskPerfMode | null;
    if (saved && KIOSK_PERF_PROFILES[saved]) return saved;
  } catch { /* noop */ }
  return detectKioskPerfMode();
}
