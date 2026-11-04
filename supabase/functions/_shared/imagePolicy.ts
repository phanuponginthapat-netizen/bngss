// Daily image quotas and content rules for Lovable AI image generation in chat.
export const STAFF_IMAGE_LIMIT = 10;
export const STUDENT_IMAGE_LIMIT = 5;
const STAFF_ROLES = new Set(["admin", "teacher", "director"]);

export function dailyImageLimit(roles: string[]): number {
  return roles.some((r) => STAFF_ROLES.has(r)) ? STAFF_IMAGE_LIMIT : STUDENT_IMAGE_LIMIT;
}

// Nudity, sexual, gore and other content unsuitable for a school.
const BLOCKED = [
  "โป๊", "เปลือย", "ลามก", "อนาจาร", "ทะลึ่ง", "เซ็กซ์", "เซ็กส์", "เซ็ก", "ร่วมเพศ", "มีเพศสัมพันธ์", "อวัยวะเพศ",
  "หัวนม", "นมโต", "หน้าอกเปลือย", "ชุดชั้นใน", "บิกินี่", "ไม่ใส่เสื้อผ้า", "ไม่สวมเสื้อผ้า", "ถอดเสื้อผ้า", "ยั่วยวน", "วาบหวิว", "เสียว",
  "ศพ", "เลือดสาด", "ฆ่า", "ทรมาน", "ชำแหละ", "ยาเสพติด", "กัญชา", "ปืน", "ระเบิด",
  "nude", "nudity", "naked", "nsfw", "porn", "sex", "sexy", "erotic", "hentai", "lingerie", "bikini", "topless",
  "nipple", "boob", "breast", "genital", "penis", "vagina", "fetish", "seductive", "strip",
  "gore", "blood", "corpse", "kill", "torture", "drug", "cocaine", "weapon", "gun",
];

export function isImagePromptAllowed(prompt: string): boolean {
  const text = prompt.toLowerCase().replace(/\s+/g, "");
  return !BLOCKED.some((w) => text.includes(w.toLowerCase()));
}

export function safeImagePrompt(prompt: string): string {
  return `${prompt}\n\n(ภาพต้องเหมาะสมกับโรงเรียนและทุกวัย แต่งกายสุภาพ ไม่มีความรุนแรงหรือเนื้อหาทางเพศ)`;
}
