// Shared constants + DMC (Data Management Center) column mapping for user/student import flows.
// Extracted from src/pages/UserManagement.tsx to keep the page slim.

import { z } from "zod";
import { commonRegex } from "@/lib/formValidation";

export const GRADE_LEVELS = [
  "อ.1", "อ.2", "อ.3",
  "ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6",
  "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6",
  "การศึกษาพิเศษ",
];

export const DEPARTMENTS = [
  { value: "วิชาการ", label: "ฝ่ายวิชาการ" },
  { value: "กิจการนักเรียน", label: "ฝ่ายกิจการนักเรียน" },
  { value: "บริหารทั่วไป", label: "ฝ่ายบริหารงานทั่วไป" },
  { value: "งบประมาณ", label: "ฝ่ายงบประมาณและบุคคล" },
  { value: "ConnextED", label: "ฝ่ายงาน ConnextED" },
];

export const POSITIONS = [
  "ครู", "ครูผู้ช่วย", "ครูอัตราจ้าง", "พนักงานราชการ",
  "ผู้อำนวยการ", "รองผู้อำนวยการ", "ลูกจ้างประจำ", "ลูกจ้างชั่วคราว",
  "ICT Talent", "School Partner", "ConnextED",
];

export const ACADEMIC_STANDINGS = [
  "ไม่มี", "ครูผู้ช่วย", "ครู คศ.1", "ครูชำนาญการ (คศ.2)",
  "ครูชำนาญการพิเศษ (คศ.3)", "ครูเชี่ยวชาญ (คศ.4)", "ครูเชี่ยวชาญพิเศษ (คศ.5)",
  "ผอ.ชำนาญการพิเศษ", "ผอ.เชี่ยวชาญ",
];

export const SUBJECT_GROUPS = [
  "ปฐมวัย",
  "ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนาและวัฒนธรรม", "ภาษาต่างประเทศ",
  "สุขศึกษาและพลศึกษา", "ศิลปะ", "การงานอาชีพ",
  "กิจกรรมพัฒนาผู้เรียน", "อื่นๆ",
];

export const PREFIXES_STUDENT = ["ด.ช.", "ด.ญ.", "นาย", "นางสาว"];
export const PREFIXES_STAFF = ["นาย", "นาง", "นางสาว", "ว่าที่ ร.ต.", "ว่าที่ ร.ท.", "ว่าที่ ร.อ.", "ดร."];

/** DMC column mapping: DMC header → our internal field name. */
export const DMC_STUDENT_MAP: Record<string, string> = {
  "เลขประจำตัวนักเรียน": "student_code",
  "รหัสนักเรียน": "student_code",
  "รหัสโรงเรียน": "student_code",
  "school_code": "student_code",
  "เลขประจำตัวประชาชน": "national_id",
  "เลขบัตรประชาชน": "national_id",
  "คำนำหน้า": "prefix",
  "คำนำหน้าชื่อ": "prefix",
  "ชื่อ": "first_name",
  "ชื่อจริง": "first_name",
  "นามสกุล": "last_name",
  "เพศ": "gender",
  "วันเกิด": "date_of_birth",
  "วัน/เดือน/ปีเกิด": "date_of_birth",
  "สัญชาติ": "nationality",
  "เชื้อชาติ": "ethnicity",
  "ศาสนา": "religion",
  "หมู่เลือด": "blood_type",
  "หมู่โลหิต": "blood_type",
  "ที่อยู่": "address",
  "โทรศัพท์": "phone",
  "ระดับชั้น": "grade_level",
  "ชั้น": "grade_level",
  "ห้อง": "classroom",
  "ชื่อบิดา": "_father_first",
  "คำนำหน้าชื่อบิดา": "_father_prefix",
  "นามสกุลบิดา": "_father_last",
  "อาชีพบิดา": "father_occupation",
  "โทรศัพท์บิดา": "father_phone",
  "หมายเลขโทรศัพท์ของบิดา": "father_phone",
  "เลขบัตรบิดา": "father_id",
  "หมายเลขบัตรประชาชนบิดา": "father_id",
  "รายได้ต่อเดือนของบิดา": "_father_income",
  "ชื่อมารดา": "_mother_first",
  "คำนำหน้าชื่อมารดา": "_mother_prefix",
  "นามสกุลมารดา": "_mother_last",
  "อาชีพมารดา": "mother_occupation",
  "โทรศัพท์มารดา": "mother_phone",
  "หมายเลขโทรศัพท์ของมารดา": "mother_phone",
  "เลขบัตรมารดา": "mother_id",
  "หมายเลขบัตรประชาชนมารดา": "mother_id",
  "รายได้ต่อเดือนของมารดา": "_mother_income",
  "ชื่อผู้ปกครอง": "_guardian_first",
  "คำนำหน้าชื่อผู้ปกครอง": "_guardian_prefix",
  "นามสกุลผู้ปกครอง": "_guardian_last",
  "โทรศัพท์ผู้ปกครอง": "guardian_phone",
  "หมายเลขโทรศัพท์ของผู้ปกครอง": "guardian_phone",
  "ความสัมพันธ์": "guardian_relation",
  "ความเกี่ยวข้องของผู้ปกครองกับนักเรียน": "guardian_relation",
  "หมายเลขบัตรประชาชนผู้ปกครอง": "_guardian_id",
  "รายได้ต่อเดือนของผู้ปกครอง": "_guardian_income",
  "โรงเรียนเดิม": "previous_school",
  "วันที่เข้าเรียน": "admission_date",
  "สถานะ": "status",
  "น้ำหนัก": "weight",
  "ส่วนสูง": "height",
  "จังหวัดที่เกิด": "birth_province",
  "ชื่อ (อังกฤษ)": "_en_first_name",
  "นามสกุล (อังกฤษ)": "_en_last_name",
  // English fallbacks
  "student_code": "student_code",
  "national_id": "national_id",
  "prefix": "prefix",
  "first_name": "first_name",
  "last_name": "last_name",
  "gender": "gender",
  "grade_level": "grade_level",
  "email": "email",
  "password": "password",
  "role": "role",
  "department": "department",
  "อีเมล": "email",
  "รหัสผ่าน": "password",
  "บทบาท": "role",
  "ฝ่ายงาน": "department",
  "ตำแหน่ง": "position",
  "วิทยฐานะ": "academic_standing",
  "position": "position",
  "academic_standing": "academic_standing",
};

// ─── Zod schemas & labels for user create/edit forms ───────────────────────────
export const userCreateSchema = z.object({
  email: z.string().trim().regex(commonRegex.email, "อีเมลไม่ถูกต้อง").max(120),
  password: z.string().min(6, "อย่างน้อย 6 ตัวอักษร").max(72),
  first_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  last_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  role: z.string().min(1),
  student_code: z.string().trim().max(30).optional(),
  national_id: z.string().trim().regex(/^\d{13}$/, "ต้องเป็นเลข 13 หลัก").optional().or(z.literal("")),
  phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์โทรไม่ถูกต้อง").optional().or(z.literal("")),
});

export const userEditSchema = z.object({
  first_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  last_name: z.string().trim().min(1, "กรุณากรอก").max(80),
  email: z.string().trim().regex(commonRegex.email, "อีเมลไม่ถูกต้อง").max(120).optional().or(z.literal("")),
  phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์โทรไม่ถูกต้อง").optional().or(z.literal("")),
  national_id: z.string().trim().regex(/^\d{13}$/, "ต้องเป็นเลข 13 หลัก").optional().or(z.literal("")),
  emergency_phone: z.string().trim().regex(commonRegex.phoneTH, "เบอร์โทรไม่ถูกต้อง").optional().or(z.literal("")),
});

export const userLabels: Record<string, string> = {
  email: "อีเมล", password: "รหัสผ่าน", first_name: "ชื่อ", last_name: "นามสกุล",
  role: "บทบาท", student_code: "รหัสนักเรียน", national_id: "เลขบัตรประชาชน",
  phone: "เบอร์โทร", emergency_phone: "เบอร์ฉุกเฉิน",
};
