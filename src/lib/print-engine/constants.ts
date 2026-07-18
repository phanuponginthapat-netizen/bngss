/**
 * Print Engine Constants
 * ตามคู่มือการพิมพ์หนังสือราชการ สำนักนายกรัฐมนตรี (ระเบียบงานสารบรรณ พ.ศ. 2526 และฉบับที่ 4 พ.ศ. 2564)
 * หน่วยทั้งหมดเป็น mm ยกเว้นฟอนต์เป็น px (1pt เดิม ≈ 1.333px)
 */

export const PAGE = {
  width: 210,       // A4
  height: 297,
  marginTop: 30,    // 3 cm
  marginBottom: 20, // 2 cm (ไม่น้อยกว่า)
  marginLeft: 30,   // 3 cm
  marginRight: 20,  // 2 cm
} as const;

export const FONT = {
  family: "'Sarabun', sans-serif",
  body: 21,         // px (เดิม 16pt)
  emblemLabel: 39,  // px (เดิม 29pt) - ขนาดฟอนต์ "ครุฑ" ตามคู่มือ (ถ้าใช้ตัวอักษร)
  subjectLabel: 27, // px (เดิม 20pt) - หัวข้อหลัก
};

export const EMBLEM = {
  externalSize: 15,
  commandSize: 30,
  topOffset: 15,
};

export const SPACING = {
  lineHeight: 1.0,
  blankLine: 6,
  paragraphIndent: 25,
};
