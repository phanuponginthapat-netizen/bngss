// แบบ นร./กสศ.01 ฉบับปรับปรุง 6 มีนาคม 2569
// โครงสร้างฟิลด์ตรงตามฟอร์มจริงของ กสศ.

export type Kosor01FieldType =
  | "text"
  | "number"
  | "radio"
  | "checkboxGroup"
  | "textarea"
  | "members";        // ตารางสมาชิกครัวเรือน (ข้อ 2)

export interface Kosor01Field {
  key: string;
  label: string;
  type: Kosor01FieldType;
  options?: string[];
  suffix?: string;
  half?: boolean;
  placeholder?: string;
  helper?: string;
}

export interface Kosor01Section {
  id: string;
  title: string;
  fields: Kosor01Field[];
}

export const KOSOR01_SECTIONS: Kosor01Section[] = [
  // ───────── ข้อ 1 ข้อมูลนักเรียน ─────────
  {
    id: "s1_student",
    title: "1. ข้อมูลนักเรียน",
    fields: [
      {
        key: "family_status",
        label: "สถานภาพครอบครัว",
        type: "radio",
        options: [
          "พ่อแม่อยู่ด้วยกัน",
          "พ่อแม่แยกกันอยู่",
          "พ่อแม่หย่าร้าง",
          "พ่อเสียชีวิต/สาบสูญ",
          "แม่เสียชีวิต/สาบสูญ",
          "เสียชีวิตทั้งคู่/สาบสูญ",
          "พ่อ/แม่ทอดทิ้ง",
        ],
      },
      {
        key: "live_with",
        label: "นักเรียนอาศัยอยู่กับ",
        type: "radio",
        options: ["พ่อ/แม่", "ญาติ", "อยู่ลำพัง", "ผู้อุปการะ/นายจ้าง", "ครัวเรือนสถาบัน"],
      },
      { key: "guardian_name", label: "ชื่อ-สกุลผู้ปกครองนักเรียน", type: "text" },
      { key: "guardian_relation", label: "ความสัมพันธ์กับนักเรียน", type: "text", half: true },
      { key: "guardian_education", label: "การศึกษาสูงสุด", type: "text", half: true },
      { key: "guardian_occupation", label: "อาชีพ", type: "text", half: true },
      { key: "guardian_phone", label: "เบอร์โทรศัพท์ที่ติดต่อได้", type: "text", half: true },
      { key: "guardian_national_id", label: "เลขประจำตัวประชาชน 13 หลัก", type: "text", half: true },
      {
        key: "guardian_flags",
        label: "สถานะอื่น",
        type: "checkboxGroup",
        options: ["ไม่มีเลขประจำตัวประชาชน", "ได้สวัสดิการแห่งรัฐ (ทะเบียนคนจน)"],
      },
    ],
  },

  // ───────── ข้อ 2 สมาชิกในครัวเรือน ─────────
  {
    id: "s2_members",
    title: "2. จำนวนสมาชิกในครัวเรือน (รวมตัวนักเรียน)",
    fields: [
      { key: "household_total", label: "รวมจำนวนสมาชิกในครัวเรือน", type: "number", suffix: "คน", half: true },
      {
        key: "members",
        label:
          "รายการสมาชิก (อาศัยอยู่ในครัวเรือนเดียวกันตั้งแต่ 3 เดือนขึ้นไปและมีค่าใช้จ่ายร่วมกัน)",
        type: "members",
      },
    ],
  },

  // ───────── ข้อ 3 สถานะของครัวเรือน ─────────
  {
    id: "s3_household",
    title: "3. ข้อมูลสถานะของครัวเรือน (เลือกได้มากกว่า 1 คำตอบ)",
    fields: [
      {
        key: "burden_status",
        label: "3.1 ครัวเรือนมีภาระพึ่งพิง",
        type: "radio",
        options: ["ครัวเรือนไม่มีภาระพึ่งพิง", "ครัวเรือนมีภาระพึ่งพิง"],
      },
      {
        key: "burden_items",
        label: "ระบุภาระพึ่งพิง (ถ้ามี)",
        type: "checkboxGroup",
        options: [
          "มีความพิการทางร่างกาย/สติปัญญา",
          "มีโรคเรื้อรัง ยกเว้น ความดัน/เบาหวาน",
          "ผู้สูงอายุตั้งแต่ 60 ปีขึ้นไป",
          "เป็นพ่อ/แม่เลี้ยงเดี่ยว",
          "มีคนอายุ 15-65 ปีที่ว่างงาน (ที่ไม่ใช่นักเรียน/นักศึกษา)",
        ],
      },
      {
        key: "housing",
        label: "3.2 การอยู่อาศัย",
        type: "radio",
        options: ["อยู่บ้านตนเอง/เจ้าของบ้าน", "อยู่บ้านเช่า", "อยู่กับผู้อื่น/อยู่ฟรี", "หอพัก"],
      },
      { key: "rent_per_month", label: "ค่าเช่า (กรณีบ้านเช่า)", type: "number", suffix: "บาท/เดือน", half: true },

      {
        key: "floor_material",
        label: "3.3 วัสดุที่ใช้ทำพื้นบ้าน",
        type: "checkboxGroup",
        options: [
          "กระเบื้อง/เซรามิค",
          "ปาเก้/ไม้ขัดเงา",
          "ซีเมนต์เปลือย",
          "ไม้กระดาน",
          "ไวนิล/กระเบื้องยาง/เสื่อน้ำมัน",
          "ไม้ไผ่",
          "ดิน/ทราย",
          "อื่น ๆ",
        ],
      },
      {
        key: "wall_material",
        label: "วัสดุที่ใช้ทำฝาบ้าน",
        type: "checkboxGroup",
        options: [
          "ฉาบซีเมนต์",
          "อิฐ/ก้อนปูน/อิฐบล็อก",
          "สังกะสี",
          "ไม้กระดาน",
          "ไม้อัด",
          "สมาร์ทบอร์ด/ไฟเบอร์/ซีเมนต์บอร์ด",
          "ไม้ไผ่/ท่อนไม้/เศษไม้",
          "ดิน/ไวนิล/อื่น ๆ",
        ],
      },
      {
        key: "roof_material",
        label: "วัสดุที่ใช้ทำหลังคา",
        type: "checkboxGroup",
        options: [
          "โลหะ (สังกะสี/เหล็ก/อะลูมิเนียม)",
          "กระเบื้อง/เซรามิค",
          "ไม้กระดาน",
          "ใบไม้/วัสดุธรรมชาติ",
          "ไวนิล/กระดาษ/แผ่นพลาสติก",
          "อื่น ๆ",
        ],
      },
      {
        key: "has_toilet",
        label: "มีห้องส้วมในที่อยู่อาศัย/บริเวณบ้าน",
        type: "radio",
        options: ["มี", "ไม่มี"],
      },

      {
        key: "farmland",
        label: "3.4 ที่ดินทำการเกษตร (รวมเช่า)",
        type: "radio",
        options: ["ไม่ทำเกษตร", "ทำเกษตร"],
      },
      {
        key: "farmland_size",
        label: "ขนาดที่ดินทำเกษตร (กรณีทำเกษตร)",
        type: "radio",
        options: ["มีที่ดินน้อยกว่า 1 ไร่", "มีที่ดิน 1 ถึง 5 ไร่", "มีที่ดินมากกว่า 5 ไร่"],
      },

      {
        key: "water_source",
        label: "3.5 แหล่งน้ำดื่ม",
        type: "checkboxGroup",
        options: [
          "น้ำดื่มบรรจุขวด/ตู้หยอดน้ำ",
          "น้ำประปา",
          "น้ำบ่อ/น้ำบาดาล",
          "น้ำฝน/น้ำประปาภูเขา/ลำธาร",
        ],
      },

      {
        key: "electricity",
        label: "3.6 แหล่งไฟฟ้า",
        type: "radio",
        options: ["ไม่มีไฟฟ้า/ไม่มีเครื่องกำเนิดไฟฟ้า", "มีไฟฟ้า"],
      },
      {
        key: "electricity_type",
        label: "ประเภทแหล่งไฟฟ้า (กรณีมีไฟฟ้า)",
        type: "checkboxGroup",
        options: ["เครื่องปั่นไฟ/โซลาเซลล์", "ไฟต่อพ่วง/แบตเตอรี่", "ไฟบ้านหรือมิเตอร์"],
      },

      {
        key: "vehicle_status",
        label: "3.7 ยานพาหนะในครัวเรือน",
        type: "radio",
        options: ["ไม่มียานพาหนะในครัวเรือน", "มียานพาหนะในครัวเรือน"],
      },
      {
        key: "vehicles",
        label: "ระบุยานพาหนะ (กรณีมี)",
        type: "checkboxGroup",
        options: [
          "รถยนต์นั่งส่วนบุคคล – อายุไม่เกิน 15 ปี",
          "รถยนต์นั่งส่วนบุคคล – อายุเกิน 15 ปี",
          "รถปิกอัพ/รถบรรทุกเล็ก/รถตู้ – อายุไม่เกิน 15 ปี",
          "รถปิกอัพ/รถบรรทุกเล็ก/รถตู้ – อายุเกิน 15 ปี",
          "รถไถ/รถเกี่ยวข้าว/รถประเภทเดียวกัน – อายุไม่เกิน 15 ปี",
          "รถไถ/รถเกี่ยวข้าว/รถประเภทเดียวกัน – อายุเกิน 15 ปี",
          "รถมอเตอร์ไซต์/เรือประมงพื้นบ้าน (ขนาดเล็ก)",
        ],
      },

      {
        key: "appliances_status",
        label: "3.8 ของใช้ในครัวเรือน",
        type: "radio",
        options: ["ไม่มีของใช้ดังกล่าว", "มีของใช้ดังกล่าว"],
      },
      {
        key: "appliances",
        label: "ระบุของใช้ (กรณีมี)",
        type: "checkboxGroup",
        options: ["คอมพิวเตอร์", "แอร์", "ทีวีจอแบน", "เครื่องซักผ้า", "ตู้เย็น"],
      },
    ],
  },

  // ───────── ข้อ 4 ครัวเรือนสถาบัน ─────────
  {
    id: "s4_institution",
    title: "4. ข้อมูลสถาบัน (เฉพาะกรณีนักเรียนอาศัยในครัวเรือนสถาบัน)",
    fields: [
      {
        key: "inst_type",
        label: "ประเภทสถาบัน",
        type: "radio",
        options: [
          "สถานสงเคราะห์ของรัฐบาล",
          "มูลนิธิ/สถานสงเคราะห์เอกชน",
          "วัด/ศาสนสถาน",
          "อื่นๆ",
        ],
      },
      {
        key: "inst_registered",
        label: "การจดทะเบียน",
        type: "radio",
        options: ["จดทะเบียน", "ไม่จดทะเบียน"],
      },
      { key: "inst_name", label: "ชื่อสถาบัน", type: "text" },
      { key: "inst_province", label: "จังหวัด", type: "text", half: true },
      { key: "inst_contact_name", label: "ชื่อผู้รับผิดชอบสถาบัน", type: "text", half: true },
      { key: "inst_phone", label: "เบอร์โทรศัพท์", type: "text", half: true },
      { key: "inst_since", label: "นักเรียนอยู่กับสถาบันตั้งแต่ (เดือน/พ.ศ.)", type: "text", half: true },
      {
        key: "inst_stay",
        label: "พักอาศัยในสถาบันแบบ",
        type: "radio",
        options: ["ประจำไม่ไปกลับ", "ไปกลับบ้านเสาร์-อาทิตย์/ช่วงปิดภาคเรียน"],
      },
      {
        key: "inst_help",
        label: "สถาบันให้ความช่วยเหลือด้วยวิธี",
        type: "checkboxGroup",
        options: [
          "ให้เงินสด",
          "ให้สิ่งของ",
          "ให้ที่พักอาศัย",
          "ให้อาหาร",
          "ให้การเดินทาง",
          "ดูแลด้านการศึกษา",
          "ดูแลด้านสุขภาพ",
        ],
      },
      { key: "inst_cost_per_student", label: "รายจ่ายในการดูแลนักเรียนรายนี้", type: "number", suffix: "บาท/คน/ปี", half: true },
      { key: "inst_num_students", label: "นักเรียนในความดูแล", type: "number", suffix: "คน", half: true },
      { key: "inst_donation", label: "รายรับจากการสนับสนุน/รับบริจาค", type: "number", suffix: "บาท/ปี" },
      { key: "inst_land_rai", label: "ที่ดิน (ไร่)", type: "number", half: true },
      { key: "inst_land_ngan", label: "ที่ดิน (งาน)", type: "number", half: true },
      { key: "inst_buildings", label: "อาคาร", type: "number", suffix: "หลัง", half: true },
      { key: "inst_vehicles_count", label: "ยานพาหนะที่ใช้งานได้", type: "number", suffix: "คัน", half: true },
      {
        key: "inst_want_subsidy",
        label: "ต้องการรับเงินอุดหนุนจาก กสศ. หรือไม่",
        type: "radio",
        options: ["ต้องการ", "ไม่ต้องการ"],
      },
    ],
  },

  // ───────── ข้อ 5 การเดินทาง ─────────
  {
    id: "s5_travel",
    title: "5. การเดินทางจากที่พักอาศัยไปโรงเรียน",
    fields: [
      {
        key: "travel_method",
        label: "วิธีเดินทางหลัก",
        type: "checkboxGroup",
        options: [
          "เดิน",
          "จักรยาน",
          "รถโรงเรียน",
          "จักรยานยนต์ส่วนตัว",
          "รถส่วนตัว",
          "เรือส่วนตัว",
          "จักรยานยนต์รับจ้าง",
          "รถโดยสารประจำทาง/รับจ้าง",
          "เรือโดยสารประจำทาง/รับจ้าง",
        ],
      },
      { key: "travel_distance_km", label: "ระยะทางบ้าน-โรงเรียน (ไป-กลับ/วัน)", type: "number", suffix: "กม.", half: true },
      { key: "travel_time_hr", label: "ใช้เวลา (ไป-กลับ/วัน)", type: "text", suffix: "ชม.:นาที", half: true, placeholder: "เช่น 1:30" },
      { key: "travel_cost_per_month", label: "ค่าใช้จ่ายในการเดินทาง", type: "number", suffix: "บาท/เดือน", half: true },
      { key: "money_per_day", label: "เงินมาโรงเรียน (ไม่รวมค่าเดินทาง)", type: "number", suffix: "บาท/วัน", half: true },
    ],
  },

  // ───────── ข้อ 6 ที่ตั้งที่พักอาศัย ─────────
  {
    id: "s6_address",
    title: "6. ที่ตั้งที่พักอาศัยนักเรียนในปัจจุบัน",
    fields: [
      { key: "addr_no", label: "บ้านเลขที่", type: "text", half: true },
      { key: "addr_moo", label: "หมู่ที่", type: "text", half: true },
      { key: "addr_soi", label: "ตรอก/ซอย", type: "text", half: true },
      { key: "addr_road", label: "ถนน", type: "text", half: true },
      { key: "addr_tambon", label: "ตำบล/แขวง", type: "text", half: true },
      { key: "addr_amphoe", label: "อำเภอ/เขต", type: "text", half: true },
      { key: "addr_province", label: "จังหวัด", type: "text", half: true },
      { key: "addr_zip", label: "รหัสไปรษณีย์", type: "text", half: true },
    ],
  },

  // ───────── ข้อ 7 ภาพถ่ายที่พักอาศัย ─────────
  {
    id: "s7_photos",
    title: "7. ภาพถ่ายที่พักอาศัยของนักเรียน",
    fields: [
      {
        key: "photo_source",
        label: "ภาพได้มาจาก",
        type: "radio",
        options: ["คุณครูลงเยี่ยมบ้านด้วยตนเอง", "ให้นักเรียนถ่ายภาพมาให้"],
      },
      {
        key: "photo_type",
        label: "ประเภทภาพถ่าย",
        type: "checkboxGroup",
        options: [
          "ภาพถ่ายที่พักอาศัย/หอพักของนักเรียน",
          "ภาพถ่ายครัวเรือนสถาบัน",
          "ภาพถ่ายนักเรียนคู่กับป้ายโรงเรียน",
        ],
      },
      {
        key: "photo_reason",
        label: "สาเหตุ (กรณีถ่ายคู่ป้ายโรงเรียน)",
        type: "checkboxGroup",
        options: [
          "ที่พักอาศัยอยู่ต่างจังหวัด",
          "ที่พักอาศัยอยู่ต่างประเทศ",
          "ไม่อนุญาตให้ถ่ายภาพที่พักอาศัย",
        ],
      },
    ],
  },

  // ───────── ข้อ 8/9 การรับรอง ─────────
  {
    id: "s8_certify",
    title: "8-9. การรับรองข้อมูล / ข้อมูลส่วนบุคคล",
    fields: [
      {
        key: "certify_truth",
        label: "การรับรองข้อมูล",
        type: "checkboxGroup",
        options: ["ข้าพเจ้าขอรับรองว่าข้อมูลข้อ 1-7 เป็นความจริง"],
      },
      {
        key: "consent_pdpa",
        label: "ข้อมูลส่วนบุคคล (PDPA)",
        type: "checkboxGroup",
        options: [
          "ข้าพเจ้ารับทราบการเก็บ-ใช้-เปิดเผยข้อมูลตาม พ.ร.บ.กสศ. และนโยบาย PDPA ของ กสศ.",
        ],
      },
    ],
  },
];

// ───────── ตารางสมาชิก (ข้อ 2) ─────────
export interface HouseholdMember {
  name?: string;
  relation?: string;
  national_id?: string;
  education?: string;
  age?: string;
  disability?: boolean;
  chronic?: boolean;
  income_wage?: string;
  income_farm?: string;
  income_business?: string;
  income_welfare?: string;
  income_other?: string;
  income_total?: string;
}

export const MEMBER_COLUMNS: { key: keyof HouseholdMember; label: string; type?: "check" | "num" }[] = [
  { key: "name", label: "ชื่อ-นามสกุล" },
  { key: "relation", label: "ความสัมพันธ์" },
  { key: "national_id", label: "เลขประจำตัวประชาชน" },
  { key: "education", label: "การศึกษาสูงสุด" },
  { key: "age", label: "อายุ" },
  { key: "disability", label: "พิการ", type: "check" },
  { key: "chronic", label: "โรคเรื้อรัง", type: "check" },
  { key: "income_wage", label: "ค่าจ้าง/เงินเดือน", type: "num" },
  { key: "income_farm", label: "เกษตร (หลังหักต้นทุน)", type: "num" },
  { key: "income_business", label: "ธุรกิจส่วนตัว", type: "num" },
  { key: "income_welfare", label: "สวัสดิการรัฐ", type: "num" },
  { key: "income_other", label: "แหล่งอื่น", type: "num" },
  { key: "income_total", label: "รวม/เดือน", type: "num" },
];

// ───────── Print rendering ─────────

export interface Kosor01PrintCtx {
  schoolName?: string;
  schoolAddress?: string;
  schoolAffiliation?: string;
  schoolLogo?: string;
  semester?: string | number;
  academicYear?: string | number;
  studentName?: string;
  studentCode?: string;
  studentNationalId?: string;
  classroomName?: string;
  visitDate?: string;
  visitorName?: string;
  directorName?: string;
  directorTitle?: string;
  povertyStatus?: string;
  latitude?: number | string;
  longitude?: number | string;
}

function val(v: any): string {
  if (v == null || v === "") return "..............................";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "..............................";
  return String(v);
}

const box = (checked: boolean): string => (checked ? "☑" : "☐");

function renderMembersTable(members: HouseholdMember[]): string {
  const rows = (members && members.length ? members : [{} as HouseholdMember]).map((m, i) => {
    return `<tr><td>${i + 1}</td>${MEMBER_COLUMNS.map((c) => {
      const v = (m as any)[c.key];
      if (c.type === "check") return `<td style="text-align:center;">${box(!!v)}</td>`;
      return `<td>${v ?? ""}</td>`;
    }).join("")}</tr>`;
  }).join("");
  return `<table class="k-mem">
    <thead><tr><th>คนที่</th>${MEMBER_COLUMNS.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderField(f: Kosor01Field, data: Record<string, any>): string {
  const v = data?.[f.key];
  if (f.type === "members") {
    return `<div class="k-field"><div class="k-label">${f.label}</div>${renderMembersTable(v || [])}</div>`;
  }
  if (f.type === "radio") {
    return `<div class="k-field"><div class="k-label">${f.label}</div><div class="k-opts">${(f.options || [])
      .map((o) => `<span class="k-opt">${box(v === o)} ${o}</span>`).join("")}</div></div>`;
  }
  if (f.type === "checkboxGroup") {
    const arr = Array.isArray(v) ? v : [];
    return `<div class="k-field"><div class="k-label">${f.label}</div><div class="k-opts">${(f.options || [])
      .map((o) => `<span class="k-opt">${box(arr.includes(o))} ${o}</span>`).join("")}</div></div>`;
  }
  if (f.type === "textarea") {
    return `<div class="k-field"><div class="k-label">${f.label}</div><div class="k-text k-multiline">${val(v)}</div></div>`;
  }
  const suffix = f.suffix ? ` <span class="k-suffix">${f.suffix}</span>` : "";
  return `<div class="k-field k-inline"><span class="k-label">${f.label}:</span> <span class="k-text">${val(v)}</span>${suffix}</div>`;
}

export function renderKosor01Html(data: Record<string, any>, ctx: Kosor01PrintCtx): string {
  const sections = KOSOR01_SECTIONS.map(
    (s) => `<div class="k-section"><div class="k-section-title">${s.title}</div>${s.fields.map((f) => renderField(f, data)).join("")}</div>`,
  ).join("");

  return `
    <style>
      .k-doc { font-family: 'Sarabun', sans-serif; font-size: 20px; color:#000; }
      .k-header { text-align:center; margin-bottom:8px; }
      .k-header img { height:54px; object-fit:contain; }
      .k-title { font-weight:700; font-size:24px; text-decoration:underline; margin-top:4px; }
      .k-school { font-weight:700; font-size:21px; }
      .k-addr { font-size:17px; }
      .k-meta { display:flex; justify-content:space-between; font-size:17px; margin:4px 0 8px; }
      .k-info { border:1px solid #000; padding:6px 10px; margin:6px 0 10px; display:grid; grid-template-columns:1fr 1fr; gap:2px 16px; font-size:19px; }
      .k-section { margin-top:8px; page-break-inside:avoid; }
      .k-section-title { font-weight:700; background:#eef; padding:3px 8px; border-left:4px solid #335; margin-bottom:4px; }
      .k-field { margin:3px 0; }
      .k-field.k-inline { display:flex; gap:6px; align-items:baseline; flex-wrap:wrap; }
      .k-label { font-weight:600; }
      .k-text { border-bottom:1px dotted #555; padding:0 6px; min-width:80px; display:inline-block; }
      .k-multiline { display:block; min-height:30px; }
      .k-opts { display:flex; flex-wrap:wrap; gap:2px 14px; padding-left:8px; }
      .k-opt { white-space:nowrap; }
      .k-suffix { color:#333; }
      table.k-mem { width:100%; border-collapse:collapse; font-size:15px; margin-top:4px; }
      table.k-mem th, table.k-mem td { border:1px solid #555; padding:2px 4px; vertical-align:top; }
      table.k-mem th { background:#f0f0f0; }
      .k-sign { margin-top:18px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; text-align:center; }
      .k-sign-line { border-top:1px dotted #000; margin-top:42px; padding-top:4px; }
      .k-photos { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-top:6px; }
      .k-photos figure { margin:0; text-align:center; font-size:16px; }
      .k-photos img { width:100%; height:200px; object-fit:cover; border:1px solid #555; }
    </style>
    <div class="k-doc">
      <div class="k-header">
        ${ctx.schoolLogo ? `<img src="${ctx.schoolLogo}" />` : ""}
        <div class="k-title">แบบ นร./กสศ. 01</div>
        <div>แบบขอรับเงินอุดหนุนนักเรียนยากจน ภาคเรียนที่ ${val(ctx.semester)} ปีการศึกษา ${val(ctx.academicYear)}</div>
      </div>
      <div class="k-meta">
        <div><b>โรงเรียน:</b> ${val(ctx.schoolName)}</div>
        <div><b>สังกัด:</b> ${val(ctx.schoolAffiliation)}</div>
      </div>

      <div class="k-info">
        <div><b>ชื่อ-สกุลนักเรียน:</b> ${val(ctx.studentName)}</div>
        <div><b>ชั้น/ห้อง:</b> ${val(ctx.classroomName)}</div>
        <div><b>เลขประจำตัวประชาชน:</b> ${val(ctx.studentNationalId)}</div>
        <div><b>รหัสนักเรียน:</b> ${val(ctx.studentCode)}</div>
        <div><b>วันที่เยี่ยมบ้าน:</b> ${val(ctx.visitDate)}</div>
        <div><b>ผู้สำรวจ/ครูผู้เยี่ยมบ้าน:</b> ${val(ctx.visitorName)}</div>
        ${ctx.povertyStatus ? `<div><b>สถานะคัดกรอง:</b> ${ctx.povertyStatus}</div>` : ""}
        ${ctx.latitude && ctx.longitude ? `<div><b>พิกัด GPS:</b> ${ctx.latitude}, ${ctx.longitude}</div>` : ""}
      </div>

      ${sections}

      <div class="k-sign">
        <div>
          <div class="k-sign-line">(${val(ctx.studentName)})</div>
          <div>นักเรียน (อายุเกิน 10 ปี)</div>
        </div>
        <div>
          <div class="k-sign-line">(${val((data as any)?.guardian_name)})</div>
          <div>ผู้ปกครอง</div>
        </div>
        <div>
          <div class="k-sign-line">(${val(ctx.visitorName)})</div>
          <div>ครูผู้สำรวจ/เยี่ยมบ้าน</div>
        </div>
      </div>
      <div class="k-sign" style="margin-top:8px;">
        <div></div>
        <div>
          <div class="k-sign-line">${ctx.directorName ? `(${ctx.directorName})` : "(...........................)"}</div>
          <div>${ctx.directorTitle || "ผู้อำนวยการสถานศึกษา (ผู้รับรอง)"}</div>
        </div>
        <div></div>
      </div>
    </div>
  `;
}
