/**
 * โปรไฟล์ประสิทธิภาพของโหมดคีออส — ครูจำลองใช้ balanced (ArcFace ปกติ)
 */
export type KioskPerfMode = "low" | "balanced" | "high";

export const KIOSK_PERF_KEY = "face_kiosk_perf_mode";

export interface KioskPerfProfile {
  inputSize: 320 | 416 | 512 | 608;
  maxWidth: number;
  loopDelayMs: number;
  checkSharpness: boolean;
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
    label: "สมดุล (ArcFace ปกติ เหมือนครู)",
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

export function detectKioskPerfMode(): KioskPerfMode {
  try {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as any).deviceMemory || 4;
    if (cores <= 4 || mem <= 4) return "low";
    return "balanced";
  } catch {
    return "balanced";
  }
}

export function loadKioskPerfMode(): KioskPerfMode {
  try {
    const saved = localStorage.getItem(KIOSK_PERF_KEY) as KioskPerfMode | null;
    if (saved && KIOSK_PERF_PROFILES[saved]) return saved;
  } catch {}
  return detectKioskPerfMode();
}
