// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { arcFaceDuplicate } from '../../../supabase/functions/_shared/nativeFaceDuplicate';
const descriptor = [1, ...Array(511).fill(0)];
describe('native enrollment identity', () => {
  it('blocks matching 512-dimensional samples of another student', () => {
    expect(arcFaceDuplicate([descriptor], [{ student_id: 'other', descriptor }], 'student')).toBe(true);
  });
  it('allows new samples for the same student', () => {
    expect(arcFaceDuplicate([descriptor], [{ student_id: 'student', descriptor }], 'student')).toBe(false);
  });
  it('does not identify an orthogonal face as the same person', () => {
    expect(arcFaceDuplicate([descriptor], [{ student_id: 'other', descriptor: [0,1,...Array(510).fill(0)] }], 'student')).toBe(false);
  });
});