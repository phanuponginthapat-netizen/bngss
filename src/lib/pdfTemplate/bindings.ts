import type { PdfTemplateCategory } from "./types";

/** Master catalog of every binding the system understands (grouped). */
export const BINDING_CATALOG: { group: string; items: { path: string; label: string }[] }[] = [
  {
    group: "นักเรียน (DMC)",
    items: [
      { path: "{student.prefix}", label: "คำนำหน้า" },
      { path: "{student.first_name}", label: "ชื่อ" },
      { path: "{student.last_name}", label: "นามสกุล" },
      { path: "{student.full_name}", label: "ชื่อ-นามสกุล" },
      { path: "{student.student_code}", label: "รหัสนักเรียน" },
      { path: "{student.id_card}", label: "เลขบัตรประชาชน 13 หลัก" },
      { path: "{student.classroom}", label: "ชั้น/ห้อง" },
      { path: "{student.birth_date}", label: "วันเดือนปีเกิด (พ.ศ.)" },
      { path: "{student.birth_province}", label: "จังหวัดเกิด" },
      { path: "{student.gender}", label: "เพศ" },
      { path: "{student.nationality}", label: "สัญชาติ" },
      { path: "{student.ethnicity}", label: "เชื้อชาติ" },
      { path: "{student.religion}", label: "ศาสนา" },
      { path: "{student.blood_type}", label: "หมู่เลือด" },
      { path: "{student.weight}", label: "น้ำหนัก (กก.)" },
      { path: "{student.height}", label: "ส่วนสูง (ซม.)" },
      { path: "{student.address}", label: "ที่อยู่ปัจจุบัน" },
      { path: "{student.phone}", label: "เบอร์โทร" },
      { path: "{student.previous_school}", label: "โรงเรียนเดิม" },
      { path: "{student.admission_date}", label: "วันที่เข้าเรียน" },
      { path: "{student.special_needs}", label: "ความต้องการพิเศษ" },
      { path: "{student.photo}", label: "รูปนักเรียน (image)" },
    ],
  },
  {
    group: "บิดา",
    items: [
      { path: "{father.name}", label: "ชื่อ-สกุล บิดา" },
      { path: "{father.id_card}", label: "เลขบัตร ปชช. บิดา" },
      { path: "{father.phone}", label: "เบอร์โทรบิดา" },
      { path: "{father.occupation}", label: "อาชีพบิดา" },
    ],
  },
  {
    group: "มารดา",
    items: [
      { path: "{mother.name}", label: "ชื่อ-สกุล มารดา" },
      { path: "{mother.id_card}", label: "เลขบัตร ปชช. มารดา" },
      { path: "{mother.phone}", label: "เบอร์โทรมารดา" },
      { path: "{mother.occupation}", label: "อาชีพมารดา" },
    ],
  },
  {
    group: "ผู้ปกครอง",
    items: [
      { path: "{guardian.name}", label: "ชื่อผู้ปกครอง" },
      { path: "{guardian.phone}", label: "เบอร์โทรผู้ปกครอง" },
      { path: "{guardian.relation}", label: "ความสัมพันธ์" },
      { path: "{emergency.contact}", label: "ติดต่อฉุกเฉิน" },
      { path: "{emergency.phone}", label: "เบอร์ฉุกเฉิน" },
    ],
  },
  {
    group: "โรงเรียน",
    items: [
      { path: "{school.name}", label: "ชื่อโรงเรียน" },
      { path: "{school.code}", label: "รหัสโรงเรียน" },
      { path: "{school.obec_code}", label: "รหัส OBEC" },
      { path: "{school.affiliation}", label: "สังกัด" },
      { path: "{school.address}", label: "ที่อยู่โรงเรียน" },
      { path: "{school.district}", label: "อำเภอ/เขต" },
      { path: "{school.province}", label: "จังหวัด" },
      { path: "{school.postal_code}", label: "รหัสไปรษณีย์" },
      { path: "{school.phone}", label: "โทรศัพท์โรงเรียน" },
      { path: "{school.email}", label: "อีเมลโรงเรียน" },
      { path: "{school.website}", label: "เว็บไซต์" },
      { path: "{school.director_name}", label: "ชื่อ ผอ." },
      { path: "{school.logo}", label: "โลโก้โรงเรียน (image)" },
    ],
  },
  {
    group: "ปีการศึกษา",
    items: [
      { path: "{academic.year}", label: "ปีการศึกษา (พ.ศ.)" },
      { path: "{academic.semester}", label: "ภาคเรียน" },
      { path: "{form.date}", label: "วันที่ปัจจุบัน (พ.ศ.)" },
    ],
  },
  {
    group: "ผู้บริหาร / ครู / ผู้กรอก",
    items: [
      { path: "{director.name}", label: "ชื่อ ผอ." },
      { path: "{director.signature}", label: "ลายเซ็น ผอ. (image)" },
      { path: "{teacher.name}", label: "ครูประจำชั้น" },
      { path: "{user.full_name}", label: "ชื่อผู้กรอก" },
      { path: "{user.position}", label: "ตำแหน่งผู้กรอก" },
    ],
  },
  {
    group: "เยี่ยมบ้าน (กสศ./SDQ)",
    items: [
      { path: "{visit.date}", label: "วันที่เยี่ยม" },
      { path: "{visit.address}", label: "ที่อยู่ที่เยี่ยม" },
      { path: "{visit.guardian_name}", label: "ชื่อผู้ปกครอง (เยี่ยม)" },
      { path: "{visit.guardian_phone}", label: "เบอร์ผู้ปกครอง" },
      { path: "{visit.relation}", label: "ความสัมพันธ์" },
      { path: "{visit.notes}", label: "บันทึกการเยี่ยม" },
      { path: "{visit.economic}", label: "สภาพเศรษฐกิจ" },
      { path: "{visit.income_per_month}", label: "รายได้/เดือน" },
    ],
  },
  {
    group: "ทุนการศึกษา",
    items: [
      { path: "{scholarship.name}", label: "ชื่อทุน" },
      { path: "{scholarship.amount}", label: "จำนวนเงิน" },
      { path: "{scholarship.date}", label: "วันที่รับทุน" },
    ],
  },
  {
    group: "การลา / ฟอร์ม",
    items: [
      { path: "{form.title}", label: "ชื่อฟอร์ม" },
      { path: "{leave.applicant}", label: "ผู้ขอลา" },
      { path: "{leave.type}", label: "ประเภทการลา" },
      { path: "{leave.from}", label: "วันที่เริ่มลา" },
      { path: "{leave.to}", label: "วันที่สิ้นสุด" },
      { path: "{leave.days}", label: "จำนวนวัน" },
      { path: "{leave.reason}", label: "เหตุผล" },
      { path: "{leave.contact}", label: "ที่อยู่ติดต่อ" },
    ],
  },
  {
    group: "กำหนดเอง",
    items: [
      { path: "{custom.text}", label: "ข้อความกำหนดเอง" },
    ],
  },
];

const flat = BINDING_CATALOG.flatMap(g => g.items);

/** preset binding paths per category — แสดงเป็น autocomplete ในตัวออกแบบ */
export const BINDING_PRESETS: Record<PdfTemplateCategory, { path: string; label: string }[]> = {
  eform: flat,
  pp: flat,
  scholarship: flat,
  home_visit: flat,
  leave: flat,
  other: flat,
};

/** Paths ที่ระบบ "auto-fill" ได้จาก system data (ไม่ต้องให้ผู้กรอกพิมพ์) */
export const SYSTEM_AUTOFILL_PATHS = new Set<string>([
  "school.name", "school.code", "school.obec_code", "school.affiliation",
  "school.address", "school.district", "school.province", "school.postal_code",
  "school.phone", "school.email", "school.website", "school.director_name", "school.logo",
  "student.prefix", "student.first_name", "student.last_name", "student.full_name",
  "student.student_code", "student.classroom", "student.id_card",
  "student.birth_date", "student.birth_province", "student.gender",
  "student.nationality", "student.ethnicity", "student.religion", "student.blood_type",
  "student.weight", "student.height", "student.address", "student.phone",
  "student.previous_school", "student.admission_date", "student.special_needs", "student.photo",
  "father.name", "father.id_card", "father.phone", "father.occupation",
  "mother.name", "mother.id_card", "mother.phone", "mother.occupation",
  "guardian.name", "guardian.phone", "guardian.relation",
  "emergency.contact", "emergency.phone",
  "academic.year", "academic.semester",
  "director.name", "director.signature",
  "user.full_name", "user.position", "teacher.name",
  "form.date",
]);

/** Extract the dotted-paths inside a binding string, e.g. "{a.b} - {c}" → ["a.b","c"] */
export function extractBindingPaths(binding: string): string[] {
  const out: string[] = [];
  binding?.replace(/\{([^}]+)\}/g, (_m, k) => { out.push(String(k).trim()); return ""; });
  return out;
}

/** Resolve "{path.to.value}" against data object. รองรับหลาย binding ในข้อความเดียว */
export function resolveBinding(binding: string, data: Record<string, any>): string {
  if (!binding) return "";
  return binding.replace(/\{([^}]+)\}/g, (_m, key) => {
    const parts = String(key).trim().split(".");
    let cur: any = data;
    for (const p of parts) {
      if (cur == null) return "";
      cur = cur[p];
    }
    return cur == null ? "" : String(cur);
  });
}
