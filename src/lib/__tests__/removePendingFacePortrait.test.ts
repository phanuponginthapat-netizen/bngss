// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const { from, update, eq, select } = vi.hoisted(() => ({ from:vi.fn(), update:vi.fn(), eq:vi.fn(), select:vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{from}}));
import { removePendingFacePortrait } from '../removePendingFacePortrait';
beforeEach(() => { vi.clearAllMocks(); const chain={update,eq,select}; from.mockReturnValue(chain);update.mockReturnValue(chain);eq.mockReturnValue(chain);select.mockResolvedValue({data:[{id:'student'}],error:null}); });
it('clears only the exact selected portrait and never attendance or shared files', async()=>{
  await removePendingFacePortrait('student','old/photo.webp');
  expect(from.mock.calls).toEqual([['students']]);expect(update).toHaveBeenCalledWith({photo_url:null});expect(eq.mock.calls).toEqual([['id','student'],['photo_url','old/photo.webp']]);
});
it('rejects stale portraits and denied writes without claiming removal', async()=>{
  select.mockResolvedValueOnce({data:[],error:null});await expect(removePendingFacePortrait('student','old')).rejects.toThrow('รูปถูกเปลี่ยน');
  select.mockResolvedValueOnce({data:null,error:new Error('permission denied')});await expect(removePendingFacePortrait('student','old')).rejects.toThrow('permission denied');
});