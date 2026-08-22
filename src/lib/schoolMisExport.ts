// Export แบบราชการ: SGS / SchoolMIS / ปพ.5 / ปพ.6
import * as XLSX from "xlsx";
import { openPrintWindow } from "./printUtils";
import { calculateGrade } from "./gradeUtils";

export interface GradeRow {
  schoolCode?: string;
  year?: string;
  term?: string;
  subjectCode: string;
  subjectName?: string;
  credit?: number;
  studentCode: string;
  studentName?: string;
  fullScore: number;
  score: number;
}

function getBranding(){ try{ const b=(window as any).__branding||JSON.parse(localStorage.getItem("cms_branding_cache")||"{}"); return { name:b.name||"โรงเรียนบ้านหนองเงือก", logo:b.logo||"", garuda:b.garuda||b.logo||"", director:b.directorName||"นายเกษม ใจกระเสน", directorTitle:b.directorTitle||"ผู้อำนวยการโรงเรียน", directorSig:b.directorSig||"", schoolSeal:b.schoolSeal||"", address:b.schoolAddress||"", phone:b.schoolPhone||"" }; }catch{ return {name:"โรงเรียนบ้านหนองเงือก",logo:"",garuda:"",director:"นายเกษม ใจกระเสน",directorTitle:"ผู้อำนวยการโรงเรียน",directorSig:"",schoolSeal:"",address:"",phone:""} } }
function brandingHeader(){ const b=getBranding(); const seal = b.schoolSeal? `<img src="${b.schoolSeal}" style="width:32pt; height:32pt; object-fit:contain; margin-left:6pt" onerror="this.style.display='none'">`:""; return `<div style="display:flex; align-items:center; gap:10pt; border-bottom:2px solid #000; padding-bottom:6pt; margin-bottom:8pt"><img src="${b.logo}" style="width:42pt; height:42pt; object-fit:contain; border-radius:4pt" onerror="this.style.display='none'"><div><div style="font-size:13pt; font-weight:bold">${b.name}</div><div style="font-size:8pt; color:#444">${b.address} ${b.phone?`โทร ${b.phone}`:""}</div></div><div style="margin-left:auto; display:flex; align-items:center; gap:6pt; text-align:right; font-size:8pt"><div>${b.directorTitle}<br><b>${b.director}</b></div>${seal}</div></div>`; }

// SchoolMIS Excel: 8 คอลัมน์ตามเทมเพลต สพฐ.
export function exportSchoolMisExcel(rows: GradeRow[], fileName = "schoolmis_grades.xlsx") {
  const b=getBranding();
  const header = ["รหัสโรงเรียน","ปีการศึกษา","ภาคเรียน","รหัสวิชา","ชื่อวิชา","หน่วยกิต","เลขประจำตัว","ชื่อ-สกุล","คะแนนเต็ม","คะแนนที่ได้","เกรด"];
  const title = [[b.name],[`โดย ${b.director} ${b.directorTitle}`],[]];
  const data = rows.map(r => {
    const g = calculateGrade(r.score, r.fullScore);
    return [r.schoolCode||"", r.year||"", r.term||"", r.subjectCode, r.subjectName||"", r.credit||"", r.studentCode, r.studentName||"", r.fullScore, r.score, g.grade];
  });
  const ws = XLSX.utils.aoa_to_sheet([...title, header, ...data]);
  ws["!cols"] = [{wch:12},{wch:10},{wch:8},{wch:10},{wch:18},{wch:8},{wch:12},{wch:18},{wch:10},{wch:10},{wch:6}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SchoolMIS");
  XLSX.writeFile(wb, fileName);
}

// ปพ.5 แบบราชการ — ตารางสรุปผลการเรียนรายวิชา
export function printPor5(rows: GradeRow[], meta: { schoolName: string; term: string; year: string; subjectCode: string; subjectName: string }) {
  const b=getBranding(); const school = meta.schoolName || b.name;
  const html = `
  <div style="font-family:TH Sarabun New, sans-serif; padding:20pt; font-size:14pt; line-height:1.4">
    ${brandingHeader()}
    <div style="text-align:center; border-bottom:3px double #000; padding-bottom:8pt; margin-bottom:12pt">
      <div style="font-size:18pt; font-weight:bold">แบบ ปพ.5 รายงานผลการเรียนรายวิชา</div>
      <div>${school} ภาคเรียนที่ ${meta.term} ปีการศึกษา ${meta.year}</div>
      <div>วิชา ${meta.subjectCode} ${meta.subjectName}</div>
    </div>
    <table border="1" cellpadding="4" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:12pt">
      <tr style="background:#eee; font-weight:bold; text-align:center"><td>ที่</td><td>เลขประจำตัว</td><td>ชื่อ-สกุล</td><td>คะแนนเต็ม</td><td>คะแนนที่ได้</td><td>เกรด</td><td>หมายเหตุ</td></tr>
      ${rows.map((r,i)=>{ const g=calculateGrade(r.score,r.fullScore); return `<tr><td style="text-align:center">${i+1}</td><td style="text-align:center">${r.studentCode}</td><td>${r.studentName||""}</td><td style="text-align:center">${r.fullScore}</td><td style="text-align:center">${r.score}</td><td style="text-align:center; font-weight:bold">${g.grade}</td><td>${g.grade==="0"||g.grade==="ร"?"แก้ตัว":""}</td></tr>`}).join("")}
    </table>
    <div style="display:flex; justify-content:space-between; margin-top:30pt; text-align:center">
      <div>ลงชื่อ...................................ครูผู้สอน<br><span style="font-size:10pt">(...................................)</span></div>
      <div>ลงชื่อ...................................หัวหน้าวิชาการ<br><span style="font-size:10pt">(...................................)</span></div>
      <div>${getBranding().directorSig?`<img src="${getBranding().directorSig}" style="height:32pt; object-fit:contain; margin-bottom:4pt"><br>`:""}ลงชื่อ...................................<br>${getBranding().director}<br><span style="font-size:10pt">(${getBranding().directorTitle})</span></div>
    </div>
    <div style="text-align:center; margin-top:12pt; font-size:9pt; color:#666">พิมพ์จาก BNGSS ${new Date().toLocaleDateString("th-TH")} — แบบฟอร์มราชการ สพฐ. | ${getBranding().name}</div>
  </div>`;
  openPrintWindow(html, { title: `ปพ.5 ${meta.subjectCode}` });
}

// Lunch: แบบรายงานอาหารกลางวัน สพฐ.
export function printLunchReport(data: { date: string; menu: string; students: number; budgetPerHead: number; source: string }[]) {
  const b=getBranding();
  const sig = b.directorSig? `<img src="${b.directorSig}" style="height:28pt; display:block; margin:0 auto 4pt" onerror="this.style.display='none'"><br>`:"";
  const html = `<div style="font-family:TH Sarabun New; padding:20pt">${brandingHeader()}<h2 style="text-align:center">รายงานอาหารกลางวันนักเรียน (สพฐ.)</h2><table border="1" cellpadding="4" cellspacing="0" style="width:100%; border-collapse:collapse"><tr style="background:#eee"><th>วันที่</th><th>เมนู (5 หมู่)</th><th>จำนวน นร.</th><th>งบ/คน</th><th>แหล่งทุน</th><th>รวม</th></tr>${data.map(d=>`<tr><td>${d.date}</td><td>${d.menu}</td><td style="text-align:center">${d.students}</td><td style="text-align:right">${d.budgetPerHead}</td><td>${d.source}</td><td style="text-align:right">${(d.students*d.budgetPerHead).toFixed(2)}</td></tr>`).join("")}</table><div style="margin-top:30pt; display:flex; justify-content:space-between; text-align:center"><div>ผู้จัดทำ<br>...........................</div><div>${sig}${b.directorTitle}<br>${b.director}<br>...........................</div></div></div>`;
  openPrintWindow(html, { title: "รายงานอาหารกลางวัน" });
}

// Homeroom 5 หมวด สพฐ. (เยี่ยมบ้าน/SDQ/ทุน/พฤติกรรม/EO)
export function printHomeroomReport(rows: { studentCode: string; name: string; visit: string; sdq: string; scholarship: string; behavior: string; eo: string }[], meta: { classroom: string; term: string; year: string }) {
  const b=getBranding(); const sig = b.directorSig? `<img src="${b.directorSig}" style="height:28pt; display:block; margin:0 auto 4pt" onerror="this.style.display='none'"><br>`:"";
  const html = `<div style="font-family:TH Sarabun New; padding:20pt">${brandingHeader()}<h2 style="text-align:center">รายงานโฮมรูม 5 หมวด (สพฐ. ระบบดูแลช่วยเหลือนักเรียน)</h2><div style="text-align:center; margin-bottom:8pt">ห้อง ${meta.classroom} ภาคเรียน ${meta.term}/${meta.year}</div><table border="1" cellpadding="4" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:11pt"><tr style="background:#eee; text-align:center"><th>ที่</th><th>เลขประจำตัว</th><th>ชื่อ</th><th>เยี่ยมบ้าน</th><th>SDQ</th><th>ทุน</th><th>พฤติกรรม</th><th>EO</th></tr>${rows.map((r,i)=>`<tr><td style="text-align:center">${i+1}</td><td style="text-align:center">${r.studentCode}</td><td>${r.name}</td><td>${r.visit}</td><td style="text-align:center">${r.sdq}</td><td>${r.scholarship}</td><td>${r.behavior}</td><td>${r.eo}</td></tr>`).join("")}</table><div style="margin-top:20pt; display:flex; justify-content:space-between; text-align:center"><div>ครูประจำชั้น<br>...........................</div><div>หัวหน้าระดับ<br>...........................</div><div>${sig}${b.directorTitle}<br>${b.director}<br>...........................</div></div></div>`;
  openPrintWindow(html, { title: `โฮมรูม ${meta.classroom}` });
}
