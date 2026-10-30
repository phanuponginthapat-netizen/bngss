export interface TermDates { semester: number; start_date: string; end_date: string }
export function validateTermDates(terms: TermDates[]): string | null {
  if (terms.length !== 2 || new Set(terms.map(t => t.semester)).size !== 2 || terms.some(t => t.semester !== 1 && t.semester !== 2)) return "กรุณากำหนดทั้งสองภาคเรียน";
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  for (const term of terms) {
    if (!validDate(term.start_date) || !validDate(term.end_date)) return "กรุณาระบุวันเปิดและวันปิดให้ครบ";
    if (term.start_date > term.end_date) return "วันปิดภาคเรียนต้องไม่ก่อนวันเปิด";
  }
  const first = terms.find(t => t.semester === 1);
  const second = terms.find(t => t.semester === 2);
  if (first && second && first.end_date >= second.start_date) return "วันเปิดภาคเรียนที่ 2 ต้องหลังวันปิดภาคเรียนที่ 1";
  return null;
}