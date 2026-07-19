import { BE_OFFSET } from "./dateBE";
// Autofill data sources for PDF template fields (DMC / school / user)

export const AUTOFILL_SOURCES: { value: string; label: string; group: string }[] = [
  // Student (DMC)
  { value: "student.prefix", label: "คำนำหน้า", group: "นักเรียน (DMC)" },
  { value: "student.first_name", label: "ชื่อ", group: "นักเรียน (DMC)" },
  { value: "student.last_name", label: "นามสกุล", group: "นักเรียน (DMC)" },
  { value: "student.full_name", label: "ชื่อ-นามสกุล", group: "นักเรียน (DMC)" },
  { value: "student.student_code", label: "รหัสนักเรียน", group: "นักเรียน (DMC)" },
  { value: "student.id_card", label: "เลขบัตรประชาชน", group: "นักเรียน (DMC)" },
  { value: "student.birthdate", label: "วันเกิด", group: "นักเรียน (DMC)" },
  { value: "student.birthdate_thai", label: "วันเกิด (ไทย)", group: "นักเรียน (DMC)" },
  { value: "student.gender", label: "เพศ", group: "นักเรียน (DMC)" },
  { value: "student.nationality", label: "สัญชาติ", group: "นักเรียน (DMC)" },
  { value: "student.religion", label: "ศาสนา", group: "นักเรียน (DMC)" },
  { value: "student.address", label: "ที่อยู่", group: "นักเรียน (DMC)" },
  { value: "student.phone", label: "เบอร์โทร", group: "นักเรียน (DMC)" },
  { value: "student.classroom", label: "ห้องเรียน", group: "นักเรียน (DMC)" },
  { value: "student.father_name", label: "ชื่อบิดา", group: "นักเรียน (DMC)" },
  { value: "student.mother_name", label: "ชื่อมารดา", group: "นักเรียน (DMC)" },
  // School
  { value: "school.name", label: "ชื่อโรงเรียน", group: "โรงเรียน" },
  { value: "school.address", label: "ที่อยู่โรงเรียน", group: "โรงเรียน" },
  { value: "school.phone", label: "โทรศัพท์", group: "โรงเรียน" },
  { value: "school.director", label: "ผู้อำนวยการ", group: "โรงเรียน" },
  // Date
  { value: "date.today", label: "วันที่วันนี้", group: "วันที่" },
  { value: "date.today_thai", label: "วันที่วันนี้ (ไทย)", group: "วันที่" },
  // User
  { value: "user.name", label: "ชื่อผู้ใช้ปัจจุบัน", group: "ผู้ใช้" },
];

const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function thaiDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + BE_OFFSET}`;
}

export interface AutofillContext {
  student?: any;
  school?: any;
  user?: { name?: string };
}

export function resolveAutofill(source: string | undefined | null, ctx: AutofillContext): string {
  if (!source) return "";
  const s = ctx.student || {};
  const sc = ctx.school || {};
  switch (source) {
    case "student.prefix": return s.prefix || "";
    case "student.first_name": return s.first_name || "";
    case "student.last_name": return s.last_name || "";
    case "student.full_name": return `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim();
    case "student.student_code": return s.student_code || "";
    case "student.id_card": return s.id_card_number || s.national_id || "";
    case "student.birthdate": return s.birth_date || s.birthdate || "";
    case "student.birthdate_thai": {
      const v = s.birth_date || s.birthdate;
      return v ? thaiDate(new Date(v)) : "";
    }
    case "student.gender": return s.gender || "";
    case "student.nationality": return s.nationality || "";
    case "student.religion": return s.religion || "";
    case "student.address": return s.address || "";
    case "student.phone": return s.phone || s.phone_number || "";
    case "student.classroom": return s.classroom_name || s.current_classroom || "";
    case "student.father_name": return s.father_name || "";
    case "student.mother_name": return s.mother_name || "";
    case "school.name": return sc.school_name || sc.name || "";
    case "school.address": return sc.address || "";
    case "school.phone": return sc.phone || sc.phone_number || "";
    case "school.director": return sc.director_name || "";
    case "date.today": return todayBangkok();
    case "date.today_thai": return thaiDate(new Date());
    case "user.name": return ctx.user?.name || "";
    default: return "";
  }
}
