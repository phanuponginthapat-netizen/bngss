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
export const thaiWorkMonth = (month: string) => new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${month}-01T00:00:00+07:00`));

export function buildWorkReportHtml(rows: WorkDay[], heading: { name: string; position: string; school: string; month: string }) {
  const e = escapeWorkHtml;
  return `<style>@page{size:A4;margin:15mm} .work-report{font-family:Sarabun,sans-serif;font-size:16pt;line-height:1.12} .work-report header{text-align:center;margin-bottom:10mm} .work-report table{width:100%;border-collapse:collapse;table-layout:fixed} .work-report th,.work-report td{border:1px solid currentColor;padding:2mm;vertical-align:top;overflow-wrap:anywhere} .work-report th{text-align:center;font-weight:bold} .work-report tr{break-inside:avoid} .work-report thead{display:table-header-group} .work-report .date{text-align:center;vertical-align:middle} .work-report .rest{text-align:center} .work-report .entry{margin-bottom:1mm}</style>
  <article class="work-report"><header><strong>รายงานการปฏิบัติงาน ตำแหน่ง ${e(heading.position)}</strong><br>${e(heading.school)}<br>${e(heading.name)}<br>ประจำเดือน ${e(thaiWorkMonth(heading.month))}</header>
  <table><colgroup><col width="13%"><col width="53%"><col width="17%"><col width="17%"></colgroup><thead><tr><th>วันเดือนปี</th><th>รายการปฏิบัติงาน</th><th>ลายมือชื่อ<br>ผู้ปฏิบัติ</th><th>ลายมือชื่อ<br>ผู้ควบคุม</th></tr></thead><tbody>${rows.map(r => `<tr><td class="date">${e(thaiWorkDate(r.date))}</td><td class="${r.kind === 'work' ? '' : 'rest'}">${r.kind !== 'work' ? e(r.label) : r.log ? r.log.items.map((item, i) => `<div class="entry">${i + 1}. ${e(item.scope)}<br>${e(item.detail).replace(/\n/g, '<br>')}</div>`).join('') : 'ยังไม่ได้บันทึก'}</td><td></td><td></td></tr>`).join('')}</tbody></table></article>`;
}