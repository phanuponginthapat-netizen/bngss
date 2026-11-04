import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Printer, Save, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useSchoolReport } from '@/hooks/useSchoolReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { swal } from '@/lib/swal';
import { todayBangkok } from '@/lib/dateBE';
import { openPrintWindow } from '@/lib/printUtils';
import { buildWorkReportHtml, canUsePersonnelWorkReport, monthBounds, parseWorkItems, thaiWorkDate, thaiWorkMonth, validWorkItems, workMonthRows, type WorkItem } from '@/lib/personnelWorkReport';

export default function DailyWorkLogPage() {
  const { userId, role, isObserver } = useUserRole();
  const allowed = canUsePersonnelWorkReport(role, isObserver);
  const qc = useQueryClient();
  const school = useSchoolReport();
  const { info } = school;
  const today = todayBangkok();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [tab, setTab] = useState('daily');
  const [templateId, setTemplateId] = useState('');
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [position, setPosition] = useState('');
  const [scopes, setScopes] = useState(['']);
  const [workDate, setWorkDate] = useState<string | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [saving, setSaving] = useState(false);
  const bounds = monthBounds(month);
  const identity = useQuery({ queryKey:['work-report-identity', userId], enabled: !!userId && allowed, queryFn: async () => {
    if (!userId) throw new Error('กรุณาเข้าสู่ระบบ');
    const { data, error } = await supabase.from('profiles').select('first_name,last_name').eq('id', userId).single();
    if (error) throw error;
    return data;
  }});
  const templates = useQuery({ queryKey:['work-report-templates', userId], enabled: !!userId && allowed, queryFn: async () => {
    if (!userId) throw new Error('กรุณาเข้าสู่ระบบ');
    const { data, error } = await supabase.from('personnel_work_templates').select('*').eq('user_id', userId).order('created_at');
    if (error) throw error;
    return data;
  }});
  const calendar = useQuery({ queryKey:['academic_events', 'work-report-holidays', userId, month], enabled: !!userId && allowed, queryFn: async () => {
    const { data, error } = await supabase.from('academic_events').select('title,event_date,end_date').eq('event_type','holiday').lte('event_date',bounds.end).or(`end_date.gte.${bounds.start},and(end_date.is.null,event_date.gte.${bounds.start})`).order('event_date');
    if (error) throw error;
    return data;
  }});
  const logs = useQuery({ queryKey:['work-report-logs', userId, month], enabled: !!userId && allowed, queryFn: async () => {
    if (!userId) throw new Error('กรุณาเข้าสู่ระบบ');
    const { data, error } = await supabase.from('personnel_daily_work_logs').select('*').eq('user_id',userId).gte('work_date',bounds.start).lte('work_date',bounds.end).order('work_date');
    if (error) throw error;
    return data.map(l => ({...l, items:parseWorkItems(l.items)}));
  }});
  useEffect(() => {
    setTemplateId(''); setEditTemplateId(null); setTitle(''); setPosition('');
    setScopes(['']); setItems([]); setWorkDate(null);
  }, [userId]);
  useEffect(() => {
    if (templates.data && !templates.data.some(t => t.id === templateId)) {
      setTemplateId(templates.data[0]?.id ?? '');
    }
  }, [templates.data, templateId]);
  const selected = templates.data?.find(t => t.id === templateId);
  const rows = workMonthRows(month, calendar.data ?? [], logs.data ?? []);
  const loading = [templates, calendar, logs, identity].some(q => q.isPending);
  const error = templates.error || calendar.error || logs.error || identity.error;
  const ready = !loading && !error;
  const printReady = ready && school.isReady;
  const refresh = () => { void templates.refetch(); void calendar.refetch(); void logs.refetch(); void identity.refetch(); void school.refetch(); };
  const invalidate = async () => {
    await Promise.all([qc.invalidateQueries({queryKey:['work-report-templates',userId]}), qc.invalidateQueries({queryKey:['work-report-logs',userId]})]);
  };
  const resetTemplate = () => { setEditTemplateId(null); setTitle(''); setPosition(''); setScopes(['']); };
  const saveTemplate = async () => {
    const cleanScopes = scopes.map(s => s.trim()).filter(Boolean);
    if (!userId || !title.trim() || !position.trim() || !cleanScopes.length) { void swal.warning('กรุณาระบุชื่อเทมเพลต ตำแหน่ง และขอบเขตงาน'); return; }
    setSaving(true);
    try {
      const payload = { title:title.trim(), position_title:position.trim(), scopes:cleanScopes };
      const result = editTemplateId
        ? await supabase.from('personnel_work_templates').update(payload).eq('id',editTemplateId).eq('user_id',userId).select().single()
        : await supabase.from('personnel_work_templates').insert(payload).select().single();
      if (result.error) throw result.error;
      setTemplateId(result.data.id);
      await invalidate(); resetTemplate(); setTab('daily'); void swal.success('บันทึกขอบเขตงานแล้ว');
    } catch (err) { void swal.error('บันทึกขอบเขตงานไม่สำเร็จ',err); } finally { setSaving(false); }
  };
  const openDay = (date: string) => {
    const row = rows.find(r => r.date === date);
    if (!ready || row?.kind !== 'work' || date > today) return;
    const log = row.log;
    if (log) {
      setTemplateId(log.template_id); setItems(log.items.map(i => ({...i})));
    } else {
      if (!selected) { setTab('templates'); return; }
      setItems(selected.scopes.map(scope => ({scope,detail:''})));
    }
    setWorkDate(date);
  };
  const saveDay = async () => {
    if (!userId || !workDate || !selected || !ready) return;
    const clean = items.filter(i => i.detail.trim()).map(i => ({scope:i.scope,detail:i.detail.trim()}));
    const original = rows.find(r => r.date === workDate)?.log;
    const allowedScopes = [...selected.scopes, ...(original?.items.map(i => i.scope) ?? [])];
    if (!validWorkItems(clean,allowedScopes)) { void swal.warning('กรุณาบันทึกงานที่ปฏิบัติอย่างน้อย 1 หัวข้อ'); return; }
    setSaving(true);
    try {
      const payload = {work_date:workDate, template_id:selected.id, position_title:original?.position_title ?? selected.position_title, items:clean};
      const result = original
        ? await supabase.from('personnel_daily_work_logs').update(payload).eq('id',original.id).eq('user_id',userId).select().single()
        : await supabase.from('personnel_daily_work_logs').insert(payload).select().single();
      if (result.error) throw result.error;
      await invalidate(); setWorkDate(null); void swal.success('บันทึกการปฏิบัติงานแล้ว');
    } catch(err) { void swal.error('บันทึกงานไม่สำเร็จ',err); } finally { setSaving(false); }
  };
  const removeDay = async () => {
    const log = rows.find(r => r.date === workDate)?.log;
    if (!log || !userId || !await swal.confirm({title:'ลบบันทึกวันนี้?',danger:true})) return;
    setSaving(true);
    try {
      const {error} = await supabase.from('personnel_daily_work_logs').delete().eq('id',log.id).eq('user_id',userId);
      if (error) throw error;
      await invalidate(); setWorkDate(null); void swal.success('ลบบันทึกแล้ว');
    } catch(err) { void swal.error('ลบบันทึกไม่สำเร็จ',err); } finally {setSaving(false);}
  };
  if (!allowed) return <p className="p-6 text-muted-foreground">สำหรับบุคลากรโรงเรียนเท่านั้น</p>;
  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-semibold"><ClipboardList className="h-5 w-5 text-primary"/>รายงานการปฏิบัติหน้าที่</h1><p className="mt-1 text-sm text-muted-foreground">{identity.data?.first_name} {identity.data?.last_name}</p></div>
      <Button variant="outline" disabled={!printReady || !selected} onClick={() => {
        if (!printReady || !selected || !identity.data) return;
        openPrintWindow(buildWorkReportHtml(rows,{name:`${identity.data.first_name} ${identity.data.last_name}`,position:selected.position_title,school:info.school_name,month}),{title:`รายงานการปฏิบัติงาน ${thaiWorkMonth(month)}`});
      }}><Printer className="mr-2 h-4 w-4"/>พิมพ์รายเดือน</Button></header>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 border border-destructive p-3 text-destructive">โหลดข้อมูลไม่สำเร็จ ไม่สามารถบันทึกหรือพิมพ์รายงานได้<Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>ลองใหม่</Button></div>}
    {!school.isLoading && !school.isReady && <div role="alert" className="flex flex-wrap items-center gap-3 border border-destructive p-3 text-destructive">โหลดชื่อโรงเรียนไม่สำเร็จ ยังพิมพ์รายงานไม่ได้<Button variant="outline" onClick={() => void school.refetch()}><RefreshCw className="mr-2 h-4 w-4"/>ลองใหม่</Button></div>}
    <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="daily">บันทึกรายวัน</TabsTrigger><TabsTrigger value="templates">ขอบเขตงานของฉัน</TabsTrigger></TabsList>
      <TabsContent value="templates" className="space-y-5 pt-3">
        <div className="flex flex-wrap gap-2">{templates.data?.map(t => <Button key={t.id} variant={editTemplateId===t.id?'default':'outline'} onClick={() => {setEditTemplateId(t.id);setTitle(t.title);setPosition(t.position_title);setScopes([...t.scopes]);}}><Pencil className="mr-2 h-4 w-4"/>{t.title}</Button>)}<Button variant="ghost" onClick={resetTemplate}><Plus className="mr-2 h-4 w-4"/>เทมเพลตใหม่</Button></div>
        <div className="max-w-3xl space-y-4"><h2 className="font-semibold">{editTemplateId?'แก้ไขขอบเขตงาน':'กำหนดขอบเขตงาน'}</h2><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="work-template-title">ชื่อเทมเพลต</Label><Input id="work-template-title" value={title} onChange={e=>setTitle(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="work-position">ตำแหน่ง</Label><Input id="work-position" value={position} onChange={e=>setPosition(e.target.value)}/></div></div>
        {scopes.map((scope,i)=><div key={i} className="flex items-start gap-2"><div className="flex-1 space-y-2"><Label htmlFor={`scope-${i}`}>ขอบเขตงาน {i+1}</Label><Textarea id={`scope-${i}`} value={scope} onChange={e=>setScopes(scopes.map((s,n)=>n===i?e.target.value:s))}/></div><Button aria-label={`ลบขอบเขตงาน ${i+1}`} title="ลบขอบเขตงาน" variant="ghost" size="icon" className="mt-7 shrink-0" disabled={scopes.length===1} onClick={()=>setScopes(scopes.filter((_,n)=>n!==i))}><Trash2 className="h-4 w-4"/></Button></div>)}
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setScopes([...scopes,''])}><Plus className="mr-2 h-4 w-4"/>เพิ่มขอบเขตงาน</Button><Button disabled={saving || !ready} onClick={saveTemplate}><Save className="mr-2 h-4 w-4"/>บันทึกเทมเพลต</Button></div></div>
      </TabsContent>
      <TabsContent value="daily" className="space-y-4 pt-3"><div className="flex flex-wrap items-end gap-4"><div className="space-y-2"><Label htmlFor="work-month">เดือนรายงาน</Label><Select value={month.slice(5)} onValueChange={value=>{setMonth(`${month.slice(0,4)}-${value}`);setWorkDate(null);}}><SelectTrigger id="work-month" className="w-44"><SelectValue/></SelectTrigger><SelectContent>{Array.from({length:12},(_,i)=>{const value=String(i+1).padStart(2,'0');return <SelectItem key={value} value={value}>{new Intl.DateTimeFormat('th-TH',{month:'long',timeZone:'Asia/Bangkok'}).format(new Date(`2000-${value}-01T00:00:00+07:00`))}</SelectItem>;})}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="work-year">ปี พ.ศ.</Label><Input id="work-year" type="number" className="w-28" min={544} max={10542} value={Number(month.slice(0,4))+543} onChange={e=>{const year=Number(e.target.value)-543;if(Number.isInteger(year)&&year>=1&&year<=9999){setMonth(`${String(year).padStart(4,'0')}-${month.slice(5)}`);setWorkDate(null);}}}/></div><div className="min-w-0 w-72 space-y-2"><Label>ขอบเขตงาน</Label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue placeholder="เลือกเทมเพลต"/></SelectTrigger><SelectContent>{templates.data?.map(t=><SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></div></div>
      {loading ? <p role="status" className="py-8 text-muted-foreground">กำลังโหลดรายงานและปฏิทิน…</p> : !error && !templates.data?.length ? <div className="border-y py-8"><h2 className="mb-3 font-medium">ยังไม่ได้กำหนดขอบเขตงาน</h2><Button onClick={()=>setTab('templates')}><Plus className="mr-2 h-4 w-4"/>กำหนดขอบเขตงานก่อน</Button></div> : ready && <><div className="flex flex-wrap gap-5 text-sm text-muted-foreground"><span>{thaiWorkMonth(month)}</span><span>บันทึกแล้ว {rows.filter(r=>r.log).length} วัน</span><span>วันทำงาน {rows.filter(r=>r.kind==='work').length} วัน</span></div><Table><TableHeader><TableRow><TableHead className="w-32">วันเดือนปี</TableHead><TableHead>รายการปฏิบัติงาน</TableHead><TableHead className="w-24 text-right">บันทึก</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.date} className={row.kind!=='work'?'bg-muted':''}><TableCell className="whitespace-nowrap align-top">{thaiWorkDate(row.date)}</TableCell><TableCell className="max-w-xl whitespace-pre-wrap break-words">{row.kind!=='work'?<span className="font-medium">{row.label}</span>:row.log?row.log.items.map((item,i)=><div key={i} className="mb-3"><p className="font-bold">{i+1}. {item.detail}</p><span className="font-normal">- {item.scope}</span></div>):<span className="text-muted-foreground">{row.date>today?'—':'ยังไม่ได้บันทึก'}</span>}</TableCell><TableCell className="text-right align-top">{row.kind==='work' && row.date<=today && <Button size="icon" variant="ghost" title={row.log?'แก้ไขบันทึก':'บันทึกงาน'} aria-label={`${row.log?'แก้ไข':'บันทึก'} ${row.date}`} onClick={()=>openDay(row.date)}>{row.log?<Pencil className="h-4 w-4"/>:<Plus className="h-4 w-4"/>}</Button>}</TableCell></TableRow>)}</TableBody></Table></>}
      </TabsContent>
    </Tabs>
    <Dialog open={!!workDate} onOpenChange={open=>{if(!open&&!saving)setWorkDate(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>บันทึกงาน {workDate?thaiWorkDate(workDate):''}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{selected?.title}</p>{items.map((item,i)=><div key={i} className="space-y-2"><Textarea id={`work-item-${i}`} className="font-bold" value={item.detail} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,detail:e.target.value}:v))}/><Label htmlFor={`work-item-${i}`} className="font-normal">{i+1}. {item.scope}</Label></div>)}<div className="flex justify-between gap-3">{rows.find(r=>r.date===workDate)?.log?<Button variant="outline" disabled={saving} onClick={removeDay}><Trash2 className="mr-2 h-4 w-4"/>ลบบันทึก</Button>:<span/>}<Button disabled={saving||!ready} onClick={saveDay}><Save className="mr-2 h-4 w-4"/>{saving?'กำลังบันทึก…':'บันทึกงาน'}</Button></div></DialogContent></Dialog>
  </div>;
}