// @vitest-environment node
import { expect, it } from 'vitest';
import { faceSampleError, MAX_ENROLLMENT_PHOTOS, MAX_ENROLLMENT_FILE_BYTES } from '../faceEnrollment';
const v=[1,...Array(511).fill(0)];
it('accepts complete same-person ArcFace samples',()=>expect(faceSampleError(v,[v])).toBeNull());
it('rejects a different person within the selected batch',()=>expect(faceSampleError([0,1,...Array(510).fill(0)],[v])).not.toBeNull());
it('rejects incomplete or nonfinite embeddings',()=>{expect(faceSampleError([1],[])).not.toBeNull();expect(faceSampleError([NaN,...v.slice(1)],[])).not.toBeNull();});
it('bounds photo count and input size',()=>{expect(MAX_ENROLLMENT_PHOTOS).toBe(5);expect(MAX_ENROLLMENT_FILE_BYTES).toBe(6000000);});