import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validFacegateCommand } from "../_shared/facegatePolicy.ts";
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 try {
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw new Error('configuration unavailable');
  const db=createClient(url,key),token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'unauthorized'},401);
  const {data:auth,error}=await db.auth.getUser(token);if(error||!auth.user)return reply({error:'unauthorized'},401);
  const {data:roles,error:roleError}=await db.from('user_roles').select('role').eq('user_id',auth.user.id);
  if(roleError)throw roleError;if(!roles?.some(r=>['admin','director'].includes(r.role)))return reply({error:'forbidden'},403);
  const body=await req.json();
  if(!body||typeof body.device_id!=='string'||body.device_id.length>150||!validFacegateCommand(body.kind,body.action))return reply({error:'invalid command'},400);
  const {data:device,error:deviceError}=await db.from('kiosk_devices').select('device_id,is_active,last_seen_at').eq('device_id',body.device_id).maybeSingle();
  if(deviceError)throw deviceError;if(!device||device.is_active===false)return reply({error:'device unavailable'},400);
  if(!device.last_seen_at||Date.now()-Date.parse(device.last_seen_at)>180000)return reply({error:'device offline'},409);
  const {data:command,error:writeError}=await db.from('kiosk_commands').insert({device_id:device.device_id,kind:body.kind,action:body.action,payload:{},created_by:auth.user.id}).select('id').single();
  if(writeError)throw writeError;
  return reply({ok:true,id:command.id,status:'queued'});
 }catch(e){console.error('facegate admin error',e);return reply({error:'request failed'},500);}
});