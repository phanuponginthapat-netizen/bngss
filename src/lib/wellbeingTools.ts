// ─────────────────────────────────────────────────────────────
// เครื่องมือประเมินสุขภาพจิตนักเรียน (อ้างอิงกรมสุขภาพจิต กระทรวงสาธารณสุข)
// 2Q คัดกรองซึมเศร้า / 9Q ประเมินโรคซึมเศร้า / 8Q ประเมินการฆ่าตัวตาย / ST-5 ความเครียด
// ─────────────────────────────────────────────────────────────

export type MentalTool = "2Q" | "9Q" | "8Q" | "ST5";

export type RiskLevel = "normal" | "mild" | "moderate" | "severe";

export const RISK_META: Record<RiskLevel, { label: string; color: string; badge: string; emoji: string }> = {
  normal: { label: "ปกติ / ไม่มีความเสี่ยง", color: "text-emerald-600", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", emoji: "😊" },
  mild: { label: "เฝ้าระวังเล็กน้อย", color: "text-amber-600", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300", emoji: "🙂" },
  moderate: { label: "ควรได้รับการดูแล", color: "text-orange-600", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300", emoji: "😟" },
  severe: { label: "เสี่ยงสูง ต้องช่วยเหลือด่วน", color: "text-red-600", badge: "bg-red-500/15 text-red-700 dark:text-red-300", emoji: "🚨" },
};

export interface MentalQuestion {
  id: string;
  text: string;
  /** ตัวเลือก: label + คะแนน */
  options: { label: string; value: number }[];
}

export interface MentalToolDef {
  key: MentalTool;
  name: string;
  short: string;
  source: string;
  intro: string;
  durationMin: number;
  questions: MentalQuestion[];
  interpret: (score: number) => { level: RiskLevel; text: string; advice: string };
}

const YES_NO = (yes = 1) => [
  { label: "ไม่มี / ไม่ใช่", value: 0 },
  { label: "มี / ใช่", value: yes },
];

const FREQ4 = [
  { label: "ไม่มีเลย", value: 0 },
  { label: "เป็นบางวัน (1-7 วัน)", value: 1 },
  { label: "เป็นบ่อย (>7 วัน)", value: 2 },
  { label: "เป็นทุกวัน", value: 3 },
];

const STRESS4 = [
  { label: "แทบไม่มี", value: 0 },
  { label: "เป็นบางครั้ง", value: 1 },
  { label: "บ่อยครั้ง", value: 2 },
  { label: "เป็นประจำ", value: 3 },
];

export const TOOL_2Q: MentalToolDef = {
  key: "2Q",
  name: "แบบคัดกรองภาวะซึมเศร้า 2Q",
  short: "2Q",
  source: "กรมสุขภาพจิต กระทรวงสาธารณสุข",
  intro: "คำถามสั้น ๆ 2 ข้อ ใช้เวลาไม่ถึง 1 นาที เพื่อดูว่าช่วง 2 สัปดาห์ที่ผ่านมาเราโอเคไหม",
  durationMin: 1,
  questions: [
    { id: "q1", text: "ใน 2 สัปดาห์ที่ผ่านมา รู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวังหรือไม่", options: YES_NO() },
    { id: "q2", text: "ใน 2 สัปดาห์ที่ผ่านมา รู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลินหรือไม่", options: YES_NO() },
  ],
  interpret: (s) =>
    s === 0
      ? { level: "normal", text: "ไม่พบสัญญาณของภาวะซึมเศร้า", advice: "ดูแลตัวเองต่อไป นอนให้พอ ออกกำลังกาย และพูดคุยกับคนที่ไว้ใจ" }
      : { level: "mild", text: "พบสัญญาณเบื้องต้น ควรทำแบบประเมิน 9Q ต่อ", advice: "ลองทำแบบประเมิน 9Q เพื่อดูรายละเอียด และคุยกับครูที่ปรึกษาได้เสมอ" },
};

export const TOOL_9Q: MentalToolDef = {
  key: "9Q",
  name: "แบบประเมินโรคซึมเศร้า 9Q",
  short: "9Q",
  source: "กรมสุขภาพจิต กระทรวงสาธารณสุข",
  intro: "9 ข้อ เกี่ยวกับความรู้สึกใน 2 สัปดาห์ที่ผ่านมา ตอบตามความจริง ไม่มีถูกผิด",
  durationMin: 3,
  questions: [
    { id: "q1", text: "เบื่อ ไม่สนใจอยากทำอะไร", options: FREQ4 },
    { id: "q2", text: "ไม่สบายใจ ซึมเศร้า ท้อแท้", options: FREQ4 },
    { id: "q3", text: "หลับยาก หลับ ๆ ตื่น ๆ หรือหลับมากไป", options: FREQ4 },
    { id: "q4", text: "เหนื่อยง่าย ไม่ค่อยมีแรง", options: FREQ4 },
    { id: "q5", text: "เบื่ออาหาร หรือกินมากเกินไป", options: FREQ4 },
    { id: "q6", text: "รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว หรือทำให้คนอื่นผิดหวัง", options: FREQ4 },
    { id: "q7", text: "สมาธิไม่ดี เวลาเรียนหรือทำสิ่งที่ต้องใช้ความตั้งใจ", options: FREQ4 },
    { id: "q8", text: "พูด/ทำอะไรช้าลงจนคนอื่นสังเกตได้ หรือกระสับกระส่ายมากกว่าปกติ", options: FREQ4 },
    { id: "q9", text: "คิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงดี", options: FREQ4 },
  ],
  interpret: (s) => {
    if (s < 7) return { level: "normal", text: "ไม่มีอาการซึมเศร้า", advice: "รักษาสมดุลชีวิต พักผ่อนให้พอ และทำกิจกรรมที่ชอบ" };
    if (s <= 12) return { level: "mild", text: "มีอาการซึมเศร้าระดับน้อย", advice: "พูดคุยกับครูที่ปรึกษา/ผู้ปกครอง และทำแบบประเมิน 8Q เพิ่มเติม" };
    if (s <= 18) return { level: "moderate", text: "มีอาการซึมเศร้าระดับปานกลาง", advice: "ควรพบครูแนะแนวหรือพยาบาลโรงเรียนเพื่อประเมินเพิ่มเติม และทำ 8Q" };
    return { level: "severe", text: "มีอาการซึมเศร้าระดับรุนแรง", advice: "ควรพบแพทย์/นักจิตวิทยาโดยเร็ว โทรสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชม." };
  },
};

export const TOOL_8Q: MentalToolDef = {
  key: "8Q",
  name: "แบบประเมินการฆ่าตัวตาย 8Q",
  short: "8Q",
  source: "กรมสุขภาพจิต กระทรวงสาธารณสุข",
  intro: "8 ข้อ เกี่ยวกับความคิดในระยะ 1 เดือนที่ผ่านมา ข้อมูลถูกเก็บเป็นความลับ",
  durationMin: 2,
  questions: [
    { id: "q1", text: "คิดอยากตาย หรือคิดว่าถ้าตายไปคงจะดี", options: YES_NO(1) },
    { id: "q2", text: "อยากทำร้ายตัวเอง หรือทำให้ตัวเองบาดเจ็บ", options: YES_NO(2) },
    { id: "q3", text: "คิดเกี่ยวกับการฆ่าตัวตาย", options: YES_NO(6) },
    { id: "q4", text: "เมื่อคิดเรื่องนี้ รู้สึกว่าควบคุมความคิดไม่ได้", options: YES_NO(8) },
    { id: "q5", text: "มีแผนการที่จะฆ่าตัวตาย", options: YES_NO(9) },
    { id: "q6", text: "ได้เตรียมการที่จะทำร้ายตนเองหรือฆ่าตัวตาย", options: YES_NO(10) },
    { id: "q7", text: "ใน 1 เดือนที่ผ่านมา ได้ทำร้ายตนเองโดยตั้งใจให้ตาย แต่ไม่สำเร็จ", options: YES_NO(10) },
    { id: "q8", text: "ตลอดชีวิตที่ผ่านมา เคยพยายามฆ่าตัวตาย", options: YES_NO(4) },
  ],
  interpret: (s) => {
    if (s === 0) return { level: "normal", text: "ไม่มีแนวโน้มการฆ่าตัวตาย", advice: "ดูแลจิตใจตัวเองต่อไป และอย่าลังเลที่จะขอความช่วยเหลือเมื่อรู้สึกแย่" };
    if (s <= 8) return { level: "mild", text: "มีแนวโน้มระดับน้อย", advice: "ควรพูดคุยกับครูแนะแนว/ผู้ปกครอง และมีคนอยู่ใกล้ชิด" };
    if (s <= 16) return { level: "moderate", text: "มีแนวโน้มระดับปานกลาง", advice: "ควรได้รับการดูแลจากครูแนะแนวและส่งต่อบุคลากรสาธารณสุขทันที" };
    return { level: "severe", text: "มีแนวโน้มระดับรุนแรง", advice: "ต้องได้รับการช่วยเหลือเร่งด่วน โทร 1323 หรือแจ้งครู/ผู้ปกครองทันที ห้ามอยู่คนเดียว" };
  },
};

export const TOOL_ST5: MentalToolDef = {
  key: "ST5",
  name: "แบบประเมินความเครียด ST-5",
  short: "ST-5",
  source: "กรมสุขภาพจิต กระทรวงสาธารณสุข",
  intro: "5 ข้อ วัดความเครียดใน 2-4 สัปดาห์ที่ผ่านมา ใช้เวลาไม่ถึง 2 นาที",
  durationMin: 2,
  questions: [
    { id: "q1", text: "มีปัญหาการนอน นอนไม่หลับ หรือนอนมากเกินไป", options: STRESS4 },
    { id: "q2", text: "มีสมาธิน้อยลง", options: STRESS4 },
    { id: "q3", text: "หงุดหงิด กระวนกระวาย ว้าวุ่นใจ", options: STRESS4 },
    { id: "q4", text: "รู้สึกเบื่อ เซ็ง", options: STRESS4 },
    { id: "q5", text: "ไม่อยากพบปะผู้คน", options: STRESS4 },
  ],
  interpret: (s) => {
    if (s <= 4) return { level: "normal", text: "เครียดน้อย", advice: "ระดับความเครียดปกติ ใช้ชีวิตได้ตามปกติ" };
    if (s <= 7) return { level: "mild", text: "เครียดปานกลาง", advice: "ลองผ่อนคลาย ออกกำลังกาย และจัดเวลาพักให้ชัดเจน" };
    if (s <= 9) return { level: "moderate", text: "เครียดมาก", advice: "ควรปรึกษาครูแนะแนว และฝึกหายใจคลายเครียดวันละ 10 นาที" };
    return { level: "severe", text: "เครียดมากที่สุด", advice: "ควรพบผู้เชี่ยวชาญด้านสุขภาพจิต หรือโทรสายด่วน 1323" };
  },
};

export const MENTAL_TOOLS: MentalToolDef[] = [TOOL_2Q, TOOL_9Q, TOOL_8Q, TOOL_ST5];
export const getTool = (k: string) => MENTAL_TOOLS.find((t) => t.key === k);
export const maxScore = (t: MentalToolDef) =>
  t.questions.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.value)), 0);

// ─────────────────────────────────────────────────────────────
// แบบวัดแววความสามารถ/แววอาชีพ — พหุปัญญา 8 ด้าน
// อ้างอิงแนวทางการวัดแววความสามารถพิเศษ สพฐ. กระทรวงศึกษาธิการ
// ─────────────────────────────────────────────────────────────

export type AptitudeKey =
  | "linguistic" | "logical" | "spatial" | "musical"
  | "bodily" | "interpersonal" | "intrapersonal" | "naturalist";

export interface AptitudeArea {
  key: AptitudeKey;
  name: string;
  emoji: string;
  desc: string;
  careers: string[];
  color: string;
}

export const APTITUDE_AREAS: AptitudeArea[] = [
  { key: "linguistic", name: "ด้านภาษา", emoji: "📚", desc: "ชอบอ่าน เขียน เล่าเรื่อง ใช้คำได้ดี", color: "#6366f1",
    careers: ["ครูภาษา", "นักเขียน/นักข่าว", "นักกฎหมาย", "ล่าม/นักแปล", "ประชาสัมพันธ์"] },
  { key: "logical", name: "ด้านตรรกะ-คณิตศาสตร์", emoji: "🔢", desc: "ชอบคิดวิเคราะห์ ตัวเลข และแก้ปัญหา", color: "#0ea5e9",
    careers: ["วิศวกร", "นักวิทยาศาสตร์ข้อมูล", "โปรแกรมเมอร์", "นักบัญชี", "นักวิจัย"] },
  { key: "spatial", name: "ด้านมิติสัมพันธ์-ศิลปะ", emoji: "🎨", desc: "จินตนาการภาพเก่ง ชอบวาด ออกแบบ", color: "#f59e0b",
    careers: ["สถาปนิก", "กราฟิกดีไซเนอร์", "ช่างภาพ", "แอนิเมเตอร์", "มัณฑนากร"] },
  { key: "musical", name: "ด้านดนตรี", emoji: "🎵", desc: "ไวต่อจังหวะ เสียง ทำนอง", color: "#ec4899",
    careers: ["นักดนตรี", "ครูดนตรี", "นักร้อง", "ซาวด์เอนจิเนียร์", "โปรดิวเซอร์เพลง"] },
  { key: "bodily", name: "ด้านร่างกาย-การเคลื่อนไหว", emoji: "🤸", desc: "ใช้ร่างกายคล่องแคล่ว ชอบลงมือทำ", color: "#10b981",
    careers: ["นักกีฬา", "ครูพลศึกษา", "นักกายภาพบำบัด", "ช่างเทคนิค", "นักแสดง/นาฏศิลป์"] },
  { key: "interpersonal", name: "ด้านมนุษยสัมพันธ์", emoji: "🤝", desc: "เข้าใจผู้อื่น ทำงานเป็นทีมได้ดี", color: "#f97316",
    careers: ["ครู", "พยาบาล", "นักจิตวิทยา", "นักการตลาด", "ผู้ประกอบการ"] },
  { key: "intrapersonal", name: "ด้านเข้าใจตนเอง", emoji: "🧘", desc: "รู้จักตนเอง ตั้งเป้าหมายและวางแผนได้", color: "#8b5cf6",
    careers: ["นักเขียน", "นักวิจัย", "ที่ปรึกษา", "ผู้ประกอบการ", "นักปรัชญา/นักบวช"] },
  { key: "naturalist", name: "ด้านธรรมชาติ", emoji: "🌱", desc: "ชอบธรรมชาติ พืช สัตว์ สิ่งแวดล้อม", color: "#22c55e",
    careers: ["สัตวแพทย์", "เกษตรกรสมัยใหม่", "นักวิทยาศาสตร์สิ่งแวดล้อม", "นักอนุรักษ์", "นักโภชนาการ"] },
];

export interface AptitudeQuestion { id: string; area: AptitudeKey; text: string }

const A = (area: AptitudeKey, texts: string[]): AptitudeQuestion[] =>
  texts.map((text, i) => ({ id: `${area}_${i + 1}`, area, text }));

export const APTITUDE_QUESTIONS: AptitudeQuestion[] = [
  ...A("linguistic", ["ฉันชอบอ่านหนังสือหรือเรื่องเล่าต่าง ๆ", "ฉันเล่าเรื่องให้เพื่อนฟังได้สนุก", "ฉันชอบเขียนบันทึก เรียงความ หรือแต่งกลอน", "ฉันจำคำศัพท์ใหม่ ๆ ได้เร็ว"]),
  ...A("logical", ["ฉันชอบแก้โจทย์ปัญหาหรือเกมคิดเลข", "ฉันชอบหาเหตุผลว่าสิ่งต่าง ๆ ทำงานอย่างไร", "ฉันจัดหมวดหมู่ข้อมูลได้เป็นระบบ", "ฉันสนุกกับการทดลองวิทยาศาสตร์"]),
  ...A("spatial", ["ฉันชอบวาดรูปหรือออกแบบสิ่งของ", "ฉันนึกภาพสิ่งที่ยังไม่เห็นได้ชัดเจน", "ฉันสังเกตสี รูปทรง และรายละเอียดได้ดี", "ฉันชอบต่อโมเดล จิ๊กซอว์ หรือแผนที่"]),
  ...A("musical", ["ฉันร้องเพลงหรือเล่นดนตรีได้ตรงจังหวะ", "ฉันจำทำนองเพลงได้ง่าย", "ฉันชอบฟังเพลงขณะทำงาน", "ฉันแยกเสียงเครื่องดนตรีต่าง ๆ ได้"]),
  ...A("bodily", ["ฉันชอบเล่นกีฬาหรือกิจกรรมที่ได้เคลื่อนไหว", "ฉันเรียนรู้ได้ดีเมื่อได้ลงมือทำจริง", "ฉันใช้มือประดิษฐ์สิ่งของได้คล่อง", "ฉันเต้นหรือแสดงท่าทางได้ดี"]),
  ...A("interpersonal", ["ฉันเข้ากับเพื่อนใหม่ได้ง่าย", "เพื่อนมักมาปรึกษาปัญหากับฉัน", "ฉันชอบทำงานกลุ่มมากกว่าทำคนเดียว", "ฉันสังเกตอารมณ์ความรู้สึกของคนอื่นได้"]),
  ...A("intrapersonal", ["ฉันรู้ว่าตัวเองถนัดและไม่ถนัดอะไร", "ฉันตั้งเป้าหมายและวางแผนให้ตัวเองได้", "ฉันชอบมีเวลาอยู่กับตัวเองเพื่อคิดทบทวน", "ฉันควบคุมอารมณ์ตัวเองได้ดี"]),
  ...A("naturalist", ["ฉันชอบปลูกต้นไม้หรือเลี้ยงสัตว์", "ฉันสนใจเรื่องสิ่งแวดล้อมและการอนุรักษ์", "ฉันแยกชนิดพืช/สัตว์ได้หลายชนิด", "ฉันชอบทำกิจกรรมกลางแจ้งในธรรมชาติ"]),
];

export const APTITUDE_SCALE = [
  { label: "ไม่ใช่ฉันเลย", value: 1, emoji: "😐" },
  { label: "ไม่ค่อยใช่", value: 2, emoji: "🙂" },
  { label: "ปานกลาง", value: 3, emoji: "😀" },
  { label: "ค่อนข้างใช่", value: 4, emoji: "😃" },
  { label: "ใช่เลย!", value: 5, emoji: "🤩" },
];

/** คำนวณคะแนนพหุปัญญา (0-100 ต่อด้าน) */
export function scoreAptitude(answers: Record<string, number>) {
  const scores: Record<string, number> = {};
  APTITUDE_AREAS.forEach((a) => {
    const qs = APTITUDE_QUESTIONS.filter((q) => q.area === a.key);
    const sum = qs.reduce((t, q) => t + (answers[q.id] || 0), 0);
    scores[a.key] = Math.round((sum / (qs.length * 5)) * 100);
  });
  const ranked = [...APTITUDE_AREAS].sort((a, b) => scores[b.key] - scores[a.key]);
  const topAreas = ranked.slice(0, 3).map((a) => a.key);
  const suggestedCareers = Array.from(
    new Set(ranked.slice(0, 3).flatMap((a) => a.careers.slice(0, 3))),
  );
  return { scores, topAreas, suggestedCareers };
}

export const areaMeta = (k: string) => APTITUDE_AREAS.find((a) => a.key === k);
