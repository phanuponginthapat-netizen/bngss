import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {RefreshCw} from 'lucide-react';
import {resolveStorageUrl} from '@/lib/storageUrl';
type Alert={id:string;device_name:string|null;kind:string;note:string|null;created_at:string;snapshot_url:string|null};
export default function FacegateAlerts(){
 const [rows,setRows]=useState<Alert[]>([]),[error,setError]=useState('');
 const load=async()=>{try{const {data,error}=await supabase.from('kiosk_agent_alerts').select('id,device_name,kind,note,created_at,snapshot_url').neq('kind','staff_pass').order('created_at',{ascending:false}).limit(100);if(error)throw error;setRows(await Promise.all((data??[]).map(async r=>({...r,snapshot_url:r.snapshot_url?await resolveStorageUrl('face-photos',r.snapshot_url):null}))));setError('');}catch{setError('อ่านเหตุการณ์ไม่สำเร็จ');}};
 useEffect(()=>{void load();const t=setInterval(load,15000);return()=>clearInterval(t);},[]);
 return <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">เหตุการณ์ล่าสุด 100 รายการ</h2><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4"/>รีเฟรช</Button></div>{error?<p className="text-destructive">{error}</p>:rows.length===0?<p className="text-muted-foreground">ไม่มีเหตุการณ์</p>:<div className="divide-y">{rows.map(r=><article key={r.id} className="flex gap-4 py-3">{r.snapshot_url&&<img src={r.snapshot_url} alt="ภาพเหตุการณ์" className="h-20 w-20 rounded-md object-cover"/>}<div><p className="font-medium">{r.device_name} · {r.kind==='unknown_face'?'ไม่พบในทะเบียน':r.kind==='visitor_unregistered'?'ผู้มาติดต่อยังไม่ลงทะเบียน':r.kind}</p><p>{r.note}</p><p className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p></div></article>)}</div>}</section>;
}