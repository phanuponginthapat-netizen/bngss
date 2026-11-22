import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildPp5PrintPages} from '../pp5PrintLayout';
import {WorkbookTemplate} from '../pp5Workbook';
const template=JSON.parse(readFileSync('public/templates/pp5-layout.json','utf8')) as WorkbookTemplate;
describe('PP5 print pagination',()=>{
 it('retains the original 95 percent scale on every score page and repeats B:E',()=>{const s=template.sheets.find(s=>s.name==='คะแนน1');if(!s)throw Error('missing');const pages=buildPp5PrintPages(s);expect(pages).toHaveLength(6);expect(pages.every(p=>p.scale===0.95)).toBe(true);expect(pages[2].columns).toEqual([{start:2,end:5},{start:22,end:35}]);});
 it('retains the original 85 percent landscape Home page',()=>{const s=template.sheets[0];const pages=buildPp5PrintPages(s);expect(pages).toHaveLength(1);expect(pages[0].scale).toBe(0.85);expect(pages[0].width).toBeGreaterThan(pages[0].height);});
 it('covers every source cell exactly once outside repeated titles for all 27 sheets',()=>{expect(template.sheets).toHaveLength(27);for(const sheet of template.sheets){const pages=buildPp5PrintPages(sheet),area=pages.reduce((sum,p)=>sum+(p.bounds[2]-p.bounds[0]+1)*(p.bounds[3]-p.bounds[1]+1),0);expect(area).toBe((sheet.bounds[2]-sheet.bounds[0]+1)*(sheet.bounds[3]-sheet.bounds[1]+1));expect(pages.every(p=>p.left+p.contentWidth*p.scale<=p.width+0.01&&p.top+p.contentHeight*p.scale<=p.height+0.01)).toBe(true);}});
});
