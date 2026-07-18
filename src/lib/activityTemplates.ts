// Activity templates: presets for common school competitions with default rules in Thai.
// Used by ActivitiesPage when creating an activity to auto-fill rules/category/format.

export type ActivityTemplate = {
  id: string;
  label: string;
  category: "sport" | "academic" | "art" | "computer" | "other";
  scoringMode: "points" | "time" | "distance";
  bracketSupported: boolean;
  teamBased: boolean;
  suggestedMax?: number;
  defaultRules: string;
};

export const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  // ───────── กีฬา ─────────
  {
    id: "football",
    label: "ฟุตบอล (11 คน)",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 11 คน (สำรองได้ไม่เกิน 7 คน)
• แข่ง 2 ครึ่ง ครึ่งละ 30 นาที พัก 5 นาที
• ตัดสินด้วยจำนวนประตูที่ยิงได้
• เสมอในรอบน็อกเอาท์: ต่อเวลา 2x5 นาที → ถ้ายังเสมอใช้การยิงจุดโทษ 5 คน
• ใบเหลือง 2 ใบ = ใบแดง พักการแข่ง 1 นัดถัดไป
• ใช้กติกาฟีฟ่าฉบับย่อ`,
  },
  {
    id: "futsal",
    label: "ฟุตซอล (5 คน)",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• ทีมละ 5 คน (รวมผู้รักษาประตู) สำรอง 7 คน เปลี่ยนตัวไม่จำกัด
• แข่ง 2 ครึ่ง ครึ่งละ 20 นาที พัก 5 นาที
• ขอเวลานอกได้ทีมละ 1 ครั้งต่อครึ่ง
• ฟาวล์รวมเกิน 5 ครั้ง: ฝ่ายตรงข้ามได้ยิงลูกโทษระยะ 10 เมตร`,
  },
  {
    id: "basketball",
    label: "บาสเกตบอล",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• ทีมละ 5 คน สำรอง 7 คน
• แข่ง 4 ควอเตอร์ ควอเตอร์ละ 8 นาที พักครึ่ง 10 นาที
• คะแนน: ในเส้น 2 แต้ม / นอกเส้น 3 แต้ม / ลูกโทษ 1 แต้ม
• ฟาวล์ส่วนตัวครบ 5 ครั้ง ต้องออกจากการแข่งขัน
• ใช้กติกา FIBA ฉบับเยาวชน`,
  },
  {
    id: "volleyball",
    label: "วอลเลย์บอล",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• ทีมละ 6 คน สำรอง 6 คน
• แข่ง 3 เซ็ตชนะ 2 ใน 3 (เซ็ตละ 25 แต้ม, เซ็ตตัดสิน 15 แต้ม)
• ห่าง 2 แต้มขึ้นไปจึงจะจบเซ็ต
• ตบหรือบล็อกข้ามตาข่ายโดยลูกอยู่ในแดนตนเอง ถือว่าผิดกติกา`,
  },
  {
    id: "sepak_takraw",
    label: "เซปักตะกร้อ",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน (เรกู)
• แข่ง 2 ใน 3 เซ็ต เซ็ตละ 21 แต้ม (เซ็ตตัดสิน 15 แต้ม)
• ห้ามใช้มือสัมผัสลูก`,
  },
  {
    id: "badminton",
    label: "แบดมินตัน",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: false,
    defaultRules:
`• แข่งเดี่ยว/คู่ ตามประเภท
• 2 ใน 3 เกม เกมละ 21 แต้ม (ต่างกัน 2 แต้ม ไม่เกิน 30)
• เสิร์ฟต่ำกว่าเอว`,
  },
  {
    id: "table_tennis",
    label: "เทเบิลเทนนิส",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: false,
    defaultRules:
`• เดี่ยว/คู่ แข่ง 3 ใน 5 เกม เกมละ 11 แต้ม (ต่าง 2 แต้ม)
• สลับเสิร์ฟทุก 2 แต้ม`,
  },
  {
    id: "petanque",
    label: "เปตอง",
    category: "sport",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    defaultRules:
`• เดี่ยว 3 ลูก / คู่ 3 ลูกต่อคน / ทีม 2 ลูกต่อคน
• ทีมที่ลูกใกล้ลูกเป้ามากที่สุดได้คะแนนต่อลูกในเอ็นด์นั้น
• ทีมแรกที่ถึง 13 คะแนนชนะ`,
  },
  {
    id: "athletics_run",
    label: "วิ่ง 60/100/200 ม.",
    category: "sport",
    scoringMode: "time",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• จับเวลาเป็นวินาที (ละเอียด 0.01)
• เริ่มในท่ายืน/หมอบสตาร์ทตามรุ่น
• ฟาวล์สตาร์ทเกิน 1 ครั้ง ถูกตัดสิทธิ์
• ผู้ที่ใช้เวลาน้อยที่สุดเป็นผู้ชนะ`,
  },
  {
    id: "long_jump",
    label: "กระโดดไกล",
    category: "sport",
    scoringMode: "distance",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• กระโดดได้คนละ 3 ครั้ง คิดผลที่ดีที่สุด (เมตร)
• เหยียบเลยเส้นถือว่าฟาวล์
• ผู้ที่ได้ระยะมากที่สุดเป็นผู้ชนะ`,
  },
  {
    id: "water_rocket",
    label: "จรวดขวดน้ำ (ระยะทาง)",
    category: "sport",
    scoringMode: "distance",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ใช้ขวดพลาสติก PET เท่านั้น ปริมาตรไม่เกิน 1.5 ลิตร
• ใช้น้ำและลมอัดเป็นแรงขับ ห้ามใช้สารเคมีอื่น
• ปล่อยจรวดจากฐานที่กำหนด มุมยิงอิสระ
• วัดระยะจากฐานถึงจุดตกครั้งแรก (เมตร)
• คนละ 3 ครั้ง คิดผลที่ดีที่สุด`,
  },
  {
    id: "rope_skipping",
    label: "กระโดดเชือก",
    category: "sport",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• นับจำนวนครั้งภายใน 1 นาที
• สะดุดเชือกให้นับต่อทันทีโดยไม่หยุดเวลา
• ผู้ที่นับได้สูงสุดเป็นผู้ชนะ`,
  },

  // ───────── วิชาการ ─────────
  {
    id: "academic_quiz",
    label: "ตอบปัญหาวิชาการ",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน
• 3 รอบ: รอบทั่วไป / รอบเร่งความเร็ว / รอบชิงชนะเลิศ
• คะแนนข้อละ 10 คะแนน ตอบผิดไม่หัก ยกเว้นรอบกดสัญญาณ
• ใช้เวลาตอบไม่เกิน 30 วินาทีต่อข้อ`,
  },
  {
    id: "math_speed",
    label: "คณิตคิดเร็ว",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ทำโจทย์ 50 ข้อ ภายใน 30 นาที
• ข้อละ 2 คะแนน ตอบผิดไม่หัก
• ห้ามใช้เครื่องคิดเลข`,
  },
  {
    id: "spelling",
    label: "สะกดคำ",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• กรรมการอ่านคำ 20 คำ ผู้แข่งเขียนตอบ
• คำละ 5 คะแนน คะแนนเต็ม 100
• เขียนพยัญชนะหรือสระเกิน/ขาด นับว่าผิดทั้งคำ`,
  },
  {
    id: "essay",
    label: "เรียงความ",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• เขียนเรียงความตามหัวข้อ 1 หน้ากระดาษ A4 ภายใน 60 นาที
• เกณฑ์: เนื้อหา 40 / สำนวน 30 / หลักภาษา 20 / ลายมือ 10 (รวม 100)
• ห้ามคัดลอกหรือเตรียมมาก่อน`,
  },
  {
    id: "thai_recite",
    label: "อ่านทำนองเสนาะ",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• อ่านบทที่กรรมการกำหนด ใช้เวลาไม่เกิน 5 นาที
• เกณฑ์: ทำนอง 40 / อักขรวิธี 30 / น้ำเสียง-อารมณ์ 20 / บุคลิก 10`,
  },

  // ───────── ศิลปะ/ดนตรี ─────────
  {
    id: "singing",
    label: "ร้องเพลง",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ร้องเพลงตามหัวข้อ 1 เพลง ใช้เวลาไม่เกิน 5 นาที
• เกณฑ์การให้คะแนน (รวม 100):
  - น้ำเสียง/ความไพเราะ 30
  - จังหวะ/ทำนอง 25
  - อักขระ/การออกเสียง 20
  - การถ่ายทอดอารมณ์ 15
  - บุคลิกภาพบนเวที 10`,
  },
  {
    id: "drawing",
    label: "วาดภาพระบายสี",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• วาดในหัวข้อที่กำหนด ขนาดกระดาษ A3 เวลา 3 ชั่วโมง
• เกณฑ์: ความคิดสร้างสรรค์ 30 / องค์ประกอบศิลป์ 25 / เทคนิคสี 25 / ความสะอาด 20
• อุปกรณ์: ผู้แข่งเตรียมเอง`,
  },
  {
    id: "thai_dance",
    label: "รำไทย",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• แสดงไม่เกิน 7 นาที
• เกณฑ์: ท่ารำถูกต้อง 40 / ความพร้อมเพรียง 25 / การแต่งกาย 15 / อารมณ์-สื่อความหมาย 20`,
  },
  {
    id: "luk_thung",
    label: "วงดนตรีลูกทุ่ง",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิกไม่เกิน 30 คน แสดงไม่เกิน 15 นาที
• เกณฑ์: นักร้อง 25 / ดนตรี 25 / หางเครื่อง 20 / องค์ประกอบเวที 15 / ภาพรวม 15`,
  },

  // ───────── อื่นๆ ─────────
  {
    id: "thai_manners",
    label: "ประกวดมารยาทไทย",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 2 คน (ชาย-หญิง)
• ปฏิบัติตามสถานการณ์ที่กรรมการกำหนด
• เกณฑ์: ความถูกต้อง 50 / ความสุภาพอ่อนน้อม 30 / บุคลิกภาพ 20`,
  },
  {
    id: "chant",
    label: "สวดมนต์หมู่",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 5 คน สวดบทที่กำหนด
• เกณฑ์: อักขระถูกต้อง 40 / ความพร้อมเพรียง 30 / น้ำเสียง 20 / มารยาท 10`,
  },

  // ───────── E-Sport / คอมพิวเตอร์ ─────────
  {
    id: "esport_rov",
    label: "E-Sport: RoV (Arena of Valor) 5v5",
    category: "computer",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 5 คน + สำรอง 1 คน (อายุไม่เกินระดับที่กำหนด)
• โหมด: Ranked 5v5 แผนที่ Antaris Battlefield
• Best of 1 รอบแบ่งสาย / Best of 3 รอบน็อกเอาท์ / Best of 5 รอบชิงชนะเลิศ
• ห้ามใช้ฮีโร่ซ้ำในแมตช์เดียวกัน (แบนได้ทีมละ 2 ตัว)
• ห้ามใช้สคริปต์/ฮีโร่ตัวล็อค/โกง — ตัดสิทธิ์ทันที
• ทีมที่ทำลายป้อมแกนกลางก่อนเป็นผู้ชนะ
• การถ่ายทอด: บังคับเปิดกล้องผู้เล่นทุกคนระหว่างแข่ง`,
  },
  {
    id: "esport_freefire",
    label: "E-Sport: Free Fire (Squad)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• ทีมละ 4 คน (Squad) แข่ง 6 แมตช์ คิดคะแนนสะสม
• แผนที่: Bermuda / Purgatory สลับกัน
• คะแนน: อันดับ 1 = 12, อันดับ 2 = 9, อันดับ 3 = 8, ... + 1 คะแนนต่อ kill
• ทีมที่ได้คะแนนรวมสูงสุดเป็นผู้ชนะ
• ห้ามใช้ Emulator (เครื่อง PC จำลอง) ในรอบชิง`,
  },
  {
    id: "esport_valorant",
    label: "E-Sport: Valorant 5v5",
    category: "computer",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 8,
    defaultRules:
`• ทีมละ 5 คน แข่งแบบ Standard (BO1 รอบแบ่งสาย / BO3 น็อกเอาท์)
• ทีมแรกที่ชนะ 13 รอบ (ห่าง 2 รอบ) เป็นฝ่ายชนะ
• เลือก Agent ห้ามซ้ำในทีมเดียวกัน
• เซิร์ฟเวอร์: Singapore / Tokyo
• ห้ามใช้โปรแกรมช่วย / Smurf account`,
  },
  {
    id: "esport_fifa_online",
    label: "E-Sport: FIFA Online 4 (เดี่ยว)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: false,
    suggestedMax: 32,
    defaultRules:
`• แข่งเดี่ยว ครึ่งละ 6 นาที (รวม 12 นาที)
• งบทีม: ใช้ Auto-Pick ตามที่กรรมการตั้งให้
• ห้ามตั้ง custom tactics ที่ผิดกติกาฟุตบอลปกติ
• เสมอในรอบน็อกเอาท์: ต่อเวลา 2x2 นาที → ยิงจุดโทษ`,
  },
  {
    id: "esport_rov_1v1",
    label: "E-Sport: RoV 1v1 Solo Mid",
    category: "computer",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: false,
    suggestedMax: 32,
    defaultRules:
`• แข่งเดี่ยว Solo Mid lane
• ผู้ชนะ: ฆ่าฝ่ายตรงข้าม 2 ครั้ง หรือทำลายป้อมแรกก่อน
• ห้ามเข้าป่า ห้ามใช้สกิลรุกฆ่ามอนสเตอร์ในป่า`,
  },

  // ───────── คอมพิวเตอร์/วิชาการไอที ─────────
  {
    id: "typing_thai",
    label: "พิมพ์ดีดภาษาไทยด้วยคอมพิวเตอร์",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พิมพ์เอกสารตามต้นฉบับภายใน 10 นาที
• คะแนน = จำนวนคำที่ถูกต้อง − (คำผิด × 2)
• ห้ามใช้ฟีเจอร์ Autocorrect`,
  },
  {
    id: "computer_drawing",
    label: "วาดภาพด้วยโปรแกรมคอมพิวเตอร์",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• วาดภาพในหัวข้อที่กำหนด ใช้เวลา 3 ชั่วโมง
• โปรแกรม: Paint / Krita / GIMP / Photoshop (เลือกได้)
• เกณฑ์: ความคิดสร้างสรรค์ 30 / องค์ประกอบศิลป์ 25 / เทคนิคการใช้โปรแกรม 25 / สื่อความหมาย 20`,
  },
  {
    id: "scratch_programming",
    label: "เขียนโปรแกรม Scratch",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 2 คน เขียนเกม/แอนิเมชันตามโจทย์ ภายใน 4 ชั่วโมง
• เกณฑ์: การทำงานครบตามโจทย์ 40 / ความคิดสร้างสรรค์ 30 / การใช้บล็อคโค้ดเหมาะสม 20 / การออกแบบ UI 10`,
  },
  {
    id: "robotics_lego",
    label: "หุ่นยนต์ LEGO (ภารกิจ)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 2–3 คน ใช้ชุด LEGO Education (EV3 / SPIKE Prime / WeDo)
• ออกแบบและประกอบหุ่นยนต์ทำภารกิจบนสนามมาตรฐาน
• เวลาแข่งขัน 2 รอบ รอบละ 2 นาที 30 วินาที คิดคะแนนรอบที่ดีที่สุด
• คะแนน: ทำภารกิจสำเร็จตามรายการ (รวม 100) + โบนัสเวลาเหลือ
• ห้ามแตะหุ่นยนต์หลังออกจากเขตสตาร์ท (สัมผัส = ลบ 10 คะแนน/ครั้ง)
• อนุญาตเฉพาะชิ้นส่วน LEGO เท่านั้น`,
  },
  {
    id: "robotics_sumo",
    label: "หุ่นยนต์ซูโม่ (อัตโนมัติ)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• หุ่นยนต์ขนาดไม่เกิน 20x20 ซม. น้ำหนักไม่เกิน 1.5 กก.
• ทำงานอัตโนมัติเท่านั้น ห้ามใช้รีโมต
• สนามวงกลมเส้นผ่านศูนย์กลาง 154 ซม.
• ชนะเมื่อดันคู่ต่อสู้ออกนอกสนาม (1 แต้ม/ยก) แข่ง Best of 3 ยก ยกละ 3 นาที
• ห้ามใช้อาวุธมีคม / ของเหลว / ไฟ`,
  },
  {
    id: "robotics_line",
    label: "หุ่นยนต์เดินตามเส้น",
    category: "computer",
    scoringMode: "time",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 20,
    defaultRules:
`• ทีมละ 2 คน หุ่นอัตโนมัติเดินตามเส้นดำบนพื้นขาว
• จับเวลาตั้งแต่ออกสตาร์ทถึงเส้นชัย
• ออกนอกเส้นเกิน 3 วินาทีต้องรีสตาร์ท (+5 วินาที penalty)
• แข่ง 2 รอบ คิดเวลาที่ดีที่สุด`,
  },
  {
    id: "coding_python",
    label: "เขียนโปรแกรม Python (แก้โจทย์)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    suggestedMax: 30,
    defaultRules:
`• แข่งเดี่ยว เวลา 3 ชั่วโมง โจทย์ 5 ข้อ ระดับยากขึ้นตามลำดับ
• ใช้ภาษา Python 3 เท่านั้น
• ตรวจอัตโนมัติด้วย test case (ข้อละ 20 คะแนน)
• ห้ามใช้อินเทอร์เน็ต / AI / โค้ดสำเร็จรูป
• เครื่องและ IDE จัดเตรียมโดยกรรมการ`,
  },
  {
    id: "coding_web",
    label: "พัฒนาเว็บไซต์ (HTML/CSS/JS)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 2–3 คน พัฒนาเว็บตามโจทย์ ภายใน 6 ชั่วโมง
• ใช้ HTML / CSS / JavaScript (อนุญาต framework ที่กรรมการกำหนด)
• เกณฑ์: ใช้งานตามโจทย์ 40 / การออกแบบ UX-UI 25 / โค้ดสะอาด 20 / Responsive 15
• ห้ามใช้ template สำเร็จรูป`,
  },
  {
    id: "coding_micro_bit",
    label: "Coding ด้วย micro:bit",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 2 คน ใช้บอร์ด micro:bit + เซ็นเซอร์ที่กำหนด
• ออกแบบโครงงาน/แก้โจทย์ภายใน 4 ชั่วโมง
• ใช้ MakeCode (Block) หรือ Python ก็ได้
• เกณฑ์: การทำงานครบตามโจทย์ 40 / ความคิดสร้างสรรค์ 25 / การใช้เซ็นเซอร์เหมาะสม 20 / การนำเสนอ 15`,
  },

  // ───────── ภาษาต่างประเทศ ─────────
  {
    id: "english_speech",
    label: "สุนทรพจน์ภาษาอังกฤษ (English Speech)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พูดสุนทรพจน์ในหัวข้อที่กำหนด 3–5 นาที (เกิน/ขาดเวลา −5 คะแนน)
• เกณฑ์การให้คะแนน (รวม 100):
  - เนื้อหา/ความสอดคล้อง 25
  - การออกเสียง (Pronunciation) 20
  - น้ำเสียง/อารมณ์ (Intonation) 15
  - ไวยากรณ์/ศัพท์ 15
  - บุคลิกภาพ-การสบตา 15
  - การจดจำเนื้อหา 10
• ห้ามถือกระดาษ/บัตรช่วยจำ`,
  },
  {
    id: "english_storytelling",
    label: "เล่านิทานภาษาอังกฤษ (Story Telling)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• เล่านิทาน 5–7 นาที พร้อมท่าทาง/อุปกรณ์ประกอบไม่เกิน 3 ชิ้น
• เกณฑ์: การออกเสียง 25 / ความเข้าใจเรื่อง 20 / การถ่ายทอด-ท่าทาง 20 / น้ำเสียง 15 / ศัพท์-สำนวน 10 / บุคลิก 10`,
  },
  {
    id: "english_spelling_bee",
    label: "Spelling Bee (สะกดคำภาษาอังกฤษ)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• กรรมการอ่านคำ ผู้แข่งสะกดเป็นตัวอักษรทีละตัว (A-B-C ...)
• ผิด 1 คำ คัดออกทันที (รอบสุดท้ายเหลือ 1 คน)
• หากเหลือผู้แข่งคนเดียว ต้องสะกดถูกอีก 1 คำเพิ่มเพื่อเป็นแชมป์
• ขอให้กรรมการอ่านซ้ำหรือใช้ในประโยคได้ ไม่จำกัดครั้ง`,
  },
  {
    id: "english_quiz",
    label: "ตอบปัญหาภาษาอังกฤษ (English Quiz)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 2–3 คน
• 3 รอบ: ความรู้ทั่วไป (Grammar/Vocab) / Listening / กดสัญญาณตอบ
• ข้อละ 10 คะแนน รอบกดสัญญาณตอบผิด −5 คะแนน
• เวลาตอบไม่เกิน 30 วินาทีต่อข้อ`,
  },
  {
    id: "english_impromptu",
    label: "Impromptu Speech (พูดสดภาษาอังกฤษ)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• จับสลากหัวข้อ เตรียมตัว 3 นาที พูด 3–5 นาที
• เกณฑ์: เนื้อหา 30 / ภาษา-ไวยากรณ์ 25 / การออกเสียง 20 / ความเป็นธรรมชาติ 15 / เวลา 10`,
  },
  {
    id: "chinese_speech",
    label: "สุนทรพจน์ภาษาจีน (中文演讲)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พูดสุนทรพจน์ภาษาจีน 3–5 นาที ในหัวข้อที่กำหนด
• เกณฑ์: เนื้อหา 25 / การออกเสียง-วรรณยุกต์ 25 / ความคล่อง 20 / บุคลิก 15 / ท่าทาง-อารมณ์ 15`,
  },
  {
    id: "chinese_calligraphy",
    label: "คัดลายมือ/พู่กันจีน",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• คัดข้อความที่กำหนดด้วยพู่กันจีนบนกระดาษไรซ์ ขนาด 34x68 ซม. เวลา 90 นาที
• เกณฑ์: ความถูกต้องของตัวอักษร 35 / น้ำหนักเส้น 25 / องค์ประกอบ-ระยะห่าง 20 / ความสะอาด 20`,
  },
  {
    id: "japanese_speech",
    label: "สุนทรพจน์ภาษาญี่ปุ่น (日本語スピーチ)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พูด 3–5 นาที หัวข้อที่กำหนด
• เกณฑ์: เนื้อหา 25 / การออกเสียง 25 / ไวยากรณ์-คำศัพท์ 20 / บุคลิก-อารมณ์ 15 / การจดจำ 15`,
  },

  // ───────── ภาษาไทย/วิชาการเพิ่มเติม ─────────
  {
    id: "thai_handwriting",
    label: "คัดลายมือภาษาไทย",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• คัดด้วยตัวบรรจงเต็มบรรทัด ตามต้นฉบับที่กำหนด ภายใน 60 นาที
• เกณฑ์ (รวม 100): รูปแบบตัวอักษร 40 / ความสะอาด 30 / สัดส่วน-ช่องไฟ 20 / ความครบถ้วน 10
• ใช้ปากกาหมึกซึม/ลูกลื่นสีน้ำเงินหรือดำเท่านั้น`,
  },
  {
    id: "thai_speech",
    label: "สุนทรพจน์ภาษาไทย",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พูดในหัวข้อที่กำหนด 5–7 นาที
• เกณฑ์: เนื้อหา 25 / อักขรวิธี-น้ำเสียง 25 / ลีลา-อารมณ์ 20 / บุคลิกภาพ 15 / การจดจำ 15`,
  },
  {
    id: "thai_poem_compose",
    label: "แต่งคำประพันธ์ (กลอน/โคลง)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• แต่งตามฉันทลักษณ์ที่กำหนด หัวข้อที่กรรมการแจ้งหน้างาน ภายใน 90 นาที
• เกณฑ์: ฉันทลักษณ์ 35 / เนื้อหา-ความหมาย 30 / การใช้คำ-สัมผัส 20 / ความคิดสร้างสรรค์ 15`,
  },
  {
    id: "thai_debate",
    label: "โต้วาที (ภาษาไทย)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: true,
    suggestedMax: 16,
    defaultRules:
`• ทีมละ 3 คน (เสนอ-คัดค้าน) ฝ่ายละ 3 รอบ คนละ 3 นาที สรุปคนละ 2 นาที
• เกณฑ์: เนื้อหา-เหตุผล 35 / การใช้ภาษา 25 / ปฏิภาณ-ไหวพริบ 20 / บุคลิก-มารยาท 20`,
  },
  {
    id: "science_project",
    label: "โครงงานวิทยาศาสตร์",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 30,
    defaultRules:
`• ทีมละ 3 คน นำเสนอโครงงาน 10 นาที + ตอบคำถาม 5 นาที
• ส่งรูปเล่ม + บอร์ดนำเสนอ (90x120 ซม.)
• เกณฑ์: กระบวนการทางวิทยาศาสตร์ 30 / ความคิดสร้างสรรค์ 20 / การนำเสนอ 20 / รูปเล่ม-บอร์ด 15 / การตอบคำถาม 15`,
  },
  {
    id: "science_show",
    label: "Science Show",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน แสดงไม่เกิน 12 นาที
• เกณฑ์: เนื้อหาวิทย์ 30 / ความคิดสร้างสรรค์ 25 / การนำเสนอ-การแสดง 25 / ความปลอดภัย 10 / การใช้สื่อ-อุปกรณ์ 10`,
  },
  {
    id: "social_quiz",
    label: "ตอบปัญหาสังคมศึกษา",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 2–3 คน 3 รอบ: ความรู้ทั่วไป / กดสัญญาณ / สถานการณ์
• ข้อละ 10 คะแนน ตอบผิดในรอบสัญญาณ −5
• เวลาตอบ 30 วินาที/ข้อ`,
  },
  {
    id: "math_project",
    label: "โครงงานคณิตศาสตร์",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน นำเสนอ 10 นาที + ตอบคำถาม 5 นาที
• เกณฑ์: ความถูกต้องเชิงคณิตศาสตร์ 30 / กระบวนการคิด 25 / ความคิดสร้างสรรค์ 20 / รูปเล่ม-บอร์ด 15 / การนำเสนอ 10`,
  },
  {
    id: "sudoku",
    label: "ซูโดกุ (Sudoku)",
    category: "academic",
    scoringMode: "time",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ทำโจทย์ 3 ระดับ (ง่าย/กลาง/ยาก) ภายใน 60 นาที
• คิดจากจำนวนข้อที่ถูกต้อง หากเท่ากันใช้เวลาน้อยกว่าเป็นผู้ชนะ
• ห้ามใช้เครื่องคำนวณ/ลบขูดด้วยน้ำยา`,
  },
  {
    id: "crossword_eng",
    label: "ครอสเวิร์ดภาษาอังกฤษ",
    category: "academic",
    scoringMode: "points",
    bracketSupported: true,
    teamBased: false,
    suggestedMax: 16,
    defaultRules:
`• แข่งแบบ 1 ต่อ 1 บนกระดานมาตรฐาน 15x15
• เวลาเดินรวม 25 นาที/คน (นาฬิกาหมากรุก)
• ห้ามใช้พจนานุกรม คะแนนตามแต้มตัวอักษร + โบนัสช่อง
• สามารถ Challenge คำได้ ถ้าผิด ผู้ท้าทายเสียตา`,
  },

  // ───────── ดนตรีไทย ─────────
  {
    id: "thai_music_ranat_ek",
    label: "ระนาดเอก (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลงเพลงที่กำหนด/เลือกอิสระ ใช้เวลาไม่เกิน 7 นาที
• เกณฑ์ (รวม 100): ทำนอง-จังหวะ 30 / เทคนิคการตี 25 / รสมือ-อารมณ์ 20 / บุคลิก-การแต่งกาย 15 / การปรับเสียงเครื่อง 10`,
  },
  {
    id: "thai_music_khim",
    label: "ขิม (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลงเพลงไทยเดิม ไม่เกิน 5 นาที
• เกณฑ์: ทำนอง-จังหวะ 30 / เทคนิคการตี 25 / น้ำเสียง 20 / อารมณ์เพลง 15 / บุคลิก 10`,
  },
  {
    id: "thai_music_saw",
    label: "ซอด้วง/ซออู้ (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลงเพลงที่กำหนด ไม่เกิน 5 นาที
• เกณฑ์: ทำนอง 30 / น้ำเสียง-อินโทเนชัน 25 / เทคนิคการสี 20 / อารมณ์ 15 / บุคลิก 10`,
  },
  {
    id: "thai_music_jakhe",
    label: "จะเข้ (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลงเพลงที่กำหนด ไม่เกิน 5 นาที
• เกณฑ์: ทำนอง-จังหวะ 30 / เทคนิคนิ้ว-ดีด 25 / น้ำเสียง 20 / อารมณ์ 15 / บุคลิก 10`,
  },
  {
    id: "thai_music_khlui",
    label: "ขลุ่ยเพียงออ (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลงเพลงไทยเดิม ไม่เกิน 5 นาที
• เกณฑ์: ทำนอง 30 / น้ำเสียง-การควบคุมลม 25 / เทคนิคการเป่า 20 / อารมณ์เพลง 15 / บุคลิก 10`,
  },
  {
    id: "thai_music_ensemble",
    label: "วงดนตรีไทย (วงเครื่องสาย/ปี่พาทย์)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• สมาชิก 8–15 คน บรรเลงเพลงที่กำหนด + เพลงเลือก รวมไม่เกิน 15 นาที
• เกณฑ์: ความพร้อมเพรียง 30 / คุณภาพเสียง 25 / ทำนอง-จังหวะ 20 / การจัดวง 15 / การแต่งกาย 10`,
  },
  {
    id: "thai_song_solo",
    label: "ขับร้องเพลงไทยเดิม (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ขับร้องเพลงที่กำหนด ไม่เกิน 5 นาที
• เกณฑ์: เอื้อน-ทำนอง 30 / น้ำเสียง 25 / อักขระ 20 / อารมณ์ 15 / บุคลิก 10`,
  },
  {
    id: "thai_song_lukthung",
    label: "ขับร้องเพลงลูกทุ่ง (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ร้อง 1 เพลง ไม่เกิน 5 นาที พร้อมแบ็คอัพ/แดนเซอร์ได้ไม่เกิน 4 คน
• เกณฑ์: น้ำเสียง 30 / จังหวะ-ทำนอง 25 / อักขระ 15 / การถ่ายทอด 15 / บุคลิกภาพ 15`,
  },
  {
    id: "thai_song_lukkrung",
    label: "ขับร้องเพลงลูกกรุง (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ร้อง 1 เพลง ไม่เกิน 5 นาที
• เกณฑ์: น้ำเสียง 30 / ทำนอง-จังหวะ 25 / อักขระ 20 / อารมณ์ 15 / บุคลิก 10`,
  },
  {
    id: "thai_dance_creative",
    label: "นาฏศิลป์ไทยสร้างสรรค์",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิก 6–10 คน แสดงไม่เกิน 8 นาที
• เกณฑ์: ความคิดสร้างสรรค์ 25 / เทคนิคนาฏศิลป์ 25 / ความพร้อมเพรียง 20 / องค์ประกอบเวที-เพลง 15 / การแต่งกาย 15`,
  },

  // ───────── ดนตรีสากล ─────────
  {
    id: "western_song_solo",
    label: "ขับร้องเพลงสากล (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ร้องเพลงภาษาอังกฤษ 1 เพลง ไม่เกิน 5 นาที
• เกณฑ์: น้ำเสียง 30 / การออกเสียง-Pronunciation 20 / จังหวะ-ทำนอง 20 / การถ่ายทอด 15 / บุคลิก 15`,
  },
  {
    id: "western_song_thai",
    label: "ขับร้องเพลงไทยสากล (เดี่ยว)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ร้องเพลงไทยสากล 1 เพลง ไม่เกิน 5 นาที
• เกณฑ์: น้ำเสียง 30 / ทำนอง-จังหวะ 25 / อักขระ 20 / การถ่ายทอด 15 / บุคลิก 10`,
  },
  {
    id: "western_band",
    label: "วงดนตรีสากล (Combo Band)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    suggestedMax: 12,
    defaultRules:
`• สมาชิก 5–10 คน บรรเลง 2 เพลง ไม่เกิน 12 นาที
• เกณฑ์: คุณภาพเสียง-การมิกซ์ 25 / ความพร้อมเพรียง 25 / เทคนิคนักดนตรี 20 / ความคิดสร้างสรรค์ 15 / การแสดง-Showmanship 15`,
  },
  {
    id: "western_choir",
    label: "ขับร้องประสานเสียง (Choir)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิก 12–30 คน ร้อง 2 เพลง (1 ไทย + 1 สากล) ไม่เกิน 10 นาที
• เกณฑ์: คุณภาพเสียงประสาน 30 / Balance-Blend 20 / ทำนอง-จังหวะ 20 / การควบคุมวง 15 / บุคลิก-การแต่งกาย 15`,
  },
  {
    id: "western_marching",
    label: "วงโยธวาทิต (Marching Band)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิก 30–60 คน แสดงสนามไม่เกิน 12 นาที
• เกณฑ์: คุณภาพเสียง-วง 30 / รูปขบวน-การเดิน 25 / Visual-Color guard 20 / ความสร้างสรรค์ 15 / บุคลิก-การแต่งกาย 10`,
  },
  {
    id: "western_solo_inst",
    label: "เดี่ยวเครื่องดนตรีสากล (เปียโน/กีตาร์/ไวโอลิน ฯลฯ)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• บรรเลง 1 บทเพลง ไม่เกิน 6 นาที
• เกณฑ์: เทคนิค 30 / ทำนอง-จังหวะ 25 / การตีความ-อารมณ์ 20 / คุณภาพเสียง 15 / บุคลิก 10`,
  },
  {
    id: "western_dance",
    label: "Cover Dance / นาฏศิลป์สากล",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิก 4–9 คน เต้นไม่เกิน 4 นาที
• เกณฑ์: ความพร้อมเพรียง 30 / เทคนิคการเต้น 25 / ความคิดสร้างสรรค์-Choreography 20 / การแต่งกาย-Makeup 15 / Stage Presence 10`,
  },

  // ───────── ศิลปะ/อาชีพเพิ่มเติม ─────────
  {
    id: "art_clay",
    label: "ปั้นดินน้ำมัน/ดินเหนียว",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ปั้นตามหัวข้อที่กำหนด ขนาดฐานไม่เกิน 30x30 ซม. เวลา 3 ชั่วโมง
• เกณฑ์: ความคิดสร้างสรรค์ 30 / สัดส่วน-รูปทรง 25 / รายละเอียด 20 / ความสะอาด 15 / สื่อความหมาย 10`,
  },
  {
    id: "art_collage",
    label: "ภาพปะติด (Collage)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• สร้างภาพปะติดจากวัสดุที่กำหนด ขนาด A3 เวลา 3 ชั่วโมง
• เกณฑ์: ความคิดสร้างสรรค์ 30 / องค์ประกอบศิลป์ 25 / การใช้วัสดุ 20 / ความสะอาด 15 / สื่อความหมาย 10`,
  },
  {
    id: "art_calligraphy_thai",
    label: "คัดลายมืออาลักษณ์ (อักษรไทยโบราณ)",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• คัดข้อความที่กำหนดด้วยปากกาคอแร้ง/พู่กัน ภายใน 90 นาที
• เกณฑ์: ความถูกต้อง 35 / น้ำหนักเส้น 25 / องค์ประกอบ 20 / ความสะอาด 20`,
  },
  {
    id: "cooking",
    label: "การทำอาหาร/ขนมไทย",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน ทำเมนูที่กำหนด ภายใน 2 ชั่วโมง
• เกณฑ์: รสชาติ 30 / หน้าตา-การจัดจาน 25 / ความสะอาด 20 / ขั้นตอน-การประหยัด 15 / การนำเสนอ 10`,
  },
  {
    id: "flower_arrangement",
    label: "จัดดอกไม้สด/ใบตอง",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• จัดตามรูปแบบที่กำหนด ภายใน 90 นาที
• เกณฑ์: ความคิดสร้างสรรค์ 30 / องค์ประกอบ-สีสัน 25 / ความประณีต 25 / ความสด-คงทน 20`,
  },
  {
    id: "agriculture_project",
    label: "โครงงานเกษตร/ปลูกผัก",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน ส่งผลงาน + นำเสนอ 10 นาที
• เกณฑ์: คุณภาพผลผลิต 30 / กระบวนการปลูก-บันทึก 25 / การนำเสนอ 20 / รูปเล่ม-บอร์ด 15 / ความยั่งยืน-เป็นมิตรสิ่งแวดล้อม 10`,
  },

  // ───────── สังคม/คุณธรรม ─────────
  {
    id: "buddhist_quiz",
    label: "ตอบปัญหาธรรมะ/พระพุทธศาสนา",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน 3 รอบ: ความรู้ทั่วไป / กดสัญญาณ / สถานการณ์-คติธรรม
• ข้อละ 10 คะแนน เวลาตอบ 30 วินาที/ข้อ`,
  },
  {
    id: "moral_drama",
    label: "ละครคุณธรรม",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• สมาชิก 5–10 คน แสดงไม่เกิน 12 นาที
• เกณฑ์: เนื้อหา-สาระคุณธรรม 30 / การแสดง 25 / บท-การกำกับ 20 / องค์ประกอบเวที 15 / การแต่งกาย-อุปกรณ์ 10`,
  },
  {
    id: "speech_anti_drug",
    label: "พูดรณรงค์ (ยาเสพติด/สิ่งแวดล้อม/อื่นๆ)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• พูดในหัวข้อที่กำหนด 5–7 นาที
• เกณฑ์: เนื้อหา-สาระ 30 / ลีลา-น้ำเสียง 25 / การถ่ายทอด 20 / บุคลิก 15 / การจดจำ 10`,
  },

  // ───────── สุขศึกษา/การงาน ─────────
  {
    id: "first_aid",
    label: "ปฐมพยาบาลเบื้องต้น",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3 คน แสดงการช่วยเหลือตามสถานการณ์ที่จับสลาก ภายใน 10 นาที
• เกณฑ์: ความถูกต้องตามหลักวิชา 40 / ความรวดเร็ว-ลำดับขั้น 25 / การสื่อสาร-ความปลอดภัย 20 / การใช้อุปกรณ์ 15`,
  },

  // ───────── สื่อสาร/มัลติมีเดีย ─────────
  {
    id: "short_film",
    label: "หนังสั้น (Short Film)",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: true,
    defaultRules:
`• ทีมละ 3–5 คน ส่งหนังสั้นความยาว 3–7 นาที ตามหัวข้อ
• เกณฑ์: บทภาพยนตร์ 25 / การกำกับ-การแสดง 25 / ภาพ-การถ่ายทำ 20 / ตัดต่อ-ดนตรีประกอบ 15 / สาระ-แนวคิด 15`,
  },
  {
    id: "photography",
    label: "ถ่ายภาพในหัวข้อ",
    category: "art",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ส่งภาพ 3 ภาพ ตามหัวข้อ ใช้กล้องอะไรก็ได้ (DSLR/Mirrorless/Smartphone)
• เกณฑ์: ความคิดสริ้างสรรค์ 30 / องค์ประกอบภาพ 25 / เทคนิคการถ่าย 20 / สื่อความหมาย 15 / การปรับแต่ง 10
• ห้ามใช้ AI สร้างภาพ`,
  },
  {
    id: "infographic",
    label: "ออกแบบ Infographic",
    category: "computer",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• ออกแบบ Infographic 1 หน้า ขนาด A3 ในหัวข้อที่กำหนด เวลา 3 ชั่วโมง
• โปรแกรม: Canva / Illustrator / Photoshop / Figma
• เกณฑ์: เนื้อหา-ความถูกต้อง 30 / การออกแบบ-Composition 25 / การใช้สี-Typography 20 / ความคิดสริ้างสรรค์ 15 / การสื่อสาร 10`,
  },
  {
    id: "news_anchor",
    label: "ผู้ประกาศข่าว (เดี่ยว/คู่)",
    category: "academic",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules:
`• อ่านข่าวที่กำหนด ภายใน 5 นาที
• เกณฑ์: อักขรวิธี 30 / น้ำเสียง 25 / การใช้สายตา-บุคลิก 20 / ลีลา-จังหวะ 15 / การแต่งกาย 10`,
  },
  {
    id: "free",
    label: "กำหนดเอง (ว่างเปล่า)",
    category: "other",
    scoringMode: "points",
    bracketSupported: false,
    teamBased: false,
    defaultRules: "",
  },
];

export const TEMPLATE_CATEGORY_LABEL: Record<string, string> = {
  sport: "กีฬา",
  academic: "วิชาการ",
  art: "ศิลปะ/ดนตรี",
  computer: "คอมพิวเตอร์/E-Sport",
  other: "อื่นๆ",
};

export const getTemplate = (id?: string | null) =>
  ACTIVITY_TEMPLATES.find((t) => t.id === id);
