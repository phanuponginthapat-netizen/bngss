// วันหยุดนักขัตฤกษ์ราชการ สำหรับรายงานการปฏิบัติงานบุคลากร
// ใส่เฉพาะปีที่รัฐบาลประกาศวันหยุดราชการอย่างเป็นทางการแล้วเท่านั้น (ปัจจุบัน: พ.ศ. 2569)
// ปีถัดไปที่ยังไม่มีประกาศ ห้ามเดาวันหยุดล่วงหน้า — ให้โรงเรียนเพิ่มเองในปฏิทินโรงเรียนเมื่อมีประกาศ
// วันหยุดชดเชยคำนวณตามเกณฑ์: ตรงวันเสาร์-อาทิตย์ เลื่อนไปวันจันทร์ถัดไป ถ้าวันจันทร์เป็นวันหยุดอยู่แล้ว เลื่อนไปวันอังคาร
// (วันแรงงานแห่งชาติไม่ใช่วันหยุดราชการ จึงไม่ใส่ วันหยุดเพิ่มกรณีพิเศษให้โรงเรียนกำหนดเองในปฏิทินโรงเรียน)

export type ThaiPublicHoliday = { date: string; title: string; substitute: boolean };
type BaseHoliday = { date: string; title: string; substitute?: boolean };

const DAY_MS = 86_400_000;

const BASE_HOLIDAYS: BaseHoliday[] = [
  { date: '2026-01-01', title: 'วันขึ้นปีใหม่' },
  { date: '2026-01-02', title: 'วันหยุดราชการกรณีพิเศษ' },
  { date: '2026-03-03', title: 'วันมาฆบูชา' },
  { date: '2026-04-06', title: 'วันจักรี' },
  { date: '2026-04-13', title: 'วันสงกรานต์ (วันผู้สูงอายุ)' },
  { date: '2026-04-14', title: 'วันสงกรานต์ (วันครอบครัว)' },
  { date: '2026-04-15', title: 'วันสงกรานต์ (วันเถลิงศก)', substitute: false },
  { date: '2026-05-04', title: 'วันฉัตรมงคล' },
  { date: '2026-05-31', title: 'วันวิสาขบูชา', substitute: true },
  { date: '2026-06-03', title: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี' },
  { date: '2026-07-28', title: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว' },
  { date: '2026-07-29', title: 'วันอาสาฬหบูชา' },
  { date: '2026-07-30', title: 'วันเข้าพรรษา' },
  { date: '2026-08-12', title: 'วันแม่แห่งชาติ' },
  { date: '2026-10-13', title: 'วันนวมินทรมหาราช' },
  { date: '2026-10-23', title: 'วันปิยมหาราช' },
  { date: '2026-12-05', title: 'วันพ่อแห่งชาติ', substitute: true },
  { date: '2026-12-10', title: 'วันรัฐธรรมนูญ' },
  { date: '2026-12-31', title: 'วันสิ้นปี' },
];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

let cache: ThaiPublicHoliday[] | null = null;

export function thaiPublicHolidays(): ThaiPublicHoliday[] {
  if (cache) return cache;
  const taken = new Set(BASE_HOLIDAYS.map(h => h.date));
  const list: ThaiPublicHoliday[] = BASE_HOLIDAYS.map(h => ({ date: h.date, title: h.title, substitute: false }));
  for (const holiday of BASE_HOLIDAYS) {
    if (!holiday.substitute) continue;
    const base = new Date(`${holiday.date}T00:00:00Z`);
    const weekday = base.getUTCDay();
    if (weekday !== 0 && weekday !== 6) continue;
    let next = new Date(base.getTime() + DAY_MS);
    while (taken.has(isoDay(next)) || next.getUTCDay() === 0 || next.getUTCDay() === 6) next = new Date(next.getTime() + DAY_MS);
    const day = isoDay(next);
    if (day.slice(0, 4) !== holiday.date.slice(0, 4)) continue; // วันหยุดข้ามปีต้องประกาศแยกต่างหาก
    taken.add(day);
    list.push({ date: day, title: `${holiday.title} (วันหยุดชดเชย)`, substitute: true });
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  cache = list;
  return list;
}

export function thaiPublicHolidaysInRange(start: string, end: string) {
  return thaiPublicHolidays().filter(holiday => holiday.date >= start && holiday.date <= end);
}
