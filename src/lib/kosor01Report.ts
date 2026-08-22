// นร./กสศ.01 — แบบบันทึกข้อมูลนักเรียนด้อยโอกาส (auto-generate from screening)
import { openPrintWindow } from "./printUtils";

export interface Kosor01Row {
  student_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  classroom: string;
  screening_type: string; // economic, health, protection, etc.
  risk_level: string; // low, medium, high
  notes: string;
  home_visit_date?: string;
  counselor_name?: string;
}

export function printKosor01(rows: Kosor01Row[], meta: { year: string; semester: string; schoolName: string }) {
  const headerRow = `<tr style="background:#eee; text-align:center"><th>ที่</th><th>รหัส นร.</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>ประเภท</th><th>ระดับความเสี่ยง</th><th>หมายเหตุ</th><th>วันที่เยี่ยมบ้าน</th></tr>`;
  
  const dataRows = rows.map((r, i) => 
    `<tr><td style="text-align:center">${i + 1}</td><td style="text-align:center">${r.student_code}</td><td>${r.prefix}${r.first_name} ${r.last_name}</td><td style="text-align:center">${r.classroom}</td><td>${r.screening_type}</td><td style="text-align:center; color:${r.risk_level === 'high' ? 'red' : r.risk_level === 'medium' ? 'orange' : 'green'}">${r.risk_level === 'high' ? 'สูง' : r.risk_level === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</td><td>${r.notes}</td><td>${r.home_visit_date || '-'}</td></tr>`
  ).join('');

  const html = `
  <div style="font-family:TH Sarabun New, sans-serif; padding:20pt; font-size:14pt">
    <div style="text-align:center; margin-bottom:12pt">
      <div style="font-size:16pt; font-weight:bold">แบบบันทึกข้อมูลนักเรียนด้อยโอกาส</div>
      <div>โรงเรียน ${meta.schoolName} ปีการศึกษา ${meta.year} ภาคเรียนที่ ${meta.semester}</div>
      <div style="font-size:10pt; color:#666">(นร./กสศ.01)</div>
    </div>
    <table border="1" cellpadding="4" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:11pt">
      ${headerRow}
      ${dataRows}
    </table>
    <div style="display:flex; justify-content:space-between; margin-top:30pt; text-align:center; font-size:12pt">
      <div>ผู้จัดทำ<br>...........................<br>(${meta.counselor_name || 'ครูที่ปรึกษา'})</div>
      <div>หัวหน้างานกิจการนักเรียน<br>...........................</div>
      <div>ผู้อำนวยการ<br>...........................</div>
    </div>
    <div style="text-align:center; margin-top:12pt; font-size:9pt; color:#666">พิมพ์จาก BNGSS — แบบฟอร์ม นร./กสศ.01 สพฐ.</div>
  </div>`;
  
  openPrintWindow(html, { title: `นร.กสศ.01 ${meta.year}/${meta.semester}` });
}
