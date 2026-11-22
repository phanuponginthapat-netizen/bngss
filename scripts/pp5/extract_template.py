"""Compile a privacy-cleared PP5 template without reserializing Excel drawing/layout parts."""
import sys,json,re,zipfile,copy
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
 styles.append({'font':f.name or 'EucrosiaUPC','size':f.sz or 14,'bold':bool(f.b),'italic':bool(f.i),'align':a.horizontal or 'general','vertical':a.vertical or 'bottom','wrap':bool(a.wrap_text),'rotation':a.text_rotation or 0,'border':{k:getattr(b,k).style for k in ['left','right','top','bottom']},'locked':w._protections[st.protectionId].locked})
sheets=[]
for i,s in enumerate(w):
 area=str(s.print_area);match=re.search(r'\$(\w+)\$(\d+):\$(\w+)\$(\d+)',area)
 bounds=list(range_boundaries(match.group(1)+match.group(2)+':'+match.group(3)+match.group(4))) if match else [1,1,min(s.max_column,30),min(s.max_row,90)]
 cells={c.coordinate:{'v':c.value if c.data_type!='f' else None,'f':str(c.value)[1:] if c.data_type=='f' else None,'s':c.style_id} for row in s.iter_rows(max_row=min(s.max_row,100)) for c in row if c.value is not None or c.has_style}
 widths={str(c):s.sheet_format.defaultColWidth or 8.43 for c in range(1,max(bounds[2],s.max_column)+1)}
 for k,d in s.column_dimensions.items():
  for c in range(d.min or openpyxl.utils.column_index_from_string(k), (d.max or openpyxl.utils.column_index_from_string(k))+1):widths[str(c)]=0 if d.hidden else d.width
 sheets.append({'name':s.title,'file':f'xl/worksheets/sheet{i+1}.xml','bounds':bounds,'cells':cells,'widths':widths,'heights':{str(r):0 if s.row_dimensions[r].hidden else (s.row_dimensions[r].height or s.sheet_format.defaultRowHeight or 15) for r in range(1,101)},'merges':[str(m) for m in s.merged_cells if m.min_row<=100],'breaks':[b.id for b in s.col_breaks.brk],'rowBreaks':[b.id for b in s.row_breaks.brk],'repeat':s.print_title_cols,'orientation':s.page_setup.orientation or 'portrait','scale':s.page_setup.scale or 100,'margins':{k:getattr(s.page_margins,k) for k in ['left','right','top','bottom']},'printable':bool(area),'hidden':s.sheet_state!='visible'})
Path('public/templates/pp5-layout.json').write_text(json.dumps({'sheets':sheets,'styles':styles,'names':{n:d.attr_text for n,d in w.defined_names.items() if not d.attr_text.startswith('[')}},ensure_ascii=False,separators=(',',':')))
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
