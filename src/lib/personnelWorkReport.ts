import type { AppRole } from '@/hooks/useUserRole';

export type WorkItem = { scope: string; detail: string };
export type WorkLog = { id: string; work_date: string; template_id: string; position_title: string; items: WorkItem[] };
export type CalendarHoliday = { title: string; event_date: string; end_date: string | null };
export type WorkDay = { date: string; kind: 'work' | 'weekend' | 'holiday'; label: string; log?: WorkLog };

export function canUsePersonnelWorkReport(role: AppRole | null, observer = false) {
  return !observer && (role === 'teacher' || role === 'admin' || role === 'director');
}
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('เดือนรายงานไม่ถูกต้อง');
  const [year, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}` };
}
export function workMonthRows(month: string, holidays: CalendarHoliday[], logs: WorkLog[]): WorkDay[] {
  const { end } = monthBounds(month);
  return Array.from({ length: Number(end.slice(-2)) }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const holiday = holidays.find(h => h.event_date <= date && (h.end_date ?? h.event_date) >= date);
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (holiday) return { date, kind: 'holiday', label: `วันหยุด — ${holiday.title}` };
    if (day === 0 || day === 6) return { date, kind: 'weekend', label: day === 6 ? '— วันเสาร์ —' : '— วันอาทิตย์ —' };
    return { date, kind: 'work', label: '', log: logs.find(l => l.work_date === date) };
  });
}
export function validWorkItems(items: WorkItem[], scopes: string[]) {
  return items.length > 0 && items.every(i => scopes.includes(i.scope) && i.detail.trim().length > 0);
}
export function parseWorkItems(value: unknown): WorkItem[] {
  if (!Array.isArray(value) || value.some(i => !i || typeof i.scope !== 'string' || typeof i.detail !== 'string')) throw new Error('ข้อมูลรายการงานไม่ถูกต้อง');
  return value as WorkItem[];
}
export const escapeWorkHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
export const thaiWorkDate = (date: string) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T00:00:00+07:00`));
const printWorkDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${day}-${shortMonths[month - 1]}-${String(year + 543).slice(-2)}`;
};
export const thaiWorkMonth = (month: string) => new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${month}-01T00:00:00+07:00`));

export function buildWorkReportHtml(rows: WorkDay[], heading: { name: string; position: string; school: string; month: string }) {
  const e = escapeWorkHtml;
  const positions = [...new Set(rows.flatMap(r => r.log ? [r.log.position_title] : []))];
  return `<style>@page{size:A4;margin:15mm} .work-report{font-family:Sarabun,sans-serif;font-size:12pt;line-height:1.15} .work-report header{text-align:center;margin-bottom:5mm;line-height:1.3} .work-report .title{font-size:16pt;font-weight:bold} .work-report .meta{font-size:12pt} .work-report table{width:100%;border-collapse:collapse;table-layout:fixed} .work-report th,.work-report td{border:1px solid currentColor;padding:1mm 1.6mm;vertical-align:top;overflow-wrap:anywhere} .work-report th{font-size:12pt;text-align:center;font-weight:bold;padding-top:1.6mm;padding-bottom:1.6mm} .work-report tr{break-inside:avoid} .work-report thead{display:table-header-group} .work-report .date{font-size:12pt;text-align:center;vertical-align:middle;white-space:nowrap;padding-left:0.8mm;padding-right:0.8mm} .work-report tr.rest td{background:#e2e2e2} .work-report .rest{text-align:center;vertical-align:middle;font-weight:bold} .work-report .entry{margin-bottom:0.8mm} .work-report .activity{font-weight:700} .work-report .scope{font-weight:400} .work-report .empty{color:#333}</style>
  <article class="work-report"><header><div class="title">รายงานการปฏิบัติงาน ตำแหน่ง ${e(positions.join(' / ') || heading.position)}</div><div class="meta">${e(heading.school)}<br>${e(heading.name)}<br>ประจำเดือน ${e(thaiWorkMonth(heading.month))}</div></header>
  <table><colgroup><col width="15%"><col width="51%"><col width="17%"><col width="17%"></colgroup><thead><tr><th>วันเดือนปี</th><th>รายการปฏิบัติงาน</th><th>ลายมือชื่อ<br>ผู้ปฏิบัติ</th><th>ลายมือชื่อ<br>ผู้ควบคุม</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.kind === 'work' ? '' : 'rest'}"><td class="date">${e(printWorkDate(r.date))}</td><td class="${r.kind === 'work' ? '' : 'rest'}">${r.kind !== 'work' ? e(r.label) : r.log ? r.log.items.map((item, i) => `<div class="entry"><span class="activity">${e(item.detail).replace(/\n/g, '<br>')}</span><br><span class="scope">${i + 1}. ${e(item.scope)}</span></div>`).join('') : '<span class="empty">ยังไม่ได้บันทึก</span>'}</td><td></td><td></td></tr>`).join('')}</tbody></table></article>`;
}