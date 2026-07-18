// ============================================================================
// Shared header-alias matcher for ALL file imports (DMC, PP5, PP6, schedule,
// personnel, assets, scores, ฯลฯ).
//
// Goal: รับหัวคอลัมน์ภาษาไทย/อังกฤษได้หลายแบบโดยไม่ต้อง maintain map ทุกหน้า
//       เช่น "ชื่อ", "ชื่อจริง", "ชื่อ-นามสกุล", "First Name", "FirstName",
//       "ชื่อ (ภาษาไทย)" → first_name
//
// Match order:
//   1. normalize() ทั้งสองฝั่ง แล้วเทียบ exact
//   2. ตรวจ substring (header includes alias) ทั้งสองทิศ
//   3. token-overlap ≥ 0.6 (เผื่อสลับลำดับคำ)
//
// ใช้:
//   const matcher = createHeaderMatcher(STUDENT_ALIASES);
//   const field = matcher("ชื่อจริง (ภาษาไทย)");   // → "first_name"
//   const headerMap = matcher.buildMap(rawHeaders); // Record<raw, field>
// ============================================================================

export type AliasMap = Record<string, string[]>;

/** normalize: ตัด BOM/ช่องว่าง/วรรคตอน/วงเล็บ, ทำตัวพิมพ์เล็ก, แปลงรูปวรรณยุกต์ */
export function normalizeHeader(input: unknown): string {
  if (input == null) return "";
  let s = String(input);
  s = s.replace(/^\uFEFF/, "");           // BOM
  s = s.normalize("NFKC");                 // unicode canonical
  s = s.toLowerCase();
  s = s.replace(/__\d+$/, "");             // dedup suffix (เช่น "ชื่อ__1")
  // ลบวงเล็บและเนื้อในวงเล็บ — "ชื่อ (ภาษาไทย)" → "ชื่อ"
  s = s.replace(/[\(（][^)\）]*[\)）]/g, " ");
  s = s.replace(/[\[［][^\]］]*[\]］]/g, " ");
  // ลบเครื่องหมายและช่องว่างทุกชนิด
  s = s.replace(/[\s\u00A0\u200B-\u200D_\-./:;,#*"'`~?!@%&+=<>|\\]+/g, "");
  return s.trim();
}

/** แตก token จาก header (ตัดวงเล็บ/punctuation ทิ้ง) */
function tokens(input: unknown): string[] {
  if (input == null) return [];
  return String(input)
    .toLowerCase()
    .replace(/[\(（][^)\）]*[\)）]/g, " ")
    .split(/[\s\u00A0_\-./:;,#*"'`~?!@%&+=<>|\\]+/)
    .filter(Boolean);
}

/** สัดส่วน token ที่ overlap กัน (Jaccard-lite) */
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  ta.forEach((t) => { if (tb.has(t)) hit++; });
  return hit / Math.min(ta.size, tb.size);
}

export interface HeaderMatcher {
  (rawHeader: unknown): string | null;
  /** สร้าง Record<rawHeader, canonicalField> สำหรับทุกหัว */
  buildMap(rawHeaders: unknown[]): Record<string, string>;
}

/** สร้าง matcher จาก alias map */
export function createHeaderMatcher(aliasMap: AliasMap): HeaderMatcher {
  // index: normalized alias → canonical field
  const normalizedIndex: Map<string, string> = new Map();
  const rawAliasesByField: Array<[string, string[]]> = [];
  for (const [field, aliases] of Object.entries(aliasMap)) {
    const all = [field, ...aliases];
    rawAliasesByField.push([field, all]);
    for (const a of all) {
      const n = normalizeHeader(a);
      if (n && !normalizedIndex.has(n)) normalizedIndex.set(n, field);
    }
  }

  const match = (rawHeader: unknown): string | null => {
    if (rawHeader == null) return null;
    const norm = normalizeHeader(rawHeader);
    if (!norm) return null;

    // 1) exact normalized
    const exact = normalizedIndex.get(norm);
    if (exact) return exact;

    // 2) substring — alias อยู่ใน header หรือ header อยู่ใน alias
    //    (ใช้ alias ที่ยาว ≥ 3 เพื่อกัน false positive เช่น "id")
    for (const [n, field] of normalizedIndex) {
      if (n.length >= 3 && (norm.includes(n) || n.includes(norm))) return field;
    }

    // 3) token overlap ≥ 0.6
    let best: { field: string; score: number } | null = null;
    for (const [field, aliases] of rawAliasesByField) {
      for (const a of aliases) {
        const score = tokenOverlap(String(rawHeader), a);
        if (score >= 0.6 && (!best || score > best.score)) {
          best = { field, score };
        }
      }
    }
    return best?.field ?? null;
  };

  (match as HeaderMatcher).buildMap = (rawHeaders: unknown[]) => {
    const out: Record<string, string> = {};
    for (const h of rawHeaders) {
      const key = String(h ?? "");
      if (!key) continue;
      const f = match(h);
      if (f && out[key] == null) out[key] = f;
    }
    return out;
  };

  return match as HeaderMatcher;
}

// ============================================================================
// Alias presets — รวมศัพท์ที่พบบ่อยทั้งไทย/อังกฤษ ครอบคลุม DMC/SGS/EMIS/SchoolMIS
// เพิ่ม alias ใหม่ได้เลย — matcher จะ normalize เอง
// ============================================================================

/** นักเรียน + บุคลากร (รวมเพราะหลายไฟล์ปนกัน) */
export const PEOPLE_ALIASES: AliasMap = {
  student_code: [
    "เลขประจำตัวนักเรียน", "รหัสนักเรียน", "รหัสประจำตัวนักเรียน",
    "เลขที่นักเรียน", "เลขประจำตัว", "รหัส น.ร.", "รหัสนร",
    "school_code", "studentcode", "student id", "studentid", "student no", "studentno",
    "รหัสโรงเรียน",
  ],
  national_id: [
    "เลขประจำตัวประชาชน", "เลขบัตรประชาชน", "เลขบัตรปชช",
    "เลขประชาชน", "บัตรประชาชน", "เลข 13 หลัก", "เลขสิบสามหลัก",
    "nationalid", "national id", "citizen id", "id card", "idcard",
  ],
  employee_code: [
    "รหัสบุคลากร", "เลขที่บุคลากร", "รหัสครู", "เลขประจำตัวข้าราชการ",
    "employeecode", "employee id", "staff id", "staff code", "teacher code", "teacher id",
  ],
  prefix: [
    "คำนำหน้า", "คำนำหน้าชื่อ", "คำนำหน้านาม", "title", "name title", "salutation",
  ],
  first_name: [
    "ชื่อ", "ชื่อจริง", "ชื่อ ภาษาไทย", "ชื่อภาษาไทย", "ชื่อ-นามสกุล",
    "firstname", "first name", "given name", "givenname", "name",
  ],
  last_name: [
    "นามสกุล", "สกุล", "ชื่อสกุล", "นามสกุล ภาษาไทย",
    "lastname", "last name", "surname", "family name", "familyname",
  ],
  gender: [
    "เพศ", "sex", "gender",
  ],
  date_of_birth: [
    "วันเกิด", "วันที่เกิด", "วัน/เดือน/ปีเกิด", "ว/ด/ป เกิด", "วดป เกิด",
    "dateofbirth", "date of birth", "dob", "birthdate", "birth date",
  ],
  nationality: ["สัญชาติ", "nationality"],
  ethnicity: ["เชื้อชาติ", "ethnicity", "race"],
  religion: ["ศาสนา", "religion"],
  blood_type: ["หมู่เลือด", "หมู่โลหิต", "กรุ๊ปเลือด", "blood", "blood type", "bloodtype", "bloodgroup"],
  address: ["ที่อยู่", "ที่อยู่ปัจจุบัน", "บ้านเลขที่", "address", "home address", "addr"],
  phone: [
    "โทรศัพท์", "เบอร์โทร", "เบอร์โทรศัพท์", "หมายเลขโทรศัพท์", "มือถือ", "โทร",
    "phone", "phonenumber", "phone number", "mobile", "tel", "telephone", "contact",
  ],
  email: ["อีเมล", "อีเมล์", "email", "e-mail", "emailaddress"],
  grade_level: [
    "ระดับชั้น", "ชั้น", "ชั้นเรียน", "ชั้นปี", "grade", "gradelevel", "grade level", "level", "class level",
  ],
  classroom: ["ห้อง", "ห้องเรียน", "section", "room", "class", "classroom"],
  weight: ["น้ำหนัก", "นน.", "weight", "kg"],
  height: ["ส่วนสูง", "สส.", "height", "cm"],
  status: ["สถานะ", "status"],
  position: ["ตำแหน่ง", "ตำแหน่งงาน", "position", "job title", "jobtitle", "role"],
  academic_standing: ["วิทยฐานะ", "academic standing", "academicstanding"],
  department: ["ฝ่ายงาน", "แผนก", "ฝ่าย", "department", "dept", "กลุ่มงาน"],
  subject_group: ["กลุ่มสาระ", "กลุ่มสาระการเรียนรู้", "subject group", "subjectgroup"],
  password: ["รหัสผ่าน", "พาสเวิร์ด", "password", "pwd", "pass"],
  role: ["บทบาท", "role", "user role", "userrole"],
  hire_date: ["วันที่เริ่มงาน", "วันบรรจุ", "วันเริ่มทำงาน", "hire date", "hiredate", "start date", "startdate"],
  admission_date: [
    "วันที่เข้าเรียน", "วันที่เข้าศึกษา", "วันเข้าเรียน", "วันรับเข้า",
    "admission date", "admissiondate", "enrollment date", "enrollmentdate", "enrolled",
  ],
  graduation_date: ["วันที่จบการศึกษา", "วันจบ", "graduation date", "graduationdate"],
  previous_school: ["โรงเรียนเดิม", "สถานศึกษาเดิม", "previous school", "previousschool", "prev school"],
  birth_province: ["จังหวัดที่เกิด", "จังหวัดเกิด", "birth province", "birthprovince"],

  // ครอบครัว
  father_name: ["ชื่อบิดา", "ชื่อ-สกุล บิดา", "ชื่อพ่อ", "father", "father name", "fathername"],
  father_phone: ["โทรศัพท์บิดา", "หมายเลขโทรศัพท์ของบิดา", "เบอร์บิดา", "เบอร์พ่อ", "father phone", "fatherphone"],
  father_id: ["เลขบัตรบิดา", "หมายเลขบัตรประชาชนบิดา", "เลขประจำตัวประชาชนบิดา", "father id"],
  father_occupation: ["อาชีพบิดา", "อาชีพพ่อ", "father occupation", "fatheroccupation"],
  mother_name: ["ชื่อมารดา", "ชื่อ-สกุล มารดา", "ชื่อแม่", "mother", "mother name", "mothername"],
  mother_phone: ["โทรศัพท์มารดา", "หมายเลขโทรศัพท์ของมารดา", "เบอร์มารดา", "เบอร์แม่", "mother phone", "motherphone"],
  mother_id: ["เลขบัตรมารดา", "หมายเลขบัตรประชาชนมารดา", "เลขประจำตัวประชาชนมารดา", "mother id"],
  mother_occupation: ["อาชีพมารดา", "อาชีพแม่", "mother occupation", "motheroccupation"],
  guardian_name: ["ชื่อผู้ปกครอง", "ชื่อ-สกุล ผู้ปกครอง", "guardian", "guardian name", "guardianname"],
  guardian_phone: ["โทรศัพท์ผู้ปกครอง", "หมายเลขโทรศัพท์ของผู้ปกครอง", "เบอร์ผู้ปกครอง", "guardian phone", "guardianphone"],
  guardian_relation: [
    "ความสัมพันธ์", "ความเกี่ยวข้อง", "ความเกี่ยวข้องของผู้ปกครองกับนักเรียน",
    "relation", "relationship", "guardian relation",
  ],
};

/** วิชา */
export const SUBJECT_ALIASES: AliasMap = {
  code: ["รหัสวิชา", "รหัส", "code", "subject code", "subjectcode"],
  name_th: ["ชื่อวิชา", "ชื่อวิชา (ไทย)", "ชื่อวิชาภาษาไทย", "subject name", "subject name th", "name", "thainame"],
  name_en: ["ชื่อวิชา (อังกฤษ)", "ชื่อวิชาภาษาอังกฤษ", "english name", "name en", "subject name en"],
  credits: ["หน่วยกิต", "credit", "credits"],
  hours_per_week: ["ชั่วโมง/สัปดาห์", "ชม./สัปดาห์", "คาบ/สัปดาห์", "hours", "hoursperweek", "periods per week"],
  grade_level: ["ระดับชั้น", "ชั้น", "ชั้นเรียน", "grade", "grade level"],
  semester: ["ภาคเรียน", "เทอม", "semester", "term"],
  academic_year: ["ปีการศึกษา", "ปีศึกษา", "academic year", "academicyear", "year"],
  subject_type: ["ประเภทวิชา", "ประเภท", "subject type", "subjecttype", "type"],
};

/** คะแนน / PP5 / PP6 */
export const SCORE_ALIASES: AliasMap = {
  seq: ["ลำดับ", "ลำดับที่", "ที่", "เลขที่", "no", "no.", "order", "ลำดับ ที่"],
  student_code: PEOPLE_ALIASES.student_code,
  student_name: ["ชื่อ-สกุล", "ชื่อนักเรียน", "ชื่อ-นามสกุล", "ชื่อ - สกุล", "ชื่อสกุล", "student name", "studentname", "name", "fullname", "full name"],
  attendance_hours: [
    "เวลาเรียน", "ชั่วโมงเรียน", "ชม.เรียน", "ชั่วโมงที่มาเรียน", "มาเรียน",
    "attendance hours", "attendancehours", "hours attended",
  ],
  attendance_percent: [
    "ร้อยละเวลาเรียน", "%เวลาเรียน", "เปอร์เซ็นต์เวลาเรียน", "ร้อยละ",
    "attendance percent", "attendance %", "attendancepercent",
  ],
  attendance_pass: [
    "ผลเวลาเรียน", "การผ่าน/ไม่ผ่านเวลาเรียน", "ผ่านเวลาเรียน", "attendance pass", "attendancepass",
  ],
  assignment_score: [
    "คะแนนเก็บ", "คะแนนระหว่างเรียน", "เก็บ", "ระหว่างเรียน", "คะแนนเก็บระหว่างภาค",
    "คะแนนระหว่างภาค", "ก่อนกลางภาค", "ก่อนปลายภาค", "งานที่มอบหมาย",
    "assignment", "assignment score", "during", "coursework", "coursework score",
  ],
  midterm_score: [
    "คะแนนสอบกลางภาค", "กลางภาค", "สอบกลางภาค", "midterm", "midterm score", "mid term", "mid-term", "midtermscore",
  ],
  final_score: [
    "คะแนนสอบปลายภาค", "ปลายภาค", "สอบปลายภาค", "final", "final score", "final exam", "finalscore",
  ],
  total_score: ["คะแนนรวม", "รวม", "รวมคะแนน", "total", "total score", "totalscore"],
  grade_point: ["ระดับคะแนน", "เกรดเฉลี่ย", "คะแนนเกรด", "gpa", "grade point", "gradepoint", "gp"],
  grade: ["ระดับผล", "ผลการเรียน", "เกรด", "ผลการประเมิน", "grade", "result"],
  reading_assessment: [
    "อ่านคิดวิเคราะห์", "การอ่านคิดวิเคราะห์", "อ่านคิดวิเคราะห์และเขียน",
    "reading", "reading assessment", "readingassessment",
  ],
  character_assessment: [
    "คุณลักษณะ", "คุณลักษณะอันพึงประสงค์", "ผลคุณลักษณะ",
    "character", "character assessment", "characterassessment",
  ],
  competency_assessment: [
    "สมรรถนะ", "สมรรถนะสำคัญ", "ผลสมรรถนะ",
    "competency", "competency assessment", "competencyassessment",
  ],
  final_result: [
    "ผลการตัดสิน", "การตัดสิน", "ผลสุดท้าย", "ผ่าน/ไม่ผ่าน",
    "result", "final result", "finalresult", "pass/fail",
  ],
};

/** ตารางสอน */
export const SCHEDULE_ALIASES: AliasMap = {
  day_of_week: ["วัน", "วันที่สอน", "day", "day of week", "dayofweek", "weekday"],
  period: ["คาบ", "คาบที่", "ชั่วโมงที่", "period", "periodno", "period no"],
  start_time: ["เวลาเริ่ม", "เวลาเริ่มต้น", "เริ่ม", "start", "start time", "starttime"],
  end_time: ["เวลาสิ้นสุด", "เวลาเลิก", "สิ้นสุด", "end", "end time", "endtime"],
  subject_code: SUBJECT_ALIASES.code,
  classroom: ["ห้อง", "ห้องเรียน", "classroom", "room"],
  teacher: ["ครูผู้สอน", "ครู", "ผู้สอน", "teacher", "instructor"],
};

// ============================================================================
// Header-row detection — สแกนแถวบนสุดของ sheet หา row ที่มี header มากสุด
// ใช้กับไฟล์ที่ column อาจสลับ/แทรกคอลัมน์ใหม่จาก template มาตรฐาน
// ============================================================================

export interface DetectedHeader {
  /** 1-based row index ที่เป็นหัวตาราง */
  rowIndex: number;
  /** map: 1-based column index → canonical field */
  colToField: Record<number, string>;
  /** map: canonical field → 1-based column index (อันแรกที่เจอ) */
  fieldToCol: Record<string, number>;
  /** จำนวน field ที่ match */
  hits: number;
}

/**
 * สแกน rows (array of array) หา header row ที่ match กับ matcher มากที่สุด
 * @param rows array 2D (จาก sheet_to_json header:1)
 * @param matcher HeaderMatcher
 * @param opts.scanRows สแกน N แถวบนสุด (default 15)
 * @param opts.minHits ต้องเจออย่างน้อย N field (default 3)
 */
export function detectHeaderRow(
  rows: any[][],
  matcher: HeaderMatcher,
  opts: { scanRows?: number; minHits?: number } = {},
): DetectedHeader | null {
  const scanRows = opts.scanRows ?? 15;
  const minHits = opts.minHits ?? 3;
  let best: DetectedHeader | null = null;
  const limit = Math.min(scanRows, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const colToField: Record<number, string> = {};
    const fieldToCol: Record<string, number> = {};
    let hits = 0;
    for (let c = 0; c < row.length; c++) {
      const f = matcher(row[c]);
      if (f) {
        colToField[c + 1] = f;
        if (fieldToCol[f] == null) fieldToCol[f] = c + 1;
        hits++;
      }
    }
    if (hits >= minHits && (!best || hits > best.hits)) {
      best = { rowIndex: r + 1, colToField, fieldToCol, hits };
    }
  }
  return best;
}

