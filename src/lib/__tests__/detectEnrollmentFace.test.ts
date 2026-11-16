// @vitest-environment node
import { expect, it, vi } from 'vitest';
const { all, extract } = vi.hoisted(()=>({all:vi.fn(),extract:vi.fn()}));
vi.mock('@vladmandic/face-api',()=>({detectAllFaces:all}));
vi.mock('../faceApi',()=>({detectorOptionsHQ:vi.fn(),detectFaceWithLandmarks:extract}));
import { detectEnrollmentFace } from '../detectEnrollmentFace';
it('rejects multiple people before generating an embedding',async()=>{
 all.mockResolvedValue([{},{}]);extract.mockClear();
 await expect(detectEnrollmentFace({} as HTMLCanvasElement)).rejects.toThrow('หลายคน');
 expect(extract).not.toHaveBeenCalled();
});
it('extracts a single detected face',async()=>{
 all.mockResolvedValue([{}]);extract.mockResolvedValue({descriptor:[1]});
 expect(await detectEnrollmentFace({} as HTMLCanvasElement)).toEqual({descriptor:[1]});
});