export type OfficialDocKind =
  | "external"      // แบบ ๑ หนังสือภายนอก
  | "internal"      // แบบ ๒ บันทึกข้อความ
  | "stamp"         // แบบ ๓ หนังสือประทับตรา
  | "command"       // แบบ ๔ คำสั่ง
  | "regulation"    // แบบ ๕ ระเบียบ
  | "bylaw"         // แบบ ๖ ข้อบังคับ
  | "announcement"  // แบบ ๗ ประกาศ
  | "statement"     // แบบ ๘ แถลงการณ์
  | "news"          // แบบ ๙ ข่าว
  | "certificate"   // แบบ ๑๐ หนังสือรับรอง
  | "meeting";      // alias: หนังสือเชิญประชุม (ใช้รูปแบบ external)

export interface SchoolInfo {
  name: string;
  address: string;        // หลายบรรทัดได้ ใช้ \n
  phone?: string;
  fax?: string;
  email?: string;
}

export interface Signer {
  signature?: string;     // URL รูปลายเซ็น (optional)
  name: string;           // (นายสมชาย ใจดี)
  position: string;       // ผู้อำนวยการโรงเรียน
}

export interface OfficialDocSpec {
  kind: OfficialDocKind;
  school: SchoolInfo;
  refNo: string;          // ที่ ศธ ๐๔xxx/xxx | เลขที่ | ที่ คำสั่งที่
  date: string;           // วัน เดือน พ.ศ. แบบไทย
  subject: string;        // เรื่อง
  to?: string;            // เรียน / ถึง
  refs?: string[];        // อ้างถึง
  attachments?: string[]; // สิ่งที่ส่งมาด้วย
  body: string;           // เนื้อความ — ขึ้นย่อหน้าด้วย \n\n
  closing?: string;       // คำลงท้าย เช่น "จึงเรียนมาเพื่อโปรดทราบ"
  salutation?: string;    // "ขอแสดงความนับถือ"
  signer: Signer;
  cc?: string[];          // สำเนาเรียน
  // เฉพาะคำสั่ง/ประกาศ/ระเบียบ/ข้อบังคับ/แถลงการณ์/ข่าว
  orderNo?: string;       // คำสั่งที่ / ประกาศที่ / ที่
  orderTitle?: string;    // เรื่อง...
  // เฉพาะระเบียบ/ข้อบังคับ
  about?: string;         // ว่าด้วย ...
  edition?: string;       // (ฉบับที่ ...)
  buddhistYear?: string;  // พ.ศ. ....
  // เฉพาะคำสั่ง — "ทั้งนี้ ตั้งแต่ ..."
  effectiveFrom?: string;
  // เฉพาะแถลงการณ์/ข่าว — "ฉบับที่ ..."
  issueNo?: string;
  // ชั้นความลับ/ความเร็ว (แสดงหัว-ท้าย)
  classification?: string; // เช่น "ลับ", "ลับมาก"
  urgency?: string;        // เช่น "ด่วน", "ด่วนมาก", "ด่วนที่สุด"
}
