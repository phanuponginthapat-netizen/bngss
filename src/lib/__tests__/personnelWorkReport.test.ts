import { describe, expect, it } from 'vitest';
import { canUsePersonnelWorkReport, monthBounds, validWorkItems, workMonthRows } from '../personnelWorkReport';
describe('personnel work report rules', () => {
  it('staff only; excludes students, parents, alumni and observers', () => {
    for (const role of ['teacher', 'admin', 'director'] as const) expect(canUsePersonnelWorkReport(role)).toBe(true);
    for (const role of ['student', 'parent', 'alumni', 'observer'] as const) expect(canUsePersonnelWorkReport(role)).toBe(false);
    expect(canUsePersonnelWorkReport('director', true)).toBe(false);
  });
  it('requires a predefined scope and actual daily detail', () => {
    expect(validWorkItems([], ['งานสอน'])).toBe(false);
    expect(validWorkItems([{ scope: 'งานอื่น', detail: 'ทำงาน' }], ['งานสอน'])).toBe(false);
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
});