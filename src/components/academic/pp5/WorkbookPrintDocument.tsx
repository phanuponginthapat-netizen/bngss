import { WorkbookGrid } from './WorkbookGrid';
import { WorkbookTemplate, sheetGeometry } from '@/lib/pp5Workbook';
import { buildPp5PrintPages } from '@/lib/pp5PrintLayout';

export function WorkbookPrintDocument({template,names,read}:{template:WorkbookTemplate;names:string[];read:(sheet:string,ref:string)=>any}){
 return <>{names.map(name=>{
  const sheet=template.sheets.find(s=>s.name===name);if(!sheet)throw new Error(`แม่แบบขาดชีต ${name}`);
  return buildPp5PrintPages(sheet).map((page,index)=>{
   let y=0;
   return <section key={`${name}-${index}`} data-sheet={name} data-page={index+1} className={`pp5-paper ${page.orientation==='landscape'?'landscape':'portrait'}`} style={{width:page.width,height:page.height}}>
    <div className="pp5-page-content" style={{position:'absolute',left:page.left,top:page.top,width:page.contentWidth,height:page.contentHeight,transform:`scale(${page.scale})`,transformOrigin:'top left'}}>
     {page.rows.flatMap(row=>{let x=0;const top=y;const height=sheetGeometry(sheet,[1,row.start,1,row.end]).height;y+=height;
      return page.columns.map(col=>{const left=x;const bounds=[col.start,row.start,col.end,row.end],g=sheetGeometry(sheet,bounds);x+=g.width;
       return <div key={`${row.start}-${col.start}`} className="pp5-print-tile" style={{position:'absolute',left,top,width:g.width,height:g.height,overflow:'hidden'}}><WorkbookGrid template={template} sheet={sheet} bounds={bounds} read={read} print/></div>;
      });
     })}
    </div>
   </section>;
  });
 })}</>;
}

/** Styles/fonts/images must finish loading before native print captures the document. */
export async function openWorkbookPrint(html:string,title:string,origin:string){
 const win=window.open('','_blank');if(!win)throw new Error('อนุญาตหน้าต่างพิมพ์ก่อน');
 win.document.title=title;
 const link=win.document.createElement('link');link.rel='stylesheet';link.href=`${origin}/templates/pp5-print.css`;
 const loaded=new Promise<void>((resolve,reject)=>{link.onload=()=>resolve();link.onerror=()=>reject(new Error('โหลดรูปแบบพิมพ์ไม่สำเร็จ'));});
 win.document.head.appendChild(link);win.document.body.innerHTML=html;
 try{
  await loaded;await win.document.fonts.ready;
  await Promise.all(Array.from(win.document.images).map(img=>img.decode()));
  for(const span of Array.from(win.document.querySelectorAll<HTMLElement>('[data-shrink]'))){const width=span.parentElement?.clientWidth;if(width&&span.scrollWidth>width)span.style.fontSize=`${parseFloat(win.getComputedStyle(span).fontSize)*width/span.scrollWidth}px`;}
  await new Promise<void>(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>resolve())));
  win.focus();win.print();
 }catch(error){win.close();throw error;}
}