"""Compile a privacy-cleared PP5 template without reserializing Excel drawing/layout parts."""
import sys,json,re,zipfile,copy,base64,mimetypes,posixpath
from pathlib import Path
import openpyxl
from openpyxl.utils import get_column_letter,range_boundaries
from lxml import etree as E
source=Path(sys.argv[1]); w=openpyxl.load_workbook(source); ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}; N='{'+ns['s']+'}'
clear={}
for s in w:
 refs=set()
 if s.title=='Home':refs|={f'{col}{r}' for col in ['C','F'] for r in [3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19]}
 if s.title=='นักเรียน':refs|={f'{get_column_letter(c)}{r}' for r in range(6,56) for c in list(range(3,12))+[14]}
 start={'คะแนน00':6,'คะแนน1':8,'คะแนนตัวชี้วัด':7,'คุณลักษณะ':6,'คิดวิเคราะห์':7,'สมรรถนะ':6,'เวลาเรียน_ป':7,'เวลาเรียน_ม':7,'สรุปตัดสินผลการเรียน':8}.get(s.title)
 if start:
  refs|={c.coordinate for row in s.iter_rows(min_row=start,max_row=start+49) for c in row if c.data_type!='f' and c.column>=6 and not c.protection.locked}
 if s.title.startswith('เวลาเรียน_'):refs|={c.coordinate for row in s.iter_rows(min_row=3,max_row=5,min_col=7) for c in row if c.data_type!='f' and not c.protection.locked}
 if s.title=='ตัวชีวัด':refs|={c.coordinate for row in s.iter_rows(min_row=18,max_row=61,min_col=4,max_col=18) for c in row if c.data_type!='f'}
 clear[s.title]=refs
 for ref in refs:
  if not isinstance(w[s.title][ref],openpyxl.cell.cell.MergedCell) and w[s.title][ref].data_type!='f':w[s.title][ref].value=None
styles=[]
for st in w._cell_styles:
 f=w._fonts[st.fontId];a=w._alignments[st.alignmentId];b=w._borders[st.borderId]
 styles.append({'font':f.name or 'EucrosiaUPC','size':f.sz or 14,'bold':bool(f.b),'italic':bool(f.i),'align':a.horizontal or 'general','vertical':a.vertical or 'bottom','wrap':bool(a.wrap_text),'shrink':bool(a.shrinkToFit),'numberFormat':openpyxl.styles.numbers.BUILTIN_FORMATS.get(st.numFmtId,w._number_formats[st.numFmtId-164] if st.numFmtId>=164 and st.numFmtId-164<len(w._number_formats) else 'General'),'rotation':a.text_rotation or 0,'border':{k:getattr(b,k).style for k in ['left','right','top','bottom']},'locked':w._protections[st.protectionId].locked})
sheets=[]
for i,s in enumerate(w):
 area=str(s.print_area);match=re.search(r'\$(\w+)\$(\d+):\$(\w+)\$(\d+)',area)
 bounds=list(range_boundaries(match.group(1)+match.group(2)+':'+match.group(3)+match.group(4))) if match else [1,1,min(s.max_column,30),min(s.max_row,90)]
 cells={c.coordinate:{'v':c.value if c.data_type!='f' else None,'f':str(c.value)[1:] if c.data_type=='f' else None,'s':c.style_id} for row in s.iter_rows(max_row=min(s.max_row,100)) for c in row if c.value is not None or c.has_style}
 widths={str(c):s.sheet_format.defaultColWidth or 8.43 for c in range(1,max(bounds[2],s.max_column)+1)}
 for k,d in s.column_dimensions.items():
  for c in range(d.min or openpyxl.utils.column_index_from_string(k), (d.max or openpyxl.utils.column_index_from_string(k))+1):widths[str(c)]=0 if d.hidden else d.width
 sheets.append({'name':s.title,'file':f'xl/worksheets/sheet{i+1}.xml','bounds':bounds,'cells':cells,'widths':widths,'heights':{str(r):0 if s.row_dimensions[r].hidden else (s.row_dimensions[r].height or s.sheet_format.defaultRowHeight or 15) for r in range(1,101)},'merges':[str(m) for m in s.merged_cells if m.min_row<=100],'breaks':[b.id for b in s.col_breaks.brk],'rowBreaks':[b.id for b in s.row_breaks.brk],'repeat':s.print_title_cols,'orientation':s.page_setup.orientation or 'portrait','scale':s.page_setup.scale or 100,'margins':{k:getattr(s.page_margins,k) for k in ['left','right','top','bottom']},'printable':bool(area),'hidden':s.sheet_state!='visible'})
media={}
with zipfile.ZipFile(source) as z:
 for i,s in enumerate(w):
  meta=sheets[i];meta.update({'repeatRows':s.print_title_rows,'paperSize':s.page_setup.paperSize or '9','pageOrder':s.page_setup.pageOrder or 'downThenOver','fitToPage':bool(s.sheet_properties.pageSetUpPr and s.sheet_properties.pageSetUpPr.fitToPage),'fitWidth':s.page_setup.fitToWidth,'fitHeight':s.page_setup.fitToHeight,'centerHorizontal':bool(s.print_options.horizontalCentered),'centerVertical':bool(s.print_options.verticalCentered),'drawings':[]})
  path=f'xl/worksheets/sheet{i+1}.xml';root=E.fromstring(z.read(path));drawing=root.find('s:drawing',ns)
  if drawing is None:continue
  relns={'r':'http://schemas.openxmlformats.org/package/2006/relationships'}
  rel=E.fromstring(z.read(f'xl/worksheets/_rels/sheet{i+1}.xml.rels'));rid=drawing.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
  target=next(e.get('Target') for e in rel if e.get('Id')==rid);dp=posixpath.normpath(posixpath.join('xl/worksheets',target))
  dr=E.fromstring(z.read(dp));rels=E.fromstring(z.read(posixpath.join(posixpath.dirname(dp),'_rels',posixpath.basename(dp)+'.rels')))
  targets={e.get('Id'):posixpath.normpath(posixpath.join(posixpath.dirname(dp),e.get('Target'))) for e in rels if e.get('TargetMode')!='External'}
  dns={'x':'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
  for anchor in dr:
   cd=anchor.find('x:clientData',dns)
   if cd is not None and cd.get('fPrintsWithSheet') in ['0','false']:continue
   pic=anchor.find('x:pic',dns);fr=anchor.find('x:from',dns);to=anchor.find('x:to',dns)
   if pic is None or fr is None:continue
   blip=pic.find('.//a:blip',dns)
   if blip is None:continue
   key=targets.get(blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'))
   if not key or not key.endswith(('.png','.jpg','.jpeg','.gif')):continue
   if key not in media:media[key]='data:'+str(mimetypes.guess_type(key)[0])+';base64,'+base64.b64encode(z.read(key)).decode()
   point=lambda e:{k:int(e.find('x:'+k,dns).text) for k in ['col','colOff','row','rowOff']}
   extent=pic.find('.//a:xfrm/a:ext',dns)
   meta['drawings'].append({'media':key,'from':point(fr),'to':point(to) if to is not None else None,'width':int(extent.get('cx'))/9525 if extent is not None else 0,'height':int(extent.get('cy'))/9525 if extent is not None else 0})
Path('public/templates/pp5-layout.json').write_text(json.dumps({'sheets':sheets,'styles':styles,'media':media,'names':{n:d.attr_text for n,d in w.defined_names.items() if not d.attr_text.startswith('[')}},ensure_ascii=False,separators=(',',':')))
with zipfile.ZipFile(source) as z,zipfile.ZipFile('public/templates/pp5-template.xlsx','w',zipfile.ZIP_DEFLATED) as out:
 strings=E.fromstring(z.read('xl/sharedStrings.xml'));used=set();roots={}
 for i,s in enumerate(w):
  path=f'xl/worksheets/sheet{i+1}.xml';root=E.fromstring(z.read(path))
  for c in root.findall('.//s:c',ns):
   ref=c.get('r');f=c.find('s:f',ns)
   if f is not None or ref in clear[s.title]:
    for tag in ['v','is']:
     child=c.find('s:'+tag,ns)
     if child is not None:c.remove(child)
    c.attrib.pop('t',None)
   elif c.get('t')=='s':used.add(int(c.find('s:v',ns).text))
  roots[path]=root
 mapping={old:new for new,old in enumerate(sorted(used))};newstrings=E.Element(N+'sst',nsmap=strings.nsmap,count=str(len(used)),uniqueCount=str(len(used)))
 for old in sorted(used):newstrings.append(copy.deepcopy(strings[old]))
 for root in roots.values():
  for c in root.findall('.//s:c[@t="s"]',ns):c.find('s:v',ns).text=str(mapping[int(c.find('s:v',ns).text)])
 for entry in z.infolist():
  data=z.read(entry.filename)
  if entry.filename in roots:data=E.tostring(roots[entry.filename],xml_declaration=True,encoding='UTF-8',standalone=True)
  elif entry.filename=='xl/sharedStrings.xml':data=E.tostring(newstrings,xml_declaration=True,encoding='UTF-8',standalone=True)
  elif entry.filename.startswith('xl/charts/') and entry.filename.endswith('.xml'):
   root=E.fromstring(data)
   for e in root.xpath('//*[local-name()="numCache" or local-name()="strCache"]'):e.getparent().remove(e)
   data=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
  elif entry.filename=='xl/workbook.xml':
   root=E.fromstring(data);calc=root.find('s:calcPr',ns)
   if calc is not None:calc.set('fullCalcOnLoad','1');calc.set('forceFullCalc','1');calc.set('calcMode','auto')
   data=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
  elif entry.filename=='docProps/core.xml':
   root=E.fromstring(data)
   for e in root:
    if E.QName(e).localname in ['creator','lastModifiedBy']:e.text=''
   data=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
  out.writestr(entry,data)
print('Compiled',len(sheets),'sheets',len(styles),'styles; personal cells and formula/chart caches cleared')
