import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveKioskMediaUrl } from "@/lib/kioskMediaUrl";
import { getRegisteredFaceImage } from "@/lib/registeredFace";
import { serverTodayBangkok } from "@/lib/serverClock";
import { SCAN_RECEIPT_EVENT } from "@/lib/scanRealtime";
import { Button } from "@/components/ui/button";
import { RefreshCw, UserRound } from "lucide-react";
type Receipt = {id:string;name:string;detail:string;time:string;device:string;photo:string|null};
export default function LiveScanReceipts() {
  const [rows,setRows]=useState<Receipt[]>([]),[error,setError]=useState("");
  useEffect(()=>{
    let disposed=false,busy=false,again=false;
    const load=async()=>{
      if(busy){again=true;return;} busy=true;
      try {
        const today=serverTodayBangkok();
        const [scans,staff]=await Promise.all([
          supabase.from("face_scan_logs").select("id,student_id,scan_time,scan_type,device_label,captured_face_url,students(prefix,first_name,last_name,photo_url,classrooms!students_classroom_id_fkey(name))").eq("scan_date",today).order("scan_time",{ascending:false}).order("id").limit(12),
          supabase.from("kiosk_agent_alerts").select("id,note,created_at,device_name,snapshot_url").eq("kind","staff_pass").gte("created_at",`${today}T00:00:00+07:00`).order("created_at",{ascending:false}).order("id").limit(12),
        ]);
        if(scans.error||staff.error)throw scans.error||staff.error;
        const students=await Promise.all((scans.data??[]).map(async r=>({id:r.id,name:`${r.students?.prefix||""}${r.students?.first_name||""} ${r.students?.last_name||""}`.trim(),detail:`${r.students?.classrooms?.name||""} · ${r.scan_type==="exit"?"ออก":"เข้า"}`,time:r.scan_time,device:r.device_label||"—",photo:await getRegisteredFaceImage(r.student_id,r.students?.photo_url)||await resolveKioskMediaUrl(r.captured_face_url)})));
        const personnel=await Promise.all((staff.data??[]).map(async r=>({id:r.id,name:r.note||"บุคลากร",detail:"บุคลากร",time:r.created_at,device:r.device_name||"—",photo:await resolveKioskMediaUrl(r.snapshot_url)})));
        if(!disposed){setRows([...students,...personnel].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)||a.id.localeCompare(b.id)).slice(0,12));setError("");}
      }catch{if(!disposed)setError("อ่านผลสแกนสดไม่สำเร็จ");}
      finally{busy=false;if(again&&!disposed){again=false;void load();}}
    };
    void load();window.addEventListener(SCAN_RECEIPT_EVENT,load);window.addEventListener("facegate:retry",load);
    const timer=setInterval(load,30000);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener(SCAN_RECEIPT_EVENT,load);window.removeEventListener("facegate:retry",load);};
  },[]);
  return <section aria-label="ผลสแกนสด" className="space-y-3 border-b pb-4">
    <header className="flex items-center justify-between"><h2 className="text-lg font-semibold">ผลสแกนล่าสุดทุกตู้</h2><Button variant="ghost" size="icon" aria-label="อ่านผลสแกนใหม่" onClick={()=>window.dispatchEvent(new Event("facegate:retry"))}><RefreshCw className="h-4 w-4"/></Button></header>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {!error&&!rows.length&&<p className="text-muted-foreground">ยังไม่มีผลสแกนวันนี้</p>}
    <div className="max-h-80 overflow-y-auto divide-y">{rows.map(r=><article key={r.id} className="flex items-center gap-3 py-3">
      {r.photo?<img src={r.photo} alt={r.name} className="h-14 w-14 shrink-0 rounded-md object-cover"/>:<UserRound className="h-14 w-14 shrink-0 text-muted-foreground"/>}
      <div className="min-w-0 flex-1"><p className="font-semibold break-words">{r.name}</p><p className="text-sm text-muted-foreground">{r.detail} · {r.device}</p></div>
      <time className="shrink-0 text-sm tabular-nums" dateTime={r.time}>{new Date(r.time).toLocaleTimeString("th-TH",{timeZone:"Asia/Bangkok",hour12:false})}</time>
    </article>)}</div>
  </section>;
}