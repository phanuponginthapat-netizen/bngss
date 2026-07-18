// Health & fitness calculations (BMR/TDEE/BMI/kcal burn)

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain_muscle";

export interface FitnessProfile {
  weight_kg?: number | null;
  height_cm?: number | null;
  birth_date?: string | null;
  sex?: Sex | null;
  activity_level?: ActivityLevel;
  goal?: Goal;
  target_weight_kg?: number | null;
  daily_kcal_target?: number | null;
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function ageFromBirth(birth?: string | null): number {
  if (!birth) return 12; // default to a school-age value
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return 12;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(5, age);
}

/** Mifflin–St Jeor */
export function calcBMR(p: FitnessProfile): number {
  const w = p.weight_kg ?? 50;
  const h = p.height_cm ?? 150;
  const age = ageFromBirth(p.birth_date);
  const base = 10 * w + 6.25 * h - 5 * age;
  if (p.sex === "female") return Math.round(base - 161);
  return Math.round(base + 5);
}

export function calcTDEE(p: FitnessProfile): number {
  const lvl = (p.activity_level || "moderate") as ActivityLevel;
  return Math.round(calcBMR(p) * (ACTIVITY_FACTOR[lvl] ?? 1.55));
}

export function calcDailyTarget(p: FitnessProfile): number {
  if (p.daily_kcal_target && p.daily_kcal_target > 0) return p.daily_kcal_target;
  const tdee = calcTDEE(p);
  if (p.goal === "lose") return Math.max(1200, tdee - 500);
  if (p.goal === "gain_muscle") return tdee + 300;
  return tdee;
}

export function calcBMI(p: FitnessProfile): number | null {
  if (!p.weight_kg || !p.height_cm) return null;
  const m = p.height_cm / 100;
  if (m <= 0) return null;
  return Math.round((p.weight_kg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number | null, lang: "th" | "en" = "th"): string {
  if (bmi == null) return lang === "th" ? "—" : "—";
  if (bmi < 18.5) return lang === "th" ? "น้ำหนักน้อย" : "Underweight";
  if (bmi < 23) return lang === "th" ? "ปกติ" : "Normal";
  if (bmi < 25) return lang === "th" ? "ท้วม" : "Overweight";
  if (bmi < 30) return lang === "th" ? "อ้วน" : "Obese I";
  return lang === "th" ? "อ้วนมาก" : "Obese II";
}

/** kcal burned = MET × weight(kg) × hours */
export function kcalBurned(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * weightKg * (minutes / 60));
}

export interface HealthAdvice {
  title: string;
  tips: string[];
  warning?: string;
}

export function generateAdvice(
  p: FitnessProfile,
  kcalIn: number,
  kcalOut: number,
  lang: "th" | "en" = "th",
): HealthAdvice {
  const target = calcDailyTarget(p);
  const net = kcalIn - kcalOut;
  const diff = net - target;
  const overPct = target ? diff / target : 0;

  const tipsLose = [
    "ลดของทอด/น้ำหวาน/ขนมเค้กระหว่างวัน",
    "ดื่มน้ำเปล่าก่อนมื้ออาหาร 1 แก้ว ช่วยให้อิ่มเร็ว",
    "เพิ่มผัก 1–2 ทัพพีในทุกมื้อ",
    "คาร์ดิโอ (วิ่ง/ปั่นจักรยาน) อย่างน้อย 30 นาที × 4 วัน/สัปดาห์",
    "นอนให้ครบ 7–9 ชม. ช่วยควบคุมฮอร์โมนหิว",
  ];
  const tipsGain = [
    "เพิ่มโปรตีนทุกมื้อ (ไข่/นม/อกไก่/ปลา)",
    "ฝึกเวทเทรนนิ่งกล้ามมัดใหญ่ 3–4 วัน/สัปดาห์",
    "ทานอาหารว่างหลังออกกำลังกายภายใน 30 นาที",
    "ดื่มนม/นมโปรตีน 1–2 แก้ว/วัน",
    "พักผ่อนระหว่างวันให้กล้ามเนื้อฟื้นตัวอย่างน้อย 48 ชม./กลุ่ม",
  ];
  const tipsMaintain = [
    "รักษาสมดุลแคลเข้า–ออกใกล้เคียงเป้าหมาย",
    "ทานครบ 5 หมู่ เน้นผัก ผลไม้ ธัญพืช",
    "ออกกำลังกายสม่ำเสมอ 150 นาที/สัปดาห์",
    "หลีกเลี่ยงน้ำตาลเกิน 6 ช้อนชา/วัน",
  ];
  const tipsEn = ["See Thai version"];

  let title = "";
  let tips: string[] = [];
  if (p.goal === "lose") {
    title = lang === "th" ? "แผนลดน้ำหนัก" : "Weight-loss plan";
    tips = lang === "th" ? tipsLose : tipsEn;
  } else if (p.goal === "gain_muscle") {
    title = lang === "th" ? "แผนเสริมกล้ามเนื้อ" : "Muscle-gain plan";
    tips = lang === "th" ? tipsGain : tipsEn;
  } else {
    title = lang === "th" ? "แผนรักษาสุขภาพ" : "Maintenance plan";
    tips = lang === "th" ? tipsMaintain : tipsEn;
  }

  let warning: string | undefined;
  if (overPct > 0.25) {
    warning =
      lang === "th"
        ? `วันนี้แคลเข้าเกินเป้าหมายไป ${Math.round(diff)} kcal — ลองเดิน/วิ่งเพิ่มก่อนนอน`
        : `Over target by ${Math.round(diff)} kcal today.`;
  } else if (overPct < -0.25 && p.goal !== "lose") {
    warning =
      lang === "th"
        ? `วันนี้กินน้อยกว่าเป้า ${Math.abs(Math.round(diff))} kcal — เติมอาหารว่างที่มีประโยชน์`
        : `Under target by ${Math.abs(Math.round(diff))} kcal today.`;
  }

  return { title, tips, warning };
}
