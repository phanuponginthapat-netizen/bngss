import {describe,it,expect} from 'vitest';
import {validFacegateCommand,facegateSaver,FACEGATE_PAUSE_SECONDS} from '../../../supabase/functions/_shared/facegatePolicy';
describe('FaceGate policy',()=>{
 it('keeps a two second pause for all completed faces',()=>expect(FACEGATE_PAUSE_SECONDS).toBe(2));
 it('does not execute an arbitrary machine command',()=>expect(validFacegateCommand('power','rm -rf')).toBe(false));
 it('does not accept a door action as a power action',()=>expect(validFacegateCommand('power','open')).toBe(false));
 it('accepts the supported screen wake command',()=>expect(validFacegateCommand('power','screen_on')).toBe(true));
 it('preserves the configured idle delay',()=>expect(facegateSaver({screensaver_mode:'stats',idle_stats_minutes:2})).toEqual({screensaver_mode:'stats',idle_stats_minutes:2}));
 it('rejects invalid idle delay rather than showing a default',()=>expect(()=>facegateSaver({idle_stats_minutes:-1})).toThrow());
});