import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { validVisitorPhoto, visitorRegistrationApproval } from '../_shared/facegateVisitor.ts';
import { validVisitorLiveness } from '../_shared/visitorLiveness.ts';
const reply=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,'Content-Type':'application/json'}});
const Body=z.object({visitor_name:z.string().trim().min(2).max(120),visitor_phone:z.string().trim().regex(/^[0-9+\- ]{6,20}$/).optional().or(z.literal('')),organization:z.string().trim().max(150).optional(),purpose:z.string().trim().min(2).max(300),contact_person_name:z.string().trim().max(120).optional(),vehicle_plate:z.string().trim().max(20).optional(),face_consent:z.boolean().default(false),photo_url:z.string().optional(),face_samples:z.unknown().optional()}).superRefine((v,c)=>{if(v.face_consent&&(!validVisitorLiveness(v.face_samples)||!validVisitorPhoto(v.photo_url)||v.photo_url!==v.face_samples[0].image))c.addIssue({code:z.ZodIssueCode.custom,message:'ต้องถ่ายใบหน้าสดให้ครบทุกมุม',path:['face_samples']});if(v.photo_url&&(!v.face_consent||!validVisitorPhoto(v.photo_url)))c.addIssue({code:z.ZodIssueCode.custom,message:'รูปไม่ถูกต้องหรือยังไม่ยินยอม',path:['photo_url']});});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
  const parsed=Body.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return reply({error:'invalid',fields:parsed.error.flatten().fieldErrors},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const d=parsed.data;
  // Simple abuse guard: same name+phone at most once per 10 minutes.
  const since=new Date(Date.now()-600000).toISOString();
  let recentQuery=db.from('visitor_logs').select('id,check_in').eq('visitor_name',d.visitor_name).gte('check_in',since).is('check_out',null).limit(1);
  recentQuery=d.visitor_phone?recentQuery.eq('visitor_phone',d.visitor_phone):recentQuery.is('visitor_phone',null);
  const {data:recent,error:re}=await recentQuery;
  if(re)throw re;
  const samples=validVisitorLiveness(d.face_samples)?d.face_samples:null;
  const approval=visitorRegistrationApproval(d.face_consent,d.photo_url,new Date().toISOString());
  if(recent?.length){
    // A resubmission may add a consented photo; never reuse an embedding from a different image.
    if(approval.face_approved_at){
      const {error:updateError}=await db.from('visitor_logs').update({...approval,face_consent:true,photo_url:d.photo_url,face_samples:samples,face_embedding:samples?.[0].descriptor??null,face_error:null}).eq('id',recent[0].id).is('check_out',null);
      if(updateError)throw updateError;
    }
    return reply({ok:true,duplicate:true,id:recent[0].id,check_in:recent[0].check_in});
  }
  const {data,error}=await db.from('visitor_logs').insert({visitor_name:d.visitor_name,visitor_phone:d.visitor_phone||null,organization:d.organization||null,purpose:d.purpose,contact_person_name:d.contact_person_name||null,vehicle_plate:d.vehicle_plate||null,photo_url:d.photo_url||null,face_consent:d.face_consent,face_samples:samples,face_embedding:samples?.[0].descriptor??null,...approval,notes:'ลงทะเบียนผู้มาติดต่อ'}).select('id,check_in').single();
  if(error)throw error;
  return reply({ok:true,id:data.id,check_in:data.check_in});
 }catch(e){if(String((e as {message?:string})?.message??'').includes('visitor_face_already_registered'))return reply({error:'ใบหน้านี้มีในทะเบียนแล้ว กรุณาติดต่อเจ้าหน้าที่'},409);console.error('visitor checkin failed');return reply({error:'failed'},500);}
});
