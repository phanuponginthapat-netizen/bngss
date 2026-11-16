// @vitest-environment node
import { expect, it } from 'vitest';
import { familyGradeSemester, linkedChild } from '../familyGrades';
it('parents start at semester 1 during semester 2 without changing student defaults', () => {
  expect(familyGradeSemester(true, 2)).toBe(1);
  expect(familyGradeSemester(false, 2)).toBe(2);
});
it('selected children must belong to the linked roster', () => {
  expect(linkedChild([{ id: '2543' }, { id: '2653' }], '2653')?.id).toBe('2653');
  expect(linkedChild([{ id: '2543' }], 'foreign')?.id).toBe('2543');
  expect(linkedChild([], 'foreign')).toBeNull();
});