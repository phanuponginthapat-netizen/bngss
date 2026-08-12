/**
 * ดึงข้อมูลทั้งหมดจาก PostgREST แบบแบ่งหน้า
 *
 * ปัญหา: Supabase/PostgREST จำกัดผลลัพธ์สูงสุด 1,000 แถวต่อคำขอ (เงียบ ๆ)
 * ทำให้รายงาน/แดชบอร์ดที่นับยอดฝั่ง client ได้ตัวเลข "เพี้ยน" เมื่อข้อมูลเกิน 1,000 แถว
 *
 * วิธีใช้:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("attendance").select("id, status")
 *       .eq("attendance_date", today)
 *       .order("id")            // ต้องมี order ที่แน่นอนเสมอ เพื่อไม่ให้แถวซ้ำ/หาย
 *       .range(from, to)
 *   );
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  opts?: { pageSize?: number; maxRows?: number },
): Promise<T[]> {
  const pageSize = opts?.pageSize ?? 1000;
  const maxRows = opts?.maxRows ?? 200_000;
  const out: T[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) {
      if (out.length === 0) throw error;
      break;
    }
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }

  return out;
}

/** นับจำนวนแถวจริงโดยไม่ดึงข้อมูล (ใช้แทนการดึงทั้งตารางมา .length) */
export async function countRows(
  build: () => PromiseLike<{ count: number | null; error: any }>,
): Promise<number> {
  const { count, error } = await build();
  if (error) return 0;
  return count || 0;
}
