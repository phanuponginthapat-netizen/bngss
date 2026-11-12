import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
type Media = { id: string; title: string; storage_path: string; media_type: string; duration_seconds: number; sort_order: number; is_active: boolean; url?: string };
export default function FacegateMedia() {
  const [items, setItems] = useState<Media[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = async () => {
    setError("");
    try {
      const rows = await fetchAllRows<Media>((a,b) => supabase.from("facegate_broadcast_media").select("*").order("sort_order").order("id").range(a,b));
      const signed = await Promise.all(rows.map(async r => { const { data,error } = await supabase.storage.from("face-photos").createSignedUrl(r.storage_path,3600); if(error) throw error; return { ...r,url:data.signedUrl }; }));
      setItems(signed);
    } catch { setError("อ่านสื่อประชาสัมพันธ์ไม่สำเร็จ"); }
  };
  useEffect(() => { void load(); },[]);
  const upload = async (f: File) => {
    if (!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(f.type) || f.size > 50*1024*1024 || !f.size) { toast.error("รับ JPG/PNG/WebP/MP4/WebM ขนาดไม่เกิน 50 MB"); return; }
    setBusy(true);
    const path = `facegate-broadcast/${crypto.randomUUID()}.${f.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'') || 'bin'}`;
    try {
      const { error } = await supabase.storage.from("face-photos").upload(path,f,{contentType:f.type}); if(error) throw error;
      const { error: saveError } = await supabase.from("facegate_broadcast_media").insert({title:f.name,storage_path:path,media_type:f.type.startsWith('video/')?'video':'image',mime_type:f.type,size_bytes:f.size,sort_order:items.length});
      if(saveError) { await supabase.storage.from("face-photos").remove([path]); throw saveError; }
      toast.success("เพิ่มสื่อแล้ว"); await load();
    } catch { toast.error("เพิ่มสื่อไม่สำเร็จ"); } finally { setBusy(false); }
  };
  const change = async (id:string,patch:Partial<Pick<Media,'is_active'|'duration_seconds'|'sort_order'>>) => { const {error}=await supabase.from("facegate_broadcast_media").update(patch).eq("id",id); if(error) toast.error("บันทึกไม่สำเร็จ"); else await load(); };
  const remove = async (item:Media) => {
    if(!(await swal.confirm({title:`ลบสื่อ ${item.title}?`}))) return;
    const {error}=await supabase.from("facegate_broadcast_media").delete().eq("id",item.id); if(error) return toast.error("ลบรายการไม่สำเร็จ");
    const {error:storageError}=await supabase.storage.from("face-photos").remove([item.storage_path]); if(storageError) toast.error("ลบรายการแล้ว แต่ไฟล์ยังอยู่ในพื้นที่เก็บ");
    await load();
  };
  return <div className="space-y-4"><h2 className="text-lg font-semibold">รูปภาพและวิดีโอประชาสัมพันธ์</h2><div className="flex gap-2"><Button disabled={busy} onClick={()=>file.current?.click()}><Upload className="mr-2 h-4 w-4" />เพิ่มสื่อ</Button><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />รีเฟรช</Button><input ref={file} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={e=>{const f=e.target.files?.[0];if(f) void upload(f);e.target.value='';}} /></div>
    {error ? <p className="text-destructive">{error}</p> : items.length===0 ? <p className="text-muted-foreground">ยังไม่มีสื่อ</p> : <div className="grid gap-4 sm:grid-cols-2">{items.map((item,i)=><article key={item.id} className="space-y-3 rounded-md border p-3">
      {item.media_type==='video'?<video className="aspect-video w-full bg-muted object-contain" src={item.url} controls preload="metadata" />:<img className="aspect-video w-full bg-muted object-contain" src={item.url} alt={item.title} />}
      <h3 className="break-words font-medium">{item.title}</h3><div className="flex flex-wrap items-center gap-2"><Switch aria-label={`เปิดสื่อ ${item.title}`} checked={item.is_active} onCheckedChange={v=>change(item.id,{is_active:v})} /><Input aria-label="เวลาแสดงภาพ (วินาที)" className="w-20" type="number" min={3} max={300} defaultValue={item.duration_seconds} onBlur={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=3&&n<=300) void change(item.id,{duration_seconds:n});}} /><Button size="icon" variant="ghost" aria-label="เลื่อนขึ้น" disabled={i===0} onClick={()=>change(item.id,{sort_order:(items[i-1]?.sort_order??0)-1})}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="เลื่อนลง" disabled={i===items.length-1} onClick={()=>change(item.id,{sort_order:(items[i+1]?.sort_order??0)+1})}><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="ลบสื่อ" onClick={()=>remove(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
    </article>)}</div>}</div>;
}