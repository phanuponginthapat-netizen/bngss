// P-OBEC — ส่งออกข้อมูลบุคลากรตามเทมเพลต สพฐ.
import * as XLSX from "xlsx";

export interface PersonnelRow {
  employee_code: string;
  prefix: string;
  first_name: string;
  last_name: string;
  position: string;
  academic_standing: string;
  education_level: string;
  subject_group: string;
  employment_type: string;
  start_date: string;
  birth_date?: string;
  phone?: string;
  google_email?: string;
}

export function exportPObec(personnel: PersonnelRow[], fileName = "p_obec_personnel.xlsx") {
  const header = [
    "ลำดับ",
    "รหัสบุคลากร",
    "คำนำหน้า",
    "ชื่อ",
    "นามสกุล",
    "ตำแหน่ง",
    "วิทยฐานะ",
    "วุฒิการศึกษา",
    "กลุ่มสาระ",
    "ประเภทการจ้าง",
    "วันที่เริ่มงาน",
    "วันเกิด",
    "เบอร์โทร",
    "อีเมล",
  ];
  const data = personnel.map((p, i) => [
    i + 1,
    p.employee_code,
    p.prefix,
    p.first_name,
    p.last_name,
    p.position,
    p.academic_standing,
    p.education_level,
    p.subject_group,
    p.employment_type,
    p.start_date,
    p.birth_date || "",
    p.phone || "",
    p.google_email || "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "P-OBEC");
  XLSX.writeFile(wb, fileName);
}

export interface WorkforceSummary {
  totalPositions: number;
  filledPositions: number;
  byType: Record<string, { required: number; actual: number }>;
  byAcademicStanding: Record<string, number>;
}

export function calculateWorkforce(personnel: PersonnelRow[]): WorkforceSummary {
  const byType: Record<string, { required: number; actual: number }> = {};
  const byAcademicStanding: Record<string, number> = {};

  for (const p of personnel) {
    const type = p.employment_type || "อื่นๆ";
    if (!byType[type]) byType[type] = { required: 0, actual: 0 };
    byType[type].actual++;

    const standing = p.academic_standing || "ไม่มี";
    byAcademicStanding[standing] = (byAcademicStanding[standing] || 0) + 1;
  }

  return {
    totalPositions: personnel.length,
    filledPositions: personnel.length,
    byType,
    byAcademicStanding,
  };
}
