import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validFacegateCommand, validWakePayload } from "../_shared/facegatePolicy.ts";
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
  if(body?.action==='approve_visitor_face') {
    if(typeof body.visitor_id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.visitor_id))return reply({error:'invalid visitor'},400);
    const {data:visit,error:readError}=await db.from('visitor_logs').select('id,face_consent,photo_url,check_out').eq('id',body.visitor_id).maybeSingle();
    if(readError)throw readError;if(!visit?.face_consent||!visit.photo_url||visit.check_out)return reply({error:'visitor unavailable or consent missing'},400);
    const {error:saveError}=await db.from('visitor_logs').update({face_approved_at:new Date().toISOString(),face_approved_by:auth.user.id,face_error:null}).eq('id',visit.id);
    if(saveError)throw saveError;return reply({ok:true});
  }
  if(!body||typeof body.device_id!=='string'||body.device_id.length>150||!validFacegateCommand(body.kind,body.action))return reply({error:'invalid command'},400);
  const {data:device,error:deviceError}=await db.from('kiosk_devices').select('device_id,is_active,last_seen_at').eq('device_id',body.device_id).maybeSingle();
  if(deviceError)throw deviceError;if(!device||device.is_active===false)return reply({error:'device unavailable'},400);
  if(!device.last_seen_at||Date.now()-Date.parse(device.last_seen_at)>180000)return reply({error:'device offline'},409);
  if(body.action==='wake'&&!validWakePayload(body.payload))return reply({error:'invalid MAC address'},400);
  const payload=body.action==='wake'?{wake_mac:body.payload.wake_mac,wake_broadcast:'255.255.255.255',wake_port:9}:{};
  const {data:command,error:writeError}=await db.from('kiosk_commands').insert({device_id:device.device_id,kind:body.kind,action:body.action,payload,created_by:auth.user.id}).select('id').single();
  if(writeError)throw writeError;
  return reply({ok:true,id:command.id,status:'queued'});
 }catch(e){console.error('facegate admin error',e);return reply({error:'request failed'},500);}
});