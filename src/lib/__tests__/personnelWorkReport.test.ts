import { describe, expect, it } from 'vitest';
import { buildWorkReportHtml, canUsePersonnelWorkReport, monthBounds, validWorkItems, workMonthRows } from '../personnelWorkReport';
describe('personnel work report rules', () => {
  it('staff only; excludes students, parents, alumni and observers', () => {
    for (const role of ['teacher', 'admin', 'director'] as const) expect(canUsePersonnelWorkReport(role)).toBe(true);
    for (const role of ['student', 'parent', 'alumni', 'observer'] as const) expect(canUsePersonnelWorkReport(role)).toBe(false);
    expect(canUsePersonnelWorkReport('director', true)).toBe(false);
  });
  it('requires a predefined scope and actual daily detail', () => {
    expect(validWorkItems([], ['งานสอน'])).toBe(false);
    expect(validWorkItems([{ scope: 'งานอื่่น', detail: 'ทำงาน' }], ['งานสอน'])).toBe(false);
    expect(validWorkItems([{ scope: 'งานสอน', detail: ' ' }], ['งานสอน'])).toBe(false);
    expect(validWorkItems([{ scope: 'งานสอน', detail: 'สอน ม.1' }], ['งานสอน'])).toBe(true);
  });
  it('lists every date including leap day', () => {
    expect(monthBounds('2028-02').end).toBe('2028-02-29');
    expect(workMonthRows('2026-11', [], [])).toHaveLength(30);
  });
  it('weekends have no daily work even if legacy data exists', () => {
    const rows = workMonthRows('2026-11', [], [{ id:'x', work_date:'2026-11-07', template_id:'t', position_title:'ครู', items:[{scope:'งาน',detail:'เก่า'}] }]);
    expect(rows[6].kind).toBe('weekend');
    expect(rows[6].log).toBeUndefined();
    expect(rows[6].loggable).toBe(false);
    expect(rows[7].kind).toBe('weekend');
  });
  it('includes holidays starting in a prior month through inclusive end date', () => {
    const rows = workMonthRows('2026-11', [{ title:'วันหยุดโรงเรียน', event_date:'2026-10-31', end_date:'2026-11-03' }], []);
    expect(rows[1].kind).toBe('holiday');
    expect(rows[2].kind).toBe('holiday');
    expect(rows[3].kind).toBe('work');
  });
  it('does not invent work or holidays when nothing is recorded', () => {
    const row = workMonthRows('2026-11', [], [])[3];
    expect(row.kind).toBe('work');
    expect(row.log).toBeUndefined();
  });
  it('names public holidays and keeps them loggable while school calendar days stay locked', () => {
    const rows = workMonthRows('2026-12', [
      { title:'วันรัฐธรรมน้ญ', event_date:'2026-12-10', end_date:null, publicHoliday:true },
      { title:'วันหยุดโรงเรียน', event_date:'2026-12-11', end_date:null },
    ], []);
    expect(rows[9]).toMatchObject({ kind:'holiday', publicHoliday:true, loggable:true, label:'วันหยุดนักขัตฤกษ์ — วันรัฐธรรมน้ญ' });
    expect(rows[10]).toMatchObject({ kind:'holiday', publicHoliday:false, loggable:false, label:'วันหยุด — วันหยุดโรงเรียน' });
  });
  it('keeps work actually done on a public holiday visible in the printed report', () => {
    const rows = workMonthRows('2026-12', [{ title:'วันพ่อแห่งชาติ', event_date:'2026-12-05', end_date:null, publicHoliday:true }], [{ id:'x', work_date:'2026-12-05', template_id:'t', position_title:'ครู', items:[{scope:'งานกิจกรรม',detail:'จัดกิจกรรมวันพ่อ'}] }]);
    expect(rows[4].log?.items[0].detail).toBe('จัดกิจกรรมวันพ่อ');
    const html = buildWorkReportHtml(rows, { name:'นาย ทดสอบ', position:'ครู', school:'โรงเรียนทจ.', month:'2026-12' });
    expect(html).toContain('จัดกิจกรรมวันพ่อ');
    expect(html).not.toContain('วันหยุดนักขัตฤกษ์ — วันพ่อแห่งชาติ');
  });
  it('prints an unlogged public holiday as a rest row', () => {
    const rows = workMonthRows('2026-12', [{ title:'วันรัฐธรรมน้ญ', event_date:'2026-12-10', end_date:null, publicHoliday:true }], []);
    const html = buildWorkReportHtml(rows, { name:'นาย ทดสอบ', position:'ครู', school:'โรงเรียนทจ.', month:'2026-12' });
    expect(html).toContain('วันหยุดนักขัตฤกษ์ — วันรัฐธรรมน้ญ');
  });
});
