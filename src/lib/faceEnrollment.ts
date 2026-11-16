export const MAX_ENROLLMENT_PHOTOS = 5;
export const MAX_ENROLLMENT_FILE_BYTES = 6_000_000;
export function faceSampleError(descriptor: ArrayLike<number> | null, previous: ArrayLike<number>[]): string | null {
  if (!descriptor || descriptor.length !== 512 || !Array.from(descriptor).every(Number.isFinite)) return 'อ่าน ArcFace ไม่สำเร็จ กรุณาลองใหม่';
  const norm = Math.sqrt(Array.from(descriptor).reduce((sum,v)=>sum+v*v,0));
  if (norm < .01) return 'ข้อมูลใบหน้าไม่สมบูรณ์';
  for (const old of previous) {
    const other = Math.sqrt(Array.from(old).reduce((sum,v)=>sum+v*v,0));
    const similarity = Array.from(descriptor).reduce((sum,v,i)=>sum+v*old[i],0)/(norm*other);
    if (!Number.isFinite(similarity) || similarity < .65) return 'ใบหน้าไม่ตรงกับรูปก่อนหน้า กรุณาตรวจว่าเป็นนักเรียนคนเดียวกัน';
  }
  return null;
}