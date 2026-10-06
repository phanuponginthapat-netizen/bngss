// แปลผลภาวะโภชนาการเด็กวัยเรียน 5–18 ปี ด้วย BMI ตามอายุและเพศ
// (อ้างอิง WHO Growth Reference 2007 ที่กรมอนามัยใช้) — ผอม < -2SD, สมส่วน, ท้วม +1..+2SD, อ้วน > +2SD
type Row = [number, number, number]; // [-2SD, +1SD, +2SD]
const BOYS: Record<number, Row> = {
  5: [12.1, 16.6, 18.3], 6: [12.1, 16.8, 18.5], 7: [12.3, 17.0, 19.0], 8: [12.4, 17.4, 19.7],
  9: [12.6, 17.9, 20.5], 10: [12.8, 18.5, 21.4], 11: [13.1, 19.2, 22.5], 12: [13.4, 19.9, 23.6],
  13: [13.8, 20.8, 24.8], 14: [14.3, 21.8, 25.9], 15: [14.7, 22.7, 27.0], 16: [15.1, 23.5, 27.9],
  17: [15.4, 24.3, 28.6], 18: [15.7, 24.9, 29.2],
};
const GIRLS: Record<number, Row> = {
  5: [11.8, 16.9, 18.9], 6: [11.7, 17.0, 19.2], 7: [11.8, 17.3, 19.8], 8: [12.1, 17.7, 20.6],
  9: [12.4, 18.3, 21.5], 10: [12.8, 19.0, 22.6], 11: [13.2, 19.9, 23.7], 12: [13.8, 20.8, 25.0],
  13: [14.3, 21.8, 26.2], 14: [14.8, 22.7, 27.3], 15: [15.2, 23.5, 28.2], 16: [15.4, 24.1, 28.9],
  17: [15.6, 24.5, 29.3], 18: [15.7, 24.8, 29.5],
};

export type NutritionStatus = "ผอม" | "สมส่วน" | "ท้วม" | "อ้วน";

export function ageInYears(dob: string | null | undefined, at: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  let y = d.getFullYear();
  if (y > 2400) y -= 543; // ปี พ.ศ.
  const birth = new Date(y, d.getMonth(), d.getDate());
  return (at.getTime() - birth.getTime()) / (365.25 * 86400000);
}

export function isFemale(g: string | null | undefined): boolean {
  return !!g && /^(f|female|หญิง|ญ|เด็กหญิง|นางสาว)/i.test(g.trim());
}

/** คืน null ถ้าอายุนอกช่วง 5–18 ปี หรือข้อมูลไม่พอ */
export function classifyChildBmi(bmi: number, ageYears: number | null, female: boolean): NutritionStatus | null {
  if (!Number.isFinite(bmi) || ageYears == null || ageYears < 5 || ageYears >= 19) return null;
  const t = female ? GIRLS : BOYS;
  const lo = Math.min(18, Math.floor(ageYears));
  const hi = Math.min(18, lo + 1);
  const f = Math.min(1, ageYears - lo);
  const r = t[lo].map((v, i) => v + (t[hi][i] - v) * f) as Row;
  if (bmi < r[0]) return "ผอม";
  if (bmi > r[2]) return "อ้วน";
  if (bmi > r[1]) return "ท้วม";
  return "สมส่วน";
}

export const NUTRITION_CLS: Record<NutritionStatus, string> = {
  "ผอม": "bg-orange-100 text-orange-800",
  "สมส่วน": "bg-green-100 text-green-800",
  "ท้วม": "bg-yellow-100 text-yellow-800",
  "อ้วน": "bg-red-100 text-red-800",
};
