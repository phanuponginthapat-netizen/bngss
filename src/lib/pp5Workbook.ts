import FormulaParser from 'fast-formula-parser';
import JSZip from 'jszip';
import { utils } from 'xlsx';
const { decode_cell, encode_cell, decode_range } = utils;
export type CellValue = string | number;
export type WorkbookCells = Record<string, CellValue>;
export interface TemplateCell { v: CellValue | null; f: string | null; s: number }
export interface TemplateStyle { font: string; size: number; bold: boolean; italic: boolean; align: string; vertical: string; wrap: boolean; shrink?:boolean; numberFormat?:string; rotation: number; border: Record<string,string|null>; locked: boolean }
export interface TemplateDrawing { media:string; from:{col:number;colOff:number;row:number;rowOff:number}; to?:{col:number;colOff:number;row:number;rowOff:number}|null; width:number; height:number }
export interface TemplateSheet { name: string; file: string; bounds: number[]; cells: Record<string,TemplateCell>; widths: Record<string,number>; heights: Record<string,number>; merges: string[]; breaks: number[]; rowBreaks: number[]; repeat: string | null; repeatRows?:string|null; paperSize?:string; pageOrder?:string; fitToPage?:boolean; fitWidth?:number|null; fitHeight?:number|null; centerHorizontal?:boolean; centerVertical?:boolean; drawings?:TemplateDrawing[]; orientation: string; scale: number; margins: Record<string,number>; printable: boolean; hidden: boolean }
export interface WorkbookTemplate { sheets: TemplateSheet[]; styles: TemplateStyle[]; media?:Record<string,string>; names: Record<string,string> }
export const workbookKey = (sheet: string, ref: string) => `${sheet}!${ref}`;
export const BOOKLET_SHEETS = ['ปก','นักเรียน','เกณฑ์','ตัวชีวัด','เวลาเรียน_ม','คะแนนตัวชี้วัด','คะแนน1','คุณลักษณะรายข้อ','คิดวิเคราะห์รายข้อ','สมรรถนะรายด้าน','สรุปตัดสินผลการเรียน','คำอธิบาย','บันทึกข้อความ','รายงาน1','แผนภูมิ'];
export function createWorkbookReader(template: WorkbookTemplate, values: WorkbookCells) {
 const cache = new Map<string, unknown>(); const active = new Set<string>(); const errors = new Map<string,string>();
 const read = (sheet: string, ref: string): any => {
  const key=workbookKey(sheet,ref);
  if (Object.prototype.hasOwnProperty.call(values,key) && values[key] !== '__PP5_FORMULA__') return values[key];
  if (cache.has(key)) return cache.get(key);
  const cell=template.sheets.find(s=>s.name===sheet)?.cells[ref];
  if (!cell?.f) return cell?.v ?? '';
  const point=decode_cell(ref);
  if(sheet.startsWith('เวลาเรียน_')&&point.r>=6&&point.r<56&&point.c>=(sheet==='เวลาเรียน_ป'?335:167)){const hasEvidence=Object.entries(values).some(([k,v])=>k.startsWith(sheet+'!')&&decode_cell(k.slice(sheet.length+1)).r===point.r&&[' /','ข','ล','ป'].includes(String(v)));if(!hasEvidence)return '';}
  if(sheet==='คะแนนตัวชี้วัด'&&point.r>=6&&point.r<56&&point.c>=263){const hasScore=Object.entries(values).some(([k,v])=>k.startsWith(sheet+'!')&&decode_cell(k.slice(sheet.length+1)).r===point.r&&typeof v==='number');if(!hasScore)return '';}
  if(sheet==='คะแนน1'&&/^A[QR](\d+)$/.test(ref)){const row=decode_cell(ref).r+1;if(row>=8&&row<=57){const entered=['F','G','H','I','J','K','L','M','N','O','P','Q','R','S','V','W','X','Y','AE','AF','AJ','AK','AN'].some(c=>{const v=values[workbookKey(sheet,`${c}${row}`)];return typeof v==='number';});if(!entered)return '';}}
  if (active.has(key)) throw new Error(`สูตรวนซ้ำ ${key}`);
  active.add(key);
  try { const p=decode_cell(ref); const result=makeParser().parse(cell.f,{sheet,row:p.r+1,col:p.c+1});
   if (result instanceof Error || (typeof result==='object' && result!==null && 'error' in result)) throw new Error(String(result));
   cache.set(key,result); return result;
  } catch (e) { const message=e instanceof Error?e.message:String(e); errors.set(key,message); cache.set(key,'#ตรวจสูตร'); return '#ตรวจสูตร'; }
  finally { active.delete(key); }
 };
 const makeParser=()=>new FormulaParser({
  functions:{COUNTA:(...args:any[])=>args.flatMap(a=>Array.isArray(a?.value)?a.value.flat(Infinity):[a?.value??a]).filter(v=>v!==''&&v!==null&&v!==undefined).length},
  onCell: ({sheet,row,col}:any)=>read(sheet,encode_cell({r:row-1,c:col-1})),
  onRange: ({sheet,from,to}:any)=>Array.from({length:Math.min(100,to.row)-from.row+1},(_,i)=>Array.from({length:Math.min(350,to.col)-from.col+1},(_,j)=>read(sheet,encode_cell({r:from.row+i-1,c:from.col+j-1})))),
  onVariable: (name:string)=>{ const target=Object.entries(template.names).find(([n])=>n.toLowerCase()===name.toLowerCase())?.[1]; if (!target) throw new Error(`ไม่พบชื่อช่วง ${name}`); const split=target.lastIndexOf('!'); const sheet=target.slice(0,split).replace(/^'|'$/g,''); const range=decode_range(target.slice(split+1).replace(/\$/g,''));return {sheet,from:{row:range.s.r+1,col:range.s.c+1},to:{row:range.e.r+1,col:range.e.c+1}}; }
 } as any);
 return {read,errors};
}
export function validateWorkbookTerm(year: number,semester: number) { if(!Number.isInteger(year)||year<2000||year>2400||![1,2,3].includes(semester)) throw new Error('ต้องเลือกปีและภาคเรียนให้ครบ'); }
export function bindWorkbookSources(input: {students:any[];subject:any;classroom:any;teacher:string;cms:Record<string,string>;year:number;semester:number;columns:any[];scores:any[];totals:any[]}) {
 validateWorkbookTerm(input.year,input.semester); if(input.students.length>50) throw new Error('แม่แบบรองรับ 50 คนต่อเล่ม กรุณาแยกกลุ่มก่อน');
 const {students,subject,classroom,teacher,cms,year,semester,columns,scores,totals}=input; const values:WorkbookCells={};
 const put=(sheet:string,ref:string,v:any)=>{values[workbookKey(sheet,ref)]=v??'';};
 const homes:Record<string,any>={C3:(cms.school_name||'').replace(/^โรงเรียน/,''),C4:cms.school_affiliation,C5:cms.school_subdistrict,C6:cms.school_district,C7:cms.school_province,F3:classroom.grade_level?.startsWith('ป.')?'ประถมศึกษา':'มัธยมศึกษาตอนต้น',F4:semester,F5:year+543,C9:classroom.grade_level,C10:subject.subject_group,C11:subject.name_th,C12:subject.code,F11:subject.hours_per_week,F12:'ชั่วโมง/สัปดาห์',C14:classroom.homeroom_teacher,C15:teacher,C19:cms.director_name,F19:cms.director_title};
 Object.entries(homes).forEach(([ref,v])=>put('Home',ref,v));
 for(let i=0;i<50;i++){const s=students[i];put('นักเรียน',`C${i+6}`,s?.student_code);put('นักเรียน',`D${i+6}`,'');put('นักเรียน',`E${i+6}`,s?`${s.prefix||''}${s.first_name} ${s.last_name}`:'');}
 // Each source column maps once. Never distribute one aggregate into invented sub-scores.
 const mappings:[any[],number[],number][]=[
  [columns.filter(c=>c.column_type==='assignment'),Array.from({length:14},(_,i)=>i+5),30],
  [[],[21,22,23,24],0],
  [columns.filter(c=>c.column_type==='midterm'),[30,31],10],
  [columns.filter(c=>c.column_type==='final'),[35,36],20]
 ];
 for(const [cols,positions] of mappings){if(cols.length>positions.length) throw new Error('จำนวนช่องคะแนนเกินแม่แบบ ต้องปรับโครงสร้างก่อน ไม่ตัดคะแนนทิ้ง');
  for(let j=0;j<positions.length;j++){const col=cols[j];const ref=encode_cell({r:5,c:positions[j]});put('คะแนน1',ref,col?.column_name);put('คะแนน1',encode_cell({r:6,c:positions[j]}),col?.max_score);
   students.forEach((s,i)=>{const score=col?scores.find(x=>x.student_id===s.id&&x.column_id===col.id):undefined;put('คะแนน1',encode_cell({r:i+7,c:positions[j]}),score?.status==='pending'?'':score?.score);});
  }
 }
 put('เกณฑ์','J4',Number(subject.weight_assignment??70));put('เกณฑ์','M4',0);put('เกณฑ์','O4',0);put('เกณฑ์','F5',Number(subject.weight_midterm??10));put('เกณฑ์','F6',Number(subject.weight_final??20));put('เกณฑ์','N28','no');put('เกณฑ์','F7',0);put('เกณฑ์','N19',subject.subject_type==='activity'?'ACT':'');
 students.forEach((s,i)=>{const t=totals.find(t=>t.student_code===s.student_code);if(t){put('คะแนน1',`AQ${i+8}`,t.total_score??'');put('คะแนน1',`AR${i+8}`,t.grade??'');}});
 if(Number(subject.weight_attendance??0)>0)throw new Error('วิชานี้มีน้ำหนักจิตพิสัยที่แม่แบบไม่มีช่องตรงกัน ต้องตรวจโครงสร้างก่อน ไม่ตัดคะแนนทิ้ง');
 return values;
}
export async function exportWorkbook(template:WorkbookTemplate,values:WorkbookCells){
 const response=await fetch('/templates/pp5-template.xlsx');if(!response.ok)throw new Error('โหลดแม่แบบ Excel ไม่สำเร็จ');const zip=await JSZip.loadAsync(await response.arrayBuffer());
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 for(const sheet of template.sheets){const entries=Object.entries(values).filter(([key])=>key.startsWith(sheet.name+'!'));if(!entries.length)continue;const file=zip.file(sheet.file);if(!file)throw new Error('แม่แบบไม่ครบ');const doc=new DOMParser().parseFromString(await file.async('string'),'application/xml');const data=doc.getElementsByTagNameNS(ns,'sheetData')[0];if(!data)throw new Error('ไม่พบตาราง');
  for(const [key,value] of entries){if(value==='__PP5_FORMULA__')continue;const ref=key.slice(sheet.name.length+1),pos=decode_cell(ref);let row=Array.from(data.children).find(e=>e.getAttribute('r')===String(pos.r+1));if(!row){row=doc.createElementNS(ns,'row');row.setAttribute('r',String(pos.r+1));const next=Array.from(data.children).find(e=>Number(e.getAttribute('r'))>pos.r+1);data.insertBefore(row,next??null);}
   let cell=Array.from(row.children).find(e=>e.getAttribute('r')===ref);if(!cell){cell=doc.createElementNS(ns,'c');cell.setAttribute('r',ref);const next=Array.from(row.children).find(e=>decode_cell(e.getAttribute('r')||'A1').c>pos.c);row.insertBefore(cell,next??null);}
   while(cell.firstChild)cell.removeChild(cell.firstChild);cell.removeAttribute('t');
   if(typeof value==='number'){const v=doc.createElementNS(ns,'v');v.textContent=String(value);cell.appendChild(v);}else{cell.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.setAttribute('xml:space','preserve');t.textContent=value;is.appendChild(t);cell.appendChild(is);}
  }
  zip.file(sheet.file,new XMLSerializer().serializeToString(doc));
 }
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function excelColumnPixels(width:number){return width===0?0:Math.floor(((256*width+Math.floor(128/7))/256)*7);}
export function sheetGeometry(sheet:TemplateSheet,bounds=sheet.bounds){const [c1,r1,c2,r2]=bounds;const x:Record<number,number>={},y:Record<number,number>={};let width=0,height=0;for(let c=c1;c<=c2;c++){x[c]=width;width+=excelColumnPixels(sheet.widths[c]??8.43);}for(let r=r1;r<=r2;r++){y[r]=height;height+=(sheet.heights[r]??15)*4/3;}return {x,y,width,height};}
export function workbookPrintSlices(sheet:TemplateSheet){const [c1,r1,c2,r2]=sheet.bounds;const stops=[...sheet.breaks.filter(c=>c>=c1&&c<c2),c2];let from=c1;return stops.map(stop=>{const result=[from,r1,stop,r2];from=stop+1;return result;});}
