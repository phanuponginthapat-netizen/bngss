// @vitest-environment node
import { expect, it } from 'vitest';
import { savedPeriodTime } from '../savedScheduleTime';
it('shows stored 09:30 rather than a recalculated 09:20', () => {
  expect(savedPeriodTime([{ period: 2, start_time: '09:30:00', end_time: '10:30:00' }], 2)).toEqual({ start: '09:30', end: '10:30' });
});
it('does not invent common times for inconsistent days', () => {
  expect(savedPeriodTime([{ period: 2, start_time: '09:30', end_time: '10:30' }, { period: 2, start_time: '09:20', end_time: '10:10' }], 2)).toBeNull();
});