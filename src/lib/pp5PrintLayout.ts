import { utils } from 'xlsx';
import { excelColumnPixels, sheetGeometry, TemplateSheet } from './pp5Workbook';

export interface PrintBand { start:number; end:number }
export interface Pp5PrintPage {
 columns:PrintBand[]; rows:PrintBand[]; bounds:number[];
 width:number; height:number; scale:number; left:number; top:number;
 contentWidth:number; contentHeight:number; orientation:string;
}
const PAPER:Record<string,[number,number]>={'9':[210,297],'1':[215.9,279.4],'5':[215.9,355.6],'8':[297,420]};
const px=(mm:number)=>mm*96/25.4;
function repeatRange(text:string|null|undefined):PrintBand|undefined {
 if(!text)return;
 const parts=text.replace(/\$/g,'').split(':');
 const index=(v:string)=>/^\d+$/.test(v)?Number(v):utils.decode_col(v)+1;
 return {start:index(parts[0]),end:index(parts[1]??parts[0])};
}
function partition(start:number,end:number,size:(n:number)=>number,stops:number[],capacity:number,title?:PrintBand):PrintBand[][] {
 const result:PrintBand[][]=[];let first=start;
 while(first<=end){
  const repeat=title&&first>title.end?title:undefined;
  let room=capacity-(repeat?Array.from({length:repeat.end-repeat.start+1},(_,i)=>size(repeat.start+i)).reduce((a,b)=>a+b,0):0);
  if(room<=0)throw new Error('หัวตารางซ้ำมีขนาดเกินพื้นที่กระดาษ');
  let last=first-1;
  for(let n=first;n<=end;n++){
   if(last>=first&&(stops.includes(n-1)||size(n)>room+0.01))break;
   if(size(n)>room+0.01&&last<first)throw new Error('เซลล์มีขนาดเกินหน้ากระดาษตามสเกลต้นฉบับ');
   room-=size(n);last=n;
  }
  if(last<first)throw new Error('แบ่งหน้าพิมพ์ไม่สำเร็จ');
  result.push([...(repeat?[repeat]:[]),{start:first,end:last}]);first=last+1;
 }
 return result;
}
/** Use stored scale, not a per-page shrink-to-width. Include automatic and manual breaks plus print titles. */
export function buildPp5PrintPages(sheet:TemplateSheet):Pp5PrintPage[]{
 const paper=PAPER[String(sheet.paperSize??'9')];if(!paper)throw new Error(`ยังไม่รองรับขนาดกระดาษ ${sheet.paperSize}`);
 const landscape=sheet.orientation==='landscape';const width=px(paper[landscape?1:0]),height=px(paper[landscape?0:1]);
 const left=(sheet.margins.left??0)*96,right=(sheet.margins.right??0)*96,top=(sheet.margins.top??0)*96,bottom=(sheet.margins.bottom??0)*96;
 const availableW=width-left-right,availableH=height-top-bottom;
 if(availableW<=0||availableH<=0)throw new Error('ระยะขอบไม่มีพื้นที่พิมพ์');
 const g=sheetGeometry(sheet);let scale=sheet.scale/100;
 if(sheet.fitToPage){scale=1;if(sheet.fitWidth)scale=Math.min(scale,availableW*sheet.fitWidth/g.width);if(sheet.fitHeight)scale=Math.min(scale,availableH*sheet.fitHeight/g.height);}
 const [c1,r1,c2,r2]=sheet.bounds;
 const col=(n:number)=>excelColumnPixels(sheet.widths[n]??8.43),row=(n:number)=>(sheet.heights[n]??15)*4/3;
 const cols=partition(c1,c2,col,sheet.fitToPage?[]:sheet.breaks,availableW/scale,repeatRange(sheet.repeat));
 const rows=partition(r1,r2,row,sheet.fitToPage?[]:sheet.rowBreaks,availableH/scale,repeatRange(sheet.repeatRows));
 const pages:Pp5PrintPage[]=[];
 const add=(columns:PrintBand[],rowBands:PrintBand[])=>{
  const sum=(bands:PrintBand[],size:(n:number)=>number)=>bands.reduce((s,b)=>s+Array.from({length:b.end-b.start+1},(_,i)=>size(b.start+i)).reduce((a,v)=>a+v,0),0);
  const contentWidth=sum(columns,col),contentHeight=sum(rowBands,row);
  const lastC=columns[columns.length-1],lastR=rowBands[rowBands.length-1];if(!lastC||!lastR)return;
  pages.push({columns,rows:rowBands,bounds:[lastC.start,lastR.start,lastC.end,lastR.end],width,height,scale,left:left+(sheet.centerHorizontal?(availableW-contentWidth*scale)/2:0),top:top+(sheet.centerVertical?(availableH-contentHeight*scale)/2:0),contentWidth,contentHeight,orientation:sheet.orientation});
 };
 if(sheet.pageOrder==='overThenDown')for(const r of rows)for(const c of cols)add(c,r);
 else for(const c of cols)for(const r of rows)add(c,r);
 return pages;
}