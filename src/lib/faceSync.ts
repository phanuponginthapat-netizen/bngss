import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceModels,
  getDescriptorFromImage,
  detectorOptionsHQ,
  embedWithArcFace,
  loadImageFromUrl,
} from "./faceApi";
import { loadArcFace } from "./arcface";
import { loadFaceSyncImage } from "./faceSyncImage";

/** โหลดโมเดลตรวจใบหน้า + ArcFace ให้พร้อมก่อนซิงค์ (เรียกซ้ำได้ โหลดครั้งเดียว) */
export async function ensureFaceSyncModels(): Promise<void> {
  await Promise.all([loadFaceModels(), loadArcFace()]);
}

/**
 * อ่านลายใบหน้าจากรูปแบบทนทาน: ลอง ArcFace ตรงๆ ก่อน
 * ถ้าไม่ได้ค่อยตรวจด้วยตัวตรวจความละเอียดสูงแล้วฝังด้วย ArcFace
 * คืน null เมื่อหาใบหน้าไม่เจอหรืออ่านไม่ได้
 */
export async function detectRobustFaceDescriptor(img: HTMLImageElement): Promise<Float32Array | null> {
  const desc = await getDescriptorFromImage(img);
  if (desc) return desc;
  const faceapiMod = await import("@vladmandic/face-api");
  const faceapi: any = (faceapiMod as any).default || faceapiMod;
  const res = await faceapi
    .detectSingleFace(img as any, detectorOptionsHQ(512, 0.25))
    .withFaceLandmarks()
    .catch(() => null);
  if (!res) return null;
  return await embedWithArcFace(img, res.landmarks, 1, 1).catch(() => null);
}

/** บันทึกลายใบหน้าจากรูปลงทะเบียนของนักเรียน (เขียนทับตัวอย่างเดิมจากรูปโปรไฟล์) */
export async function saveSyncedFaceDescriptor(
  studentId: string,
  descriptor: Float32Array,
  capturedBy?: string,
): Promise<void> {
  const { error } = await supabase.from("student_face_descriptors").upsert(
    {
      student_id: studentId,
      sample_index: 0,
      descriptor: Array.from(descriptor),
      captured_by: capturedBy,
      source: "profile_avatar",
      created_at: new Date().toISOString(),
    },
    { onConflict: "student_id,sample_index" },
  );
  if (error) throw error;
}

/** ซิงค์ใบหน้าจากรูปโปรไฟล์/รูปบัตรที่บันทึกไว้แล้ว — ใช้ในหน้าลงทะเบียน */
export async function syncStudentFaceFromPortrait(
  studentId: string,
  photoUrl: string,
  capturedBy?: string,
): Promise<Float32Array> {
  await ensureFaceSyncModels();
  const img = await loadFaceSyncImage(photoUrl, loadImageFromUrl);
  const desc = await detectRobustFaceDescriptor(img);
  if (!desc) throw new Error("ตรวจไม่พบใบหน้าในรูป (เบลอ/มุมเอียง/หลายคน)");
  await saveSyncedFaceDescriptor(studentId, desc, capturedBy);
  return desc;
}

/** ซิงค์ใบหน้าจากไฟล์รูปที่เพิ่งอัปโหลด — ใช้ตอนใส่รูปบัตรใหม่ ไม่ต้องดึงรูปกลับมาอีกรอบ */
export async function syncStudentFaceFromFile(
  studentId: string,
  file: File,
  capturedBy?: string,
): Promise<Float32Array> {
  await ensureFaceSyncModels();
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(objectUrl);
    const desc = await detectRobustFaceDescriptor(img);
    if (!desc) throw new Error("ตรวจไม่พบใบหน้าในรูป (เบลอ/มุมเอียง/หลายคน)");
    await saveSyncedFaceDescriptor(studentId, desc, capturedBy);
    return desc;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
