import { supabase } from "@/integrations/supabase/client";
import { resolveProfileImageUrl } from "@/lib/profileImageUrl";

/**
 * ดึง "ใบหน้าที่ลงทะเบียนไว้" ของนักเรียน เพื่อนำไปแสดงเทียบกับใบหน้าที่สแกนได้
 * ลำดับความสำคัญ: ภาพจากการลงทะเบียนใบหน้า (student_face_descriptors.face_image)
 * ถ้าไม่มี → ใช้รูปโปรไฟล์นักเรียน (students.photo_url) โดยเซ็น URL ให้ก่อน (bucket เป็น private)
 */
const cache = new Map<string, string | null>();

async function resolveFallback(studentId: string, fallback?: string | null): Promise<string | null> {
  let raw = fallback || null;
  if (!raw) {
    try {
      const { data } = await supabase
        .from("students")
        .select("photo_url")
        .eq("id", studentId)
        .maybeSingle();
      raw = (data as any)?.photo_url || null;
    } catch {
      raw = null;
    }
  }
  if (!raw) return null;
  try {
    return (await resolveProfileImageUrl(raw)) || raw;
  } catch {
    return raw;
  }
}

export async function getRegisteredFaceImage(
  studentId: string,
  fallback?: string | null,
): Promise<string | null> {
  if (cache.has(studentId)) {
    const hit = cache.get(studentId);
    if (hit) return hit;
    return resolveFallback(studentId, fallback);
  }
  try {
    const { data } = await supabase
      .from("student_face_descriptors")
      .select("face_image, quality_score")
      .eq("student_id", studentId)
      .not("face_image", "is", null)
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const img = (data as any)?.face_image || null;
    cache.set(studentId, img);
    if (img) return img;
  } catch {
    cache.set(studentId, null);
  }
  return resolveFallback(studentId, fallback);
}

export function clearRegisteredFaceCache(studentId?: string) {
  if (studentId) cache.delete(studentId);
  else cache.clear();
}
