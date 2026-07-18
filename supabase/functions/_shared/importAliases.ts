// Mirror of src/lib/importHeaders.ts for edge runtime.
// ใช้ normalize หัวตาราง/key ของ row จาก AI ให้เข้ากับ canonical schema fields
// เพื่อกัน AI คืน key ภาษาไทย/ตัวพิมพ์ใหญ่/เว้นวรรค แล้วถูกกรองทิ้งใน ALLOWED_TABLES filter

export type AliasMap = Record<string, string[]>;

export function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\(.*?\)|（.*?）|\[.*?\]|\{.*?\}/g, "")
    .replace(/[\s\u00A0\u200B\u200C\u200D\u2060]+/g, "")
    .replace(/[._\-\/\\:：,;'"`*#?!|~^=+<>]/g, "")
    .replace(/\d+/g, "")
    .toLowerCase();
}

export function tokenizeHeader(s: unknown): string[] {
  const raw = String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[（）()\[\]{}._\-\/\\:：,;'"`*#?!|~^=+<>]+/g, " ")
    .replace(/([\u0E00-\u0E7F]+)(\d+)/g, "$1 $2")
    .replace(/(\d+)([\u0E00-\u0E7F]+)/g, "$1 $2")
    .replace(/([a-zA-Z]+)(\d+)/g, "$1 $2")
    .replace(/(\d+)([a-zA-Z]+)/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return raw.split(/\s+/).map(t => t.trim()).filter(Boolean);
}

export function cleanCellValue(s: unknown): string {
  return String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\(.*?\)|（.*?）|\[.*?\]|\{.*?\}/g, " ")
    .replace(/[\u00A0\u200B\u200C\u200D\u2060]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,'"`]+|[\s.,'"`]+$/g, "")
    .trim();
}

export const STUDENT_ALIASES: AliasMap = {
  student_code: [
    "เลขประจำตัวนักเรียน", "รหัสนักเรียน", "รหัสประจำตัวนักเรียน", "เลขที่นักเรียน",
    "เลขประจำตัว", "เลขนักเรียน", "รหัส น.ร.", "รหัสนร",
    "studentcode", "student_id", "studentno", "studentnumber", "id",
  ],
  national_id: [
    "เลขประจำตัวประชาชน", "เลขบัตรประชาชน", "บัตรประชาชน", "เลขบัตรปชช", "เลขปชช",
    "national_id", "citizenid", "citizen_id", "nid", "idcard",
  ],
  prefix: ["คำนำหน้า", "คำนำหน้าชื่อ", "คำนำหน้านาม", "prefix", "title", "นำหน้า"],
  first_name: ["ชื่อ", "ชื่อจริง", "ชื่อตัว", "ชื่อภาษาไทย", "ชื่อนักเรียน",
    "firstname", "first_name", "givenname", "given_name", "name"],
  last_name: ["นามสกุล", "สกุล", "นามสกุลภาษาไทย", "นามสกุลนักเรียน",
    "lastname", "last_name", "surname", "familyname", "family_name"],
  gender: ["เพศ", "เพศนักเรียน", "gender", "sex"],
  date_of_birth: ["วันเกิด", "วันเดือนปีเกิด", "วัน/เดือน/ปีเกิด", "วดป.เกิด", "วันที่เกิด",
    "ว/ด/ป เกิด", "dob", "birthdate", "birthday", "date_of_birth", "dateofbirth"],
  classroom_name: ["ห้องเรียน", "ห้อง", "ห้องที่", "ชื่อห้อง", "classroom", "classroomname", "section", "room"],
  grade_level: ["ระดับชั้น", "ชั้น", "ชั้นเรียน", "ชั้นปี", "ระดับ", "grade", "gradelevel", "level", "class"],
  phone: ["โทรศัพท์", "เบอร์โทร", "เบอร์โทรศัพท์", "โทร", "เบอร์ติดต่อ", "phone", "tel", "mobile", "telephone"],
  email: ["อีเมล", "อีเมล์", "email", "e-mail", "mail"],
};

export const PERSONNEL_ALIASES: AliasMap = {
  ...STUDENT_ALIASES,
  employee_code: ["รหัสบุคลากร", "รหัสครู", "รหัสพนักงาน", "เลขประจำตัวครู",
    "employee_code", "employeecode", "staffcode", "staff_code", "employee_id", "employeeid"],
  position: ["ตำแหน่ง", "ตำแหน่งงาน", "position", "title", "jobtitle"],
  subject_group: ["กลุ่มสาระ", "กลุ่มสาระการเรียนรู้", "วิชาเอก", "subjectgroup", "subject_group"],
};

export const SUBJECT_ALIASES: AliasMap = {
  subject_code: ["รหัสวิชา", "รหัส", "subjectcode", "subject_code", "code"],
  subject_name: ["ชื่อวิชา", "วิชา", "รายวิชา", "subjectname", "subject_name", "name"],
  grade_level: STUDENT_ALIASES.grade_level,
  credits: ["หน่วยกิต", "นก", "credit", "credits"],
  subject_group: ["กลุ่มสาระ", "กลุ่มสาระการเรียนรู้", "subjectgroup", "subject_group"],
};

export const SCHEDULE_ALIASES: AliasMap = {
  day_of_week: ["วัน", "วันที่สอน", "dayofweek", "day_of_week", "day", "weekday"],
  period: ["คาบ", "คาบที่", "ชั่วโมงที่", "period", "periodno", "slot"],
  start_time: ["เวลาเริ่ม", "เริ่ม", "เวลาเริ่มต้น", "starttime", "start_time", "from"],
  end_time: ["เวลาสิ้นสุด", "สิ้นสุด", "เวลาเลิก", "endtime", "end_time", "to"],
  subject_code: SUBJECT_ALIASES.subject_code,
  subject_name: SUBJECT_ALIASES.subject_name,
  classroom_name: STUDENT_ALIASES.classroom_name,
  teacher_name: ["ครู", "ครูผู้สอน", "ชื่อครู", "ผู้สอน", "teachername", "teacher_name", "teacher"],
  academic_year: ["ปีการศึกษา", "ปี", "academicyear", "academic_year", "year"],
  semester: ["ภาคเรียน", "เทอม", "ภาค", "semester", "term"],
};

export const ATTENDANCE_ALIASES: AliasMap = {
  student_code: STUDENT_ALIASES.student_code,
  attendance_date: ["วันที่", "วันเช็คชื่อ", "วันที่เช็คชื่อ", "date", "attendancedate", "attendance_date"],
  status: ["สถานะ", "การมาเรียน", "status", "state"],
  academic_year: SCHEDULE_ALIASES.academic_year,
  semester: SCHEDULE_ALIASES.semester,
  notes: ["หมายเหตุ", "บันทึก", "notes", "note", "remark"],
};

export const NEWS_ALIASES: AliasMap = {
  title: ["หัวข้อ", "ชื่อข่าว", "เรื่อง", "title", "headline", "subject"],
  content: ["เนื้อหา", "รายละเอียด", "content", "body", "description"],
  category: ["หมวด", "หมวดหมู่", "ประเภท", "category", "type"],
  published_at: ["วันที่เผยแพร่", "วันที่ประกาศ", "publishedat", "published_at", "date"],
};

export const EVENT_ALIASES: AliasMap = {
  title: NEWS_ALIASES.title,
  description: NEWS_ALIASES.content,
  event_date: ["วันที่", "วันจัดกิจกรรม", "วันกิจกรรม", "eventdate", "event_date", "date"],
  location: ["สถานที่", "location", "place", "venue"],
};

export const TABLE_ALIAS_MAP: Record<string, AliasMap> = {
  students: STUDENT_ALIASES,
  personnel: PERSONNEL_ALIASES,
  subjects: SUBJECT_ALIASES,
  schedules: SCHEDULE_ALIASES,
  classrooms: {
    name: ["ชื่อห้อง", "ห้อง", "ห้องเรียน", "name", "classroomname"],
    grade_level: STUDENT_ALIASES.grade_level,
    capacity: ["จำนวนที่นั่ง", "ความจุ", "capacity", "max"],
    homeroom_teacher: ["ครูประจำชั้น", "homeroom", "homeroomteacher"],
  },
  attendance: ATTENDANCE_ALIASES,
  enrollments: {
    student_code: STUDENT_ALIASES.student_code,
    subject_code: SUBJECT_ALIASES.subject_code,
    classroom_name: STUDENT_ALIASES.classroom_name,
    academic_year: SCHEDULE_ALIASES.academic_year,
    semester: SCHEDULE_ALIASES.semester,
  },
  news: NEWS_ALIASES,
  school_events: EVENT_ALIASES,
};

function buildLookup(aliases: AliasMap): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [canonical, variants] of Object.entries(aliases)) {
    map[normalizeHeader(canonical)] = canonical;
    for (const v of variants || []) map[normalizeHeader(v)] = canonical;
  }
  return map;
}

const LOOKUP_CACHE = new WeakMap<AliasMap, Record<string, string>>();
function lookupFor(aliases: AliasMap): Record<string, string> {
  let c = LOOKUP_CACHE.get(aliases);
  if (!c) { c = buildLookup(aliases); LOOKUP_CACHE.set(aliases, c); }
  return c;
}

export function matchAlias(header: unknown, aliases: AliasMap): string | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  const lookup = lookupFor(aliases);
  if (lookup[n]) return lookup[n];
  for (const tok of tokenizeHeader(header)) {
    const tn = normalizeHeader(tok);
    if (tn && lookup[tn]) return lookup[tn];
  }
  for (const [k, canonical] of Object.entries(lookup)) {
    if (k.length >= 3 && (n.includes(k) || k.includes(n))) return canonical;
  }
  return null;
}

export function normalizeRowKeys(row: Record<string, unknown>, aliases: AliasMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row || {})) {
    const canonical = matchAlias(k, aliases) || k;
    if (out[canonical] == null || out[canonical] === "") out[canonical] = v;
  }
  return out;
}
