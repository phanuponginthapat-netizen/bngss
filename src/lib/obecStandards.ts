/**
 * มาตรฐานอ้างอิงของสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)
 *
 * อ้างอิง:
 *  - หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช 2551 (ฉบับปรับปรุง พ.ศ. 2560)
 *  - แนวปฏิบัติการวัดและประเมินผลการเรียนรู้ ตามหลักสูตรแกนกลางฯ
 *  - ระเบียบ สพฐ. ว่าด้วยเอกสารหลักฐานการศึกษา (ปพ.1 – ปพ.8)
 *  - แบบประเมิน SDQ ของกรมสุขภาพจิต (ฉบับ 25 ข้อ)
 *  - มาตรฐานการประกันคุณภาพการศึกษา สมศ. รอบสี่/รอบห้า
 *
 * ใช้เป็น Single Source of Truth ให้ส่วนต่าง ๆ ของระบบ
 * (วิชา / ปพ. / เกรด / คุณลักษณะ / SDQ / SMSC) ดึงไปอ้างอิงตรงกัน
 */

// ─── 1) 8 กลุ่มสาระการเรียนรู้ ──────────────────────────────────
export interface SubjectGroup {
  code: string;
  key:
    | "thai" | "math" | "science" | "social"
    | "health" | "art" | "career" | "foreign";
  name: string;
  nameEn: string;
  color: string;
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { code: "ท", key: "thai",    name: "ภาษาไทย",                          nameEn: "Thai Language",        color: "bg-cat-1-soft text-cat-1" },
  { code: "ค", key: "math",    name: "คณิตศาสตร์",                        nameEn: "Mathematics",          color: "bg-cat-2-soft text-cat-2" },
  { code: "ว", key: "science", name: "วิทยาศาสตร์และเทคโนโลยี",          nameEn: "Science & Technology", color: "bg-cat-3-soft text-cat-3" },
  { code: "ส", key: "social",  name: "สังคมศึกษา ศาสนา และวัฒนธรรม",     nameEn: "Social Studies",       color: "bg-cat-4-soft text-cat-4" },
  { code: "พ", key: "health",  name: "สุขศึกษาและพลศึกษา",               nameEn: "Health & PE",          color: "bg-cat-5-soft text-cat-5" },
  { code: "ศ", key: "art",     name: "ศิลปะ",                            nameEn: "Arts",                 color: "bg-cat-6-soft text-cat-6" },
  { code: "ง", key: "career",  name: "การงานอาชีพ",                      nameEn: "Occupations",          color: "bg-cat-7-soft text-cat-7" },
  { code: "อ", key: "foreign", name: "ภาษาต่างประเทศ",                   nameEn: "Foreign Languages",    color: "bg-cat-8-soft text-cat-8" },
];

/**
 * โครงสร้างรหัสวิชา สพฐ.
 * [อักษรกลุ่มสาระ][ระดับชั้น 2 หลัก][ภาคเรียน 1 หลัก][ลำดับวิชา 2 หลัก]
 * ป.1=11 … ป.6=16, ม.1=21 … ม.6=26
 * พื้นฐานเริ่ม 01, เพิ่มเติมเริ่ม 21
 */
export function gradeCodeFor(gradeLevel: number): string {
  if (gradeLevel >= 1 && gradeLevel <= 6) return `1${gradeLevel}`;
  if (gradeLevel >= 7 && gradeLevel <= 12) return `2${gradeLevel - 6}`;
  return "00";
}

export function buildSubjectCode(
  groupKey: SubjectGroup["key"],
  gradeLevel: number,
  semester: 1 | 2,
  seq: number,
  type: "พื้นฐาน" | "เพิ่มเติม" = "พื้นฐาน",
): string {
  const g = SUBJECT_GROUPS.find((s) => s.key === groupKey);
  if (!g) return "";
  const start = type === "พื้นฐาน" ? 1 : 21;
  const seqStr = String(start + seq - 1).padStart(2, "0");
  return `${g.code}${gradeCodeFor(gradeLevel)}${semester}${seqStr}`;
}

// ─── 2) เกณฑ์ระดับผลการเรียน 8 ระดับ ───────────────────────────
export interface GradeBand {
  grade: string;
  point: number;
  minPercent: number;
  meaning: string;
}

export const GRADE_BANDS: GradeBand[] = [
  { grade: "4",   point: 4.0, minPercent: 80, meaning: "ผลการเรียนดีเยี่ยม" },
  { grade: "3.5", point: 3.5, minPercent: 75, meaning: "ผลการเรียนดีมาก" },
  { grade: "3",   point: 3.0, minPercent: 70, meaning: "ผลการเรียนดี" },
  { grade: "2.5", point: 2.5, minPercent: 65, meaning: "ผลการเรียนค่อนข้างดี" },
  { grade: "2",   point: 2.0, minPercent: 60, meaning: "ผลการเรียนปานกลาง" },
  { grade: "1.5", point: 1.5, minPercent: 55, meaning: "ผลการเรียนพอใช้" },
  { grade: "1",   point: 1.0, minPercent: 50, meaning: "ผ่านเกณฑ์ขั้นต่ำ" },
  { grade: "0",   point: 0.0, minPercent:  0, meaning: "ต่ำกว่าเกณฑ์ขั้นต่ำ" },
];

export const QUALITATIVE_LEVELS = [
  { code: "3", label: "ดีเยี่ยม" },
  { code: "2", label: "ดี" },
  { code: "1", label: "ผ่าน" },
  { code: "0", label: "ไม่ผ่าน" },
] as const;

export const ACTIVITY_RESULT = [
  { code: "ผ",  label: "ผ่าน" },
  { code: "มผ", label: "ไม่ผ่าน" },
] as const;

// ─── 3) คุณลักษณะอันพึงประสงค์ 8 ข้อ ───────────────────────────
export const DESIRABLE_CHARACTERISTICS = [
  { no: 1, name: "รักชาติ ศาสน์ กษัตริย์" },
  { no: 2, name: "ซื่อสัตย์สุจริต" },
  { no: 3, name: "มีวินัย" },
  { no: 4, name: "ใฝ่เรียนรู้" },
  { no: 5, name: "อยู่อย่างพอเพียง" },
  { no: 6, name: "มุ่งมั่นในการทำงาน" },
  { no: 7, name: "รักความเป็นไทย" },
  { no: 8, name: "มีจิตสาธารณะ" },
] as const;

// ─── 4) สมรรถนะสำคัญของผู้เรียน 5 ด้าน ─────────────────────────
export const KEY_COMPETENCIES = [
  { no: 1, name: "ความสามารถในการสื่อสาร" },
  { no: 2, name: "ความสามารถในการคิด" },
  { no: 3, name: "ความสามารถในการแก้ปัญหา" },
  { no: 4, name: "ความสามารถในการใช้ทักษะชีวิต" },
  { no: 5, name: "ความสามารถในการใช้เทคโนโลยี" },
] as const;

// ─── 5) อ่าน คิดวิเคราะห์ และเขียน ─────────────────────────────
export const READ_THINK_WRITE_STANDARDS = [
  "อ่านเพื่อหาข้อมูลสารสนเทศ เสริมประสบการณ์ และเพื่อการเรียนรู้",
  "จับใจความสำคัญ ลำดับเหตุการณ์ วิเคราะห์เรื่องที่อ่าน",
  "สรุป แสดงความคิดเห็น ตัดสินคุณค่าจากเรื่องที่อ่าน",
  "ถ่ายทอดความเข้าใจ ความคิดเห็น คุณค่าจากเรื่องที่อ่านโดยการเขียน",
  "เขียนสื่อสารตรงตามวัตถุประสงค์ ถูกต้องตามรูปแบบและกาลเทศะ",
] as const;

// ─── 6) เอกสารหลักฐานการศึกษา ปพ.1 – ปพ.8 ──────────────────────
export interface PpDoc {
  code: string;
  name: string;
  purpose: string;
  isOfficial: boolean;
  variants?: string[];
}

export const PP_DOCUMENTS: PpDoc[] = [
  { code: "ปพ.1", name: "ระเบียนแสดงผลการเรียน",                       purpose: "บันทึกผลการเรียนรายปี/ภาค ตลอดหลักสูตร",       isOfficial: true,  variants: ["ปพ.1:ป", "ปพ.1:บ", "ปพ.1:พ"] },
  { code: "ปพ.2", name: "ประกาศนียบัตร",                               purpose: "หลักฐานสำเร็จการศึกษา ป.6 / ม.3 / ม.6",         isOfficial: true,  variants: ["ปพ.2:ป", "ปพ.2:บ"] },
  { code: "ปพ.3", name: "แบบรายงานผู้สำเร็จการศึกษา",                  purpose: "รายงานผู้สำเร็จการศึกษาส่งเขต/สพฐ.",            isOfficial: true,  variants: ["ปพ.3:ป", "ปพ.3:บ", "ปพ.3:พ"] },
  { code: "ปพ.4", name: "แบบบันทึกผลการพัฒนาคุณลักษณะอันพึงประสงค์", purpose: "บันทึกผลการประเมินคุณลักษณะ 8 ข้อ",            isOfficial: false },
  { code: "ปพ.5", name: "แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน",          purpose: "คะแนนเก็บ/กลางภาค/ปลายภาค + คุณลักษณะรายวิชา", isOfficial: false },
  { code: "ปพ.6", name: "สมุดรายงานผลการเรียน",                       purpose: "รายงานผลการเรียนให้ผู้ปกครอง",                  isOfficial: false },
  { code: "ปพ.7", name: "ใบรับรองผลการศึกษา",                          purpose: "ใบรับรองสำหรับนักเรียนที่ยังไม่จบหลักสูตร",     isOfficial: true },
  { code: "ปพ.8", name: "ระเบียนสะสม",                                 purpose: "ข้อมูลพัฒนาการรอบด้านของผู้เรียน",              isOfficial: false },
];

// ─── 7) SDQ — เกณฑ์กรมสุขภาพจิต ฉบับ 25 ข้อ ────────────────────
export type SdqInformant = "self" | "parent" | "teacher";
export type SdqBand = "ปกติ" | "เสี่ยง" | "มีปัญหา";

export interface SdqCutoff {
  totalDifficulties: { normalMax: number; riskMax: number };
  prosocial:         { normalMin: number; riskValue: number };
}

/**
 * เกณฑ์มาตรฐานไทย กรมสุขภาพจิต
 * - Self: นักเรียนประเมินตนเอง (อายุ 11–16)
 * - Parent / Teacher: ผู้ปกครอง / ครู ประเมิน
 */
export const SDQ_CUTOFFS: Record<SdqInformant, SdqCutoff> = {
  self:    { totalDifficulties: { normalMax: 15, riskMax: 19 }, prosocial: { normalMin: 6, riskValue: 5 } },
  parent:  { totalDifficulties: { normalMax: 13, riskMax: 16 }, prosocial: { normalMin: 4, riskValue: 3 } },
  teacher: { totalDifficulties: { normalMax: 13, riskMax: 16 }, prosocial: { normalMin: 4, riskValue: 3 } },
};

export function classifySdqTotal(
  total: number,
  informant: SdqInformant = "teacher",
): SdqBand {
  const c = SDQ_CUTOFFS[informant].totalDifficulties;
  if (total <= c.normalMax) return "ปกติ";
  if (total <= c.riskMax)   return "เสี่ยง";
  return "มีปัญหา";
}

export function classifySdqProsocial(
  score: number,
  informant: SdqInformant = "teacher",
): SdqBand {
  const c = SDQ_CUTOFFS[informant].prosocial;
  if (score >= c.normalMin) return "ปกติ";
  if (score === c.riskValue) return "เสี่ยง";
  return "มีปัญหา";
}

// ─── 8) มาตรฐานการประกันคุณภาพการศึกษา สมศ. ─────────────────────
export interface SmscStandard {
  no: number;
  name: string;
  indicators: string[];
}

export const SMSC_STANDARDS: SmscStandard[] = [
  {
    no: 1,
    name: "คุณภาพของผู้เรียน",
    indicators: [
      "ผลสัมฤทธิ์ทางวิชาการของผู้เรียน",
      "คุณลักษณะที่พึงประสงค์ของผู้เรียน",
    ],
  },
  {
    no: 2,
    name: "กระบวนการบริหารและการจัดการ",
    indicators: [
      "มีเป้าหมาย วิสัยทัศน์ และพันธกิจที่ชัดเจน",
      "มีระบบบริหารจัดการคุณภาพของสถานศึกษา",
      "ดำเนินงานพัฒนาวิชาการที่เน้นคุณภาพผู้เรียนรอบด้าน",
      "พัฒนาครูและบุคลากรให้มีความเชี่ยวชาญทางวิชาชีพ",
      "จัดสภาพแวดล้อมทางกายภาพและสังคมที่เอื้อต่อการเรียนรู้",
      "จัดระบบเทคโนโลยีสารสนเทศเพื่อสนับสนุนการบริหารและจัดการเรียนรู้",
    ],
  },
  {
    no: 3,
    name: "กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ",
    indicators: [
      "จัดการเรียนรู้ผ่านกระบวนการคิดและปฏิบัติจริง",
      "ใช้สื่อ เทคโนโลยีสารสนเทศ และแหล่งเรียนรู้ที่เอื้อต่อการเรียนรู้",
      "มีการบริหารจัดการชั้นเรียนเชิงบวก",
      "ตรวจสอบและประเมินผู้เรียนอย่างเป็นระบบและนำผลมาพัฒนา",
      "มีการแลกเปลี่ยนเรียนรู้และให้ข้อมูลสะท้อนกลับเพื่อพัฒนาการจัดการเรียนรู้",
    ],
  },
];

// ─── 9) ระดับชั้น ป.1 – ม.6 ───────────────────────────────────
export const GRADE_LEVELS: { value: number; label: string; level: "ประถม" | "มัธยมต้น" | "มัธยมปลาย" }[] = [
  { value: 1,  label: "ป.1", level: "ประถม" },
  { value: 2,  label: "ป.2", level: "ประถม" },
  { value: 3,  label: "ป.3", level: "ประถม" },
  { value: 4,  label: "ป.4", level: "ประถม" },
  { value: 5,  label: "ป.5", level: "ประถม" },
  { value: 6,  label: "ป.6", level: "ประถม" },
  { value: 7,  label: "ม.1", level: "มัธยมต้น" },
  { value: 8,  label: "ม.2", level: "มัธยมต้น" },
  { value: 9,  label: "ม.3", level: "มัธยมต้น" },
  { value: 10, label: "ม.4", level: "มัธยมปลาย" },
  { value: 11, label: "ม.5", level: "มัธยมปลาย" },
  { value: 12, label: "ม.6", level: "มัธยมปลาย" },
];

export const OBEC_VERSION = {
  curriculum: "หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 (ปรับปรุง 2560)",
  ppRegulation: "ระเบียบ สพฐ. ว่าด้วยเอกสารหลักฐานการศึกษา",
  sdqSource: "แบบประเมิน SDQ กรมสุขภาพจิต (25 ข้อ)",
  smscRound: "มาตรฐานการประกันคุณภาพการศึกษา สมศ. รอบสี่",
  lastUpdated: "2568",
} as const;
