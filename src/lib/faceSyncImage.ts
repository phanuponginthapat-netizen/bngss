import { resolveProfileImageUrl } from '@/lib/profileImageUrl';

/** Private portraits need a current read URL before face extraction/canvas use. */
export async function loadFaceSyncImage(
  source: string,
  load: (url: string) => Promise<HTMLImageElement>,
): Promise<HTMLImageElement> {
  const url = await resolveProfileImageUrl(source, true);
  if (!url) throw new Error('ไม่พบรูปสำหรับซิงค์ใบหน้า');
  try {
    return await load(url);
  } catch {
    throw new Error('อ่านไฟล์รูปไม่ได้ กรุณาลองใหม่หรือตรวจว่ารูปยังอยู่');
  }
}