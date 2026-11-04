import { describe, expect, it } from 'vitest';
import { thaiPublicHolidays, thaiPublicHolidaysInRange } from '../thaiPublicHolidays';

const dates = (start: string, end: string) => thaiPublicHolidaysInRange(start, end).map(h => h.date);

describe('Thai public holiday calendar used by the work report', () => {
  it('has unique, sorted dates', () => {
    const list = thaiPublicHolidays();
    expect(new Set(list.map(h => h.date)).size).toBe(list.length);
    expect(list.map(h => h.date)).toEqual([...list.map(h => h.date)].sort());
  });
  it('carries the announced substitutions of 2569', () => {
    expect(dates('2026-05-25', '2026-06-08')).toContain('2026-06-01');
    expect(dates('2026-12-01', '2026-12-31')).toEqual(['2026-12-05', '2026-12-07', '2026-12-10', '2026-12-31']);
    expect(thaiPublicHolidaysInRange('2026-12-07', '2026-12-07')[0].substitute).toBe(true);
  });
  it('pushes the 2570 Asalha substitute past Buddhist Lent entry', () => {
    expect(thaiPublicHolidaysInRange('2027-07-19', '2027-07-19')[0].substitute).toBe(false);
    const substitute = thaiPublicHolidaysInRange('2027-07-20', '2027-07-20')[0];
    expect(substitute.substitute).toBe(true);
    expect(substitute.title).not.toBe(thaiPublicHolidaysInRange('2027-07-19', '2027-07-19')[0].title);
  });
  it('invents no Songkran substitute and no cross-year substitute', () => {
    expect(dates('2026-04-16', '2026-04-30')).toHaveLength(0);
    expect(dates('2028-12-25', '2029-01-10')).toEqual(['2028-12-31']);
  });
  it('reports no public holiday for November 2569, as announced', () => {
    expect(dates('2026-11-01', '2026-11-30')).toHaveLength(0);
  });
  it('covers December 2570 holidays on the correct weekdays', () => {
    const days = thaiPublicHolidaysInRange('2027-12-01', '2027-12-31');
    expect(days.map(h => h.date)).toEqual(['2027-12-05', '2027-12-06', '2027-12-10', '2027-12-31']);
    expect(new Date('2027-12-05T00:00:00Z').getUTCDay()).toBe(0);
    expect(new Date('2027-12-06T00:00:00Z').getUTCDay()).toBe(1);
  });
});
