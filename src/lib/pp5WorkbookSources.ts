import { utils } from 'xlsx';
import { WorkbookCells,workbookKey } from './pp5Workbook';
/** Bind only recorded lesson evidence and explicit summary assessments. Never spread totals into sub-items. */
export function bindPp5Evidence(students:any[],subject:any,attendance:any[],criteria:any[],assessments:any[],indicators:any[]):WorkbookCells{
 const values:WorkbookCells={};const put=(s:string,r:string,v:any)=>{values[workbookKey(s,r)]=v??'';};
 const dates:string[]=[...new Set<string>((subject.pp5_period_dates??[]).filter(Boolean))].sort();
 const statuses:Record<string,string>={present:' /',late:' /',absent:'ข',leave:'ล',sick:'ป'};
 for(const sheet of ['เวลาเรียน_ม','เวลาเรียน_ป']){
  const max=sheet==='เวลาเรียน_ม'?161:329;if(dates.length>max)throw new Error('จำนวนคาบเกินแม่แบบ ไม่สามารถตัดคาบที่เกินทิ้ง');
  dates.forEach((date,j)=>{put(sheet,utils.encode_cell({r:5,c:j+6}),Number(date.slice(-2)));students.forEach((student,i)=>{const rows=attendance.filter(a=>a.student_id===student.id&&a.attendance_date===date);const status=new Set(rows.map(a=>a.status));if(status.size>1)throw new Error(`คาบของ ${student.student_code} วันที่ ${date} มีหลายสถานะ ต้องตรวจข้อมูลก่อน`);put(sheet,utils.encode_cell({r:i+6,c:j+6}),rows[0]?statuses[rows[0].status]??'':'');});});
 }
 indicators.forEach((ind,i)=>{if(i>=44)throw new Error('ตัวชี้วัดเกินแม่แบบ');put('ตัวชีวัด',`D${i+18}`,ind.title);put('ตัวชีวัด',`E${i+18}`,ind.description);});
 const summaries:[string,string,string,number][]=[['desirable','คุณลักษณะ','AD',6],['reading_writing','คิดวิเคราะห์','AB',7],['competency','สมรรถนะ','X',6]];
 const text:Record<string,string>={excellent:'ดีเยี่ยม',good:'ดี',moderate:'ผ่าน',needs_improvement:'ไม่ผ่าน'};
 const numeric:Record<string,number>={excellent:3,good:2,moderate:1,needs_improvement:0};
 for(const [category,sheet,col,start] of summaries){const summary=criteria.find(c=>c.category===category&&c.title?.includes('(สรุปจาก ปพ.5)'));if(!summary)continue;
  students.forEach((student,i)=>{const result=assessments.find(a=>a.student_id===student.id&&a.criteria_id===summary.id);if(!result?.level)return;put(sheet,`${col}${i+start}`,text[result.level]);const levelCol=sheet==='คุณลักษณะ'?'AE':sheet==='คิดวิเคราะห์'?'AC':'Y';put(sheet,`${levelCol}${i+start}`,numeric[result.level]);});
 }
 return values;
}
