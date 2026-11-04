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
  it('invents no Songkran substitute', () => {
    expect(dates('2026-04-16', '2026-04-30')).toHaveLength(0);
  });
  it('reports no public holiday for November 2569, as announced', () => {
    expect(dates('2026-11-01', '2026-11-30')).toHaveLength(0);
  });
  it('lists only officially announced years — nothing beyond 2569 until the government announces it', () => {
    expect(dates('2027-01-01', '2027-12-31')).toHaveLength(0);
    expect(dates('2028-01-01', '2028-12-31')).toHaveLength(0);
  });
  it('matches the announced 2569 calendar exactly', () => {
    expect(dates('2026-01-01', '2026-12-31')).toEqual([
      '2026-01-01', '2026-01-02', '2026-03-03', '2026-04-06', '2026-04-13', '2026-04-14', '2026-04-15',
      '2026-05-04', '2026-05-31', '2026-06-01', '2026-06-03', '2026-07-28', '2026-07-29', '2026-07-30',
      '2026-08-12', '2026-10-13', '2026-10-23', '2026-12-05', '2026-12-07', '2026-12-10', '2026-12-31',
    ]);
  });
});
