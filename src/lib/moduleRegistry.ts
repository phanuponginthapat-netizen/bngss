// Registry of toggleable modules. Admin can disable any of these.
// Core modules (Home, Profile, Users, System Settings, Hub, Academic Management,
// Students DMC, Module Toggles itself, Auth) are NOT listed here and cannot be disabled.

export type ModuleGroup =
  | "academic"
  | "student"
  | "general"
  | "finance"
  | "operations"
  | "hr"
  | "integrations"
  | "security"
  | "extras";

export type ModuleDef = {
  key: string;
  /** Thai label */
  label: string;
  /** English label */
  labelEn: string;
  /** Short description (Thai) */
  desc: string;
  group: ModuleGroup;
  /** Route prefixes — any pathname starting with one of these belongs to this module */
  urlPrefixes: string[];
  /** Default to enabled when not configured */
  defaultEnabled?: boolean;
};

export const MODULES: ModuleDef[] = [
  // Academic
  { key: "pp2", label: "วุฒิการศึกษา ปพ.2", labelEn: "PP.2", desc: "ออกใบวุฒิการศึกษา", group: "academic", urlPrefixes: ["/dashboard/academic/certificate"] },
  { key: "pp3", label: "ปพ.3 รายงานผู้สำเร็จ", labelEn: "PP.3", desc: "เอกสารผู้สำเร็จการศึกษา", group: "academic", urlPrefixes: ["/dashboard/academic/pp3"] },
  { key: "pp4", label: "ปพ.4 แผนการเรียน", labelEn: "PP.4", desc: "เอกสารแผนการเรียน", group: "academic", urlPrefixes: ["/dashboard/academic/pp4"] },
  { key: "pp5", label: "ปพ.5 ระเบียนผลการเรียน", labelEn: "PP.5", desc: "ระเบียนคะแนน/เกรด", group: "academic", urlPrefixes: ["/dashboard/academic/pp5"] },
  { key: "pp6", label: "ปพ.6 รายงานพัฒนา", labelEn: "PP.6", desc: "รายงานพัฒนาผู้เรียน", group: "academic", urlPrefixes: ["/dashboard/academic/pp6"] },
  { key: "pp7", label: "ปพ.7 ใบรับรอง", labelEn: "PP.7", desc: "ใบรับรองผลการเรียน", group: "academic", urlPrefixes: ["/dashboard/academic/pp7"] },
  { key: "pp8", label: "ปพ.8 ระเบียนสะสม", labelEn: "PP.8", desc: "ระเบียนสะสมรายบุคคล", group: "academic", urlPrefixes: ["/dashboard/academic/pp8"] },
  { key: "transcript", label: "ระเบียน ปพ.1", labelEn: "Transcript", desc: "ออกใบ ปพ.1", group: "academic", urlPrefixes: ["/dashboard/academic/transcript"] },
  { key: "schedule", label: "ตารางสอน/ตารางเรียน", labelEn: "Schedule", desc: "ตารางสอนรายห้อง/รายครู", group: "academic", urlPrefixes: ["/dashboard/academic/schedule"] },
  { key: "homework", label: "การบ้าน", labelEn: "Homework", desc: "มอบหมาย/ส่งการบ้านออนไลน์", group: "academic", urlPrefixes: ["/dashboard/homework"] },
  { key: "exam_ocr", label: "OCR ข้อสอบ", labelEn: "Exam OCR", desc: "สแกน-ตรวจข้อสอบอัตโนมัติ", group: "academic", urlPrefixes: ["/dashboard/exam"] },
  { key: "e_learning", label: "E-Learning สื่อการเรียน", labelEn: "E-Learning", desc: "แขวนเกม HTML/วิดีโอ/PDF ให้นักเรียนเข้าใช้ในระบบ + ลิงก์สาธารณะ", group: "academic", urlPrefixes: ["/dashboard/academic/learning", "/dashboard/learning", "/learn"] },
  { key: "calendar", label: "ปฏิทินวิชาการ", labelEn: "Calendar", desc: "ปฏิทินกิจกรรม", group: "academic", urlPrefixes: ["/dashboard/academic/calendar"] },
  { key: "teaching_reflection", label: "บันทึกหลังการสอน", labelEn: "Teaching Reflection", desc: "บันทึกผลการสอน ประเมิน K/P/A แนบชิ้นงาน ลงนาม 5 ระดับ", group: "academic", urlPrefixes: ["/dashboard/academic/teaching-reflections"] },

  // Student affairs
  { key: "attendance", label: "เช็กชื่อ", labelEn: "Attendance", desc: "บันทึกการมาเรียน", group: "student", urlPrefixes: ["/dashboard/student/attendance"] },
  { key: "behavior", label: "ความประพฤติ", labelEn: "Behavior", desc: "บันทึกพฤติกรรม + คะแนน", group: "student", urlPrefixes: ["/dashboard/student/behavior"] },
  { key: "leave_student", label: "การลานักเรียน", labelEn: "Student Leave", desc: "ใบลา/ขออนุญาต", group: "student", urlPrefixes: ["/dashboard/student/leave"] },
  { key: "screening", label: "คัดกรองนักเรียน", labelEn: "Screening", desc: "คัดกรอง SDQ/EQ", group: "student", urlPrefixes: ["/dashboard/student/screening"] },
  { key: "homeroom", label: "โฮมรูม", labelEn: "Homeroom", desc: "บันทึกโฮมรูม", group: "student", urlPrefixes: ["/dashboard/student/homeroom"] },
  { key: "sdq", label: "SDQ", labelEn: "SDQ", desc: "แบบประเมิน SDQ", group: "student", urlPrefixes: ["/dashboard/student/sdq"] },
  { key: "home_visit", label: "เยี่ยมบ้าน", labelEn: "Home Visit", desc: "บันทึกเยี่ยมบ้าน", group: "student", urlPrefixes: ["/dashboard/student/home-visit"] },
  { key: "face_scan", label: "สแกนหน้า", labelEn: "Face Scan", desc: "เช็คชื่อด้วยใบหน้า + รายงาน LINE", group: "student", urlPrefixes: ["/dashboard/student/face-scan"] },
  { key: "health_trend", label: "สุขภาพ-แนวโน้ม", labelEn: "Health Trend", desc: "กราฟพัฒนาการสุขภาพนักเรียน", group: "student", urlPrefixes: ["/dashboard/student/health-trend"] },
  { key: "eform_inbox", label: "กล่องจดหมาย E-Form", labelEn: "E-Form Inbox", desc: "อ่าน/ลงนามเอกสารที่ได้รับ", group: "student", urlPrefixes: ["/dashboard/eform-inbox"] },

  // General admin
  { key: "news", label: "ข่าวสาร", labelEn: "News", desc: "ประกาศ/ข่าวประชาสัมพันธ์", group: "general", urlPrefixes: ["/dashboard/admin/news"] },
  { key: "documents", label: "สารบรรณ", labelEn: "Documents", desc: "ระบบเอกสารราชการ", group: "general", urlPrefixes: ["/dashboard/admin/document"] },
  { key: "eform", label: "E-Form", labelEn: "E-Form", desc: "แบบฟอร์มอิเล็กทรอนิกส์", group: "general", urlPrefixes: ["/dashboard/admin/eform"] },
  { key: "vaccine", label: "วัคซีน", labelEn: "Vaccine", desc: "บันทึกการรับวัคซีน", group: "general", urlPrefixes: ["/dashboard/admin/vaccine"] },
  { key: "lunch", label: "อาหารกลางวัน", labelEn: "Lunch", desc: "เมนู/งบอาหารกลางวัน", group: "general", urlPrefixes: ["/dashboard/admin/school-lunch"] },
  { key: "milk", label: "นมโรงเรียน", labelEn: "Milk", desc: "โครงการนมโรงเรียน", group: "general", urlPrefixes: ["/dashboard/admin/school-milk"] },
  { key: "pdca", label: "PDCA / แผนปฏิบัติ", labelEn: "Action Plan", desc: "วงจร PDCA", group: "general", urlPrefixes: ["/dashboard/admin/action-plan"] },
  { key: "emergency", label: "เหตุฉุกเฉิน", labelEn: "Emergency", desc: "ประกาศเหตุฉุกเฉิน", group: "general", urlPrefixes: ["/dashboard/admin/emergency"] },

  // Finance
  { key: "budget", label: "งบ & บัญชี", labelEn: "Budget", desc: "งบประมาณและบัญชี", group: "finance", urlPrefixes: ["/dashboard/finance/budget"] },
  { key: "procurement", label: "จัดซื้อจัดจ้าง", labelEn: "Procurement", desc: "ระบบจัดซื้อ e-GP", group: "finance", urlPrefixes: ["/dashboard/finance/procurement"] },
  { key: "assets", label: "ทรัพย์สิน", labelEn: "Assets", desc: "ทะเบียนพัสดุ/ครุภัณฑ์", group: "finance", urlPrefixes: ["/dashboard/finance/assets"] },
  { key: "subsidy", label: "เงินอุดหนุน", labelEn: "Subsidies", desc: "เงินอุดหนุนรายหัว", group: "finance", urlPrefixes: ["/dashboard/finance/subsidy"] },

  // HR
  { key: "hr_attendance", label: "การมาทำงานครู", labelEn: "Staff Attendance", desc: "Dashboard การมาทำงาน", group: "hr", urlPrefixes: ["/dashboard/hr/attendance-dashboard"] },
  { key: "time_clock", label: "ลงเวลาทำงาน", labelEn: "Time Clock", desc: "ตอกบัตรเข้า-ออก", group: "hr", urlPrefixes: ["/dashboard/hr/time-clock"] },
  { key: "dpa", label: "DPA / วิทยฐานะ", labelEn: "DPA", desc: "ประเมินวิทยฐานะ", group: "hr", urlPrefixes: ["/dashboard/hr/evaluation"] },
  { key: "salary", label: "เงินเดือน", labelEn: "Salary", desc: "ระบบเงินเดือน", group: "hr", urlPrefixes: ["/dashboard/hr/salary"] },
  { key: "id_plan", label: "ID Plan", labelEn: "ID Plan", desc: "แผนพัฒนารายบุคคล", group: "hr", urlPrefixes: ["/dashboard/hr/id-plan"] },
  { key: "disc", label: "DISC", labelEn: "DISC", desc: "ประเมินบุคลิกภาพ DISC", group: "hr", urlPrefixes: ["/dashboard/hr/assessment"] },
  { key: "staff_leave", label: "ลาบุคลากร", labelEn: "Staff Leave", desc: "ใบลาบุคลากร", group: "hr", urlPrefixes: ["/dashboard/hr/leave"] },
  { key: "substitute", label: "สอนแทน", labelEn: "Substitute", desc: "ระบบสอนแทน", group: "hr", urlPrefixes: ["/dashboard/hr/substitute"] },

  // Integrations & extras
  { key: "cms", label: "เว็บไซต์ (CMS)", labelEn: "Website CMS", desc: "จัดการเว็บไซต์โรงเรียน", group: "integrations", urlPrefixes: ["/dashboard/admin/cms"] },
  { key: "line", label: "LINE OA", labelEn: "LINE", desc: "แจ้งเตือน/Chatbot ผ่าน LINE", group: "integrations", urlPrefixes: ["/dashboard/admin/line-settings"] },
  { key: "google_chat", label: "Google Chat", labelEn: "Google Chat", desc: "Webhook Google Chat", group: "integrations", urlPrefixes: ["/dashboard/admin/webhooks"] },
  { key: "district_feed", label: "District Feed API", labelEn: "District Feed", desc: "API ส่งข้อมูลไปเขต", group: "integrations", urlPrefixes: ["/dashboard/admin/district-feed"] },
  { key: "analytics", label: "Analytics", labelEn: "Analytics", desc: "วิเคราะห์ภาพรวม", group: "integrations", urlPrefixes: ["/dashboard/admin/analytics"] },
  { key: "audit_log", label: "Audit Log", labelEn: "Audit Log", desc: "บันทึกการใช้งานระบบ", group: "integrations", urlPrefixes: ["/dashboard/admin/audit-log"] },
  { key: "bulk_ops", label: "Bulk Operations", labelEn: "Bulk Ops", desc: "นำเข้า/แก้ไขกลุ่ม", group: "integrations", urlPrefixes: ["/dashboard/admin/bulk-operations"] },
  { key: "id_cards", label: "บัตรประจำตัว", labelEn: "ID Cards", desc: "พิมพ์บัตรนักเรียน/บุคลากร", group: "integrations", urlPrefixes: ["/dashboard/admin/id-card", "/dashboard/admin/bulk-id", "/dashboard/admin/bulk-qr", "/dashboard/admin/qr"] },
  { key: "print_center", label: "ศูนย์พิมพ์เอกสาร", labelEn: "Print Center", desc: "พิมพ์เอกสาร/บัตรแบบรวม", group: "integrations", urlPrefixes: ["/dashboard/admin/print-center"] },
  { key: "field_visibility", label: "การแสดงข้อมูลโปรไฟล์", labelEn: "Field Visibility", desc: "ควบคุมการแสดงฟิลด์โปรไฟล์", group: "integrations", urlPrefixes: ["/dashboard/admin/field-visibility"] },
  { key: "school_location", label: "ตำแหน่งโรงเรียน", labelEn: "School Location", desc: "พิกัด GPS สำหรับลงเวลา", group: "integrations", urlPrefixes: ["/dashboard/admin/school-location"] },
  { key: "social_feed", label: "Social Wall (Facebook)", labelEn: "Social Wall", desc: "ดึงโพสต์ FB Page เข้าระบบ", group: "integrations", urlPrefixes: ["/dashboard/admin/social-feed"] },
  { key: "ai_integrations", label: "API & Secrets", labelEn: "API & Secrets", desc: "ศูนย์รวม Secrets, AI Providers, Key Pool", group: "integrations", urlPrefixes: ["/dashboard/admin/api-keys", "/dashboard/admin/ai-providers", "/dashboard/admin/ai-key-pool", "/dashboard/admin/secrets", "/dashboard/admin/ai-import", "/dashboard/admin/ai-analytics"] },
  { key: "backup_external", label: "สำรองข้อมูลภายนอก", labelEn: "External Backup", desc: "Backup ไป Google Drive/S3", group: "integrations", urlPrefixes: ["/dashboard/admin/backup-external"] },

  // Extras
  { key: "garbage", label: "ธนาคารขยะ", labelEn: "Garbage Bank", desc: "ระบบสะสมแต้มขยะ + รางวัล", group: "extras", urlPrefixes: ["/dashboard/garbage"] },
  { key: "iot", label: "IoT / สมาร์ทดีไวซ์", labelEn: "IoT", desc: "อุปกรณ์ IoT ในโรงเรียน", group: "extras", urlPrefixes: ["/dashboard/iot"] },
  { key: "ict_loans", label: "ยืม-คืน ICT", labelEn: "ICT Loans", desc: "ระบบยืมคืนอุปกรณ์ ICT", group: "extras", urlPrefixes: ["/dashboard/admin/ict-loans", "/dashboard/admin/ict-loan-history", "/dashboard/admin/ict-devices", "/dashboard/admin/ict-loan-report"] },

  // ===== NEW MODULES =====
  // Finance — เพิ่มเติม
  { key: "tuition", label: "ค่าเทอม/ค่ากิจกรรม", labelEn: "Tuition", desc: "ใบเรียกเก็บ + QR PromptPay + ติดตามชำระ", group: "finance", urlPrefixes: ["/dashboard/finance/tuition"] },
  { key: "scholarships", label: "ทุนการศึกษา/กยศ.", labelEn: "Scholarships", desc: "ทุนการศึกษาและการมอบทุน", group: "finance", urlPrefixes: ["/dashboard/finance/scholarships"] },
  { key: "coop", label: "สหกรณ์โรงเรียน", labelEn: "School Co-op", desc: "สมาชิก หุ้น ฝาก-ถอน-กู้", group: "finance", urlPrefixes: ["/dashboard/finance/coop"] },

  // Operations — หมวดใหม่
  { key: "library", label: "ห้องสมุด", labelEn: "Library", desc: "หนังสือ + ยืม-คืน + ค่าปรับ", group: "operations", urlPrefixes: ["/dashboard/library"] },
  { key: "cafeteria", label: "โรงอาหาร", labelEn: "Cafeteria", desc: "เมนูประจำวัน + สั่งล่วงหน้า", group: "operations", urlPrefixes: ["/dashboard/cafeteria"] },
  { key: "bus", label: "รถรับ-ส่งนักเรียน", labelEn: "School Bus", desc: "เส้นทาง จุดจอด นักเรียนที่ใช้บริการ", group: "operations", urlPrefixes: ["/dashboard/bus"] },

  // Academic — เพิ่มเติม
  { key: "question_bank", label: "คลังข้อสอบกลาง", labelEn: "Question Bank", desc: "แชร์ข้อสอบระหว่างครู", group: "academic", urlPrefixes: ["/dashboard/academic/question-bank"] },
  { key: "tutoring", label: "ติว/สอนเสริม", labelEn: "Tutoring", desc: "ครูเปิดคิวติว นักเรียนจอง", group: "academic", urlPrefixes: ["/dashboard/academic/tutoring"] },
  { key: "guidance", label: "แนะแนว", labelEn: "Guidance", desc: "บันทึกการให้คำปรึกษานักเรียน", group: "student", urlPrefixes: ["/dashboard/student/guidance"] },
  { key: "alumni_uni", label: "ติดตามศิษย์เก่า (มหา'ลัย)", labelEn: "Alumni University", desc: "ศิษย์เก่าที่ศึกษาต่อ/ทำงาน", group: "academic", urlPrefixes: ["/dashboard/academic/alumni-university"] },

  // General Admin — เพิ่มเติม
  { key: "saraban", label: "e-Saraban สารบรรณ", labelEn: "e-Saraban", desc: "รับ-ส่งหนังสือราชการ", group: "general", urlPrefixes: ["/dashboard/admin/saraban"] },
  { key: "mou", label: "MOU/ความร่วมมือ", labelEn: "MOU", desc: "บันทึกความร่วมมือกับหน่วยงาน", group: "general", urlPrefixes: ["/dashboard/admin/mou"] },
  { key: "room_booking", label: "จองห้องประชุม", labelEn: "Room Booking", desc: "จองห้องล่วงหน้า รออนุมัติ", group: "general", urlPrefixes: ["/dashboard/admin/room-bookings"] },
  { key: "vehicle_booking", label: "จองรถส่วนกลาง", labelEn: "Vehicle Booking", desc: "ขออนุมัติใช้รถยนต์โรงเรียน", group: "general", urlPrefixes: ["/dashboard/admin/vehicle-bookings"] },
  { key: "sar", label: "SAR ประกันคุณภาพ", labelEn: "SAR Quality", desc: "หลักฐาน 3 มาตรฐาน OBEC", group: "general", urlPrefixes: ["/dashboard/admin/sar"] },

  // Security — หมวดใหม่
  { key: "visitor", label: "บันทึกผู้มาติดต่อ", labelEn: "Visitor Log", desc: "ลงทะเบียนผู้มาติดต่อ + บัตร QR", group: "security", urlPrefixes: ["/dashboard/security/visitors"] },
  { key: "cctv", label: "CCTV กล้องวงจรปิด", labelEn: "CCTV", desc: "จัดการ + ดูสตรีมกล้อง HLS", group: "security", urlPrefixes: ["/dashboard/security/cctv"] },
  { key: "early_warning", label: "Early Warning AI", labelEn: "Early Warning", desc: "นักเรียนเสี่ยง + ข้อเสนอแนะ", group: "security", urlPrefixes: ["/dashboard/security/early-warning"] },
];

export const GROUP_LABELS: Record<ModuleGroup, { th: string; en: string }> = {
  academic: { th: "วิชาการ / เอกสาร ปพ.", en: "Academic / PP Documents" },
  student: { th: "กิจการนักเรียน", en: "Student Affairs" },
  general: { th: "บริหารทั่วไป", en: "General Admin" },
  finance: { th: "งบประมาณ & การเงิน", en: "Finance" },
  operations: { th: "ปฏิบัติการประจำวัน", en: "Daily Operations" },
  hr: { th: "บุคลากร", en: "HR" },
  integrations: { th: "การเชื่อมต่อ & เครื่องมือ", en: "Integrations & Tools" },
  security: { th: "ความปลอดภัย & AI", en: "Security & AI" },
  extras: { th: "โมดูลเสริม", en: "Extra Modules" },
};

const URL_TO_KEY_CACHE = new Map<string, string | null>();

/** Find which module key (if any) owns this pathname. Returns null for core/uncovered routes. */
export function getModuleKeyForPath(pathname: string): string | null {
  if (URL_TO_KEY_CACHE.has(pathname)) return URL_TO_KEY_CACHE.get(pathname)!;
  let best: { key: string; len: number } | null = null;
  for (const m of MODULES) {
    for (const p of m.urlPrefixes) {
      if (pathname === p || pathname.startsWith(p + "/")) {
        if (!best || p.length > best.len) best = { key: m.key, len: p.length };
      }
    }
  }
  const result = best?.key ?? null;
  URL_TO_KEY_CACHE.set(pathname, result);
  return result;
}
