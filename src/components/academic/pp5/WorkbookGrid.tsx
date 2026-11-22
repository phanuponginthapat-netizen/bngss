import { CSSProperties } from 'react';
import { utils } from 'xlsx';
const { decode_cell,decode_range,encode_cell } = utils;
import { excelColumnPixels,sheetGeometry,TemplateSheet,WorkbookTemplate } from '@/lib/pp5Workbook';
export function WorkbookGrid({template,sheet,read,bounds=sheet.bounds,onSelect,selected,print=false}:{template:WorkbookTemplate;sheet:TemplateSheet;read:(s:string,r:string)=>any;bounds?:number[];onSelect?:(ref:string)=>void;selected?:string;print?:boolean}){
 const g=sheetGeometry(sheet,bounds);const [c1,r1,c2,r2]=bounds;const covered=new Set<string>();const merges=new Map<string,ReturnType<typeof decode_range>>();
 for(const text of sheet.merges){const m=decode_range(text);merges.set(encode_cell(m.s),m);for(let r=m.s.r;r<=m.e.r;r++)for(let c=m.s.c;c<=m.e.c;c++)if(r!==m.s.r||c!==m.s.c)covered.add(encode_cell({r,c}));}
 const nodes=[];
 for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const ref=encode_cell({r:r-1,c:c-1});if(covered.has(ref)||(sheet.widths[c]===0)||sheet.heights[r]===0)continue;const cell=sheet.cells[ref];const style=template.styles[cell?.s??0];if(!style)continue;const m=merges.get(ref);const endC=Math.min(c2,(m?.e.c??c-1)+1),endR=Math.min(r2,(m?.e.r??r-1)+1);const width=(g.x[endC]??g.width)+excelColumnPixels(sheet.widths[endC]??8.43)-g.x[c];const height=(g.y[endR]??g.height)+(sheet.heights[endR]??15)*4/3-g.y[r];const value=read(sheet.name,ref);const pos:CSSProperties={left:g.x[c],top:g.y[r],width,height,fontFamily:`'${style.font}', 'TH Sarabun New', serif`,fontSize:`${style.size}pt`,fontWeight:style.bold?700:400,fontStyle:style.italic?'italic':'normal',textAlign:style.align==='general'?(typeof value==='number'?'right':'left'):style.align as CSSProperties['textAlign'],alignItems:style.vertical==='top'?'flex-start':style.vertical==='center'?'center':'flex-end',whiteSpace:style.wrap?'pre-wrap':'pre',...Object.fromEntries(Object.entries(style.border).filter(([,s])=>s).map(([side,s])=>[`border${side[0].toUpperCase()+side.slice(1)}`,`${s==='double'?3:s==='medium'?2:1}px ${s==='double'?'double':s==='dashed'?'dashed':'solid'} var(--pp5-ink)`]))};
 const display=typeof value==='number'&&style.numberFormat&&style.numberFormat!=='General'?utils.format_cell({t:'n',v:value,z:style.numberFormat}):String(value??'');
 nodes.push(<div key={ref} role={print?undefined:'gridcell'} tabIndex={!print&&ref===selected?0:undefined} data-ref={ref} aria-selected={!print?selected===ref:undefined} onClick={()=>onSelect?.(ref)} className={`pp5-cell ${!print&&!style.locked&&!cell?.f?'pp5-cell-editable':''} ${!print&&selected===ref?'pp5-cell-selected':''}`} style={pos}><span data-shrink={style.shrink||undefined} style={style.rotation?{transform:`rotate(${-style.rotation}deg)`}:undefined}>{display}</span></div>);
 }
 const origin=sheetGeometry(sheet,[1,1,c2,r2]);
 for(const [i,d] of (sheet.drawings??[]).entries()){
  const src=template.media?.[d.media];if(!src)continue;
  const left=(origin.x[d.from.col+1]??0)+d.from.colOff/9525-(origin.x[c1]??0),top=(origin.y[d.from.row+1]??0)+d.from.rowOff/9525-(origin.y[r1]??0);
  const width=d.to?(origin.x[d.to.col+1]??0)+d.to.colOff/9525-((origin.x[d.from.col+1]??0)+d.from.colOff/9525):d.width;
  const height=d.to?(origin.y[d.to.row+1]??0)+d.to.rowOff/9525-((origin.y[d.from.row+1]??0)+d.from.rowOff/9525):d.height;
  if(left+width<=0||top+height<=0||left>=g.width||top>=g.height)continue;
  nodes.push(<img key={`drawing-${i}`} src={src} alt="" className="pp5-drawing" style={{position:'absolute',left,top,width,height,pointerEvents:'none'}}/>);
 }
 return <div role={print?undefined:'grid'} aria-label={print?undefined:`ชีต ${sheet.name}`} className={`pp5-sheet ${print?'pp5-print-sheet':''}`} style={{width:g.width,height:g.height}}>{nodes}</div>;
}
