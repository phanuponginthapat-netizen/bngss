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
  "หัวนม", "นมโต", "หน้าอกเปลือย", "ชุดชั้นใน", "บิกินี่", "ไม่ใส่เสื้อผ้า", "ไม่สวมเสื้อผ้า", "ถอดเสื้อผ้า", "ยั่วยวน", "วาบหวิว",
  "ศพ", "เลือดสาด", "ฆ่าคน", "ทรมาน", "ชำแหละ", "ยาเสพติด",
  "nude", "nudity", "naked", "nsfw", "porn", "sexy", "sexual", "erotic", "hentai", "lingerie", "bikini", "topless",
  "nipple", "boob", "genital", "penis", "vagina", "fetish", "seductive", "striptease",
  "gore", "bloody", "corpse", "murder", "torture", "cocaine",
];

export function isImagePromptAllowed(prompt: string): boolean {
  const text = prompt.toLowerCase().replace(/\s+/g, "");
  return !BLOCKED.some((w) => text.includes(w.toLowerCase()));
}

export function safeImagePrompt(prompt: string): string {
  return `${prompt}\n\n(ภาพต้องเหมาะสมกับโรงเรียนและทุกวัย แต่งกายสุภาพ ไม่มีความรุนแรงหรือเนื้อหาทางเพศ)`;
}
