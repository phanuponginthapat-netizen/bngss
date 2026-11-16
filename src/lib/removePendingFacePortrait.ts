import { supabase } from '@/integrations/supabase/client';
/** Clear only the selected roster portrait; shared files and attendance evidence stay intact. */
export async function removePendingFacePortrait(id: string, photoUrl: string): Promise<void> {
  const { data, error } = await supabase.from('students').update({ photo_url: null }).eq('id', id).eq('photo_url', photoUrl).select('id');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('รูปถูกเปลี่ยนแล้ว กรุณาโหลดรายการใหม่ก่อนลบ');
}