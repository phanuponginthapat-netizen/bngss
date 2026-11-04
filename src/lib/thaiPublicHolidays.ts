// วันหยุดนักขัตฤกษ์ราชการ (ข้อมูลจริงตามประกาศ) สำหรับรายงานการปฏิบัติงานบุคลากร
// 2569/2570 ยึดตามประกาศวันหยุดราชการประจำปี
// 2571 ระบุเฉพาะวันที่ตรงตามปฏิทินคงที่ (วันมาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา รอประกาศทางการ)
// วันหยุดชดเชยคำนวณตามเกณฑ์: ตรงวันเสาร์-อาทิตย์ เลื่อนไปวันจันทร์ถัดไป ถ้าวันจันทร์เป็นวันหยุดอยู่แล้ว เลื่อนไปวันอังคาร
// (สงกรานต์ และวันแรงงานแห่งชาติ ไม่นับเป็นวันหยุดราชการ จึงไม่ใส่ วันหยุดเพิ่มกรณีพิเศษให้โรงเรียนกำหนดเองในปฏิทินโรงเรียน)

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
  { date: '2027-01-01', title: 'วันขึ้นปีใหม่' },
  { date: '2027-02-21', title: 'วันมาฆบูชา', substitute: true },
  { date: '2027-04-06', title: 'วันจักรี' },
  { date: '2027-04-13', title: 'วันสงกรานต์ (วันผู้สูงอายุ)' },
  { date: '2027-04-14', title: 'วันสงกรานต์ (วันครอบครัว)' },
  { date: '2027-04-15', title: 'วันสงกรานต์ (วันเถลิงศก)', substitute: false },
  { date: '2027-05-04', title: 'วันฉัตรมงคล' },
  { date: '2027-05-20', title: 'วันวิสาขบูชา' },
  { date: '2027-06-03', title: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี' },
  { date: '2027-07-18', title: 'วันอาสาฬหบูชา', substitute: true },
  { date: '2027-07-19', title: 'วันเข้าพรรษา' },
  { date: '2027-07-28', title: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว' },
  { date: '2027-08-12', title: 'วันแม่แห่งชาติ' },
  { date: '2027-10-13', title: 'วันนวมินทรมหาราช' },
  { date: '2027-10-23', title: 'วันปิยมหาราช', substitute: true },
  { date: '2027-12-05', title: 'วันพ่อแห่งชาติ', substitute: true },
  { date: '2027-12-10', title: 'วันรัฐธรรมนูญ' },
  { date: '2027-12-31', title: 'วันสิ้นปี' },
  { date: '2028-01-01', title: 'วันขึ้นปีใหม่', substitute: true },
  { date: '2028-04-06', title: 'วันจักรี' },
  { date: '2028-04-13', title: 'วันสงกรานต์ (วันผู้สูงอายุ)' },
  { date: '2028-04-14', title: 'วันสงกรานต์ (วันครอบครัว)' },
  { date: '2028-04-15', title: 'วันสงกรานต์ (วันเถลิงศก)', substitute: false },
  { date: '2028-05-04', title: 'วันฉัตรมงคล' },
  { date: '2028-06-03', title: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี', substitute: true },
  { date: '2028-07-28', title: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว' },
  { date: '2028-08-12', title: 'วันแม่แห่งชาติ', substitute: true },
  { date: '2028-10-13', title: 'วันนวมินทรมหาราช' },
  { date: '2028-10-23', title: 'วันปิยมหาราช' },
  { date: '2028-12-05', title: 'วันพ่อแห่งชาติ' },
  { date: '2028-12-10', title: 'วันรัฐธรรมนูญ', substitute: true },
  { date: '2028-12-31', title: 'วันสิ้นปี', substitute: true },
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
    while (taken.has(isoDay(next))) next = new Date(next.getTime() + DAY_MS);
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
