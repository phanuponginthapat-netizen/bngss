// Shared password policy — RELAXED
// รหัสผ่านตั้งอะไรก็ได้ (ขั้นต่ำ 6 ตัวอักษรตามข้อกำหนดของระบบ auth)
// กฎอื่นๆ ทั้งหมดเป็นเพียง "คำแนะนำ" ไม่บังคับ เพื่อให้เด็กจำรหัสผ่านได้ง่าย

export interface PasswordRuleResult {
  id: string;
  label: string;
  labelEn: string;
  passed: boolean;
  required: boolean;
}

export interface PasswordCheck {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  rules: PasswordRuleResult[];
  strengthLabel: { th: string; en: string };
}

export interface PolicyContext {
  forbidden?: string[];
}

// ขั้นต่ำที่ Supabase Auth ยอมรับ
const MIN_LEN = 6;

export const PASSWORD_RULES_DESC = {
  th: [
    `อย่างน้อย ${MIN_LEN} ตัวอักษร (ข้อกำหนดขั้นต่ำของระบบ)`,
    "แนะนำ: มีตัวพิมพ์ใหญ่ (A-Z)",
    "แนะนำ: มีตัวพิมพ์เล็ก (a-z)",
    "แนะนำ: มีตัวเลข (0-9)",
    "แนะนำ: มีอักขระพิเศษ (!@#$%)",
  ],
  en: [
    `At least ${MIN_LEN} characters (system minimum)`,
    "Recommended: uppercase letter (A-Z)",
    "Recommended: lowercase letter (a-z)",
    "Recommended: digit (0-9)",
    "Recommended: special character (!@#$%)",
  ],
};

export function checkPassword(pwd: string, _ctx: PolicyContext = {}): PasswordCheck {
  const p = pwd || "";
  const hasLen = p.length >= MIN_LEN;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  const hasSymbol = /[^A-Za-z0-9]/.test(p);

  const rules: PasswordRuleResult[] = [
    { id: "len",    label: `อย่างน้อย ${MIN_LEN} ตัวอักษร`,        labelEn: `At least ${MIN_LEN} characters`,             passed: hasLen,    required: true  },
    { id: "upper",  label: "มีตัวพิมพ์ใหญ่ (A-Z) — แนะนำ",           labelEn: "Uppercase letter (A-Z) — recommended",       passed: hasUpper,  required: false },
    { id: "lower",  label: "มีตัวพิมพ์เล็ก (a-z) — แนะนำ",            labelEn: "Lowercase letter (a-z) — recommended",       passed: hasLower,  required: false },
    { id: "digit",  label: "มีตัวเลข (0-9) — แนะนำ",                  labelEn: "Digit (0-9) — recommended",                  passed: hasDigit,  required: false },
    { id: "symbol", label: "มีอักขระพิเศษ (!@#$%) — แนะนำ",           labelEn: "Special character (!@#$%) — recommended",    passed: hasSymbol, required: false },
  ];

  // valid = ผ่านเฉพาะกฎที่ required (ตอนนี้เหลือแค่ len ≥ 6)
  const valid = hasLen;
  const strengthCount = [hasLen, hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  const score = (Math.max(0, Math.min(4, strengthCount - 1)) as 0 | 1 | 2 | 3 | 4);
  const strengthLabel =
    score <= 1 ? { th: "อ่อนแอ", en: "Weak" } :
    score === 2 ? { th: "พอใช้", en: "Fair" } :
    score === 3 ? { th: "ดี", en: "Good" } :
                  { th: "แข็งแรงมาก", en: "Strong" };

  return { valid, score, rules, strengthLabel };
}

/** Generate a temp password that satisfies the policy. */
export function generateTempPassword(seed: string): string {
  const cleanSeed = (seed || "user").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "user";
  const random = String(Math.floor(10 + Math.random() * 90));
  return `Teacher@${cleanSeed}${random}`;
}
