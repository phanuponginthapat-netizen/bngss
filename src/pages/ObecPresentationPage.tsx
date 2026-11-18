import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, ExternalLink, FileDown, LayoutGrid, Maximize, MessageSquareText, Minimize, PanelLeftClose, PanelLeftOpen, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { obecDeck } from '@/components/presentation/obecDeck';
import ScaledSlide from '@/components/presentation/ScaledSlide';
import ObecSlide from '@/components/presentation/ObecSlide';
import logo from '@/assets/obec/school-logo.png.asset.json';

export default function ObecPresentationPage() {
  const [params,setParams] = useSearchParams();
  const requested = Number(params.get('slide') || 1);
  const index = Number.isFinite(requested) ? Math.min(obecDeck.length-1, Math.max(0,Math.floor(requested)-1)) : 0;
  const slide = obecDeck[index];
  const print = params.has('print');
  const [grid,setGrid] = useState(false);
  const [notes,setNotes] = useState(false);
  const [sidebar,setSidebar] = useState(true);
  const [present,setPresent] = useState(false);
  const [editedNotes,setEditedNotes] = useState<Record<string,string>>(() => { try{return JSON.parse(localStorage.getItem('obec-presenter-notes-v1') || '{}');}catch{return {};} });
  const touchStart = useRef<number|null>(null);
  const channel = useRef<BroadcastChannel|null>(null);
  const navigate = useCallback((next:number) => {
    const value = Math.max(0, Math.min(obecDeck.length-1,next));
    setParams({slide:String(value+1)},{replace:true});
    channel.current?.postMessage({slide:value+1});
  },[setParams]);
  useEffect(() => { const bc=new BroadcastChannel('obec-presentation');channel.current=bc;bc.onmessage=(e)=>{if(Number.isInteger(e.data?.slide)&&e.data.slide>=1&&e.data.slide<=obecDeck.length)setParams({slide:String(e.data.slide)},{replace:true});};return()=>{bc.close();channel.current=null;}; },[setParams]);
  useEffect(() => { const changed=()=>setPresent(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed); },[]);
  useEffect(() => {
    const listener=(e:KeyboardEvent)=>{if(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)return;if(['ArrowRight',' ','PageDown'].includes(e.key)){e.preventDefault();navigate(index+1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();navigate(index-1);}if(e.key==='Escape'){setGrid(false);setPresent(false);}if(e.key.toLowerCase()==='g')setGrid(v=>!v);};
    window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
  },[index,navigate]);
  useEffect(() => { if(!print)return;const start=async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.decode().catch(()=>undefined)));window.print();};const timer=window.setTimeout(start,600);return()=>window.clearTimeout(timer); },[print]);
  const enterPresent=async()=>{setGrid(false);setPresent(true);try{await document.documentElement.requestFullscreen();}catch{/* Full-window mode remains available when browser fullscreen is unavailable. */}};
  const exitPresent=async()=>{setPresent(false);if(document.fullscreenElement)await document.exitFullscreen();};
  const title=`${index+1}/${obecDeck.length} — ${slide.title.replace(/\n/g,' ')} | OBEC Channel`;
  const metadata=<Helmet><title>{title}</title><meta name="description" content="นำเสนอ BNG Smart School โรงเรียนบ้านหนองเงือก สำหรับ OBEC Channel: การบ้าน ใบงาน การมาเรียน ตาราง คะแนน และงานครู พร้อมภาพระบบจริง" /><meta property="og:title" content="BNG Smart School — OBEC Channel" /><meta property="og:description" content="ระบบโรงเรียนอัจฉริยะ โรงเรียนบ้านหนองเงือก จากงานห้องเรียนถึงการดูแลนักเรียน" /><meta property="og:type" content="website" /><meta name="twitter:card" content="summary_large_image" /></Helmet>;
  if(print)return <div className="obec-print">{metadata}{obecDeck.map((s,i)=><ObecSlide key={s.id} slide={s} index={i} total={obecDeck.length} />)}</div>;
  return <div className={`obec-app ${present?'obec-presenting':''}`}>{metadata}
    {!present && <header className="obec-toolbar"><div className="obec-toolbar-brand"><img src={logo.url} alt="ตราโรงเรียน" /><div><strong>BNG Smart School</strong><span>OBEC Channel · Presentation</span></div></div><div className="obec-toolbar-actions"><Button variant="ghost" size="icon" title="แสดง/ซ่อนรายการสไลด์" aria-label="แสดง/ซ่อนรายการสไลด์" onClick={()=>setSidebar(v=>!v)}>{sidebar?<PanelLeftClose/>:<PanelLeftOpen/>}</Button><Button variant={grid?'secondary':'ghost'} size="icon" title="ดูสไลด์ทั้งหมด" aria-label="ดูสไลด์ทั้งหมด" onClick={()=>setGrid(v=>!v)}><LayoutGrid/></Button><Button variant={notes?'secondary':'ghost'} size="icon" title="คำบรรยายผู้พูด" aria-label="คำบรรยายผู้พูด" onClick={()=>setNotes(v=>!v)}><MessageSquareText/></Button><Button variant="outline" title="ส่งออก PDF" onClick={()=>window.open('/obec-presentation?print','_blank','noopener')}><FileDown/><span className="obec-action-label">PDF</span></Button><Button onClick={enterPresent}><Play/><span>นำเสนอ</span></Button></div></header>}
    <div className="obec-editor">
      {sidebar && !present && <aside className="obec-sidebar"><div className="obec-sidebar-heading"><span>เนื้อหานำเสนอ</span><span>{obecDeck.length} สไลด์</span></div>{obecDeck.map((s,i)=><Button key={s.id} variant="ghost" className={`obec-thumb-button ${index===i?'is-active':''}`} aria-label={`ไปสไลด์ ${i+1} ${s.title.replace(/\n/g,' ')}`} aria-current={index===i?'step':undefined} onClick={()=>{navigate(i);setGrid(false);}}><span className="obec-thumb-number">{String(i+1).padStart(2,'0')}</span><div className="obec-thumb-wrap"><ScaledSlide><ObecSlide slide={s} index={i} total={obecDeck.length}/></ScaledSlide><span>{s.title.replace(/\n/g,' ')}</span></div></Button>)}</aside>}
      <main className="obec-main">
        {!present && <div className="obec-canvas-heading"><span>{slide.section}</span><span>16:9 · ภาษาไทย</span></div>}
        {grid && !present ? <div className="obec-grid">{obecDeck.map((s,i)=><Button key={s.id} variant="ghost" className="obec-grid-button" onClick={()=>{navigate(i);setGrid(false);}}><div><ScaledSlide><ObecSlide slide={s} index={i} total={obecDeck.length}/></ScaledSlide></div><span>{i+1}. {s.title.replace(/\n/g,' ')}</span></Button>)}</div>
        : <div className="obec-canvas" onTouchStart={e=>{touchStart.current=e.touches[0]?.clientX??null;}} onTouchEnd={e=>{const start=touchStart.current;const end=e.changedTouches[0]?.clientX;if(start!==null&&end!==undefined&&Math.abs(end-start)>50)navigate(index+(end<start?1:-1));touchStart.current=null;}}><ScaledSlide><ObecSlide key={slide.id} slide={slide} index={index} total={obecDeck.length}/></ScaledSlide></div>}
        <nav className="obec-navigation" aria-label="เปลี่ยนสไลด์"><Button variant="ghost" size="icon" aria-label="สไลด์ก่อนหน้า" title="สไลด์ก่อนหน้า" disabled={index===0} onClick={()=>navigate(index-1)}><ArrowLeft/></Button><span>{String(index+1).padStart(2,'0')} <small>/ {obecDeck.length}</small></span><Button variant="ghost" size="icon" aria-label="สไลด์ถัดไป" title="สไลด์ถัดไป" disabled={index===obecDeck.length-1} onClick={()=>navigate(index+1)}><ArrowRight/></Button>{present?<Button variant="ghost" size="icon" aria-label="ออกจากนำเสนอ" title="ออกจากนำเสนอ" onClick={exitPresent}><Minimize/></Button>:<Button variant="ghost" size="icon" aria-label="เต็มจอ" title="เต็มจอ" onClick={enterPresent}><Maximize/></Button>}</nav>
        {notes && !present && <section className="obec-notes"><div><strong>คำบรรยายผู้พูด</strong><Button variant="ghost" size="icon" aria-label="ปิดคำบรรยาย" onClick={()=>setNotes(false)}><X/></Button></div><textarea aria-label="แก้ไขคำบรรยายผู้พูด" value={editedNotes[slide.id]??slide.notes} onChange={e=>{const next={...editedNotes,[slide.id]:e.target.value};setEditedNotes(next);try{localStorage.setItem('obec-presenter-notes-v1',JSON.stringify(next));}catch{/* Notes remain in this tab when local storage is unavailable. */}}}/><div className="obec-notes-bottom"><span>บันทึกคำบรรยายในเครื่องนี้</span>{slide.route&&<Button variant="link" asChild><a href={slide.route} target="_blank" rel="noopener noreferrer"><ExternalLink/>เปิดหน้าระบบจริง</a></Button>}</div></section>}
      </main>
    </div>
  </div>;
}