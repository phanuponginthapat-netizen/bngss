// ภาคเรียน/ปีการศึกษา "ปัจจุบัน" ตามวันจริงในตาราง ปฏิทินของโรงเรียน
//
// ฐานข้อมูลเก็บคาบเรียนไว้ในตาราง academic_periods (start_date/end_date เป็น ค.ศ.)
// และ trigger ของ attendance/face scan ใช้แถวที่ is_current = true เป็นตัวตัดสินใจ
// ว่าบันทึกนั้นเข้าภาคเรียนไหน — ถ้าคำนวณจากเดือนอย่างเดียว จะเพี้ยนได้ 1 วัน
// เช่นภาคเรียนที่ 2 เปิด 2 พฤศจิกายน แต่เดือนเปลี่ยนตั้งแต่วันที่ 1 พฤศจิกายน
// คะแนน/การเข้าเรียนวันที่ 1 พ.ย. จะถูกจัดเข้าภาคเรียนที่ 2 ทั้งที่โรงเรียนยังไม่เปิด
//
// ฟังก์ชันนี้เป็นตัว "แปลวัน → ภาคเรียน" ที่ใช้ซ้ำได้และทดสอบได้ (ไม่แตะเครือข่าย)

export interface AcademicPeriodRow {
  academic_year_be: number | string | null;
  semester: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ResolvedAcademicPeriod {
  /** ปีการศึกษา พ.ศ. เช่น 2569 */
  yearBE: number;
  /** ภาคเรียน 1 หรือ 2 */
  semester: number;
  /** "in-period" = วันนี้ตรงในคาบ, "recent-past" = ช่วงปิดภาคเรียน ใช้คาบที่เพิ่งผ่านไป */
  basis: "in-period" | "recent-past";
}

/** ช่วงปิดภาคเรียนที่ยังถือว่าภาคเรียนล่าสุดเป็น "ปัจจุบัน" (กันข้อมูลคาบเรียนเก่าค้าง) */
export const MAX_GAP_DAYS = 180;

function toDay(value?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? "").trim());
  return m ? m[0] : null;
}

function daysBefore(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

interface CleanRow {
  year: number;
  sem: number;
  start: string;
  end: string;
}

function clean(rows: AcademicPeriodRow[]): CleanRow[] {
  return rows
    .map((r) => ({
      year: Number(r.academic_year_be),
      sem: Number(r.semester),
      start: toDay(r.start_date),
      end: toDay(r.end_date),
    }))
    .filter(
      (r): r is CleanRow & { start: string; end: string } =>
        Number.isFinite(r.year) &&
        r.year > 1900 &&
        (r.sem === 1 || r.sem === 2) &&
        !!r.start &&
        !!r.end &&
        r.start <= r.end
    );
}

/**
 * หาภาคเรียนของ "วันนี้" (ISO YYYY-MM-DD ตามเวลาไทย)
 * 1) วันนี้ตรงในคาบใด → ใช้คาบนั้น (ถ้าซ้อนกัน ใช้คาบที่เริ่มใหม่สุด)
 * 2) อยู่ในช่องว่างระหว่างคาบ → ใช้คาบที่เพิ่งจบไป (ไม่เกิน MAX_GAP_DAYS)
 * 3) ไม่มีข้อมูลที่ใช้ได้ → null (ผู้เรียกควรคำนวณจากเดือนต่อ)
 */
export function resolveAcademicPeriod(
  rows: AcademicPeriodRow[],
  todayISO: string
): ResolvedAcademicPeriod | null {
  const today = toDay(todayISO);
  if (!today) return null;
  const valid = clean(rows || []);
  if (!valid.length) return null;

  const inPeriod = valid
    .filter((r) => r.start <= today && today <= r.end)
    .sort((a, b) => b.start.localeCompare(a.start) || b.sem - a.sem)[0];
  if (inPeriod) return { yearBE: inPeriod.year, semester: inPeriod.sem, basis: "in-period" };

  const floor = daysBefore(today, MAX_GAP_DAYS);
  const recent = valid
    .filter((r) => r.end < today && r.end >= floor)
    .sort((a, b) => b.end.localeCompare(a.end))[0];
  if (recent) return { yearBE: recent.year, semester: recent.sem, basis: "recent-past" };

  return null;
}
