// Shared password policy. Used by FirstLoginSetup, admin password reset, and any future change-password UI.
// Aligned with Lovable Cloud auth minimum + school requirements.

export interface PasswordRuleResult {
  id: string;
  label: string;
  labelEn: string;
  passed: boolean;
  required: boolean;
}

export interface PasswordCheck {
  valid: boolean;       // all required rules pass
  score: 0 | 1 | 2 | 3 | 4; // strength meter
  rules: PasswordRuleResult[];
  strengthLabel: { th: string; en: string };
}

export interface PolicyContext {
  /** values the password MUST NOT equal/contain (case-insensitive) — e.g. username, email, staff_code */
  forbidden?: string[];
}

export const PASSWORD_RULES_DESC = {
  th: [
    "อย่างน้อย 8 ตัวอักษร",
    "มีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว",
    "มีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว",
    "มีตัวเลข (0-9) อย่างน้อย 1 ตัว",
    
    "แนะนำ: ใส่อักขระพิเศษ (!@#$%) เพื่อความปลอดภัยสูงสุด",
  ],
  en: [
    "At least 8 characters",
    "Contains at least one uppercase letter (A-Z)",
    "Contains at least one lowercase letter (a-z)",
    "Contains at least one digit (0-9)",
    
    "Recommended: include a special character (!@#$%)",
  ],
};


export function checkPassword(pwd: string, _ctx: PolicyContext = {}): PasswordCheck {
  const p = pwd || "";
  const hasLen = p.length >= 8;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  const hasSymbol = /[^A-Za-z0-9]/.test(p);

  const rules: PasswordRuleResult[] = [
    { id: "len",    label: "อย่างน้อย 8 ตัวอักษร",                        labelEn: "At least 8 characters",                  passed: hasLen,    required: true },
    { id: "upper",  label: "มีตัวพิมพ์ใหญ่ (A-Z)",                         labelEn: "Includes uppercase letter (A-Z)",        passed: hasUpper,  required: true },
    { id: "lower",  label: "มีตัวพิมพ์เล็ก (a-z)",                          labelEn: "Includes lowercase letter (a-z)",        passed: hasLower,  required: true },
    { id: "digit",  label: "มีตัวเลข (0-9)",                                labelEn: "Includes a digit (0-9)",                  passed: hasDigit,  required: true },
    { id: "symbol", label: "มีอักขระพิเศษ (!@#$%) — แนะนำ",                labelEn: "Includes a special character — recommended", passed: hasSymbol, required: false },
  ];

  const requiredPassed = rules.filter((r) => r.required).every((r) => r.passed);
  const strengthCount = [hasLen, hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  const score = (Math.max(0, Math.min(4, strengthCount - 2)) as 0 | 1 | 2 | 3 | 4);
  const strengthLabel =
    score <= 1 ? { th: "อ่อนแอ", en: "Weak" } :
    score === 2 ? { th: "พอใช้", en: "Fair" } :
    score === 3 ? { th: "ดี", en: "Good" } :
                  { th: "แข็งแรงมาก", en: "Strong" };

  return { valid: requiredPassed, score, rules, strengthLabel };
}

/** Generate a temp password that satisfies the policy. */
export function generateTempPassword(seed: string): string {
  // Pattern: Teacher@<seed><2-digit random>
  // Ensures: 8+ chars, uppercase 'T', lowercase, digits, symbol '@'
  const cleanSeed = (seed || "user").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "user";
  const random = String(Math.floor(10 + Math.random() * 90));
  return `Teacher@${cleanSeed}${random}`;
}
