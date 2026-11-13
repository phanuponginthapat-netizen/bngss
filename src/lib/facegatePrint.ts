/** Print only the selected evidence/QR, never dashboard navigation or controls. */
export async function printFacegateElement(element: HTMLElement | null, title: string) {
  if (!element) return;
  const frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');
  frame.className='fixed h-0 w-0 border-0';
  document.body.appendChild(frame);
  const doc=frame.contentDocument,win=frame.contentWindow;
  if(!doc||!win){frame.remove();return;}
  doc.title=title;
  document.querySelectorAll('style,link[rel="stylesheet"]').forEach(n=>doc.head.appendChild(n.cloneNode(true)));
  const page=element.cloneNode(true) as HTMLElement;
  page.querySelectorAll('button,input,select,.print\\:hidden').forEach(n=>n.remove());
  doc.body.appendChild(page);
  await Promise.all(Array.from(doc.images).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();})));
  await doc.fonts.ready;
  win.addEventListener('afterprint',()=>frame.remove(),{once:true});
  win.focus();win.print();
}