// เกณฑ์การจำแนกประเภทวัสดุ/ครุภัณฑ์ ตามระเบียบ สพฐ. / กระทรวงการคลัง
// ครุภัณฑ์: มูลค่า ≥ 10,000 บาท/หน่วย และอายุการใช้งาน > 1 ปี
// วัสดุ: มูลค่า < 10,000 บาท หรือสิ้นเปลือง

export interface AssetCategoryDef {
  name: string;
  group: "ครุภัณฑ์" | "วัสดุ" | "สิ่งก่อสร้าง";
  usefulLife: number; // ปี
  depreciationRate: number; // %
  obecCode?: string;
}

export const ASSET_CATEGORIES_FULL: AssetCategoryDef[] = [
  // ครุภัณฑ์ (มูลค่า ≥ 10,000)
  { name: "ครุภัณฑ์สำนักงาน", group: "ครุภัณฑ์", usefulLife: 8, depreciationRate: 12.5, obecCode: "7110" },
  { name: "ครุภัณฑ์คอมพิวเตอร์", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7440" },
  { name: "ครุภัณฑ์การศึกษา", group: "ครุภัณฑ์", usefulLife: 8, depreciationRate: 12.5, obecCode: "7110" },
  { name: "ครุภัณฑ์งานบ้านงานครัว", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7210" },
  { name: "ครุภัณฑ์ยานพาหนะและขนส่ง", group: "ครุภัณฑ์", usefulLife: 8, depreciationRate: 12.5, obecCode: "7320" },
  { name: "ครุภัณฑ์โฆษณาและเผยแพร่", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7440" },
  { name: "ครุภัณฑ์ไฟฟ้าและวิทยุ", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7430" },
  { name: "ครุภัณฑ์วิทยาศาสตร์และการแพทย์", group: "ครุภัณฑ์", usefulLife: 8, depreciationRate: 12.5, obecCode: "7420" },
  { name: "ครุภัณฑ์กีฬา", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7460" },
  { name: "ครุภัณฑ์ก่อสร้าง", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7110" },
  { name: "ครุภัณฑ์โรงงาน", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7110" },
  { name: "ครุภัณฑ์สำรวจ", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7110" },
  { name: "ครุภัณฑ์ดนตรี", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7110" },
  { name: "ครุภัณฑ์การเกษตร", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20, obecCode: "7110" },
  { name: "ครุภัณฑ์อื่นๆ", group: "ครุภัณฑ์", usefulLife: 5, depreciationRate: 20 },
  // สิ่งก่อสร้าง
  { name: "อาคาร/สิ่งก่อสร้าง", group: "สิ่งก่อสร้าง", usefulLife: 25, depreciationRate: 4 },
  // วัสดุ
  { name: "วัสดุสำนักงาน", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุการศึกษา", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุงานบ้านงานครัว", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุไฟฟ้าและวิทยุ", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุก่อสร้าง", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุคอมพิวเตอร์", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุการเกษตร", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุเชื้อเพลิงและหล่อลื่น", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุวิทยาศาสตร์และการแพทย์", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุกีฬา", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุยานพาหนะ", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
  { name: "วัสดุอื่นๆ", group: "วัสดุ", usefulLife: 1, depreciationRate: 100 },
];

export const ASSET_CATEGORIES = ASSET_CATEGORIES_FULL.map((c) => c.name);

export const getCategoryDef = (name: string): AssetCategoryDef | undefined =>
  ASSET_CATEGORIES_FULL.find((c) => c.name === name);

export const BUDGET_SOURCES = [
  "เงินอุดหนุนรายหัว",
  "เงินอุดหนุนปัจจัยพื้นฐาน",
  "เงินงบประมาณ (รายจ่ายลงทุน)",
  "เงินรายได้สถานศึกษา",
  "เงินบริจาค",
  "เงินอื่นๆ",
];
