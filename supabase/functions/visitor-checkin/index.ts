import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
const reply=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...corsHeaders,'Content-Type':'application/json'}});
const Body=z.object({visitor_name:z.string().trim().min(2).max(120),visitor_phone:z.string().trim().regex(/^[0-9+\- ]{6,20}$/).optional().or(z.literal('')),organization:z.string().trim().max(150).optional(),purpose:z.string().trim().min(2).max(300),contact_person_name:z.string().trim().max(120).optional(),vehicle_plate:z.string().trim().max(20).optional()});
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
  const {data:recent,error:re}=await db.from('visitor_logs').select('id').eq('visitor_name',d.visitor_name).gte('check_in',since).limit(1);
  if(re)throw re;if(recent?.length)return reply({ok:true,duplicate:true,id:recent[0].id});
  const {data,error}=await db.from('visitor_logs').insert({visitor_name:d.visitor_name,visitor_phone:d.visitor_phone||null,organization:d.organization||null,purpose:d.purpose,contact_person_name:d.contact_person_name||null,vehicle_plate:d.vehicle_plate||null,notes:'ลงทะเบียนผ่าน QR'}).select('id,check_in').single();
  if(error)throw error;
  return reply({ok:true,id:data.id,check_in:data.check_in});
 }catch(e){console.error('visitor checkin',e);return reply({error:'failed'},500);}
});
