import { supabase } from "@/integrations/supabase/client";

/**
 * ดึง "ใบหน้าที่ลงทะเบียนไว้" ของนักเรียน เพื่อนำไปแสดงเทียบกับใบหน้าที่สแกนได้
 * ลำดับความสำคัญ: ภาพจากการลงทะเบียนใบหน้า (student_face_descriptors.face_image)
 * ถ้าไม่มี → ใช้รูปโปรไฟล์นักเรียน (students.photo_url)
 */
const cache = new Map<string, string | null>();

export async function getRegisteredFaceImage(
  studentId: string,
  fallback?: string | null,
): Promise<string | null> {
  if (cache.has(studentId)) return cache.get(studentId) ?? fallback ?? null;
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
    return img || fallback || null;
  } catch {
    cache.set(studentId, null);
    return fallback || null;
  }
}

export function clearRegisteredFaceCache(studentId?: string) {
  if (studentId) cache.delete(studentId);
  else cache.clear();
}
