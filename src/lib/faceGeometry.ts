/**
 * faceGeometry — "สัดส่วนโครงหน้า" เป็นความเห็นที่สองของการจับคู่ใบหน้า
 *
 * ทำไมต้องมี: embedding ของ ArcFace เก่งเรื่องรูปลักษณ์โดยรวม แต่ฝาแฝด/พี่น้องหน้าคล้าย
 * อาจได้คะแนนใกล้กันมาก การวัด "ระยะระหว่างตา–จมูก–ปาก" แบบหารด้วยระยะห่างตาสองข้าง
 * (จึงไม่ขึ้นกับระยะยืนหรือขนาดภาพ) ช่วยแยกคนที่โครงหน้าต่างกันออกจากกันได้
 *
 * ค่าที่ได้จาก FaceGate agent (จุดสังเกต 5 จุดของ SCRFD) — ถ้าไม่มี agent จะไม่มีค่านี้
 * และระบบจะตัดสินด้วย embedding อย่างเดียวเหมือนเดิม
 */

export type FaceGeometry = Record<string, number>;

export const GEOMETRY_KEYS = [
  "nose_left_eye",
  "nose_right_eye",
  "nose_eye_mid",
  "mouth_width",
  "nose_mouth_mid",
  "eye_mid_mouth_mid",
  "left_eye_mouth_left",
  "right_eye_mouth_right",
  "face_width",
  "face_height",
  "eye_asymmetry",
] as const;

/** คำนวณสัดส่วนจากจุดสังเกต 5 จุด (ตาซ้าย ตาขวา จมูก มุมปากซ้าย มุมปากขวา) */
export function geometryFromKeypoints(
  kps: Array<[number, number]> | undefined | null,
  box?: { x: number; y: number; width: number; height: number },
): FaceGeometry | null {
  if (!kps || kps.length < 5) return null;
  const [le, re, nose, ml, mr] = kps;
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const eyeDist = dist(le, re);
  if (!(eyeDist > 1e-3)) return null;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const eyeMid = mid(le, re);
  const mouthMid = mid(ml, mr);
  const d = (a: [number, number], b: [number, number]) => dist(a, b) / eyeDist;
  const noseL = d(nose, le);
  const noseR = d(nose, re);
  const g: FaceGeometry = {
    nose_left_eye: noseL,
    nose_right_eye: noseR,
    nose_eye_mid: d(nose, eyeMid),
    mouth_width: d(ml, mr),
    nose_mouth_mid: d(nose, mouthMid),
    eye_mid_mouth_mid: d(eyeMid, mouthMid),
    left_eye_mouth_left: d(le, ml),
    right_eye_mouth_right: d(re, mr),
    face_width: box ? box.width / eyeDist : 0,
    face_height: box ? box.height / eyeDist : 0,
    eye_asymmetry: Math.abs(noseL - noseR) / Math.max(noseL + noseR, 1e-3),
  };
  for (const k of Object.keys(g)) g[k] = Math.round(g[k] * 1e5) / 1e5;
  return g;
}

/** 1.0 = สัดส่วนเหมือนกันเป๊ะ — ใช้ค่าต่างสัมพัทธ์เฉลี่ย */
export function geometrySimilarity(a?: FaceGeometry | null, b?: FaceGeometry | null): number | null {
  if (!a || !b) return null;
  const diffs: number[] = [];
  for (const key of GEOMETRY_KEYS) {
    const av = a[key];
    const bv = b[key];
    if (typeof av !== "number" || typeof bv !== "number") continue;
    const denom = Math.abs(av) + Math.abs(bv);
    if (denom < 1e-6) continue;
    diffs.push(Math.abs(av - bv) / denom);
  }
  if (!diffs.length) return null;
  const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  return Math.max(0, 1 - 2 * mean);
}

/** คะแนนโครงหน้าที่ดีที่สุดเมื่อเทียบกับทุกภาพที่ลงทะเบียนไว้ของคนคนนั้น */
export function bestGeometryScore(live: FaceGeometry | null | undefined, stored?: FaceGeometry[] | null): number | null {
  if (!live || !stored?.length) return null;
  let best: number | null = null;
  for (const g of stored) {
    const s = geometrySimilarity(live, g);
    if (s != null && (best == null || s > best)) best = s;
  }
  return best;
}

/**
 * ตัดสินร่วมกับระยะห่าง embedding
 * - ไม่มีข้อมูลโครงหน้า → ผ่าน (ใช้ผลเดิม) เพื่อไม่ให้ระบบเข้มขึ้นกับคนที่ยังไม่มีข้อมูล
 * - มีข้อมูลแล้วต่ำกว่าเกณฑ์ → ปฏิเสธ กันจำผิดคน
 */
export function geometryVerdict(
  live: FaceGeometry | null | undefined,
  stored: FaceGeometry[] | null | undefined,
  minScore = 0.55,
): { ok: boolean; score: number | null } {
  const score = bestGeometryScore(live, stored);
  if (score == null) return { ok: true, score: null };
  return { ok: score >= minScore, score };
}
