import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import VisitorPhotoCapture from '@/components/kiosk/VisitorPhotoCapture';
const fields=[['visitor_name','ชื่อ-นามสกุล *'],['visitor_phone','เบอร์โทร'],['organization','หน่วยงาน'],['purpose','เรื่องที่มาติดต่อ *'],['contact_person_name','ผู้ที่ต้องการพบ'],['vehicle_plate','ทะเบียนรถ']] as const;
export default function VisitorCheckinPage(){
 const [f,setF]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[done,setDone]=useState<string|null>(null),[err,setErr]=useState('');
 const [consent,setConsent]=useState(false),[photo,setPhoto]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setErr('');try{const {data,error}=await supabase.functions.invoke('visitor-checkin',{body:{...f,face_consent:consent,...(consent&&photo?{photo_url:photo}:{})}});if(error||!data?.ok)throw error;setDone(new Date(data.check_in??Date.now()).toLocaleString('th-TH'));}catch{setErr('ลงทะเบียนไม่สำเร็จ ตรวจชื่อและเรื่องที่มาติดต่อ แล้วลองใหม่');}finally{setBusy(false);}};
 return <main className="mx-auto min-h-screen max-w-md space-y-5 p-5"><h1 className="text-2xl font-bold">ลงทะเบียนผู้มาติดต่อ</h1>{done?<div className="space-y-3 rounded-md border p-5 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-primary"/><p className="font-semibold">ลงทะเบียนแล้ว</p><p className="text-sm text-muted-foreground">{done} · กรุณาแจ้งเจ้าหน้าที่</p></div>:<form onSubmit={submit} className="space-y-3">{fields.map(([k,l])=><div key={k} className="space-y-1"><Label htmlFor={k}>{l}</Label><Input id={k} required={l.endsWith('*')} maxLength={k==='purpose'?300:k==='vehicle_plate'?20:120} value={f[k]??''} onChange={e=>setF(s=>({...s,[k]:e.target.value}))}/></div>)}<div className="flex items-start gap-2 border-t pt-4"><Checkbox id="face-consent" checked={consent} onCheckedChange={v=>{setConsent(v===true);if(v!==true)setPhoto('');}}/><Label htmlFor="face-consent" className="leading-6">ยินยอมใช้รูปใบหน้าเพื่อยืนยันการเข้า–ออกวันนี้ หลังเจ้าหน้าที่อนุมัติ (ไม่บังคับ)</Label></div>{consent&&<div className="space-y-2"><Label htmlFor="visitor-photo"><Camera className="mr-2 inline h-4 w-4"/>รูปใบหน้า</Label><Input id="visitor-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e=>void selectPhoto(e.target.files?.[0])}/>{photo&&<img src={photo} alt="รูปผู้มาติดต่อ" className="h-36 w-36 rounded-md object-cover"/>}</div>}{err&&<p className="text-destructive">{err}</p>}<Button className="w-full" disabled={busy}><UserPlus className="mr-2 h-4 w-4"/>{busy?'กำลังบันทึก…':'ลงทะเบียน'}</Button></form>}</main>;
}
