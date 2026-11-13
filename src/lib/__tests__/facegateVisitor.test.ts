import {describe,it,expect} from 'vitest';
import {activeVisitorFace,validFaceEmbedding,validVisitorPhoto} from '../../../supabase/functions/_shared/facegateVisitor';
import {validFacegateCommand,validWakePayload} from '../../../supabase/functions/_shared/facegatePolicy';
describe('temporary visitor faces',()=>{
 const visit={face_consent:true,face_approved_at:'2026-11-13T00:00:00Z',check_in:'2026-11-12T18:00:00Z',check_out:null};
 it('requires explicit consent',()=>expect(activeVisitorFace({...visit,face_consent:false},'2026-11-13')).toBe(false));
 it('requires staff approval',()=>expect(activeVisitorFace({...visit,face_approved_at:null},'2026-11-13')).toBe(false));
 it('expires at Bangkok midnight',()=>{expect(activeVisitorFace(visit,'2026-11-13')).toBe(true);expect(activeVisitorFace(visit,'2026-11-14')).toBe(false);});
 it('stops matching after checkout',()=>expect(activeVisitorFace({...visit,check_out:'2026-11-13T03:00:00Z'},'2026-11-13')).toBe(false));
 it('requires 512 finite nonzero model values',()=>{expect(validFaceEmbedding(Array(512).fill(.1))).toBe(true);expect(validFaceEmbedding(Array(128).fill(.1))).toBe(false);expect(validFaceEmbedding(Array(512).fill(0))).toBe(false);expect(validFaceEmbedding(Array(512).fill(NaN))).toBe(false);});
 it('does not accept HTML as a face photo',()=>{expect(validVisitorPhoto('data:text/html;base64,AAAA')).toBe(false);expect(validVisitorPhoto('data:image/jpeg;base64,AAAA')).toBe(true);expect(validVisitorPhoto('data:image/jpeg;base64,'+'A'.repeat(1400000))).toBe(false);});
 it('allows voice preparation only as a power command',()=>{expect(validFacegateCommand('power','prepare_voice')).toBe(true);expect(validFacegateCommand('door','prepare_voice')).toBe(false);});
 it('requires a complete MAC address and blocks host injection',()=>{expect(validWakePayload({wake_mac:'AA:BB:CC:DD:EE:FF'})).toBe(true);expect(validWakePayload({wake_mac:'127.0.0.1;shutdown'})).toBe(false);});
});