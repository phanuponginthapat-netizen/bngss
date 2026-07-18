// คลังเมนูอาหารกลางวันโรงเรียน อ้างอิงตามแนวทางกรมอนามัย และ Thai School Lunch (สพฐ.)
// ค่าโภชนาการต่อ 1 ที่เด็กประถม (โดยประมาณ)

export type LunchCategory = "main" | "soup" | "vegetable" | "fruit" | "milk" | "dessert";

export interface LunchMenuItem {
  id: string;
  name: string;
  category: LunchCategory;
  kcal: number;       // กิโลแคลอรี
  protein: number;    // กรัม
  fat: number;        // กรัม
  carb: number;       // กรัม
  benefits: string;   // ประโยชน์
}

export const LUNCH_CATEGORIES: Record<LunchCategory, { th: string; en: string; icon: string }> = {
  main: { th: "จานหลัก", en: "Main Dish", icon: "🍛" },
  soup: { th: "แกง/ซุป", en: "Soup", icon: "🍲" },
  vegetable: { th: "ผัก", en: "Vegetable", icon: "🥬" },
  fruit: { th: "ผลไม้", en: "Fruit", icon: "🍎" },
  milk: { th: "นม", en: "Milk", icon: "🥛" },
  dessert: { th: "ของหวาน", en: "Dessert", icon: "🍮" },
};

export const LUNCH_MENU: LunchMenuItem[] = [
  // จานหลัก
  { id: "m1", name: "ข้าวผัดไก่ใส่ไข่", category: "main", kcal: 480, protein: 22, fat: 14, carb: 65, benefits: "โปรตีนจากไก่และไข่ ช่วยเสริมการเจริญเติบโต" },
  { id: "m2", name: "ข้าวผัดหมูสับ", category: "main", kcal: 470, protein: 20, fat: 15, carb: 62, benefits: "พลังงานจากข้าว โปรตีนจากเนื้อหมู" },
  { id: "m3", name: "ข้าวราดกะเพราไก่ไข่ดาว", category: "main", kcal: 530, protein: 25, fat: 18, carb: 60, benefits: "ใบกะเพรามีสารต้านอนุมูลอิสระ" },
  { id: "m4", name: "ข้าวมันไก่", category: "main", kcal: 550, protein: 24, fat: 20, carb: 65, benefits: "โปรตีนเนื้อไก่ ย่อยง่าย" },
  { id: "m5", name: "ก๋วยเตี๋ยวน้ำหมู", category: "main", kcal: 380, protein: 18, fat: 10, carb: 55, benefits: "น้ำซุปช่วยให้ร่างกายได้รับน้ำ" },
  { id: "m6", name: "ผัดซีอิ๊วหมู/ไก่", category: "main", kcal: 460, protein: 19, fat: 14, carb: 60, benefits: "คาร์โบไฮเดรตเชิงซ้อนจากเส้น" },
  { id: "m7", name: "ข้าวหมูทอดกระเทียม", category: "main", kcal: 520, protein: 22, fat: 22, carb: 58, benefits: "กระเทียมช่วยเสริมภูมิคุ้มกัน" },
  { id: "m8", name: "ข้าวไข่เจียวหมูสับ", category: "main", kcal: 450, protein: 20, fat: 18, carb: 55, benefits: "ไข่ให้โปรตีนคุณภาพสูงและโคลีน" },
  { id: "m9", name: "ข้าวคลุกกะปิ", category: "main", kcal: 490, protein: 17, fat: 16, carb: 65, benefits: "กะปิเป็นแหล่งโปรตีนและแคลเซียม" },
  { id: "m10", name: "ข้าวหมูแดง/หมูกรอบ", category: "main", kcal: 540, protein: 23, fat: 22, carb: 60, benefits: "พลังงานสูง เหมาะกับมื้อกลางวัน" },
  { id: "m11", name: "สปาเก็ตตี้ผัดขี้เมา", category: "main", kcal: 510, protein: 20, fat: 16, carb: 70, benefits: "เส้นพาสต้าให้พลังงานยาวนาน" },
  { id: "m12", name: "ข้าวผัดกุ้ง", category: "main", kcal: 470, protein: 22, fat: 13, carb: 64, benefits: "กุ้งมีโปรตีนและไอโอดีน" },
  { id: "m13", name: "ข้าวต้มปลา", category: "main", kcal: 350, protein: 22, fat: 6, carb: 50, benefits: "ปลามีโอเมก้า-3 บำรุงสมอง" },

  // แกง/ซุป
  { id: "s1", name: "แกงจืดเต้าหู้หมูสับ", category: "soup", kcal: 120, protein: 10, fat: 5, carb: 8, benefits: "เต้าหู้ให้แคลเซียม โปรตีนจากพืช" },
  { id: "s2", name: "แกงจืดผักกาดขาว", category: "soup", kcal: 90, protein: 6, fat: 3, carb: 10, benefits: "ใยอาหารช่วยระบบขับถ่าย" },
  { id: "s3", name: "ต้มยำไก่", category: "soup", kcal: 110, protein: 12, fat: 4, carb: 8, benefits: "ข่า ตะไคร้ ใบมะกรูดมีสรรพคุณสมุนไพร" },
  { id: "s4", name: "แกงเลียงผักรวม", category: "soup", kcal: 100, protein: 5, fat: 2, carb: 14, benefits: "ผักรวม 5 สี วิตามินครบถ้วน" },
  { id: "s5", name: "แกงส้มผักรวม", category: "soup", kcal: 130, protein: 10, fat: 3, carb: 16, benefits: "มะขามเปียกมีวิตามินซี" },
  { id: "s6", name: "ต้มจืดฟักหมูสับ", category: "soup", kcal: 95, protein: 8, fat: 3, carb: 9, benefits: "ฟักช่วยขับปัสสาวะ คลายร้อน" },

  // ผัก
  { id: "v1", name: "ผัดผักรวมมิตร", category: "vegetable", kcal: 90, protein: 4, fat: 4, carb: 12, benefits: "วิตามินเอ ซี และใยอาหารสูง" },
  { id: "v2", name: "ผัดผักบุ้งไฟแดง", category: "vegetable", kcal: 80, protein: 3, fat: 3, carb: 10, benefits: "ธาตุเหล็กบำรุงเลือด" },
  { id: "v3", name: "ผัดคะน้าน้ำมันหอย", category: "vegetable", kcal: 95, protein: 4, fat: 5, carb: 10, benefits: "แคลเซียมและวิตามินเค บำรุงกระดูก" },
  { id: "v4", name: "ผัดฟักทอง", category: "vegetable", kcal: 100, protein: 3, fat: 4, carb: 15, benefits: "เบต้าแคโรทีนบำรุงสายตา" },
  { id: "v5", name: "ผัดถั่วฝักยาวใส่ไข่", category: "vegetable", kcal: 110, protein: 6, fat: 5, carb: 12, benefits: "ใยอาหารและโปรตีน" },
  { id: "v6", name: "ยำผักกาดดอง", category: "vegetable", kcal: 70, protein: 2, fat: 2, carb: 11, benefits: "โพรไบโอติกส์ดีต่อระบบย่อยอาหาร" },

  // ผลไม้
  { id: "f1", name: "กล้วยน้ำว้า 1 ผล", category: "fruit", kcal: 90, protein: 1, fat: 0, carb: 23, benefits: "โพแทสเซียมบำรุงกล้ามเนื้อ" },
  { id: "f2", name: "ส้มเขียวหวาน 1 ผล", category: "fruit", kcal: 60, protein: 1, fat: 0, carb: 15, benefits: "วิตามินซีเสริมภูมิคุ้มกัน" },
  { id: "f3", name: "แตงโม 1 ชิ้น", category: "fruit", kcal: 50, protein: 1, fat: 0, carb: 12, benefits: "เพิ่มน้ำให้ร่างกาย ไลโคปีน" },
  { id: "f4", name: "ฝรั่ง 1/2 ผล", category: "fruit", kcal: 65, protein: 1, fat: 1, carb: 14, benefits: "วิตามินซีสูงกว่าส้ม 4 เท่า" },
  { id: "f5", name: "มะละกอสุก 1 ชิ้น", category: "fruit", kcal: 55, protein: 1, fat: 0, carb: 14, benefits: "เอนไซม์ปาเปนช่วยย่อย" },
  { id: "f6", name: "สับปะรด 1 ชิ้น", category: "fruit", kcal: 50, protein: 1, fat: 0, carb: 13, benefits: "เอนไซม์โบรมีเลน ลดอักเสบ" },
  { id: "f7", name: "แอปเปิ้ล 1 ผล", category: "fruit", kcal: 80, protein: 0, fat: 0, carb: 21, benefits: "ใยอาหารและสารต้านอนุมูลอิสระ" },
  { id: "f8", name: "ชมพู่ 2 ผล", category: "fruit", kcal: 45, protein: 1, fat: 0, carb: 11, benefits: "น้ำสูง แคลอรีต่ำ" },

  // นม
  { id: "k1", name: "นมจืด 200 มล.", category: "milk", kcal: 130, protein: 7, fat: 5, carb: 12, benefits: "แคลเซียมบำรุงกระดูกและฟัน" },
  { id: "k2", name: "นมรสจืดพร่องมันเนย 200 มล.", category: "milk", kcal: 90, protein: 7, fat: 2, carb: 12, benefits: "ไขมันต่ำ เหมาะกับเด็กน้ำหนักเกิน" },

  // ของหวาน
  { id: "d1", name: "เต้าฮวยน้ำขิง", category: "dessert", kcal: 150, protein: 5, fat: 3, carb: 25, benefits: "ขิงช่วยขับลม โปรตีนจากถั่วเหลือง" },
  { id: "d2", name: "ขนมตาล", category: "dessert", kcal: 180, protein: 2, fat: 5, carb: 32, benefits: "วิตามินจากเนื้อตาล" },
  { id: "d3", name: "ฟักทองแกงบวด", category: "dessert", kcal: 200, protein: 3, fat: 6, carb: 34, benefits: "วิตามินเอจากฟักทอง" },
  { id: "d4", name: "วุ้นกะทิ", category: "dessert", kcal: 160, protein: 1, fat: 6, carb: 26, benefits: "ของหวานเบาๆ" },
];

// เกณฑ์พลังงานต่อมื้อกลางวัน (กรมอนามัย: ~1/3 ของพลังงานต่อวัน)
export const KCAL_TARGET = {
  primary: { min: 600, max: 700, label: "ป.1-ป.6 (600-700 kcal)" },
  secondary: { min: 700, max: 800, label: "ม.1-ม.6 (700-800 kcal)" },
};

export const getMenuById = (id: string) => LUNCH_MENU.find(m => m.id === id);

export const calcTotalNutrition = (ids: string[]) => {
  const items = ids.map(getMenuById).filter(Boolean) as LunchMenuItem[];
  return items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      fat: acc.fat + m.fat,
      carb: acc.carb + m.carb,
    }),
    { kcal: 0, protein: 0, fat: 0, carb: 0 }
  );
};
