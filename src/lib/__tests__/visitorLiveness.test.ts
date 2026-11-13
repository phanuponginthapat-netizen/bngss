// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validVisitorLiveness, cosine } from '../../../supabase/functions/_shared/visitorLiveness';
const samples = () => ['front','left','right','closed','open'].map((pose,i)=>({pose,image:'data:image/jpeg;base64,AAAA',descriptor:Array(512).fill(.1),yaw:[0,-.25,.25,0,0][i],ear:[.3,.3,.3,.1,.3][i],at:1000+i*800}));
describe('visitor camera challenge',()=>{
  it('accepts five consistent angles and a closed-open blink',()=>expect(validVisitorLiveness(samples())).toBe(true));
  it('rejects a single uploaded photo',()=>expect(validVisitorLiveness(samples().slice(0,1))).toBe(false));
  it('rejects stationary faces without both turns',()=>{const s=samples();s[1].yaw=0;expect(validVisitorLiveness(s)).toBe(false);});
  it('rejects missing blink',()=>{const s=samples();s[3].ear=.3;expect(validVisitorLiveness(s)).toBe(false);});
  it('rejects switching people between angles',()=>{const s=samples();s[2].descriptor=Array(512).fill(-.1);expect(validVisitorLiveness(s)).toBe(false);});
  it('rejects replay with identical timestamps',()=>{const s=samples();s[1].at=s[0].at;expect(validVisitorLiveness(s)).toBe(false);});
  it('matches identical identities above the database duplicate threshold',()=>expect(cosine(Array(512).fill(.1),Array(512).fill(.1))).toBeGreaterThanOrEqual(.5));
});