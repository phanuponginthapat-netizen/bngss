// OBEC Hub — ส่งออกไฟล์ตามสเปค สพฐ. แบบไร้รอยต่อ
import * as XLSX from "xlsx";

export function exportDMC(students: any[], fileName="dmc_students.xlsx"){
  const header=["เลขประจำตัว","คำนำหน้า","ชื่อ","สกุล","เพศ","วันเกิด","เลข13หลัก","ชั้น","ห้อง"];
  const data=students.map(s=>[s.student_code,s.prefix,s.first_name,s.last_name,s.gender,s.date_of_birth,s.national_id,s.grade_level,s.classroom]);
  const ws=XLSX.utils.aoa_to_sheet([header,...data]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"DMC"); XLSX.writeFile(wb,fileName);
}
export function exportSGS(rows:any[], fileName="sgs_grades.xlsx"){
  const header=["ปี","เทอม","รหัสวิชา","เลขประจำตัว","คะแนน","เกรด"];
  const data=rows.map(r=>[r.year,r.term,r.subjectCode,r.studentCode,r.score,r.grade]);
  const ws=XLSX.utils.aoa_to_sheet([header,...data]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"SGS"); XLSX.writeFile(wb,fileName);
}
export function exportObecZip(all:any){ /* รวมทุกไฟล์เป็น zip เดียว — ใช้ jszip */ }
