/**
 * โปรไฟล์ประสิทธิภาพของโหมดคีออส — เหลือโหมดเดียว "Turbo"
 * ปรับจูนมาสำหรับเครื่องสเปกต่ำอย่าง HP Pavilion x2 (Intel Atom x5)
 * เป้าหมาย: ไม่ค้าง ไม่กระตุก สแกนไว และยังแม่นยำ
 */
export type KioskPerfMode = "turbo";

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

/** โปรไฟล์เดียวของระบบ — เร็วที่สุดที่ยังคงความแม่นยำ */
export const KIOSK_TURBO_PROFILE: KioskPerfProfile = {
  inputSize: 320,
  maxWidth: 480,
  loopDelayMs: 110,
  checkSharpness: false,
  // 720p @15fps ถอดรหัสเบากว่า 1080p มากบน Atom แต่ยังจับใบหน้าระยะ ~1.5 ม. ได้
  videoWidth: 1280,
  videoHeight: 720,
  frameRate: 15,
  label: "Turbo (เหมาะกับ HP Pavilion x2 / Atom)",
};

export const KIOSK_PERF_PROFILES: Record<KioskPerfMode, KioskPerfProfile> = {
  turbo: KIOSK_TURBO_PROFILE,
};

export function detectKioskPerfMode(): KioskPerfMode {
  return "turbo";
}

export function loadKioskPerfMode(): KioskPerfMode {
  return "turbo";
}
