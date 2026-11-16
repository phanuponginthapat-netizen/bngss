// @vitest-environment node
import { expect, it } from 'vitest';
import { canSaveFaceRegistration } from '../faceRegistrationPolicy';
it('teachers save enrollment directly without waiting for admin approval', () => {
  expect(canSaveFaceRegistration('teacher')).toBe(true);
});
it('administrators and directors retain direct enrollment', () => {
  expect(canSaveFaceRegistration('admin')).toBe(true);
  expect(canSaveFaceRegistration('director')).toBe(true);
});
it('automatic enrollment does not grant students or parents write access', () => {
  expect(canSaveFaceRegistration('student')).toBe(false);
  expect(canSaveFaceRegistration('parent')).toBe(false);
});
it('observers and unresolved roles cannot save enrollment', () => {
  expect(canSaveFaceRegistration('director', true)).toBe(false);
  expect(canSaveFaceRegistration('observer')).toBe(false);
  expect(canSaveFaceRegistration(null)).toBe(false);
});