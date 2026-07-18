// Shared header normalization & alias matching for all import flows.
// Goal: รับหัวตาราง Excel/CSV หลายแบบให้ map ไปยัง canonical field เดียวกัน
// เพื่อลดความผิดพลาดของผู้ใช้และรองรับเทมเพลตหลากหลาย (DMC, สพฐ., ตัวเอง, อังกฤษ ฯลฯ)
//
// Usage:
//   import { matchAlias, STUDENT_ALIASES } from "@/lib/importHeaders";
//   const field = matchAlias(headerCell, STUDENT_ALIASES); // → "student_code" | null

/** Normalize a header cell: strip BOM, parentheses, punctuation, spaces, digits, lowercase.
 *  Note: standalone digits and trailing digits are stripped so that "ชื่อ1", "วิชา (1)",
 *  "ห้อง 2/1" all collapse to the same canonical form. */
export function normalizeHeader(s: any): string {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\(.*?\)|（.*?）|\[.*?\]|\{.*?\}/g, "") // remove bracketed hints
    .replace(/[\s\u00A0\u200B\u200C\u200D\u2060]+/g, "") // strip all whitespace (incl. ZW)
    .replace(/[._\-\/\\:：,;'"`*#?!|~^=+<>]/g, "")  // strip punctuation
    .replace(/\d+/g, "")                            // strip digits (e.g. "วิชา1", "ป6/1")
    .toLowerCase();
}

/** Tokenize a raw header into words for token-based matching.
 *  Splits on whitespace, punctuation, parentheses, and between Thai/Latin/digit runs. */
export function tokenizeHeader(s: any): string[] {
  const raw = String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[（）()\[\]{}._\-\/\\:：,;'"`*#?!|~^=+<>]+/g, " ")
    .replace(/([\u0E00-\u0E7F]+)(\d+)/g, "$1 $2")  // Thai|digit boundary
    .replace(/(\d+)([\u0E00-\u0E7F]+)/g, "$1 $2")
    .replace(/([a-zA-Z]+)(\d+)/g, "$1 $2")
    .replace(/(\d+)([a-zA-Z]+)/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2");           // camelCase
  return raw.split(/\s+/).map(t => t.trim()).filter(Boolean);
}

/** Clean a cell value: drop parenthetical hints (e.g. "สมชาย ใจดี (ป.6/1)" → "สมชาย ใจดี"),
 *  collapse whitespace, trim dots/quotes from edges. Use on names/codes before insert. */
export function cleanCellValue(s: any): string {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\(.*?\)|（.*?）|\[.*?\]|\{.*?\}/g, " ")
    .replace(/[\u00A0\u200B\u200C\u200D\u2060]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,'"`]+|[\s.,'"`]+$/g, "")
    .trim();
}

export type AliasMap = Record<string, string[]>;

/** canonical field → list of accepted header variants (Thai + English + abbreviations).
 *  รวมคำที่คลุมเครือหลายรูปแบบจาก DMC/สพฐ./ระบบภายนอก — เพิ่มได้เรื่อยๆ */
export const STUDENT_ALIASES: AliasMap = {
  student_code: [
    "เลขประจำตัวนักเรียน", "เลขประจําตัวนักเรียน",
    "รหัสนักเรียน", "รหัสประจำตัวนักเรียน", "รหัสประจําตัวนักเรียน",
    "เลขที่นักเรียน", "เลขที่", "เลขประจำตัว", "เลขประจําตัว",
    "เลขนักเรียน", "รหัสน.ร.", "รหัสนร", "รหัสนร.", "นร.",
    "รหัสประจำตัว", "รหัสประจําตัว",
    "เลขประจำตัวผู้เรียน", "รหัสผู้เรียน",
    "student_code", "student_id", "studentcode", "studentno",
    "studentnumber", "student_no", "student_number", "code", "id",
  ],
  national_id: [
    "เลขประจำตัวประชาชน", "เลขประจําตัวประชาชน",
    "เลขบัตรประชาชน", "เลขที่บัตรประชาชน", "บัตรประชาชน",
    "เลขบัตรปชช", "เลขปชช", "เลข13หลัก",
    "หมายเลขบัตรประชาชน", "รหัสประชาชน",
    "national_id", "citizenid", "citizen_id", "nid", "idcard", "id_card",
  ],
  prefix: [
    "คำนำหน้า", "คําานําหน้า", "คำนำหน้าชื่อ", "คําานําหน้าชื่อ",
    "คำนำหน้านาม", "นำหน้า", "นําหน้า",
    "prefix", "title", "namePrefix",
  ],
  first_name: [
    "ชื่อ", "ชื่อจริง", "ชื่อตัว", "ชื่อภาษาไทย", "ชื่อนักเรียน",
    "ชื่อ(ไทย)", "ชื่อไทย",
    "firstname", "first_name", "givenname", "given_name", "name", "fname",
  ],
  last_name: [
    "นามสกุล", "สกุล", "นามสกุลภาษาไทย", "นามสกุลนักเรียน",
    "นามสกุล(ไทย)", "นามสกุลไทย",
    "lastname", "last_name", "surname", "familyname", "family_name", "lname",
  ],
  gender: ["เพศ", "เพศนักเรียน", "เพศสภาพ", "gender", "sex"],
  date_of_birth: [
    "วันเกิด", "วันเดือนปีเกิด", "วัน/เดือน/ปีเกิด", "วดป.เกิด",
    "วดปเกิด", "วันที่เกิด", "ว/ด/ปเกิด", "ว/ด/ป เกิด",
    "วันเดือนปีเกิด(พ.ศ.)", "วันเกิด(พ.ศ.)", "birthdate", "birthday",
    "dob", "date_of_birth", "dateofbirth", "birth_date",
  ],
  nationality: ["สัญชาติ", "nationality"],
  ethnicity: ["เชื้อชาติ", "ethnicity", "race"],
  religion: ["ศาสนา", "religion"],
  blood_type: ["หมู่เลือด", "หมู่โลหิต", "กรุ๊ปเลือด", "กรุ๊บเลือด", "bloodtype", "bloodgroup", "blood_type", "blood"],
  address: ["ที่อยู่", "ที่อยู่ปัจจุบัน", "ที่อยู่นักเรียน", "ที่อยู่ตามทะเบียนบ้าน", "address", "homeaddress", "home_address"],
  phone: ["โทรศัพท์", "เบอร์โทร", "เบอร์โทรศัพท์", "โทร", "เบอร์ติดต่อ", "หมายเลขโทรศัพท์", "มือถือ", "phone", "tel", "mobile", "telephone", "phonenumber"],
  grade_level: [
    "ระดับชั้น", "ชั้น", "ชั้นเรียน", "ชั้นปี", "ระดับ", "ชั้นที่เรียน",
    "ชั้นปัจจุบัน", "ระดับการศึกษา",
    "grade", "gradelevel", "grade_level", "class", "level",
  ],
  classroom: ["ห้อง", "ห้องเรียน", "ห้องที่", "ห้องที่เรียน", "ห้องปัจจุบัน", "section", "classroom", "room", "class_room"],
  email: ["อีเมล", "อีเมล์", "อีเมลล์", "อีเมลนักเรียน", "email", "e-mail", "mail", "emailaddress"],
  password: ["รหัสผ่าน", "พาสเวิร์ด", "รหัสลับ", "password", "pwd", "pass"],
  role: ["บทบาท", "สิทธิ์", "สิทธิการใช้งาน", "role", "userrole", "user_role"],
  department: ["ฝ่ายงาน", "ฝ่าย", "แผนก", "กลุ่มงาน", "department", "dept"],
  position: ["ตำแหน่ง", "ตําแหน่ง", "ตำแหน่งงาน", "position", "title"],
  academic_standing: ["วิทยฐานะ", "ขั้น", "academic_standing"],
  weight: ["น้ำหนัก", "น้ําหนัก", "นน", "นน.", "weight", "wt", "kg"],
  height: ["ส่วนสูง", "สูง", "สส", "สส.", "height", "ht", "cm"],
  birth_province: ["จังหวัดที่เกิด", "จังหวัดเกิด", "สถานที่เกิด", "จ.เกิด", "birthprovince", "birthplace", "birth_place"],
  previous_school: ["โรงเรียนเดิม", "สถานศึกษาเดิม", "รร.เดิม", "previousschool", "previous_school"],
  admission_date: ["วันที่เข้าเรียน", "วันเข้าเรียน", "วันรับเข้า", "วันเข้าศึกษา", "admissiondate", "admission_date", "enrolldate", "enroll_date"],
  status: ["สถานะ", "สถานะนักเรียน", "status", "state"],
  father_phone: ["โทรศัพท์บิดา", "เบอร์บิดา", "เบอร์โทรบิดา", "โทรบิดา", "หมายเลขโทรศัพท์ของบิดา", "หมายเลขโทรศัพท์บิดา", "เบอร์พ่อ", "fatherphone", "father_phone"],
  father_occupation: ["อาชีพบิดา", "อาชีพพ่อ", "fatheroccupation", "father_occupation"],
  father_id: ["เลขบัตรบิดา", "เลขบัตรประชาชนบิดา", "หมายเลขบัตรประชาชนบิดา", "เลขประจำตัวประชาชนบิดา", "เลขประจําตัวประชาชนบิดา", "fatherid", "father_id"],
  mother_phone: ["โทรศัพท์มารดา", "เบอร์มารดา", "เบอร์โทรมารดา", "โทรมารดา", "หมายเลขโทรศัพท์ของมารดา", "หมายเลขโทรศัพท์มารดา", "เบอร์แม่", "motherphone", "mother_phone"],
  mother_occupation: ["อาชีพมารดา", "อาชีพแม่", "motheroccupation", "mother_occupation"],
  mother_id: ["เลขบัตรมารดา", "เลขบัตรประชาชนมารดา", "หมายเลขบัตรประชาชนมารดา", "เลขประจำตัวประชาชนมารดา", "เลขประจําตัวประชาชนมารดา", "motherid", "mother_id"],
  guardian_phone: ["โทรศัพท์ผู้ปกครอง", "เบอร์ผู้ปกครอง", "เบอร์โทรผู้ปกครอง", "โทรผู้ปกครอง", "หมายเลขโทรศัพท์ของผู้ปกครอง", "หมายเลขโทรศัพท์ผู้ปกครอง", "guardianphone", "guardian_phone"],
  guardian_relation: ["ความสัมพันธ์", "ความสัมพันธ์กับนักเรียน", "ความเกี่ยวข้อง", "ความเกี่ยวข้องของผู้ปกครองกับนักเรียน", "เกี่ยวข้องเป็น", "guardianrelation", "guardian_relation", "relation", "relationship"],
};

export const PERSONNEL_ALIASES: AliasMap = {
  ...STUDENT_ALIASES,
  position: ["ตำแหน่ง", "ตำแหน่งงาน", "position", "title", "jobtitle"],
  subject_group: ["กลุ่มสาระ", "กลุ่มสาระการเรียนรู้", "วิชาเอก", "subjectgroup", "subject_group"],
  staff_code: ["รหัสบุคลากร", "รหัสครู", "รหัสพนักงาน", "เลขประจำตัวครู", "staffcode", "employee_id", "employeeid"],
  start_date: ["วันที่เริ่มงาน", "วันบรรจุ", "วันเริ่มปฏิบัติงาน", "startdate", "hiredate"],
};

export const SCORE_ALIASES: AliasMap = {
  student_code: STUDENT_ALIASES.student_code,
  national_id: STUDENT_ALIASES.national_id,
  first_name: STUDENT_ALIASES.first_name,
  last_name: STUDENT_ALIASES.last_name,
  score: ["คะแนน", "คะแนนที่ได้", "คะแนนรวม", "score", "totalscore", "points"],
  full_score: ["คะแนนเต็ม", "เต็ม", "fullscore", "maxscore"],
  grade: ["เกรด", "ผลการเรียน", "grade", "gradepoint", "gpa"],
};

/** Precompute normalized → canonical lookup. */
function buildLookup(aliases: AliasMap): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [canonical, variants] of Object.entries(aliases)) {
    map[normalizeHeader(canonical)] = canonical;
    for (const v of variants) map[normalizeHeader(v)] = canonical;
  }
  return map;
}

const LOOKUP_CACHE = new WeakMap<AliasMap, Record<string, string>>();
function lookupFor(aliases: AliasMap): Record<string, string> {
  let cached = LOOKUP_CACHE.get(aliases);
  if (!cached) {
    cached = buildLookup(aliases);
    LOOKUP_CACHE.set(aliases, cached);
  }
  return cached;
}

/** Match a header cell to a canonical field. Returns null if no confident match.
 *  Strategy:
 *   (1) exact normalized lookup
 *   (2) token-by-token exact lookup (handles concatenated headers like "ชื่อนามสกุลห้อง")
 *   (3) best-overlap substring fallback — pick the LONGEST alias whose normalized form
 *       appears in the header (or header in alias). Prevents "รหัส" (สั้น, กำกวม) จาก
 *       ชนะ "รหัสประจำตัวนักเรียน" (ยาว, ชัดเจนกว่า) */
export function matchAlias(header: any, aliases: AliasMap = STUDENT_ALIASES): string | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  const lookup = lookupFor(aliases);
  if (lookup[n]) return lookup[n];
  // Token-based exact match
  for (const tok of tokenizeHeader(header)) {
    const tn = normalizeHeader(tok);
    if (tn && lookup[tn]) return lookup[tn];
  }
  // Best-overlap substring fallback
  let bestKey = "";
  let bestCanonical: string | null = null;
  for (const [k, canonical] of Object.entries(lookup)) {
    if (k.length < 3) continue;
    const hit = n.includes(k) || (k.length >= n.length && k.includes(n));
    if (hit && k.length > bestKey.length) {
      bestKey = k;
      bestCanonical = canonical;
    }
  }
  return bestCanonical;
}

/** Map a whole row's keys to canonical field names, keeping unknown keys as-is. */
export function mapRowKeys<T = any>(
  row: Record<string, any>,
  aliases: AliasMap = STUDENT_ALIASES,
): Record<string, T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const canonical = matchAlias(k, aliases) || k;
    if (out[canonical] == null || out[canonical] === "") out[canonical] = v;
  }
  return out;
}
