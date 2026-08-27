import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

type Lang = "th" | "en" | "mm";
type Entry = Partial<Record<Lang, string>> & { th: string; en: string };
type Translations = Record<string, Entry>;

const translations: Translations = {
  // General
  "app.name": { th: "Smart School System", en: "Smart School System", mm: "Smart School System" },
  "app.subtitle": { th: "ระบบบริหารจัดการโรงเรียนอัจฉริยะ", en: "Intelligent School Management System", mm: "ထက်မြက်သော ကျောင်းစီမံခန့်ခွဲမှု စနစ်" },
  "login": { th: "เข้าสู่ระบบ", en: "Login", mm: "ဝင်ရောက်ရန်" },
  "logout": { th: "ออกจากระบบ", en: "Logout", mm: "ထွက်ရန်" },
  "email": { th: "อีเมล", en: "Email", mm: "အီးမေးလ်" },
  "password": { th: "รหัสผ่าน", en: "Password", mm: "စကားဝှက်" },
  "dashboard": { th: "แดชบอร์ด", en: "Dashboard", mm: "ဒက်ရှ်ဘုတ်" },
  "users": { th: "จัดการผู้ใช้", en: "User Management", mm: "အသုံးပြုသူ စီမံ" },
  "search": { th: "ค้นหา...", en: "Search...", mm: "ရှာဖွေရန်..." },
  "save": { th: "บันทึก", en: "Save", mm: "သိမ်းမည်" },
  "cancel": { th: "ยกเลิก", en: "Cancel", mm: "ပယ်ဖျက်" },
  "edit": { th: "แก้ไข", en: "Edit", mm: "ပြင်ဆင်" },
  "delete": { th: "ลบ", en: "Delete", mm: "ဖျက်မည်" },
  "add": { th: "เพิ่ม", en: "Add", mm: "ထည့်" },
  "actions": { th: "การดำเนินการ", en: "Actions", mm: "လုပ်ဆောင်ချက်" },
  "name": { th: "ชื่อ", en: "Name", mm: "အမည်" },
  "role": { th: "บทบาท", en: "Role", mm: "အခန်းကဏ္ဍ" },
  "status": { th: "สถานะ", en: "Status", mm: "အခြေအနေ" },
  "active": { th: "ใช้งาน", en: "Active", mm: "လုပ်ဆောင်နေ" },
  "inactive": { th: "ไม่ใช้งาน", en: "Inactive", mm: "မလုပ်ဆောင်" },
  "confirm_delete": { th: "ยืนยันการลบ?", en: "Confirm delete?", mm: "ဖျက်ရန် သေချာပါသလား?" },

  // Roles
  "role.admin": { th: "ผู้ดูแลระบบ", en: "Admin", mm: "စီမံခန့်ခွဲသူ" },
  "role.teacher": { th: "ครู", en: "Teacher", mm: "ဆရာ" },
  "role.student": { th: "นักเรียน", en: "Student", mm: "ကျောင်းသား" },
  "role.director": { th: "ผู้อำนวยการ", en: "Director", mm: "ကျောင်းအုပ်" },
  "role.alumni": { th: "ศิษย์เก่า", en: "Alumni", mm: "ကျောင်းသားဟောင်း" },
  "role.parent": { th: "ผู้ปกครอง", en: "Parent", mm: "မိဘ" },
  "role.observer": { th: "ศึกษานิเทศก์ (อ่านอย่างเดียว)", en: "Observer", mm: "လေ့လာသူ" },

  // Departments
  "dept.academic": { th: "ฝ่ายวิชาการ", en: "Academic Affairs" },
  "dept.student_affairs": { th: "ฝ่ายกิจการนักเรียน", en: "Student Affairs" },
  "dept.general_admin": { th: "ฝ่ายบริหารงานทั่วไป", en: "General Administration" },
  "dept.budget_hr": { th: "ฝ่ายงบประมาณและบุคคล", en: "Budget & HR" },

  // Dashboard stats
  "stat.total_students": { th: "นักเรียนทั้งหมด", en: "Total Students", mm: "စုစုပေါင်း ကျောင်းသား" },
  "stat.total_teachers": { th: "ครูทั้งหมด", en: "Total Teachers", mm: "စုစုပေါင်း ဆရာ" },
  "stat.total_classes": { th: "ห้องเรียนทั้งหมด", en: "Total Classes", mm: "စုစုပေါင်း အတန်း" },
  "stat.attendance_rate": { th: "อัตราการเข้าเรียน", en: "Attendance Rate", mm: "တက်ရောက်မှု နှုန်း" },

  // Academic sub-menus
  "academic.grades": { th: "บันทึกคะแนน/ตัดเกรด", en: "Grades & GPA" },
  "academic.enrollment": { th: "ลงทะเบียนวิชาเรียน", en: "Course Registration" },
  "academic.schedule": { th: "ตารางเรียน-ตารางสอน", en: "Class Schedule" },
  "academic.transcript": { th: "ระเบียนผลการเรียน (ปพ.1)", en: "Transcript (ปพ.1)" },
  "academic.admission": { th: "รับสมัครนักเรียน", en: "Admission" },
  "academic.homework": { th: "การบ้านออนไลน์", en: "Online Homework" },
  "academic.exam": { th: "ระบบสอบ/ข้อสอบ", en: "Exam System" },
  "academic.report": { th: "รายงานผลการเรียน", en: "Report Card" },
  "academic.certificate": { th: "วุฒิการศึกษา (ปพ.2)", en: "Certificate (ปพ.2)" },
  "academic.student_record": { th: "ผลพัฒนาคุณภาพ (ปพ.5)", en: "Student Record (ปพ.5)" },

  // Student Affairs sub-menus
  "student.attendance": { th: "เช็กชื่อ/การเข้าเรียน", en: "Attendance", mm: "တက်ရောက်မှု" },
  "student.behavior": { th: "ความประพฤติ", en: "Behavior", mm: "အပြုအမူ" },
  "student.leave": { th: "ระบบการลา", en: "Leave System", mm: "ခွင့်ယူခြင်း" },
  "student.screening": { th: "คัดกรองนักเรียน", en: "Student Screening" },
  "student.homeroom": { th: "กิจกรรมโฮมรูม", en: "Homeroom" },
  "student.sdq": { th: "ประเมิน SDQ", en: "SDQ Assessment" },
  "student.home_visit": { th: "เยี่ยมบ้านนักเรียน", en: "Home Visit" },

  // General Admin sub-menus
  "admin.health": { th: "ห้องพยาบาล/สุขภาพ", en: "Health Room" },
  "admin.news": { th: "ข่าวสาร/ประกาศ", en: "News & Announcements" },
  "admin.info_dashboard": { th: "Dashboard สารสนเทศ", en: "Info Dashboard" },
  "admin.document": { th: "สารบรรณอิเล็กทรอนิกส์", en: "E-Saraban" },
  "admin.emergency": { th: "ประกาศฉุกเฉิน", en: "Emergency Broadcast" },
  "admin.vaccine": { th: "บันทึกวัคซีน", en: "Vaccine Records" },

  // Budget & HR sub-menus
  "hr.personnel": { th: "ข้อมูลบุคลากร", en: "Personnel Data" },
  "hr.time_clock": { th: "ลงเวลา", en: "Time Clock" },
  "hr.leave": { th: "ลาออนไลน์ (บุคลากร)", en: "Staff Leave" },
  "hr.evaluation": { th: "ประเมิน 360 องศา", en: "360° Evaluation" },
  "hr.substitute": { th: "จัดสอนแทน", en: "Substitute Teaching" },

  // Signup
  "signup.title": { th: "สมัครสมาชิก", en: "Sign Up", mm: "အကောင့်ဖွင့်ရန်" },
  "signup.subtitle": { th: "สร้างบัญชีผู้ใช้ใหม่", en: "Create a new account", mm: "အကောင့်အသစ် ဖန်တီးပါ" },
  "signup.button": { th: "สมัครสมาชิก", en: "Sign Up", mm: "အကောင့်ဖွင့်ရန်" },
  "signup.success": { th: "สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมล", en: "Sign up successful! Please verify your email.", mm: "အောင်မြင်ပါသည်! အီးမေးလ်ကို အတည်ပြုပါ။" },
  "signup.have_account": { th: "มีบัญชีอยู่แล้ว?", en: "Already have an account?", mm: "အကောင့်ရှိပြီးသား?" },
  "signup.no_account": { th: "ยังไม่มีบัญชี?", en: "Don't have an account?", mm: "အကောင့်မရှိသေး?" },
  "signup.password_min": { th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", en: "Password must be at least 6 characters", mm: "စကားဝှက် အနည်းဆုံး ၆ လုံး လိုသည်" },
  "no_access": { th: "ไม่มีสิทธิ์เข้าถึง", en: "Access Denied", mm: "ဝင်ရောက်ခွင့် မရှိပါ" },

  // User management
  "user.add": { th: "เพิ่มผู้ใช้ใหม่", en: "Add New User" },
  "user.edit": { th: "แก้ไขผู้ใช้", en: "Edit User" },
  "user.first_name": { th: "ชื่อจริง", en: "First Name", mm: "နာမည်ရင်း" },
  "user.last_name": { th: "นามสกุล", en: "Last Name", mm: "မျိုးနွယ်အမည်" },
  "user.phone": { th: "เบอร์โทร", en: "Phone", mm: "ဖုန်း" },
  "user.total": { th: "ผู้ใช้ทั้งหมด", en: "Total Users", mm: "စုစုပေါင်း အသုံးပြုသူ" },

  // Language
  "language": { th: "ภาษา", en: "Language", mm: "ဘာသာစကား" },
  "language.thai": { th: "ไทย", en: "Thai", mm: "ထိုင်း" },
  "language.english": { th: "อังกฤษ", en: "English", mm: "အင်္ဂလိပ်" },
  "language.myanmar": { th: "พม่า", en: "Myanmar", mm: "မြန်မာ" },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const STORAGE_KEY = "app.uiLang";
const LEGACY_STORAGE_KEY = "app.lang";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "th";
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "en" || saved === "mm" || saved === "th") return saved;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY) as Lang | null;
    return legacy === "en" || legacy === "mm" || legacy === "th" ? legacy : "th";
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "mm" ? "my" : lang;
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      // Fallback chain: requested → en → th → key
      return entry[lang] ?? entry.en ?? entry.th ?? key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
