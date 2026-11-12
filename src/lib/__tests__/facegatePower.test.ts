import {describe,it,expect} from 'vitest';
import {facegatePowerPlan,validateFacegatePower} from '../../../supabase/functions/_shared/facegatePolicy';
const s={power_saving_enabled:true,screen_off_time:'18:00',screen_on_time:'06:00',power_off_time:'20:00'};
describe('facegate power plan',()=>{
 it('screen off across midnight',()=>{expect(facegatePowerPlan(s,23*60).screen_off_window).toBe(true);expect(facegatePowerPlan(s,5*60+59).screen_off_window).toBe(true);expect(facegatePowerPlan(s,6*60).screen_off_window).toBe(false);});
 it('shutdown due only within 10 minutes',()=>{expect(facegatePowerPlan(s,20*60+9).power_off_due).toBe(true);expect(facegatePowerPlan(s,20*60+10).power_off_due).toBe(false);});
 it('disabled does nothing',()=>{expect(facegatePowerPlan({...s,power_saving_enabled:false},23*60)).toMatchObject({screen_off_window:false,power_off_due:false});});
 it('rejects bad time',()=>{expect(()=>validateFacegatePower({screen_off_time:'25:00'})).toThrow();});
});
