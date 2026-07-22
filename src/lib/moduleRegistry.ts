// Registry of toggleable modules. Admin can disable any of these.
// Core modules (Home, Profile, Users, System Settings, Hub, Academic Management,
// Students DMC, Module Toggles itself, Auth) are NOT listed here and cannot be disabled.

export type ModuleGroup =
  | "academic"
  | "student"
  | "general"
  | "finance"
  | "hr"
  | "integrations"
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
  // วิชาการ
  { key: "pp2", label: "ปพ.2 ประกาศนียบัตร", labelEn: "PP.2 Certificate", desc: "ออกใบประกาศนียบัตรผู้สำเร็จการศึกษา", group: "academic", urlPrefixes: ["/dashboard/academic/certificate"] },
  { key: "pp3", label: "ปพ.3 รายงานผู้สำเร็จ", labelEn: "PP.3 Graduation Report", desc: "แบบรายงานผู้สำเร็จการศึกษา", group: "academic", urlPrefixes: ["/dashboard/academic/pp3"] },
  { key: "pp4", label: "ปพ.4 คุณลักษณะ", labelEn: "PP.4 Character Record", desc: "แบบแสดงผลการพัฒนาคุณลักษณะอันพึงประสงค์", group: "academic", urlPrefixes: ["/dashboard/academic/pp4"] },
  { key: "pp5", label: "ปพ.5 บันทึกคะแนน", labelEn: "PP.5 Grade Book", desc: "บันทึกคะแนนและผลการเรียนรายวิชา", group: "academic", urlPrefixes: ["/dashboard/academic/pp5"] },
  { key: "pp6", label: "ปพ.6 รายงานพัฒนาการ", labelEn: "PP.6 Development Report", desc: "รายงานผลการพัฒนาผู้เรียนรายภาคเรียน", group: "academic", urlPrefixes: ["/dashboard/academic/pp6"] },
  { key: "pp7", label: "ปพ.7 ใบรับรอง", labelEn: "PP.7 Certificate", desc: "ใบรับรองผลการศึกษา", group: "academic", urlPrefixes: ["/dashboard/academic/pp7"] },
  { key: "pp8", label: "ปพ.8 ระเบียนสะสม", labelEn: "PP.8 Cumulative Record", desc: "ระเบียนสะสมรายบุคคล", group: "academic", urlPrefixes: ["/dashboard/academic/pp8"] },
  { key: "transcript", label: "ปพ.1 ผลการเรียน", labelEn: "PP.1 Transcript", desc: "ระเบียนแสดงผลการเรียนรายบุคคล", group: "academic", urlPrefixes: ["/dashboard/academic/transcript"] },
  { key: "schedule", label: "ตารางเรียน-ตารางสอน", labelEn: "Schedule", desc: "ตารางเรียนรายห้องและตารางสอนรายครู", group: "academic", urlPrefixes: ["/dashboard/academic/schedule"] },
  { key: "homework", label: "การบ้าน", labelEn: "Homework", desc: "มอบหมายและตรวจการบ้านออนไลน์", group: "academic", urlPrefixes: ["/dashboard/homework"] },
  { key: "exam_ocr", label: "ข้อสอบ (OCR)", labelEn: "Exam System", desc: "สแกนและตรวจข้อสอบอัตโนมัติ", group: "academic", urlPrefixes: ["/dashboard/exam"] },
  { key: "calendar", label: "ปฏิทินวิชาการ", labelEn: "Academic Calendar", desc: "ปฏิทินกิจกรรมและกำหนดการวิชาการ", group: "academic", urlPrefixes: ["/dashboard/academic/calendar"] },

  // กิจการนักเรียน
  { key: "attendance", label: "เช็คชื่อการมาเรียน", labelEn: "Attendance", desc: "บันทึกการมาเรียนรายวัน/รายคาบ", group: "student", urlPrefixes: ["/dashboard/student/attendance"] },
  { key: "behavior", label: "พฤติกรรมนักเรียน", labelEn: "Behavior", desc: "บันทึกพฤติกรรมและคะแนนความประพฤติ", group: "student", urlPrefixes: ["/dashboard/student/behavior"] },
  { key: "leave_student", label: "ใบลานักเรียน", labelEn: "Student Leave", desc: "ยื่นและอนุมัติใบลานักเรียน", group: "student", urlPrefixes: ["/dashboard/student/leave"] },
  { key: "screening", label: "คัดกรองนักเรียน", labelEn: "Screening", desc: "คัดกรองด้าน SDQ/EQ", group: "student", urlPrefixes: ["/dashboard/student/screening"] },
  { key: "homeroom", label: "โฮมรูม", labelEn: "Homeroom", desc: "บันทึกกิจกรรมโฮมรูมประจำวัน", group: "student", urlPrefixes: ["/dashboard/student/homeroom"] },
  { key: "sdq", label: "SDQ", labelEn: "SDQ", desc: "แบบประเมินจุดแข็ง-จุดอ่อน", group: "student", urlPrefixes: ["/dashboard/student/sdq"] },
  { key: "home_visit", label: "เยี่ยมบ้าน", labelEn: "Home Visit", desc: "บันทึกการเยี่ยมบ้านนักเรียน", group: "student", urlPrefixes: ["/dashboard/student/home-visit"] },
  { key: "face_scan", label: "สแกนหน้าเช็คชื่อ", labelEn: "Face Check-in", desc: "เช็คชื่อด้วยใบหน้า/QR แจ้ง LINE ผู้ปกครอง", group: "student", urlPrefixes: ["/dashboard/student/face-scan"] },
  { key: "health_trend", label: "แนวโน้มสุขภาพ", labelEn: "Health Trend", desc: "กราฟพัฒนาการสุขภาพนักเรียน", group: "student", urlPrefixes: ["/dashboard/student/health-trend"] },
  { key: "eform_inbox", label: "กล่อง E-Form", labelEn: "E-Form Inbox", desc: "อ่านและลงนามเอกสารที่ได้รับ", group: "student", urlPrefixes: ["/dashboard/eform-inbox"] },

  // บริหารทั่วไป
  { key: "news", label: "ข่าวสาร", labelEn: "News", desc: "ข่าวและประกาศประชาสัมพันธ์", group: "general", urlPrefixes: ["/dashboard/admin/news"] },
  { key: "documents", label: "สารบรรณ", labelEn: "Documents", desc: "หนังสือราชการรับ-ส่ง", group: "general", urlPrefixes: ["/dashboard/admin/document"] },
  { key: "eform", label: "E-Form", labelEn: "E-Form", desc: "แบบฟอร์มอิเล็กทรอนิกส์", group: "general", urlPrefixes: ["/dashboard/admin/eform"] },
  { key: "vaccine", label: "วัคซีน", labelEn: "Vaccine", desc: "บันทึกการรับวัคซีน", group: "general", urlPrefixes: ["/dashboard/admin/vaccine"] },
  { key: "lunch", label: "อาหารกลางวัน", labelEn: "Lunch", desc: "เมนูและงบอาหารกลางวัน", group: "general", urlPrefixes: ["/dashboard/admin/school-lunch"] },
  { key: "milk", label: "นมโรงเรียน", labelEn: "School Milk", desc: "โครงการอาหารเสริม (นม)", group: "general", urlPrefixes: ["/dashboard/admin/school-milk"] },
  { key: "pdca", label: "แผนปฏิบัติการ PDCA", labelEn: "Action Plan", desc: "วงจร Plan-Do-Check-Act", group: "general", urlPrefixes: ["/dashboard/admin/action-plan"] },
  { key: "emergency", label: "แจ้งเหตุฉุกเฉิน", labelEn: "Emergency", desc: "ประกาศเหตุฉุกเฉิน", group: "general", urlPrefixes: ["/dashboard/admin/emergency"] },

  // งบประมาณและพัสดุ
  { key: "budget", label: "งบประมาณและบัญชี", labelEn: "Budget", desc: "บริหารงบประมาณและบัญชี", group: "finance", urlPrefixes: ["/dashboard/finance/budget"] },
  { key: "procurement", label: "จัดซื้อจัดจ้าง", labelEn: "Procurement", desc: "จัดซื้อจัดจ้าง e-GP", group: "finance", urlPrefixes: ["/dashboard/finance/procurement"] },
  { key: "assets", label: "ทะเบียนพัสดุ", labelEn: "Assets", desc: "ทะเบียนพัสดุและครุภัณฑ์", group: "finance", urlPrefixes: ["/dashboard/finance/assets"] },
  { key: "subsidy", label: "เงินอุดหนุน", labelEn: "Subsidies", desc: "เงินอุดหนุนรายหัวนักเรียน", group: "finance", urlPrefixes: ["/dashboard/finance/subsidy"] },

  // บุคลากร (HR)
  { key: "hr_attendance", label: "การมาทำงานครู", labelEn: "Staff Attendance", desc: "สรุปการมาปฏิบัติงานของบุคลากร", group: "hr", urlPrefixes: ["/dashboard/hr/attendance-dashboard"] },
  { key: "time_clock", label: "ลงเวลาทำงาน", labelEn: "Time Clock", desc: "บันทึกเวลาเข้า-ออกงาน", group: "hr", urlPrefixes: ["/dashboard/hr/time-clock"] },
  { key: "dpa", label: "วPA / DPA", labelEn: "vPA / DPA", desc: "ประเมินวิทยฐานะข้าราชการครู", group: "hr", urlPrefixes: ["/dashboard/hr/evaluation"] },
  { key: "salary", label: "เงินเดือน", labelEn: "Salary", desc: "เงินเดือนและสวัสดิการบุคลากร", group: "hr", urlPrefixes: ["/dashboard/hr/salary"] },
  { key: "id_plan", label: "ID Plan", labelEn: "ID Plan", desc: "แผนพัฒนาตนเองรายบุคคล", group: "hr", urlPrefixes: ["/dashboard/hr/id-plan"] },
  { key: "disc", label: "DISC", labelEn: "DISC", desc: "ประเมินบุคลิกภาพแบบ DISC", group: "hr", urlPrefixes: ["/dashboard/hr/assessment"] },
  { key: "staff_leave", label: "ใบลาบุคลากร", labelEn: "Staff Leave", desc: "ยื่นและอนุมัติใบลาบุคลากร", group: "hr", urlPrefixes: ["/dashboard/hr/leave"] },
  { key: "substitute", label: "สอนแทน", labelEn: "Substitute", desc: "มอบหมายและติดตามการสอนแทน", group: "hr", urlPrefixes: ["/dashboard/hr/substitute"] },

  // การเชื่อมต่อและเครื่องมือ
  { key: "cms", label: "เว็บไซต์ (CMS)", labelEn: "Website CMS", desc: "จัดการเนื้อหาเว็บไซต์โรงเรียน", group: "integrations", urlPrefixes: ["/dashboard/admin/cms"] },
  { key: "line", label: "LINE OA", labelEn: "LINE OA", desc: "แจ้งเตือน/แชทบอทผ่าน LINE OA", group: "integrations", urlPrefixes: ["/dashboard/admin/line-settings"] },
  { key: "google_chat", label: "Google Chat", labelEn: "Google Chat", desc: "Webhook แจ้งเตือน Google Chat", group: "integrations", urlPrefixes: ["/dashboard/admin/webhooks"] },
  { key: "district_feed", label: "District Feed API", labelEn: "District Feed", desc: "ส่งข้อมูลไปเขตพื้นที่การศึกษา", group: "integrations", urlPrefixes: ["/dashboard/admin/district-feed"] },
  { key: "district_sync", label: "District Sync", labelEn: "District Sync", desc: "สถานะ snapshot รายคืน + คิวส่งข้อมูล (retry/DLQ)", group: "integrations", urlPrefixes: ["/dashboard/admin/district-sync"] },
  { key: "analytics", label: "วิเคราะห์ข้อมูล", labelEn: "Analytics", desc: "วิเคราะห์ข้อมูลภาพรวมโรงเรียน", group: "integrations", urlPrefixes: ["/dashboard/admin/analytics"] },
  { key: "audit_log", label: "Audit Log", labelEn: "Audit Log", desc: "บันทึกการใช้งานระบบ", group: "integrations", urlPrefixes: ["/dashboard/admin/audit-log"] },
  { key: "system_health", label: "สุขภาพระบบ", labelEn: "System Health", desc: "สถานะ AI, ผู้ใช้ออนไลน์, error logs", group: "integrations", urlPrefixes: ["/dashboard/admin/system-health"] },
  { key: "role_troubleshoot", label: "ตรวจสิทธิ์ตาราง", labelEn: "Role Troubleshoot", desc: "ทดสอบว่า role ปัจจุบันอ่านแต่ละตารางได้หรือไม่", group: "integrations", urlPrefixes: ["/dashboard/admin/role-troubleshoot"] },
  { key: "bulk_ops", label: "ทำทีละหลายคน (Bulk)", labelEn: "Bulk Ops", desc: "นำเข้า/แก้ไขข้อมูลทีละมาก", group: "integrations", urlPrefixes: ["/dashboard/admin/bulk-operations"] },
  { key: "id_cards", label: "บัตรประจำตัว", labelEn: "ID Cards", desc: "พิมพ์บัตรนักเรียนและบุคลากร", group: "integrations", urlPrefixes: ["/dashboard/admin/id-card", "/dashboard/admin/bulk-id", "/dashboard/admin/bulk-qr", "/dashboard/admin/qr"] },
  { key: "print_center", label: "ศูนย์งานพิมพ์", labelEn: "Print Center", desc: "พิมพ์เอกสารและบัตรรวมศูนย์", group: "integrations", urlPrefixes: ["/dashboard/admin/print-center"] },
  { key: "field_visibility", label: "การแสดงข้อมูลโปรไฟล์", labelEn: "Field Visibility", desc: "ควบคุมการแสดงฟิลด์โปรไฟล์", group: "integrations", urlPrefixes: ["/dashboard/admin/field-visibility"] },
  { key: "school_location", label: "ตำแหน่งโรงเรียน", labelEn: "School Location", desc: "พิกัด GPS สำหรับลงเวลา", group: "integrations", urlPrefixes: ["/dashboard/admin/school-location"] },
  { key: "social_feed", label: "Social Wall (Facebook)", labelEn: "Social Wall", desc: "ดึงโพสต์จาก Facebook Page", group: "integrations", urlPrefixes: ["/dashboard/admin/social-feed"] },
  { key: "ai_integrations", label: "API & AI", labelEn: "API & AI", desc: "Secrets ผู้ให้บริการ AI และคีย์พูล", group: "integrations", urlPrefixes: ["/dashboard/admin/api-keys", "/dashboard/admin/ai-providers", "/dashboard/admin/ai-key-pool", "/dashboard/admin/secrets", "/dashboard/admin/ai-import", "/dashboard/admin/ai-analytics"] },
  { key: "backup_external", label: "สำรองข้อมูลภายนอก", labelEn: "External Backup", desc: "Backup ไป Google Drive/S3", group: "integrations", urlPrefixes: ["/dashboard/admin/backup-external"] },

  // โมดูลเสริม
  { key: "help", label: "ศูนย์ช่วยเหลือ", labelEn: "Help Center", desc: "คู่มือ FAQ และวิธีใช้งาน", group: "extras", urlPrefixes: ["/dashboard/help", "/help"] },
  { key: "garbage", label: "ธนาคารขยะ", labelEn: "Garbage Bank", desc: "สะสมแต้มขยะรีไซเคิลและของรางวัล", group: "extras", urlPrefixes: ["/dashboard/garbage"] },
  { key: "iot", label: "IoT อุปกรณ์อัจฉริยะ", labelEn: "IoT Smart Devices", desc: "อุปกรณ์ IoT ในโรงเรียน", group: "extras", urlPrefixes: ["/dashboard/iot"] },
  { key: "ict_loans", label: "ยืม-คืน ICT", labelEn: "ICT Loans", desc: "ยืม-คืนอุปกรณ์ ICT", group: "extras", urlPrefixes: ["/dashboard/admin/ict-loans", "/dashboard/admin/ict-loan-history", "/dashboard/admin/ict-devices", "/dashboard/admin/ict-loan-report"] },
];

export const GROUP_LABELS: Record<ModuleGroup, { th: string; en: string }> = {
  academic: { th: "วิชาการ / เอกสาร ปพ.", en: "Academic / PP Documents" },
  student: { th: "กิจการนักเรียน", en: "Student Affairs" },
  general: { th: "บริหารทั่วไป", en: "General Admin" },
  finance: { th: "งบประมาณและพัสดุ", en: "Budget & Assets" },
  hr: { th: "บุคลากร (HR)", en: "HR" },
  integrations: { th: "การเชื่อมต่อและเครื่องมือ", en: "Integrations & Tools" },
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
