// @vitest-environment node
import { expect, it } from 'vitest';
import { familyGradeSemester, linkedChild } from '../familyGrades';
it('parents and students start at semester 1 during semester 2 while staff keep the current term', () => {
  expect(familyGradeSemester(true, 2)).toBe(1);
  expect(familyGradeSemester(true, 1)).toBe(1);
  expect(familyGradeSemester(false, 2)).toBe(2);
});
it('selected children must belong to the linked roster', () => {
  expect(linkedChild([{ id: '2543' }, { id: '2653' }], '2653')?.id).toBe('2653');
  expect(linkedChild([{ id: '2543' }], 'foreign')?.id).toBe('2543');
  expect(linkedChild([], 'foreign')).toBeNull();
});