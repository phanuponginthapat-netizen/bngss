import { supabase } from "@/integrations/supabase/client";

/**
 * บัตรนักเรียนถูกพิมพ์เป็น QR ที่มีค่าเป็น:
 *  - URL ของโปรไฟล์:  `${origin}/p/<auth_user_id>`
 *  - URL ของ SDQ:     `${origin}/sdq-assess/<student.id>`
 *  - รหัสนักเรียนล้วน (เช่น "s0001")
 *  - บาง QR ใส่ query string: `?code=xxx` / `?sid=xxx` / `?student=xxx`
 *
 * ฟังก์ชันนี้ดึง "รหัสอ้างอิง" ออกจากค่า QR/บาร์โค้ดที่สแกนเข้ามา
 * แล้วคืนสตริงที่พร้อมส่งเข้า resolveScannedStudent() หรือ setSearch()
 */
export function extractScannedCode(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const q = u.searchParams.get("code") || u.searchParams.get("sid") || u.searchParams.get("student");
      if (q) return q.trim();
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length) return parts[parts.length - 1].trim();
    } else {
      const m = s.match(/(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)/i);
      if (m) return m[1];
    }
  } catch { /* fallthrough */ }
  return s;
}

export interface ResolvedStudent {
  id: string;
  student_code: string | null;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  classroom_id?: string | null;
  auth_user_id?: string | null;
}

/**
 * แปลงค่า QR/บาร์โค้ดที่สแกน → student record หนึ่งคน
 * ลองตามลำดับ: student_code → auth_user_id (จาก /p/) → id (จาก /sdq-assess/ หรือ UUID)
 */
export async function resolveScannedStudent(
  raw: string,
  opts?: { classroomId?: string | null },
): Promise<ResolvedStudent | null> {
  const s = (raw || "").trim();
  if (!s) return null;

  const cols = "id, student_code, prefix, first_name, last_name, classroom_id, auth_user_id" as const;

  // ตรวจว่ามาเป็น URL หรือไม่ + path ประเภทไหน
  let pathHint: "profile" | "sdq" | null = null;
  let extracted = s;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const q = u.searchParams.get("code") || u.searchParams.get("sid") || u.searchParams.get("student");
      if (q) extracted = q.trim();
      else {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const kind = parts[parts.length - 2];
          extracted = parts[parts.length - 1];
          if (/^p$/i.test(kind)) pathHint = "profile";
          else if (/^sdq-assess$/i.test(kind)) pathHint = "sdq";
        } else if (parts.length === 1) {
          extracted = parts[0];
        }
      }
    } else {
      const m = s.match(/(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)/i);
      if (m) extracted = m[1];
    }
  } catch { /* keep extracted = s */ }

  extracted = extracted.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(extracted);
  const classroomId = opts?.classroomId || null;

  const applyClassroom = (q: any) => (classroomId ? q.eq("classroom_id", classroomId) : q);

  // 1) ถ้ามีคำใบ้จาก URL → ลอง lookup ตรงประเภทก่อน
  if (pathHint === "profile" && isUuid) {
    const { data } = await applyClassroom(
      supabase.from("students").select(cols).eq("auth_user_id", extracted).limit(1),
    ).maybeSingle();
    if (data) return data as ResolvedStudent;
  }
  if (pathHint === "sdq" && isUuid) {
    const { data } = await applyClassroom(
      supabase.from("students").select(cols).eq("id", extracted).limit(1),
    ).maybeSingle();
    if (data) return data as ResolvedStudent;
  }

  // 2) fallback: ลอง student_code ตรงๆ
  {
    const { data } = await applyClassroom(
      supabase.from("students").select(cols).eq("student_code", extracted).limit(1),
    ).maybeSingle();
    if (data) return data as ResolvedStudent;
  }

  // 3) UUID ที่ไม่มี hint → ลองทั้ง auth_user_id / id
  if (isUuid) {
    const { data: byAuth } = await applyClassroom(
      supabase.from("students").select(cols).eq("auth_user_id", extracted).limit(1),
    ).maybeSingle();
    if (byAuth) return byAuth as ResolvedStudent;
    const { data: byId } = await applyClassroom(
      supabase.from("students").select(cols).eq("id", extracted).limit(1),
    ).maybeSingle();
    if (byId) return byId as ResolvedStudent;
  }

  return null;
}
