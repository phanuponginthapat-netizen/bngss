/**
 * Passive Face Liveness — ตรวจว่าใบหน้าที่เห็นเป็น "ใบหน้าสด" ไม่ใช่รูปถ่าย/จอภาพ
 *
 * ทำไมต้องมี: กล้องคีออส/ประตูอัตโนมัติเสี่ยงถูกหลอกด้วยรูปถ่ายนักเรียนที่พิมพ์มา
 * หรือโชว์บนจอโทรศัพท์ ระบบ embedding เดิมแค่จับคู่ความเหมือนของใบหน้า ไม่รู้ว่า
 * คนที่ยืนอยู่หน้าเครื่องยังมีชีวิตหรือเป็นรูปภาพ
 *
 * วิธีทำงาน (passive — ไม่ต้องให้ผู้ใช้ทำตามคำสั่ง):
 *   1. แต่ละเฟรมที่จับใบหน้าคนเดิมได้ จะบันทึกตัวอย่าง (EAR, yaw, pitch, ตำแหน่ง)
 *   2. สะสมหลักฐานภายในหน้าต่างเวลา:
 *      • Blink — EAR ลดต่ำกว่าเกณฑ์ (ตาหลับ) แล้วกลับขึ้น (ตาเปิด) = คนจริงเกือบ
 *        ทุกคนกะพริบตาเป็นธรรมชาติภายในไม่กี่วินาที หลักฐานแข็งแกร่งที่สุด
 *      • Head rotation — ผลรวมการหมุนศีรษะ (yaw/pitch) ข้ามเฟรมเกินเกณฑ์
 *        รูปถ่าย/จอภาพนิ่งแทบไม่มีแนวโน้มนี้
 *   3. ผ่านเมื่อมีหลักฐานพอ — กันคนจริงที่ยืนนิ่ง ๆ ไม่ถูกรบกวน (กะพริบตาธรรมชาติ)
 *
 * จุดอ่อนที่ทราบ: วิดีโอรีเพลย์ (เล่นคลิปของคนจริง) อาจผ่าน — ต้องใช้ชั้นอื่นเสริม
 * เช่น texture verification สำหรับกรณีนั้น
 */
import { averageEAR, estimateYaw, estimatePitch } from "@/lib/faceApi";
import type * as faceapi from "@vladmandic/face-api";

export interface LivenessSample {
  t: number;
  ear: number;
  yaw: number;
  pitch: number;
  cx: number;
  cy: number;
  size: number;
}

export interface LivenessTrack {
  samples: LivenessSample[];
  prev: LivenessSample | null;
  /** ผลรวมการหมุนศีรษะสะสม (|Δyaw| + |Δpitch|) ภายในหน้าต่างเวลา */
  poseTravel: number;
  /** เคยเห็นการกะพริบตา (EAR ปิด→เปิด) */
  blinked: boolean;
  /** EAR ณ เฟรมก่อนหน้า อยู่ในสถานะ "ตาปิด" อยู่หรือไม่ */
  eyeWasClosed: boolean;
}

export type TrackState = LivenessTrack;

export interface LivenessEval {
  live: boolean;
  signal: "blink" | "pose" | "none";
  poseTravel: number;
  samples: number;
}

/** ค่าปรับจูน — ปรับได้ถ้าพบว่าปฏิเสธคนจริงบ่อยเกินไป (ลด) หรือยอมรับของปลอม (เพิ่ม) */
export const LIVENESS_CONFIG = {
  /** หน้าต่างเวลา (ms) ที่ใช้สะสมหลักฐาน — ยิ่งสั้นยิ่งตรวจเร็วแต่หลักฐานน้อย */
  WINDOW_MS: 3500,
  /** EAR ต่ำกว่านี้ = ตาปิด */
  BLINK_EAR_CLOSED: 0.20,
  /** EAR สูงกว่านี้ = ตาเปิด (ต้องกลับมาถึงค่านี้ถึงนับว่า "กะพริบครบ 1 ครั้ง") */
  BLINK_EAR_OPEN: 0.27,
  /** ต้องสะสมการหมุนศีรษะรวมถึงเกณฑ์นี้ (แบบช้า) — คนจริงขยับหัวเล็กน้อยตลอด */
  POSE_TRAVEL_TARGET: 0.12,
  /** จำนวนตัวอย่างสูงสุดที่เก็บ (กันหน่วยความจำบาน) */
  MAX_SAMPLES: 48,
} as const;

/** เก็บ tracker แยกตามคน (studentId) — เรียกใหม่ทุกเฟรมที่เจอใบหน้าคนเดิม */
export function newLivenessTrack(): TrackState {
  return { samples: [], prev: null, poseTravel: 0, blinked: false, eyeWasClosed: false };
}

function pruned(state: TrackState, now: number): LivenessSample[] {
  const cutoff = now - LIVENESS_CONFIG.WINDOW_MS;
  const list = state.samples;
  let i = 0;
  while (i < list.length && list[i].t < cutoff) i++;
  return i > 0 ? list.slice(i) : list;
}

/**
 * บันทึกตัวอย่างเฟรมใหม่ลง tracker แล้วประเมินผล liveness ทันที
 * `landmarks` ใช้แค่สัดส่วน (EAR/yaw/pitch) จึงไม่สนใจพิกัดของเฟรมที่ย่อหรือไม่
 */
export function recordLivenessSample(
  state: TrackState,
  sample: LivenessSample,
): LivenessEval {
  state.samples.push(sample);
  if (state.samples.length > LIVENESS_CONFIG.MAX_SAMPLES) {
    state.samples = state.samples.slice(state.samples.length - LIVENESS_CONFIG.MAX_SAMPLES);
  }
  state.samples = pruned(state, sample.t);

  // ---- ช่วงว่างระหว่างตัวอย่างเกินหน้าต่าง = เริ่มต้นสะสมใหม่ (กันคนเดิมย้อนกลับมาขอผ่านซ้ำ) ----
  if (state.prev && sample.t - state.prev.t > LIVENESS_CONFIG.WINDOW_MS) {
    state.poseTravel = 0;
    state.blinked = false;
    state.eyeWasClosed = false;
  }

  // ---- สะสมการหมุนศีรษะ ----
  if (state.prev) {
    const dyaw = Math.abs(sample.yaw - state.prev.yaw);
    const dpitch = Math.abs(sample.pitch - state.prev.pitch);
    state.poseTravel += dyaw + dpitch;
  }
  state.prev = sample;

  // ---- ตรวจจับการกะพริบตา (EAR ปิด → เปิด) ----
  if (sample.ear < LIVENESS_CONFIG.BLINK_EAR_CLOSED) {
    state.eyeWasClosed = true;
  } else if (sample.ear > LIVENESS_CONFIG.BLINK_EAR_OPEN && state.eyeWasClosed) {
    state.blinked = true;
    state.eyeWasClosed = false;
  }

  const n = state.samples.length;
  if (state.blinked) {
    return { live: true, signal: "blink", poseTravel: state.poseTravel, samples: n };
  }
  if (state.poseTravel >= LIVENESS_CONFIG.POSE_TRAVEL_TARGET) {
    return { live: true, signal: "pose", poseTravel: state.poseTravel, samples: n };
  }
  // Micro-motion — คนจริงยืนนิ่งก็ยังมีการขยับตำแหน่ง/ระยะเล็กน้อยตลอด
  // รูปถ่ายที่ถือนิ่งหรือติดกับที่จะไม่มีการเปลี่ยนแปลงต่อเนื่องแบบนี้
  // ช่วยไม่ให้ผู้ใช้ต้องยืนรอนานเป็นนาทีเพียงเพราะยังไม่กะพริบตาให้กล้องเห็น
  if (n >= LIVENESS_CONFIG.MICRO_MIN_SAMPLES) {
    const first = state.samples[0];
    const last = state.samples[n - 1];
    const span = last.t - first.t;
    let motion = 0;
    for (let i = 1; i < n; i++) {
      const a = state.samples[i - 1], b = state.samples[i];
      const scale = Math.max(1, b.size);
      motion += (Math.abs(b.cx - a.cx) + Math.abs(b.cy - a.cy)) / scale + Math.abs(b.size - a.size) / scale;
    }
    if (span >= LIVENESS_CONFIG.MICRO_MIN_MS && motion >= LIVENESS_CONFIG.MICRO_MOTION_TARGET) {
      return { live: true, signal: "pose", poseTravel: state.poseTravel, samples: n };
    }
  }
  return { live: false, signal: "none", poseTravel: state.poseTravel, samples: n };

}

/** สร้าง LivenessSample จากผลตรวจจับ face-api (computed EAR/yaw/pitch) */
export function makeLivenessSample(
  now: number,
  landmarks: faceapi.FaceLandmarks68,
  box: { x: number; y: number; width: number; height: number },
): LivenessSample {
  return {
    t: now,
    ear: averageEAR(landmarks),
    yaw: estimateYaw(landmarks),
    pitch: estimatePitch(landmarks),
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    size: Math.min(box.width, box.height),
  };
}