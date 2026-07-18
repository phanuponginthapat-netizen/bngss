// แปลชื่อตัวแปร (token) ของเทมเพลตพิมพ์ → คำอธิบายภาษาไทย
// ใช้ทั้งใน palette ด้านบน, WordLikeEditor และ OverlayDesigner

const MAP: Record<string, string> = {
  // โรงเรียน
  "school.name": "ชื่อโรงเรียน",
  "school.address": "ที่อยู่โรงเรียน",
  "school.phone": "เบอร์โทรโรงเรียน",
  "school.logo": "โลโก้โรงเรียน",
  "school.director": "ผู้อำนวยการ",

  // ห้องเรียน / ภาคเรียน
  "class.label": "ชั้น/ห้อง",
  "class.name": "ชื่อห้องเรียน",
  "class.grade": "ระดับชั้น",
  "class.room": "ห้อง",
  "semester": "ภาคเรียน",
  "year": "ปีการศึกษา",
  "beYear year": "ปีการศึกษา (พ.ศ.)",
  "thaiDate today": "วันที่ปัจจุบัน (ไทย)",
  "today": "วันที่ปัจจุบัน",

  // นักเรียน
  "student.full_name": "ชื่อ-นามสกุลนักเรียน",
  "student.first_name": "ชื่อนักเรียน",
  "student.last_name": "นามสกุลนักเรียน",
  "student.student_code": "รหัสนักเรียน",
  "student.id_card": "เลขบัตรประชาชน",
  "student.birth_date": "วันเกิด",
  "student.gender": "เพศ",
  "student.address": "ที่อยู่นักเรียน",
  "student.photo": "รูปนักเรียน",
  "student.gpa": "เกรดเฉลี่ย",
  "student.father_name": "ชื่อบิดา",
  "student.mother_name": "ชื่อมารดา",
  "student.guardian_name": "ผู้ปกครอง",

  // ครู / บุคลากร
  "teacher.full_name": "ชื่อ-นามสกุลครู",
  "teacher.position": "ตำแหน่ง",
  "teacher.signature": "ลายเซ็นครู",

  // โครงสร้าง
  "#each students": "เริ่มวนรายชื่อนักเรียน",
  "/each": "จบการวน",
  "#each students} ... {{/each": "วนรายชื่อนักเรียน (loop)",
};

export const tokenThaiLabel = (token: string): string => {
  // รับได้ทั้ง "{{school.name}}" หรือ "school.name"
  const raw = token.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
  if (MAP[raw]) return MAP[raw];

  // helper เช่น "beYear year" → ลองทั้งคู่
  const parts = raw.split(/\s+/);
  if (parts.length > 1 && MAP[raw]) return MAP[raw];

  // แปลงจุด → ภาษาไทยอัตโนมัติเบื้องต้น
  return raw;
};
