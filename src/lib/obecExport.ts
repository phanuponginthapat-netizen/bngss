// OBEC Hub — ส่งออกไฟล์ตามสเปค สพฐ. แบบไร้รอยต่อ
import * as XLSX from "xlsx";
import JSZip from "jszip";

/**
 * DMC Export — 25+ fields ตาม标准 สพฐ. Data Management Center
 */
export function exportDMC(students: any[], fileName = "dmc_students.xlsx") {
  const header = [
    "เลขประจำตัวนักเรียน",        // student_code
    "รหัสโรงเรียน",              // school_code
    "คำนำหน้า",                  // prefix
    "ชื่อ",                       // first_name
    "นามสกุล",                   // last_name
    "เพศ",                        // gender
    "วัน/เดือน/ปีเกิด",          // date_of_birth
    "เลขประจำตัวประชาชน",        // national_id
    "สัญชาติ",                    // nationality
    "เชื้อชาติ",                  // ethnicity
    "ศาสนา",                      // religion
    "หมู่เลือด",                  // blood_type
    "ที่อยู่",                     // address
    "โทรศัพท์",                   // phone
    "ระดับชั้น",                  // grade_level
    "ห้อง",                       // classroom
    "โรงเรียนเดิม",              // previous_school
    "วันที่เข้าเรียน",            // admission_date
    "สถานะ",                      // status
    "ชื่อบิดา",                   // father_name
    "อาชีพบิดา",                  // father_occupation
    "โทรศัพท์บิดา",              // father_phone
    "ชื่อมารดา",                 // mother_name
    "อาชีพมารดา",                // mother_occupation
    "โทรศัพท์มารดา",            // mother_phone
    "ชื่อผู้ปกครอง",             // guardian_name
    "ความเกี่ยวข้อง",            // guardian_relation
    "โทรศัพท์ผู้ปกครอง",        // guardian_phone
    "น้ำหนัก (กก.)",             // weight
    "ส่วนสูง (ซม.)",             // height
    "หมู่เลือด",                  // blood_type (dup for OBEC)
  ];

  const data = students.map((s) => {
    const fatherName = [s.father_prefix, s.father_first_name, s.father_last_name].filter(Boolean).join(" ");
    const motherName = [s.mother_prefix, s.mother_first_name, s.mother_last_name].filter(Boolean).join(" ");
    const guardianName = [s.guardian_prefix, s.guardian_first_name, s.guardian_last_name].filter(Boolean).join(" ");
    return [
      s.student_code || "",
      s.school_code || "",
      s.prefix || "",
      s.first_name || "",
      s.last_name || "",
      s.gender || "",
      s.date_of_birth || "",
      s.national_id || "",
      s.nationality || "ไทย",
      s.ethnicity || "",
      s.religion || "",
      s.blood_type || "",
      s.address || "",
      s.phone || "",
      s.grade_level || "",
      s.classroom || "",
      s.previous_school || "",
      s.admission_date || "",
      s.status || "active",
      fatherName,
      s.father_occupation || "",
      s.father_phone || "",
      motherName,
      s.mother_occupation || "",
      s.mother_phone || "",
      guardianName,
      s.guardian_relation || "",
      s.guardian_phone || "",
      s.weight || "",
      s.height || "",
      s.blood_type || "",
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DMC");
  XLSX.writeFile(wb, fileName);
}

/**
 * SGS Export — ผลการเรียนตามเทมเพลต สพฐ.
 */
export function exportSGS(rows: any[], fileName = "sgs_grades.xlsx") {
  const header = ["ปีการศึกษา", "ภาคเรียน", "รหัสวิชา", "ชื่อวิชา", "หน่วยกิต", "เลขประจำตัว", "ชื่อ-สกุล", "คะแนนเต็ม", "คะแนนที่ได้", "เกรด"];
  const data = rows.map((r) => [r.year, r.term, r.subjectCode, r.subjectName || "", r.credit || "", r.studentCode, r.studentName || "", r.fullScore, r.score, r.grade]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SGS");
  XLSX.writeFile(wb, fileName);
}

/**
 * Export OBEC ZIP — รวมทุกไฟล์เป็น ZIP เดียวสำหรับอัปโหลด สพฐ.
 */
export async function exportObecZip(payload: {
  dmcStudents?: any[];
  sgsGrades?: any[];
  attendanceSummary?: any[];
  testScores?: any[];
  schoolInfo?: Record<string, string>;
}, fileName = "obec_export.zip") {
  const zip = new JSZip();
  const info = payload.schoolInfo || {};

  // 1. DMC student data
  if (payload.dmcStudents?.length) {
    const dmcWb = XLSX.utils.book_new();
    const dmcHeader = ["เลขประจำตัวนักเรียน","รหัสโรงเรียน","คำนำหน้า","ชื่อ","นามสกุล","เพศ","วัน/เดือน/ปีเกิด","เลข13หลัก","สัญชาติ","ศาสนา","ระดับชั้น","ห้อง"];
    const dmcData = payload.dmcStudents.map(s => [
      s.student_code, info.school_code || "", s.prefix, s.first_name, s.last_name,
      s.gender, s.date_of_birth, s.national_id, s.nationality || "ไทย",
      s.religion || "", s.grade_level, s.classroom
    ]);
    const ws = XLSX.utils.aoa_to_sheet([dmcHeader, ...dmcData]);
    XLSX.utils.book_append_sheet(dmcWb, ws, "DMC");
    zip.file("dmc_students.xlsx", XLSX.write(dmcWb, { bookType: "xlsx", type: "array" }));
  }

  // 2. SGS grades
  if (payload.sgsGrades?.length) {
    const sgsWb = XLSX.utils.book_new();
    const sgsHeader = ["ปีการศึกษา","ภาคเรียน","รหัสวิชา","ชื่อวิชา","เลขประจำตัว","ชื่อ-สกุล","เกรด"];
    const sgsData = payload.sgsGrades.map(r => [r.year, r.term, r.subjectCode, r.subjectName, r.studentCode, r.studentName, r.grade]);
    const ws = XLSX.utils.aoa_to_sheet([sgsHeader, ...sgsData]);
    XLSX.utils.book_append_sheet(sgsWb, ws, "SGS");
    zip.file("sgs_grades.xlsx", XLSX.write(sgsWb, { bookType: "xlsx", type: "array" }));
  }

  // 3. Attendance summary
  if (payload.attendanceSummary?.length) {
    const attWb = XLSX.utils.book_new();
    const attHeader = ["เดือน","มาเรียน","สาย","ขาด","ลา","ป่วย","อัตราการมาเรียน (%)"];
    const ws = XLSX.utils.aoa_to_sheet([attHeader, ...payload.attendanceSummary.map((a: any) => [a.month, a.present, a.late, a.absent, a.leave, a.sick, a.rate])]);
    XLSX.utils.book_append_sheet(attWb, ws, "ATTENDANCE");
    zip.file("attendance_summary.xlsx", XLSX.write(attWb, { bookType: "xlsx", type: "array" }));
  }

  // 4. Test scores
  if (payload.testScores?.length) {
    const tsWb = XLSX.utils.book_new();
    const tsHeader = ["ปีการศึกษา","ประเภทสอบ","ระดับชั้น","วิชา","ค่าเฉลี่ย","จำนวนนักเรียน","ค่าเฉลี่ยชาติ","ค่าเฉลี่ยเขต"];
    const ws = XLSX.utils.aoa_to_sheet([tsHeader, ...payload.testScores.map((t: any) => [t.academic_year, t.test_type, t.grade_level, t.subject, t.avg_score, t.student_count, t.national_avg, t.area_avg])]);
    XLSX.utils.book_append_sheet(tsWb, ws, "TEST_SCORES");
    zip.file("test_scores.xlsx", XLSX.write(tsWb, { bookType: "xlsx", type: "array" }));
  }

  // 5. School info JSON
  zip.file("school_info.json", JSON.stringify(info, null, 2));

  // Generate and download
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
