import { validFaceEmbedding, validVisitorPhoto } from './facegateVisitor.ts';
export type VisitorSample = { pose: string; image: string; descriptor: number[]; yaw: number; ear: number; at: number };
export function cosine(a: number[], b: number[]) {
  let dot=0, aa=0, bb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return dot/Math.sqrt(aa*bb);
}
export function validVisitorLiveness(samples: unknown): samples is VisitorSample[] {
  if(!Array.isArray(samples)||samples.length!==5)return false;
  const poses=['front','left','right','closed','open'];
  for(let i=0;i<5;i++){
    const s=samples[i];
    if(!s||s.pose!==poses[i]||!validVisitorPhoto(s.image)||!validFaceEmbedding(s.descriptor)||![s.yaw,s.ear,s.at].every(Number.isFinite))return false;
    if(i>0&&(s.at-samples[i-1].at<200||s.at-samples[i-1].at>30000||cosine(samples[0].descriptor,s.descriptor)<.5))return false;
  }
  return Math.abs(samples[0].yaw)<.15&&samples[1].yaw<-.18&&samples[2].yaw>.18&&samples[3].ear<.20&&samples[4].ear>.25&&samples[4].at-samples[0].at>=1500&&samples[4].at-samples[0].at<=90000;
}