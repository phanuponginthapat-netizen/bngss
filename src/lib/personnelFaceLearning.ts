/**
 * Personnel Face Learning — เรียนรู้ใบหน้าบุคลากรจาก "หลายรูป"
 *
 * ใช้ 2 ทาง:
 *  1) addPersonnelSamplesFromFiles() — อัปโหลดรูปหลายไฟล์ (มุม/แสงต่างกัน) แล้วเก็บเป็น descriptor
 *  2) learnPersonnelFromScan()      — เรียนรู้อัตโนมัติระหว่างจำลองสแกน เมื่อ match มั่นใจสูง
 *
 * กติกาความปลอดภัย เหมือนฝั่งนักเรียน (กันเรียนรู้ผิดคน):
 *  - รูปใหม่ต้อง "ต่างพอจะมีประโยชน์" แต่ "ไม่ต่างจนน่าสงสัย" (novelty band)
 *  - มีเพดานจำนวนภาพต่อคน — เต็มแล้วตัดตัวที่ซ้ำซ้อนที่สุดทิ้ง
 */
import { supabase } from "@/integrations/supabase/client";
import { cosineDistance } from "@/lib/arcface";
import { getDescriptorFromImage, type MatchResult } from "@/lib/faceApi";

export const PERSONNEL_LEARN = {
  /** เพดาน descriptor ต่อบุคลากร 1 คน */
  MAX_PER_PERSON: 15,
  /** ใกล้ของเดิมเกินไป = ซ้ำซ้อน ไม่ต้องเก็บ */
  NOVELTY_MIN: 0.06,
  /** ต่างมากเกินไป = เสี่ยงเป็นคนละคน */
  NOVELTY_MAX: 0.55,
  /** เกณฑ์เรียนรู้อัตโนมัติจากการสแกน */
  AUTO_MIN_CONFIDENCE: 0.74,
  AUTO_MIN_MARGIN: 0.1,
  AUTO_MAX_DISTANCE: 0.26,
  AUTO_NOVELTY_MAX: 0.26,
} as const;

type Row = { id: string; descriptor: number[] | null; sample_index: number | null };

async function loadExisting(personnelId: string): Promise<Row[]> {
  const { data, error } = await (supabase as any)
    .from("personnel_face_descriptors")
    .select("id, descriptor, sample_index")
    .eq("personnel_id", personnelId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as Row[]) || []).filter((r) => Array.isArray(r.descriptor));
}

function minDistanceTo(probe: number[], rows: Row[]): number {
  let min = Infinity;
  for (const r of rows) {
    const d = cosineDistance(probe, r.descriptor as number[]);
    if (d < min) min = d;
  }
  return min;
}

/** เต็มเพดาน → ลบตัวที่ "ใกล้เพื่อนบ้านที่สุด" (ซ้ำซ้อนที่สุด) */
async function pruneIfFull(rows: Row[], max: number) {
  if (rows.length < max) return rows;
  let victim: Row | null = null;
  let victimDist = Infinity;
  for (let i = 0; i < rows.length; i++) {
    let nearest = Infinity;
    for (let j = 0; j < rows.length; j++) {
      if (i === j) continue;
      const d = cosineDistance(rows[i].descriptor as number[], rows[j].descriptor as number[]);
      if (d < nearest) nearest = d;
    }
    if (nearest < victimDist) { victimDist = nearest; victim = rows[i]; }
  }
  if (victim) {
    await (supabase as any).from("personnel_face_descriptors").delete().eq("id", victim.id);
    return rows.filter((r) => r.id !== victim!.id);
  }
  return rows;
}

async function insertSample(opts: {
  personnelId: string;
  descriptor: number[];
  rows: Row[];
  quality: number;
  source: string;
  faceImage?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const nextIdx = Math.max(-1, ...opts.rows.map((r) => r.sample_index ?? -1)) + 1;
  const { error } = await (supabase as any).from("personnel_face_descriptors").insert({
    personnel_id: opts.personnelId,
    sample_index: nextIdx,
    descriptor: opts.descriptor,
    quality_score: opts.quality,
    captured_by: auth?.user?.id ?? null,
    source: opts.source,
    face_image: opts.faceImage ?? null,
  });
  if (error) throw error;
}

// ── 1) เรียนรู้จากหลายรูปที่อัปโหลด ─────────────────────────────

export type FileLearnStatus = "added" | "no-face" | "redundant" | "too-different" | "error";
export interface FileLearnResult {
  fileName: string;
  status: FileLearnStatus;
  novelty?: number;
  message?: string;
  thumbnail?: string;
}

async function fileToImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("อ่านไฟล์รูปไม่ได้"));
    img.src = url;
  });
  return { img, url };
}

function makeThumb(img: HTMLImageElement, size = 96): string | null {
  try {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.7);
  } catch { return null; }
}

/**
 * เรียนรู้ใบหน้าบุคลากรจากหลายไฟล์รูป — ประมวลผลทีละไฟล์และรายงานผลระหว่างทาง
 * โมเดลต้องถูกโหลดแล้ว (loadFaceModels) ก่อนเรียกฟังก์ชันนี้
 */
export async function addPersonnelSamplesFromFiles(
  personnelId: string,
  files: File[],
  onProgress?: (done: number, total: number, result: FileLearnResult) => void,
): Promise<FileLearnResult[]> {
  const out: FileLearnResult[] = [];
  let rows = await loadExisting(personnelId);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let res: FileLearnResult = { fileName: file.name, status: "error" };
    let url = "";
    try {
      const loaded = await fileToImage(file);
      url = loaded.url;
      const desc = await getDescriptorFromImage(loaded.img);
      if (!desc) {
        res = { fileName: file.name, status: "no-face", message: "ไม่พบใบหน้าในรูปนี้" };
      } else {
        const probe = Array.from(desc);
        const novelty = rows.length ? minDistanceTo(probe, rows) : 1;
        if (rows.length && novelty < PERSONNEL_LEARN.NOVELTY_MIN) {
          res = { fileName: file.name, status: "redundant", novelty, message: "คล้ายรูปที่มีอยู่แล้วมาก" };
        } else if (rows.length && novelty > PERSONNEL_LEARN.NOVELTY_MAX) {
          res = { fileName: file.name, status: "too-different", novelty, message: "ต่างจากใบหน้าที่ลงทะเบียนไว้มาก — อาจเป็นคนละคน" };
        } else {
          rows = await pruneIfFull(rows, PERSONNEL_LEARN.MAX_PER_PERSON);
          const thumb = makeThumb(loaded.img);
          await insertSample({
            personnelId,
            descriptor: probe,
            rows,
            quality: Math.round(Math.max(0, Math.min(100, (1 - Math.min(novelty, 1)) * 100))),
            source: "photo_upload",
            faceImage: thumb,
          });
          rows = [...rows, { id: `tmp-${i}`, descriptor: probe, sample_index: Math.max(-1, ...rows.map((r) => r.sample_index ?? -1)) + 1 }];
          res = { fileName: file.name, status: "added", novelty, thumbnail: thumb ?? undefined };
        }
      }
    } catch (e: any) {
      res = { fileName: file.name, status: "error", message: e?.message || "ผิดพลาด" };
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
    out.push(res);
    onProgress?.(i + 1, files.length, res);
  }
  return out;
}

// ── 2) เรียนรู้อัตโนมัติจากการจำลองสแกน ─────────────────────────

export type PersonnelLearnResult =
  | { learned: true; total: number; novelty: number }
  | { learned: false; reason: string };

const inFlight = new Set<string>();

export async function learnPersonnelFromScan(input: {
  personnelId: string;
  descriptor: Float32Array | number[];
  match: MatchResult;
  sharpness?: number;
  source?: string;
}): Promise<PersonnelLearnResult> {
  const { personnelId, descriptor, match } = input;
  if (!personnelId || !descriptor) return { learned: false, reason: "no-input" };
  if (inFlight.has(personnelId)) return { learned: false, reason: "in-flight" };
  if (match.studentId !== personnelId) return { learned: false, reason: "match-mismatch" };
  if (match.confidence < PERSONNEL_LEARN.AUTO_MIN_CONFIDENCE) return { learned: false, reason: "low-confidence" };
  if (match.margin < PERSONNEL_LEARN.AUTO_MIN_MARGIN) return { learned: false, reason: "low-margin" };
  if (match.distance > PERSONNEL_LEARN.AUTO_MAX_DISTANCE) return { learned: false, reason: "far-distance" };
  if (input.sharpness !== undefined && input.sharpness < 75) return { learned: false, reason: "blurry" };

  inFlight.add(personnelId);
  try {
    let rows = await loadExisting(personnelId);
    if (rows.length === 0) return { learned: false, reason: "no-template" };
    const probe = Array.from(descriptor as any) as number[];
    const novelty = minDistanceTo(probe, rows);
    if (novelty < PERSONNEL_LEARN.NOVELTY_MIN) return { learned: false, reason: "redundant" };
    if (novelty > PERSONNEL_LEARN.AUTO_NOVELTY_MAX) return { learned: false, reason: "too-different" };
    rows = await pruneIfFull(rows, PERSONNEL_LEARN.MAX_PER_PERSON);
    await insertSample({
      personnelId,
      descriptor: probe,
      rows,
      quality: Math.round(Math.min(100, match.confidence * 100)),
      source: input.source ? `auto_learn:${input.source}` : "auto_learn",
    });
    return { learned: true, total: rows.length + 1, novelty };
  } catch (e: any) {
    return { learned: false, reason: e?.message || "error" };
  } finally {
    inFlight.delete(personnelId);
  }
}
