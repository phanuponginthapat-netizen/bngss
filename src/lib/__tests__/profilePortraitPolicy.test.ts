import { expect, it } from 'vitest';
import { canChangeOwnPortrait } from '../profilePortraitPolicy';
it('students cannot change their portrait', () => { expect(canChangeOwnPortrait('student')).toBe(false); });
it('parents cannot change their portrait', () => { expect(canChangeOwnPortrait('parent')).toBe(false); });
it('staff retain their existing portrait controls', () => {
  for (const role of ['admin','director','teacher']) expect(canChangeOwnPortrait(role)).toBe(true);
});
it('unresolved roles do not expose portrait controls', () => { expect(canChangeOwnPortrait(null)).toBe(false); });