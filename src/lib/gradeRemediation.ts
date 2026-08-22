export const GRADE_REMEDIATION_TYPES = ["0", "ร", "มส", "มผ"] as const;
export type RemediationGrade = typeof GRADE_REMEDIATION_TYPES[number];
export const REMEDIATION_STATUS = ["ติด", "ประกาศแล้ว", "กำลังแก้", "รอสอบแก้", "ผ่าน", "ไม่ผ่าน"] as const;
export type RemediationStatus = typeof REMEDIATION_STATUS[number];

export const STATUS_COLOR: Record<RemediationStatus, string> = {
  "ติด": "bg-red-100 text-red-700 border-red-200",
  "ประกาศแล้ว": "bg-amber-100 text-amber-700 border-amber-200",
  "กำลังแก้": "bg-sky-100 text-sky-700 border-sky-200",
  "รอสอบแก้": "bg-violet-100 text-violet-700 border-violet-200",
  "ผ่าน": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "ไม่ผ่าน": "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const GRADE_LABEL: Record<RemediationGrade, string> = {
  "0": "0 (ตก)",
  "ร": "ร (รอตัดสิน)",
  "มส": "มส (ไม่ส่งงาน)",
  "มผ": "มผ (ไม่ผ่านกิจกรรม)",
};

export function isPassingGrade(g: string | null | undefined): boolean {
  if (!g) return false;
  return !GRADE_REMEDIATION_TYPES.includes(g as RemediationGrade);
}

export function canAnnounce(status: string): boolean { return status === "ติด"; }
export function canFix(status: string): boolean { return ["ประกาศแล้ว", "กำลังแก้", "รอสอบแก้", "ไม่ผ่าน"].includes(status); }
