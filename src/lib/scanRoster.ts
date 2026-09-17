/**
 * scanRoster — สำเนารายชื่อนักเรียนไว้ในเครื่อง สำหรับหน้าสแกน QR
 *
 * ทำไมต้องมี: ถ้าเน็ตหลุดตอนเวรประตู เดิมระบบ "หาไม่เจอ" แล้วทิ้งการสแกนไปเลย
 * ทำให้เด็กที่มาจริงกลายเป็นขาดเรียน — เก็บรายชื่อไว้ในเครื่องจึงยังเก็บคิวได้ครบ
 * และซิงค์ขึ้นระบบเมื่อเน็ตกลับมา
 */
import { supabase } from "@/integrations/supabase/client";

export interface RosterStudent {
  id: string;
  student_code: string;
  name: string;
  classroom: string;
}

const KEY = "bng_scan_roster_v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // รีเฟรชอย่างน้อยวันละ 2 ครั้ง

interface RosterCache {
  at: number;
  rows: RosterStudent[];
}

function read(): RosterCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RosterCache) : null;
  } catch {
    return null;
  }
}

/** ดาวน์โหลดรายชื่อนักเรียนที่ยังศึกษาอยู่มาเก็บในเครื่อง */
export async function refreshRoster(): Promise<number> {
  const { data, error } = await supabase
    .from("students")
    .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level)")
    .eq("status", "active");
  if (error || !data) return read()?.rows.length ?? 0;

  const rows: RosterStudent[] = data.map((s: any) => ({
    id: s.id,
    student_code: String(s.student_code || "").trim(),
    name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
    classroom: s.classrooms
      ? `${s.classrooms.grade_level || ""}/${s.classrooms.name || ""}`.replace(/^\/|\/$/g, "")
      : "-",
  }));
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rows } satisfies RosterCache));
  } catch { /* เต็ม — ข้าม */ }
  return rows.length;
}

/** รีเฟรชถ้าข้อมูลเก่าเกินกำหนด (เรียกได้บ่อย ไม่เปลืองคำขอ) */
export async function ensureRosterFresh(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const cache = read();
  if (cache && Date.now() - cache.at < MAX_AGE_MS && cache.rows.length) return;
  await refreshRoster().catch(() => {});
}

export function rosterInfo(): { count: number; updatedAt: number | null } {
  const cache = read();
  return { count: cache?.rows.length ?? 0, updatedAt: cache?.at ?? null };
}

/** ค้นนักเรียนจากรหัส (ตรงตัวเท่านั้น — ห้ามเดา เพื่อไม่ให้บันทึกผิดคน) */
export function findInRoster(code: string): RosterStudent | null {
  const c = (code || "").trim();
  if (!c) return null;
  const rows = read()?.rows ?? [];
  return (
    rows.find((r) => r.student_code === c) ||
    rows.find((r) => r.id === c) ||
    null
  );
}
