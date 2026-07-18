import { useState, useMemo, useEffect, useRef } from "react";
import {
  GraduationCap, BookOpen, Users, ClipboardList, Calendar, CalendarDays, CalendarRange,
  FileText, BarChart3, Shield, ShieldCheck, IdCard,
  Megaphone, Activity, Star, Home, LayoutDashboard,
  UserCog, ChevronDown, Award, Syringe, Globe, User, MessageSquare, UserCheck,
  DollarSign, ShoppingCart, Package, Heart, Banknote, Clock, BookOpenCheck, Brain, AlertTriangle,
  UtensilsCrossed, Milk, ClipboardCheck, FolderOpen, Building2, Network, Database, Inbox, Settings as SettingsIcon,
  Search, X, Recycle, History, TrendingUp, Coins, Trophy, QrCode, Cpu, Wifi, ScanLine, ScanFace, MapPin, Power, Sparkles, DoorOpen
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { getModuleKeyForPath } from "@/lib/moduleRegistry";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  color?: string;
  desc?: string;
};

type Department = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  color?: string;
  desc?: string;
  items: MenuItem[];
};

const renderTooltip = (title: string, desc?: string) =>
  desc
    ? ({
        children: (
          <div className="max-w-[260px]">
            <div className="font-semibold text-[13px]">{title}</div>
            <div className="text-[11px] opacity-80 mt-0.5 leading-snug">{desc}</div>
          </div>
        ),
      } as any)
    : title;


export function AppSidebar() {
  const { state, setOpen, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, lang } = useLanguage();
  const location = useLocation();
  const { role } = useUserRole();
  const [search, setSearch] = useState("");
  const isFirstRender = useRef(true);
  // Force sidebar to be expanded on mount (clear any legacy collapsed cookie state).
  useEffect(() => {
    if (!isMobile) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Keep sidebar expanded on route change so icons always show labels.
    // Only collapse the mobile drawer overlay after navigating.
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);
  // Explicit click fallback: close the mobile drawer only.
  // Desktop sidebar stays expanded per user request.
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const { appName, schoolName, schoolLogo } = useSystemSettings();
  const { isModuleEnabled } = useModuleToggles();
  const headerTitle = appName;
  const headerSubtitle = schoolName && schoolName !== appName ? schoolName : "";

  const LogoMark = () => (
    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
      {schoolLogo ? (
        <img src={schoolLogo} alt={headerTitle} className="w-full h-full object-contain" />
      ) : (
        <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );

  const L = (th: string, en: string) => lang === "th" ? th : en;

  type CompactItem = { to: string; icon: any; label: string; color?: string };
  type CompactSection = { label: string; icon?: any; items: CompactItem[] };

  // Compact sidebar with section headings — used by alumni and parent
  const renderCompactSidebar = (sections: CompactSection[]) => (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <SidebarHeader className={`${collapsed ? 'px-1.5' : 'px-4'} py-5 border-b border-sidebar-border transition-all`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">{headerTitle}</h2>
              <p className="text-xs text-sidebar-foreground/60 truncate">{headerSubtitle}</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className={`${collapsed ? 'px-1' : 'px-2'} py-3 gap-0 transition-all`}>
        {sections.map((sec, si) => (
          <SidebarGroup key={si} className="!p-0">
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider px-2 h-8 mt-1 flex items-center gap-2">
                {sec.icon && <sec.icon className="w-3.5 h-3.5" />}
                <span>{sec.label}</span>
              </SidebarGroupLabel>
            )}
            {collapsed && si > 0 && <div className="mx-auto my-2 h-px w-6 bg-sidebar-border/60" />}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {sec.items.map((it, itIdx) => (
                  <SidebarMenuItem key={`${si}-${itIdx}-${it.to}`}>
                    <SidebarMenuButton asChild tooltip={it.label}>
                      <NavLink onClick={handleNavClick} to={it.to} end className={`text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors ${collapsed ? 'justify-center' : ''}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                        <it.icon className={`w-4 h-4 flex-shrink-0 ${it.color || 'text-info'} ${collapsed ? '' : 'mr-2'}`} />
                        {!collapsed && <span className="truncate">{it.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );

  const alumniSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("แดชบอร์ด", "Dashboard"), color: "text-info" },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile"), color: "text-info" },
        { to: "/dashboard/portfolio", icon: Award, label: L("ผลงานของฉัน", "My Portfolio"), color: "text-warning" },
        { to: "/dashboard/fitness", icon: Activity, label: L("ฟิตเนส", "Fitness"), color: "text-success" },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed"), color: "text-danger" },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members"), color: "text-success" },
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar"), color: "text-success" },
      ],
    },
  ]);

  const parentSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("แดชบอร์ด", "Dashboard"), color: "text-info" },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile"), color: "text-info" },
        { to: "/dashboard/inbox", icon: Inbox, label: L("กล่องข้อความ", "Inbox"), color: "text-info" },
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed"), color: "text-danger" },
      ],
    },
    {
      label: L("ลูกของฉัน", "My Child"),
      icon: Heart,
      items: [
        { to: "/dashboard/student/attendance", icon: ClipboardList, label: L("การมาเรียน", "Attendance"), color: "text-success" },
        { to: "/dashboard/student/behavior", icon: Shield, label: L("พฤติกรรม", "Behavior"), color: "text-danger" },
        { to: "/dashboard/student/leave", icon: FileText, label: L("ยื่นใบลา", "Leave"), color: "text-warning" },
        { to: "/dashboard/student/health-trend", icon: Heart, label: L("สุขภาพ", "Health"), color: "text-danger" },
        { to: "/dashboard/homework", icon: BookOpenCheck, label: L("การบ้าน", "Homework"), color: "text-success" },
        { to: "/dashboard/academic/schedule", icon: Calendar, label: L("ตารางเรียน", "Schedule"), color: "text-warning" },
        { to: "/dashboard/fitness", icon: Activity, label: L("ฟิตเนส", "Fitness"), color: "text-success" },
      ],
    },
    {
      label: L("กิจกรรม", "Activities"),
      icon: Trophy,
      items: [
        { to: "/dashboard/activities", icon: Trophy, label: L("กิจกรรม & การแข่งขัน", "Activities"), color: "text-warning" },
        { to: "/dashboard/sports-day", icon: Trophy, label: L("กีฬาสี", "Sports Day"), color: "text-warning" },
        { to: "/dashboard/clubs", icon: Sparkles, label: L("ชุมนุม & ชมรม", "Clubs"), color: "text-primary" },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar"), color: "text-success" },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members"), color: "text-success" },
      ],
    },
  ]);


  // Concise main items
  const mainItems: MenuItem[] = [
    { title: L("แดชบอร์ด", "Dashboard"), url: "/dashboard", icon: LayoutDashboard, color: "text-info", desc: L("ภาพรวมการทำงานและสรุปข้อมูลสำคัญ", "Overview and key stats") },
    { title: L("เว็บไซต์โรงเรียน", "School Website"), url: "/", icon: Globe, color: "text-info", desc: L("ดูหน้าเว็บโรงเรียนสำหรับบุคคลภายนอก", "Public school website") },
    { title: L("โปรไฟล์ของฉัน", "My Profile"), url: "/dashboard/profile", icon: User, color: "text-info", desc: L("ข้อมูลส่วนตัวและการตั้งค่าบัญชี", "Personal info & account settings") },
    { title: L("กล่องข้อความ", "Inbox"), url: "/dashboard/inbox", icon: Inbox, color: "text-info", desc: L("ข้อความ แจ้งเตือน และเอกสารที่ส่งถึงคุณ", "Messages, notifications & docs to you") },
    { title: L("ฟีดโรงเรียน", "Feed"), url: "/dashboard/feed", icon: Megaphone, color: "text-danger", desc: L("โพสต์ กิจกรรม และผลงานจากทุกคนในโรงเรียน", "Posts, activities & work from everyone") },
    { title: L("ฟิตเนส (แคลอรี/อาหาร/ออกกำลังกาย)", "Fitness Tracker"), url: "/dashboard/fitness", icon: Activity, color: "text-success", desc: L("บันทึกแคลอรี อาหาร การออกกำลังกาย", "Calories, food & exercise log") },
    { title: L("กิจกรรม & การแข่งขัน", "Activities"), url: "/dashboard/activities", icon: Trophy, color: "text-warning", desc: L("สร้างกิจกรรม ลงทะเบียน บันทึกคะแนน และโพสผลขึ้นฟีดอัตโนมัติ", "Create events, register, score, auto-post results") },
    { title: L("กีฬาสี", "Sports Day"), url: "/dashboard/sports-day", icon: Trophy, color: "text-warning", desc: L("งานกีฬาสี คณะสี และตารางคะแนนเหรียญรวม", "Sports Day, houses, medal leaderboard") },
    { title: L("ชุมนุม & ชมรม", "Clubs"), url: "/dashboard/clubs", icon: Sparkles, color: "text-primary", desc: L("ฮับชุมนุม สมาชิก ประธาน เช็คชื่อ ผลงาน รับสมัคร และ TO BE NUMBER ONE", "Clubs hub: members, attendance, works & recruitment") },
    { title: L("ผลงานของฉัน", "My Portfolio"), url: "/dashboard/portfolio", icon: Award, color: "text-warning", desc: L("แขวนผลงาน เอกสาร วิดีโอ ในโปรไฟล์สาธารณะ", "Showcase your work on public profile") },
    { title: L("สมาชิกโรงเรียน", "Members"), url: "/dashboard/members", icon: Users, color: "text-success", desc: L("ค้นหาสมาชิกและดูผลงานของแต่ละคน", "Browse members and view portfolios") },
    { title: L("ลงเวลาเข้างาน", "Clock In/Out"), url: "/dashboard/hr/time-clock", icon: Clock, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("บันทึกเวลาเข้า-ออกงานของบุคลากร", "Staff check-in / check-out") },
    { title: L("สแกนนักเรียน", "Scan Student"), url: "/dashboard/student/face-scan", icon: ScanFace, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อนักเรียนด้วยใบหน้า/QR และแจ้งผู้ปกครอง", "Face/QR check-in + LINE notify parent") },
    { title: L("ลงทะเบียนใบหน้าของฉัน", "Register My Face"), url: "/dashboard/student/face-scan", icon: ScanFace, color: "text-info", roles: ["student"], desc: L("ถ่ายรูปใบหน้าตัวเองส่งให้แอดมินอนุมัติ", "Submit your face photo for approval") },
  ];

  const departments: Department[] = [
    // ===== 1. CONTENT & USERS =====
    {
      key: "content_users",
      label: L("เนื้อหา & ผู้ใช้", "Content & Users"),
      icon: UserCog, color: "text-info",
      roles: ["admin", "director"],
      items: [
        { title: L("จัดการผู้ใช้งาน", "Users"), url: "/dashboard/users", icon: UserCog, color: "text-info", roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้", "Add, edit & deactivate users") },
        { title: L("ผู้สังเกตการณ์ (Observer)", "Observers"), url: "/dashboard/admin/observers", icon: UserCog, color: "text-warning", roles: ["admin"], desc: L("บัญชีบุคคลภายนอก ดูระบบอย่างเดียว", "External read-only viewers") },
        { title: L("ศูนย์รวมโมดูล", "Module Hub"), url: "/dashboard/hub", icon: Network, color: "text-danger", roles: ["admin", "director"], desc: L("เข้าถึงทุกโมดูลจากที่เดียว", "Quick access to every module") },
        { title: L("เว็บไซต์โรงเรียน (CMS)", "Website CMS"), url: "/dashboard/admin/cms", icon: FileText, color: "text-danger", roles: ["admin", "director"], desc: L("แก้ไขเนื้อหาเว็บไซต์", "Edit public site content") },
        { title: L("ออกแบบบัตรประจำตัว", "ID Cards"), url: "/dashboard/admin/id-card", icon: IdCard, color: "text-danger", roles: ["admin", "director"], desc: L("ออกแบบบัตรประจำตัว", "Design ID cards") },
        { title: L("ศูนย์พิมพ์บัตรนักเรียน", "ID Card Print"), url: "/dashboard/admin/print-center", icon: FileText, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("พิมพ์บัตรนักเรียน พร้อม QR", "Print student ID cards") },
      ],
    },

    // ===== 2. SYSTEM SETTINGS =====
    {
      key: "system_settings",
      label: L("ตั้งค่าระบบ", "System Settings"),
      icon: SettingsIcon, color: "text-neutral",
      roles: ["admin", "director"],
      items: [
        { title: L("ระบบ & Cloud", "System & Cloud"), url: "/dashboard/admin/system-settings", icon: SettingsIcon, color: "text-neutral", roles: ["admin", "director"], desc: L("ชื่อระบบ โลโก้ โดเมน", "App name, logo, domain") },
        { title: L("ปีการศึกษา & ภาคเรียน", "Academic Year"), url: "/dashboard/admin/semester-settings", icon: CalendarRange, color: "text-warning", roles: ["admin", "director"], desc: L("เดือนเริ่ม/สิ้นสุดปีการศึกษา", "Year/semester config") },
        { title: L("ช่วงเทอม (วันเปิด-ปิด)", "Academic Periods"), url: "/dashboard/admin/academic-periods", icon: CalendarRange, color: "text-warning", roles: ["admin", "director"], desc: L("วันที่จริงของแต่ละเทอม", "Real semester dates") },
        { title: L("ตำแหน่งโรงเรียน (GPS)", "School Location"), url: "/dashboard/admin/school-location", icon: MapPin, color: "text-danger", roles: ["admin", "director"], desc: L("พิกัด GPS สำหรับลงเวลา", "GPS geofence") },
        { title: L("การแสดงข้อมูลโปรไฟล์", "Field Visibility"), url: "/dashboard/admin/field-visibility", icon: Shield, color: "text-success", roles: ["admin", "director"], desc: L("ใครเห็นฟิลด์ใดได้", "Profile field visibility") },
        { title: L("เปิด-ปิดโมดูล", "Module Toggles"), url: "/dashboard/admin/module-toggles", icon: Power, color: "text-warning", roles: ["admin", "director"], desc: L("เปิด/ปิดโมดูลของโรงเรียน", "Enable/disable modules") },
        { title: L("อัปเดตระบบ", "System Update"), url: "/dashboard/admin/system-update", icon: Power, color: "text-danger", roles: ["admin", "director"], desc: L("ดูเวอร์ชันและอัปเดต", "View version & update") },
        { title: L("สำรองข้อมูลภายนอก", "External Backup"), url: "/dashboard/admin/backup-external", icon: Database, color: "text-info", roles: ["admin", "director"], desc: L("สำรองไปยังบริการภายนอก", "External DB backups") },
      ],
    },

    // ===== 3. MONITORING & REPORTS =====
    {
      key: "monitoring",
      label: L("ตรวจสอบ & รายงาน", "Monitoring & Reports"),
      icon: BarChart3, color: "text-success",
      roles: ["admin", "director"],
      items: [
        { title: L("Analytics ภาพรวม", "Analytics"), url: "/dashboard/admin/analytics", icon: BarChart3, color: "text-success", roles: ["admin", "director"], desc: L("สถิติและตัวชี้วัด", "Usage & KPIs") },
        { title: L("Audit Log", "Audit Log"), url: "/dashboard/admin/audit-log", icon: Activity, color: "text-danger", roles: ["admin", "director"], desc: L("ประวัติการกระทำในระบบ", "User audit trail") },
        { title: L("ดำเนินการเป็นชุด (Bulk)", "Bulk Ops"), url: "/dashboard/admin/bulk-operations", icon: Users, color: "text-info", roles: ["admin", "director"], desc: L("เลื่อนชั้น/ลบ/แก้ผู้ใช้จำนวนมาก", "Bulk user actions") },
        { title: L("District Feed API", "District Feed API"), url: "/dashboard/admin/district-feed", icon: Database, color: "text-info", roles: ["admin", "director"], desc: L("ส่งข้อมูลเขตพื้นที่", "Feed for district office") },
        { title: L("คะแนน O-NET / NT / PISA", "Test Scores"), url: "/dashboard/admin/test-scores", icon: BarChart3, color: "text-success", roles: ["admin", "director"], desc: L("คะแนนสอบส่ง Hub กลาง", "Central hub scores") },
        { title: L("ศูนย์ข้อมูล สมศ.", "SMSC Center"), url: "/dashboard/admin/smsc", icon: ShieldCheck, color: "text-info", roles: ["admin", "director"], desc: L("3 มาตรฐาน สมศ.", "SMSC KPIs") },
        { title: L("มาตรฐาน สพฐ.", "OBEC Standards"), url: "/dashboard/admin/obec-standards", icon: ShieldCheck, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ปพ./เกรด/SDQ/สมศ.", "OBEC reference") },
      ],
    },

    // ===== 4. INTEGRATIONS (external services) =====
    {
      key: "integrations",
      label: L("การเชื่อมต่อภายนอก", "Integrations"),
      icon: Network, color: "text-info",
      roles: ["admin", "director"],
      items: [
        { title: L("Google Chat", "Google Chat"), url: "/dashboard/admin/webhooks", icon: MessageSquare, color: "text-success", roles: ["admin", "director"], desc: L("Webhook แจ้งเตือน Google Chat", "Google Chat webhook") },
        { title: L("LINE OA", "LINE OA"), url: "/dashboard/admin/line-settings", icon: MessageSquare, color: "text-success", roles: ["admin", "director"], desc: L("เชื่อม LINE OA", "Connect LINE OA") },
        { title: L("Social Wall (Facebook)", "Social Wall (FB)"), url: "/dashboard/admin/social-feed", icon: MessageSquare, color: "text-info", roles: ["admin", "director"], desc: L("ดึงโพสต์ FB Page", "Pull FB posts") },
      ],
    },

    // ===== 4b. AI HUB — รวมเมนู AI ทั้งหมด =====
    {
      key: "ai_hub",
      label: L("AI & ระบบอัจฉริยะ", "AI & Intelligence"),
      icon: Sparkles, color: "text-danger",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("API & Secrets (ศูนย์รวม)", "API & Secrets Hub"), url: "/dashboard/admin/api-keys", icon: SettingsIcon, color: "text-danger", roles: ["admin", "director"], desc: L("Secrets + AI providers + key pool", "Secrets & AI providers") },
        { title: L("AI นำเข้าข้อมูล", "AI Import"), url: "/dashboard/admin/ai-import", icon: Database, color: "text-info", roles: ["admin"], desc: L("AI ช่วยอ่านเอกสาร", "AI document import") },
        { title: L("Analytics การใช้ AI", "AI Analytics"), url: "/dashboard/admin/ai-analytics", icon: BarChart3, color: "text-success", roles: ["admin", "director"], desc: L("ปริมาณ AI ต้นทุน หัวข้อ", "AI usage & cost") },
        { title: L("Early Warning AI", "Early Warning AI"), url: "/dashboard/security/early-warning", icon: AlertTriangle, color: "text-danger", roles: ["admin","director","teacher"], desc: L("นักเรียนเสี่ยง + ข้อเสนอแนะ", "At-risk students") },
      ],
    },

    // ===== 5. ACADEMIC (รวม academic + academic_plus) =====
    {
      key: "academic",
      label: L("งานวิชาการ", "Academic"),
      icon: BookOpen, color: "text-info",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("จัดการวิชาการ", "Management"), url: "/dashboard/academic/management", icon: BookOpen, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ห้องเรียน รายวิชา ครูประจำชั้น", "Classes, subjects, homeroom") },
        { title: L("ทะเบียนนักเรียน (DMC)", "Students (DMC)"), url: "/dashboard/academic/all-students", icon: Users, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลนักเรียนตามมาตรฐาน DMC", "All students (DMC)") },
        { title: L("ทะเบียนศิษย์เก่า", "Alumni"), url: "/dashboard/academic/alumni", icon: GraduationCap, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลศิษย์เก่า", "Alumni records") },
        { title: L("สิ้นปีการศึกษา (เลื่อนชั้นอัตโนมัติ)", "Year-End Promotion"), url: "/dashboard/academic/year-end-promotion", icon: GraduationCap, color: "text-warning", roles: ["admin", "director"], desc: L("เลื่อนชั้นทั้งโรงเรียน + Holding Zone รอยต่อ", "Auto-promote + holding zone") },
        { title: L("ติดตามศิษย์เก่า (มหาวิทยาลัย)", "Alumni University"), url: "/dashboard/academic/alumni-university", icon: Building2, color: "text-success", roles: ["admin","director","teacher","alumni"], desc: L("ศิษย์เก่าที่ศึกษาต่อ/ทำงาน", "Higher-ed tracking") },
        { title: L("ตารางเรียน-ตารางสอน", "Schedule"), url: "/dashboard/academic/schedule", icon: Calendar, color: "text-warning", roles: ["admin", "director", "teacher", "student"], desc: L("ตารางเรียน/ตารางสอน", "Class & teaching schedules") },
        { title: L("สแกนเช็คชื่อรายวิชา", "Subject Period Scan"), url: "/dashboard/academic/subject-scan", icon: ScanLine, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อรายคาบด้วย QR", "Per-period QR check-in") },
        { title: L("ระเบียนผลการเรียน ปพ.1", "Transcript ปพ.1"), url: "/dashboard/academic/transcript", icon: FileText, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("ระเบียนผลการเรียน", "Transcript") },
        { title: L("วุฒิการศึกษา ปพ.2", "Certificate ปพ.2"), url: "/dashboard/academic/certificate", icon: Award, color: "text-warning", roles: ["admin", "director"], desc: L("ใบประกาศนียบัตร", "Graduation certificate") },
        { title: L("รายงานผู้สำเร็จการศึกษา ปพ.3", "ปพ.3"), url: "/dashboard/academic/pp3", icon: FileText, color: "text-danger", roles: ["admin", "director"], desc: L("ผู้จบการศึกษาประจำปี", "Annual graduates") },
        { title: L("แบบรายงานการพัฒนา ปพ.4", "ปพ.4"), url: "/dashboard/academic/pp4", icon: BookOpen, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("พัฒนาคุณลักษณะ", "Desired traits") },
        { title: L("บันทึกผลการเรียน ปพ.5", "ปพ.5"), url: "/dashboard/academic/pp5", icon: ClipboardList, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("คะแนนรายวิชา", "Per-subject grading") },
        { title: L("บันทึกหลังการสอน", "Teaching Reflection"), url: "/dashboard/academic/teaching-reflections", icon: ClipboardList, color: "text-primary", roles: ["admin", "director", "teacher"], desc: L("บันทึกผลการสอน + ลงนามอนุมัติ", "Post-teaching reflection + signoff") },
        { title: L("เอกสารแสดงผลการเรียน ปพ.6", "ปพ.6"), url: "/dashboard/academic/pp6", icon: FileText, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("รายงานพัฒนาผู้เรียน", "Learner report") },
        { title: L("ใบรับรองผลการเรียน ปพ.7", "ปพ.7"), url: "/dashboard/academic/pp7", icon: FileText, color: "text-info", roles: ["admin", "director"], desc: L("ใบรับรองผลการเรียน", "Result certificate") },
        { title: L("ระเบียนสะสม ปพ.8", "ปพ.8"), url: "/dashboard/academic/pp8", icon: FolderOpen, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ระเบียนสะสมนักเรียน", "Cumulative records") },
        { title: L("รายงานผล 0/ร/มส", "Incomplete Grades"), url: "/dashboard/academic/incomplete-grades", icon: AlertTriangle, color: "text-danger", roles: ["admin", "director", "teacher", "student", "parent"], desc: L("ติด 0, ร, มส", "Incomplete grades") },
        { title: L("ตรวจสอบการแมพครู", "Teacher Mapping"), url: "/dashboard/academic/teacher-mapping", icon: UserCheck, color: "text-warning", roles: ["admin", "director"], desc: L("ตรวจ/แก้ไขการแมพชื่อครูกับบุคลากร", "Review teacher name mapping") },
        { title: L("ปฏิทินวิชาการ", "Calendar"), url: "/dashboard/academic/calendar", icon: CalendarDays, color: "text-success", roles: ["admin", "director", "teacher", "student"], desc: L("กิจกรรม กำหนดสอบ", "Events & exams") },
        { title: L("การบ้าน & งานที่มอบหมาย", "Homework"), url: "/dashboard/homework", icon: BookOpenCheck, color: "text-success", roles: ["admin", "director", "teacher", "student"], desc: L("มอบหมาย/ส่ง/ตรวจการบ้าน", "Assign & grade homework") },
        { title: L("คลังข้อสอบกลาง", "Question Bank"), url: "/dashboard/academic/question-bank", icon: BookOpenCheck, color: "text-info", roles: ["admin","director","teacher"], desc: L("แชร์ข้อสอบระหว่างครู", "Shared question pool") },
        { title: L("ติว/สอนเสริม", "Tutoring"), url: "/dashboard/academic/tutoring", icon: GraduationCap, color: "text-info", roles: ["admin","director","teacher","student","parent"], desc: L("เปิดคิว/จองติว", "Open & book sessions") },
        { title: L("ตรวจข้อสอบ OCR", "Exam OCR"), url: "/dashboard/exam", icon: ClipboardList, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("สแกนกระดาษคำตอบ", "Scan & auto-grade") },
        { title: L("สื่อการเรียนรู้ (E-Learning)", "Learning Hub"), url: "/dashboard/learning", icon: BookOpen, color: "text-success", roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("เกม/วิดีโอ/PDF", "Games / videos / PDFs") },
      ],
    },

    // ===== 6. STUDENT CARE (เพิ่ม Guidance) =====
    {
      key: "student_affairs",
      label: L("ดูแลนักเรียน", "Student Care"),
      icon: Users, color: "text-success",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("รายงานการมาเรียน", "Attendance Report"), url: "/dashboard/student/attendance", icon: ClipboardList, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("รายงานเช็คชื่อ", "Attendance reports") },
        { title: L("บันทึกพฤติกรรม", "Behavior"), url: "/dashboard/student/behavior", icon: Shield, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("คะแนนความประพฤติ", "Conduct points") },
        { title: L("การลานักเรียน", "Leave"), url: "/dashboard/student/leave", icon: FileText, color: "text-warning", roles: ["admin", "director", "teacher", "student", "parent"], desc: L("ยื่น/อนุมัติใบลา", "Leave requests") },
        { title: L("คัดกรองนักเรียน", "Screening"), url: "/dashboard/student/screening", icon: Activity, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("คัดกรองรายบุคคล", "Per-student screening") },
        { title: L("สุขภาพ (น้ำหนัก/ส่วนสูง)", "Health"), url: "/dashboard/student/health-trend", icon: Heart, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("น้ำหนัก ส่วนสูง", "Weight & height") },
        
        { title: L("งานโฮมรูม", "Homeroom"), url: "/dashboard/student/homeroom", icon: Home, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("บันทึกโฮมรูม", "Homeroom notes") },
        { title: L("แบบประเมิน SDQ", "SDQ"), url: "/dashboard/student/sdq", icon: Activity, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("SDQ", "SDQ assessment") },
        { title: L("แนะแนวนักเรียน", "Guidance"), url: "/dashboard/student/guidance", icon: Heart, color: "text-danger", roles: ["admin","director","teacher"], desc: L("บันทึกการให้คำปรึกษา", "Counseling records") },
        { title: L("เยี่ยมบ้านนักเรียน", "Home Visit"), url: "/dashboard/student/home-visit", icon: Home, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("บันทึกเยี่ยมบ้าน", "Home visit records") },
        { title: L("วัคซีนนักเรียน", "Vaccine"), url: "/dashboard/admin/vaccine", icon: Syringe, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("ประวัติการรับวัคซีน", "Vaccination records") },
      ],
    },

    // ===== 7. OFFICE & COMMS (รวม office + office_plus) =====
    {
      key: "office",
      label: L("งานสารบรรณ", "Office & e-Saraban"),
      icon: Megaphone, color: "text-warning",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ข่าวสาร & ประกาศ", "News"), url: "/dashboard/admin/news", icon: Megaphone, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("ประกาศข่าวสาร", "Announce news") },
        { title: L("สารบรรณอิเล็กทรอนิกส์ (e-Saraban)", "e-Saraban"), url: "/dashboard/admin/saraban", icon: Inbox, color: "text-info", roles: ["admin","director","teacher"], desc: L("ทะเบียนรับ-ส่ง + คลังหนังสือราชการ", "Register + document repository") },
        { title: L("เปิด/แก้ไข Word & PDF", "Word & PDF Editor"), url: "/dashboard/admin/doc-editor", icon: FileText, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("อ่าน/แก้/เซ็น .docx/.pdf", "Edit & sign documents") },
        { title: L("PDF Designer Pro", "PDF Designer Pro"), url: "/dashboard/admin/pdf-designer", icon: FileText, color: "text-danger", roles: ["admin", "director"], desc: L("เทมเพลต PDF สำหรับ E-Form/ปพ.", "PDF template designer") },
        { title: L("จัดการเทมเพลตฟอร์ม (กลาง)", "Form Templates Manager"), url: "/dashboard/admin/form-templates", icon: FileText, color: "text-info", roles: ["admin", "director"], desc: L("ดู/แก้เทมเพลตทุกฟอร์มจากที่เดียว", "Manage all form templates") },
        { title: L("ใบงานอินเทอร์แอคทีฟ", "Interactive Worksheets"), url: "/dashboard/admin/worksheets", icon: ClipboardList, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("ใบงานออนไลน์ ตรวจอัตโนมัติ", "Interactive worksheets") },
        { title: L("E-Form", "E-Form"), url: "/dashboard/admin/eform", icon: FileText, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("สร้าง ส่ง ลงนามแบบฟอร์ม", "Create & sign e-forms") },
        { title: L("MOU/ความร่วมมือ", "MOU"), url: "/dashboard/admin/mou", icon: FileText, color: "text-info", roles: ["admin","director","teacher"], desc: L("บันทึกข้อตกลงความร่วมมือ", "Partnership agreements") },
        { title: L("จองห้องประชุม", "Meeting Room Booking"), url: "/dashboard/admin/room-bookings", icon: DoorOpen, color: "text-success", roles: ["admin","director","teacher"], desc: L("จองห้องประชุมรออนุมัติ", "Reserve meeting rooms") },
        { title: L("จองรถส่วนกลาง", "Vehicle Booking"), url: "/dashboard/admin/vehicle-bookings", icon: MapPin, color: "text-info", roles: ["admin","director","teacher"], desc: L("ขออนุมัติใช้รถยนต์", "Request school vehicles") },
        { title: L("SAR ประกันคุณภาพ", "SAR"), url: "/dashboard/admin/sar", icon: ShieldCheck, color: "text-info", roles: ["admin","director","teacher"], desc: L("หลักฐาน 3 มาตรฐาน OBEC", "OBEC evidence") },
        { title: L("แผนปฏิบัติการ PDCA", "PDCA"), url: "/dashboard/admin/action-plan", icon: ClipboardCheck, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("PDCA", "Plan-Do-Check-Act") },
        { title: L("แจ้งเหตุฉุกเฉิน", "Emergency"), url: "/dashboard/admin/emergency", icon: AlertTriangle, color: "text-danger", roles: ["admin", "director", "teacher"], desc: L("Broadcast ด่วน", "Emergency broadcast") },
      ],
    },

    // ===== 8. HR =====
    {
      key: "hr",
      label: L("บุคลากร & HR", "Personnel & HR"),
      icon: Users, color: "text-info",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ทะเบียนบุคลากร P-OBEC", "P-OBEC"), url: "/dashboard/hr/personnel", icon: Users, color: "text-info", roles: ["admin", "director"], desc: L("ทะเบียนบุคลากร", "Personnel records") },
        { title: L("แผนผังฝ่ายงาน", "Org Chart"), url: "/dashboard/hr/org-chart", icon: Network, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("โครงสร้างองค์กร", "Org chart") },
        { title: L("สรุปการมาทำงาน", "Attendance"), url: "/dashboard/hr/attendance-dashboard", icon: BarChart3, color: "text-success", roles: ["admin", "director"], desc: L("มาทำงาน/ขาด/สาย/ลา", "Staff attendance") },
        { title: L("ประเมิน DPA / วิทยฐานะ", "DPA"), url: "/dashboard/hr/evaluation", icon: Star, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("PA + วิทยฐานะ", "PA & DPA") },
        { title: L("เงินเดือน & สวัสดิการ", "Salary"), url: "/dashboard/hr/salary", icon: Banknote, color: "text-success", roles: ["admin", "director"], desc: L("เงินเดือน/สวัสดิการ", "Salary & benefits") },
        { title: L("แผนพัฒนาตนเอง ID Plan", "ID Plan"), url: "/dashboard/hr/id-plan", icon: BookOpenCheck, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("Individual Development Plan", "Individual Development Plan") },
        { title: L("ลาบุคลากร", "Staff Leave"), url: "/dashboard/hr/leave", icon: FileText, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("ใบลาครู-เจ้าหน้าที่", "Staff leave") },
        { title: L("จัดครูสอนแทน", "Substitute"), url: "/dashboard/hr/substitute", icon: Users, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("จัดครูสอนแทน", "Assign substitutes") },
      ],
    },

    // ===== 9. FINANCE (รวม finance + finance_plus) =====
    {
      key: "finance",
      label: L("การเงิน-พัสดุ-สหกรณ์", "Finance & Assets"),
      icon: DollarSign, color: "text-success",
      roles: ["admin", "director", "teacher", "student", "parent"],
      items: [
        { title: L("งบประมาณ & บัญชี", "Budget"), url: "/dashboard/finance/budget", icon: DollarSign, color: "text-success", roles: ["admin", "director"], desc: L("งบ/รายรับ-จ่าย", "Budgets & income/expense") },
        { title: L("จัดซื้อจัดจ้าง (e-GP)", "Procurement"), url: "/dashboard/finance/procurement", icon: ShoppingCart, color: "text-warning", roles: ["admin", "director"], desc: L("จัดซื้อตามระบบ e-GP", "e-GP procurement") },
        { title: L("ทรัพย์สิน & ครุภัณฑ์", "Assets"), url: "/dashboard/finance/assets", icon: Package, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("ทะเบียนทรัพย์สิน", "Asset register") },
        { title: L("ค่าเทอม/ค่ากิจกรรม", "Tuition"), url: "/dashboard/finance/tuition", icon: DollarSign, color: "text-success", roles: ["admin","director","teacher","student","parent"], desc: L("ใบเรียกเก็บ + QR PromptPay", "Invoices + QR") },
        { title: L("ทุนการศึกษา/กยศ.", "Scholarships"), url: "/dashboard/finance/scholarships", icon: Award, color: "text-warning", roles: ["admin","director","teacher","student","parent"], desc: L("ทุนการศึกษา", "Scholarships") },
        { title: L("เงินอุดหนุนนักเรียน", "Subsidies"), url: "/dashboard/finance/subsidy", icon: Heart, color: "text-danger", roles: ["admin", "director"], desc: L("เงินอุดหนุนรายหัว", "Per-student subsidies") },
        { title: L("สหกรณ์โรงเรียน", "School Co-op"), url: "/dashboard/finance/coop", icon: Coins, color: "text-success", roles: ["admin","director","teacher"], desc: L("สมาชิก หุ้น ฝาก-ถอน", "Members & shares") },
        { title: L("โครงการพิเศษ (ตามปีงบ)", "Special Projects"), url: "/dashboard/finance/procurement?tab=projects", icon: ClipboardCheck, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ตั้งโครงการตามปีงบประมาณ ในงานงบประมาณ & พัสดุ", "Set projects by fiscal year within Budget & Procurement") },
      ],
    },

    // ===== 10. SERVICES (รวม garbage + rooms + ict + iot + ops_services) =====
    {
      key: "services",
      label: L("บริการประจำวัน", "Daily Services"),
      icon: UtensilsCrossed, color: "text-warning",
      roles: ["admin", "director", "teacher", "student", "alumni", "parent"],
      items: [
        // ห้องสมุด
        { title: L("ห้องสมุด — คลังหนังสือ", "Library"), url: "/dashboard/library", icon: BookOpen, color: "text-warning", roles: ["admin","director","teacher","student","parent"], desc: L("คลังหนังสือ", "Books catalog") },
        { title: L("ห้องสมุด — ยืม-คืน", "Library Loans"), url: "/dashboard/library/loans", icon: ClipboardCheck, color: "text-warning", roles: ["admin","director","teacher","student","parent"], desc: L("ยืม-คืน + ค่าปรับ", "Loans & fines") },
        // อาหาร
        { title: L("โรงอาหาร — เมนู", "Cafeteria Menu"), url: "/dashboard/cafeteria", icon: UtensilsCrossed, color: "text-warning", roles: ["admin","director","teacher","student","parent"], desc: L("เมนูประจำวัน + สั่งล่วงหน้า", "Daily menu + pre-orders") },
        { title: L("อาหารกลางวัน (สพฐ.)", "Lunch (OBEC)"), url: "/dashboard/admin/school-lunch", icon: UtensilsCrossed, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("บันทึก สพฐ.", "OBEC lunch records") },
        { title: L("นมโรงเรียน", "Milk"), url: "/dashboard/admin/school-milk", icon: Milk, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("รับ-แจกนม", "Milk distribution") },
        // รถ
        { title: L("รถรับ-ส่งนักเรียน", "School Bus"), url: "/dashboard/bus", icon: MapPin, color: "text-info", roles: ["admin","director","teacher","student","parent"], desc: L("เส้นทาง จุดจอด", "Routes & stops") },
        // ห้องพิเศษ
        { title: L("จองห้องพิเศษ & ตารางการใช้", "Special Rooms"), url: "/dashboard/academic/learning-center", icon: CalendarDays, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("จองห้องพิเศษ", "Reserve special rooms") },
        { title: L("ตั้งค่าห้องพิเศษ", "Manage Special Rooms"), url: "/dashboard/admin/special-rooms", icon: SettingsIcon, color: "text-warning", roles: ["admin", "director"], desc: L("เพิ่ม/แก้ห้องพิเศษ", "Add/edit rooms") },
        // ICT
        { title: L("ICT — คลังให้ยืม", "ICT Catalog"), url: "/dashboard/admin/ict-catalog", icon: Package, color: "text-danger", roles: ["admin", "director", "teacher", "student"], desc: L("อุปกรณ์ที่ว่างให้ยืม", "Available devices") },
        { title: L("ICT — ยืม-คืน", "ICT Loans"), url: "/dashboard/admin/ict-loans", icon: ScanLine, color: "text-info", roles: ["admin", "director", "teacher", "student"], desc: L("สแกนยืม-คืน", "Scan to borrow") },
        { title: L("ICT — ประวัติ & รายงาน", "ICT History"), url: "/dashboard/admin/ict-loan-history", icon: Database, color: "text-danger", roles: ["admin", "director", "teacher", "student"], desc: L("ประวัติยืม + เกินกำหนด", "Loan history & overdue") },
        { title: L("ICT — คลังอุปกรณ์", "Manage ICT Devices"), url: "/dashboard/admin/ict-devices", icon: SettingsIcon, color: "text-warning", roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไขอุปกรณ์", "Add/edit devices") },
        // IoT
        { title: L("IoT — แดชบอร์ด", "IoT Dashboard"), url: "/dashboard/iot", icon: Wifi, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลเซ็นเซอร์เรียลไทม์", "Live sensor data") },
        { title: L("IoT — จัดการอุปกรณ์", "Manage IoT"), url: "/dashboard/iot/devices", icon: SettingsIcon, color: "text-warning", roles: ["admin", "director"], desc: L("ลงทะเบียน IoT", "Register IoT") },
        // ธนาคารขยะ
        { title: L("ธนาคารขยะ — แต้มของฉัน", "Garbage: My Points"), url: "/dashboard/garbage/my", icon: Coins, color: "text-success", roles: ["student", "teacher", "admin", "director"], desc: L("แต้มสะสมของฉัน", "My points") },
        { title: L("ธนาคารขยะ — เคาน์เตอร์", "Garbage: Counter"), url: "/dashboard/garbage/counter", icon: ClipboardCheck, color: "text-warning", roles: ["admin", "director", "teacher"], desc: L("รับฝาก/แลกรางวัล", "Deposits & redeem") },
        { title: L("ธนาคารขยะ — รายการ/รางวัล", "Garbage: Items"), url: "/dashboard/garbage/items", icon: Package, color: "text-info", roles: ["admin", "director", "teacher", "student"], desc: L("ประเภทขยะ & รางวัล", "Items & rewards") },
        { title: L("ธนาคารขยะ — ภาพรวม/รายงาน", "Garbage: Dashboard"), url: "/dashboard/garbage", icon: BarChart3, color: "text-success", roles: ["admin", "director", "teacher"], desc: L("สถิติ + รายงานผู้บริหาร", "Stats & reports") },
        { title: L("ธนาคารขยะ — ประวัติ", "Garbage: History"), url: "/dashboard/garbage/history", icon: History, color: "text-info", roles: ["admin", "director", "teacher"], desc: L("ประวัติธุรกรรม", "Transaction log") },
        { title: L("ธนาคารขยะ — ความสำเร็จ", "Garbage: Achievements"), url: "/dashboard/garbage/achievements", icon: Trophy, color: "text-warning", roles: ["admin", "director", "teacher", "student"], desc: L("Badge & เหรียญ", "Badges") },
      ],
    },

    // ===== 11. SECURITY =====
    {
      key: "security",
      label: L("ความปลอดภัย", "Security"),
      icon: Shield, color: "text-danger",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("บันทึกผู้มาติดต่อ", "Visitor Log"), url: "/dashboard/security/visitors", icon: User, color: "text-warning", roles: ["admin","director","teacher"], desc: L("ลงทะเบียน + บัตรเข้า-ออก", "Visitor badge") },
        { title: L("CCTV — ดูสด", "CCTV — Live"), url: "/dashboard/security/cctv/live", icon: Activity, color: "text-info", roles: ["admin","director"], desc: L("ดูภาพสด HLS", "Live HLS viewer") },
        { title: L("CCTV — จัดการกล้อง", "CCTV — Manage"), url: "/dashboard/security/cctv", icon: SettingsIcon, color: "text-info", roles: ["admin","director"], desc: L("จัดการรายชื่อกล้อง", "Manage cameras") },
      ],
    },
  ];


  const canSee = (item: { roles?: AppRole[]; url?: string }) => {
    // observer = read-only viewer, เห็นได้ทุกเมนู (การแก้ไขถูกบล็อกที่ RLS)
    if (role === "observer") {
      if (item.url) {
        const mk = getModuleKeyForPath(item.url);
        if (mk && !isModuleEnabled(mk)) return false;
      }
      return true;
    }
    if (item.roles && role && !item.roles.includes(role)) return false;
    if (item.url) {
      const mk = getModuleKeyForPath(item.url);
      if (mk && !isModuleEnabled(mk)) return false;
    }
    return true;
  };

  const canSeeDept = (d: Department) => canSee(d);

  const q = search.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);

  const visibleMain = useMemo(
    () => mainItems.filter(canSee).filter((i) => matches(i.title)),
    [mainItems, role, q]
  );

  // Order + visibility per role using stable keys
  const roleConfig: Record<string, { order: string[]; hide?: string[] }> = {
    admin: {
      // ผู้ดูแลระบบ: เริ่มจากงานตั้งค่า/ตรวจสอบ แล้วตามด้วยงานปฏิบัติ
      order: [
        "content_users", "system_settings", "monitoring", "integrations", "ai_hub",
        "academic", "student_affairs", "office", "hr", "finance",
        "services", "security",
      ],
    },
    director: {
      // ผอ.: เน้นงานบริหาร/วิชาการก่อน, การตั้งค่าระบบลงท้าย
      order: [
        "academic", "student_affairs", "office", "hr", "finance",
        "services", "monitoring", "ai_hub", "security",
        "content_users", "system_settings", "integrations",
      ],
    },
    teacher: {
      // ครู: งานสอน-นักเรียน-สารบรรณ-บริการ; ซ่อนเฉพาะส่วนตั้งค่า/ตรวจสอบระบบ
      order: [
        "academic", "student_affairs", "office", "hr",
        "finance", "services", "ai_hub", "security",
      ],
      hide: ["content_users", "system_settings", "monitoring", "integrations"],
    },
    observer: {
      // ผู้สังเกตการณ์: เห็นทุกอย่างแบบ director (อ่านอย่างเดียว — RLS คุมการแก้)
      order: [
        "academic", "student_affairs", "office", "hr", "finance",
        "services", "monitoring", "ai_hub", "security",
        "content_users", "system_settings", "integrations",
      ],
    },
    student: { order: [] },
    parent: { order: [] },
    alumni: { order: [] },
  };


  const visibleDepts = useMemo(
    () => {
      const cfg = roleConfig[role || ""] || { order: [] };
      const orderMap = new Map(cfg.order.map((k, i) => [k, i]));
      const hide = new Set(cfg.hide || []);
      return departments
        .filter((d) => !hide.has(d.key))
        .filter(canSeeDept)
        .map((dept) => ({
          ...dept,
          items: dept.items.filter(canSee).filter((i) => matches(i.title) || matches(dept.label)),
        }))
        .filter((dept) => dept.items.length > 0)
        .sort((a, b) => (orderMap.get(a.key) ?? 999) - (orderMap.get(b.key) ?? 999));
    },
    [departments, role, q]
  );

  if (role === "alumni") return alumniSidebar;
  if (role === "parent") return parentSidebar;

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <SidebarHeader className={`${collapsed ? 'px-1.5' : 'px-3'} py-4 border-b border-sidebar-border transition-all`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-3`}>
          <LogoMark />
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">{headerTitle}</h2>
              <p className="text-xs text-sidebar-foreground/60 truncate">{headerSubtitle}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L("ค้นหาเมนู...", "Search menu...")}
              className="h-9 pl-8 pr-7 text-sm bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                aria-label="clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className={`${collapsed ? 'px-1' : 'px-2'} py-2 gap-0 transition-all`}>
        {role === "student" ? (
          (() => {
            // Build flat lookup by url for student section split
            const all = [
              ...visibleMain,
              ...visibleDepts.flatMap((d) => d.items),
            ];
            const seen = new Set<string>();
            const uniq = all.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));

            const inSection = (urls: string[]) => uniq.filter((i) => urls.includes(i.url));
            const usedUrls = new Set<string>();
            const mark = (items: MenuItem[]) => { items.forEach((i) => usedUrls.add(i.url)); return items; };

            const myItems = mark(inSection([
              "/dashboard", "/dashboard/profile", "/dashboard/portfolio",
              "/dashboard/inbox", "/dashboard/feed", "/dashboard/members", "/",
            ]));
            const learnItems = mark(inSection([
              "/dashboard/academic/schedule", "/dashboard/academic/calendar",
              "/dashboard/homework", "/dashboard/student/leave",
            ]));
            const activityItems = mark(inSection([
              "/dashboard/activities", "/dashboard/sports-day", "/dashboard/clubs",
            ]));
            const serviceItems = mark(uniq.filter((i) =>
              i.url.startsWith("/dashboard/garbage") ||
              i.url.startsWith("/dashboard/admin/ict") ||
              i.url.startsWith("/dashboard/iot")
            ));
            const otherItems = uniq.filter((i) => !usedUrls.has(i.url));

            const sections = [
              { label: L("ของฉัน", "My Account"), icon: User, items: myItems },
              { label: L("การเรียน", "Learning"), icon: BookOpen, items: learnItems },
              { label: L("กิจกรรม", "Activities"), icon: Trophy, items: activityItems },
              { label: L("บริการ", "Services"), icon: Sparkles, items: serviceItems },
              ...(otherItems.length ? [{ label: L("อื่นๆ", "More"), icon: FolderOpen, items: otherItems }] : []),
            ].filter((s) => s.items.length > 0);

            return sections.map((sec, idx) => (
              <SidebarGroup key={idx} className="!p-0">
                {!collapsed ? (
                  <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider px-2 h-8 mt-1 flex items-center gap-2">
                    <sec.icon className="w-3.5 h-3.5" />
                    <span>{sec.label}</span>
                  </SidebarGroupLabel>
                ) : (
                  idx > 0 && <div className="mx-auto my-2 h-px w-6 bg-sidebar-border/60" />
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {sec.items.map((item, itemIdx) => (
                      <SidebarMenuItem key={`${idx}-${itemIdx}-${item.url}`}>
                        <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                          <NavLink onClick={handleNavClick} to={item.url} end title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors text-base ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'py-2.5'}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${item.color || ''} ${collapsed ? '' : 'mr-2.5'}`} />
                            {!collapsed && <span className="truncate">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}

                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ));
          })()
        ) : (
          <>
        {visibleMain.length > 0 && (
          <SidebarGroup className="!p-0">
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider px-2 h-8 flex items-center">
                {L("ทั่วไป", "General")}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {visibleMain.map((item, mIdx) => (
                  <SidebarMenuItem key={`main-${mIdx}-${item.url}`}>
                    <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                      <NavLink onClick={handleNavClick} to={item.url} end title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors text-base ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'py-2.5'}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${item.color || ''} ${collapsed ? '' : 'mr-2.5'}`} />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleDepts.map((dept) => {
          const isActive = dept.items.some((i) => location.pathname === i.url);
          // Group items into sub-sections by URL pattern for readability
          const subGroupFor = (deptKey: string, url: string, title: string): string => {
            if (deptKey === "academic") {
              if (/\/pp[1-8]|\/transcript|\/certificate/.test(url)) return L("เอกสาร ปพ.", "PP Documents");
              if (/\/schedule|\/calendar|incomplete-grades/.test(url)) return L("ตาราง & ปฏิทิน", "Schedule & Calendar");
              if (/\/homework|\/learning|\/question-bank|\/tutoring|\/exam/.test(url)) return L("การเรียนการสอน", "Teaching & Learning");
              if (/all-students|\/alumni|management|subject-scan/.test(url)) return L("ทะเบียน & การจัดการ", "Registry & Management");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "student_affairs") {
              if (/attendance|behavior|leave|homeroom/.test(url)) return L("การมาเรียน & พฤติกรรม", "Attendance & Behavior");
              if (/health|fitness|vaccine|screening|sdq/.test(url)) return L("สุขภาพ & คัดกรอง", "Health & Screening");
              if (/guidance|home-visit/.test(url)) return L("แนะแนว & เยี่ยมบ้าน", "Guidance & Home Visit");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "office") {
              if (/news|emergency/.test(url)) return L("ประชาสัมพันธ์", "Announcements");
              if (/saraban|doc-editor|pdf-designer|form-templates|worksheets|eform|mou/.test(url)) return L("เอกสาร & ฟอร์ม", "Documents & Forms");
              if (/room-bookings|vehicle-bookings/.test(url)) return L("จอง & ขอใช้", "Bookings");
              if (/sar|action-plan/.test(url)) return L("ประกันคุณภาพ & แผน", "QA & Planning");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "hr") {
              if (/personnel|org-chart/.test(url)) return L("ทะเบียน & โครงสร้าง", "Registry & Structure");
              if (/attendance-dashboard|substitute|leave/.test(url)) return L("เวลาทำงาน & ลา", "Attendance & Leave");
              if (/evaluation|id-plan|salary/.test(url)) return L("ประเมิน & สวัสดิการ", "Evaluation & Welfare");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "finance") {
              if (/budget|procurement|assets/.test(url)) return L("งบประมาณ & พัสดุ", "Budget & Assets");
              if (/tuition|scholarships|subsidy/.test(url)) return L("ค่าเล่าเรียน & ทุน", "Tuition & Scholarships");
              if (/coop/.test(url)) return L("สหกรณ์", "Cooperative");
              if (/projects/.test(url)) return L("โครงการ", "Projects");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "services") {
              if (/\/library/.test(url)) return L("ห้องสมุด", "Library");
              if (/cafeteria|school-lunch|school-milk/.test(url)) return L("อาหาร & นม", "Food & Milk");
              if (/\/bus/.test(url)) return L("รถรับ-ส่ง", "Transport");
              if (/learning-center|special-rooms/.test(url)) return L("ห้องพิเศษ", "Special Rooms");
              if (/\/ict/.test(url)) return L("ICT", "ICT");
              if (/\/iot/.test(url)) return L("IoT", "IoT");
              if (/\/garbage/.test(url)) return L("ธนาคารขยะ", "Garbage Bank");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "security_ai") {
              if (/mfa|pdpa/.test(url)) return L("ความเป็นส่วนตัว & ตัวตน", "Privacy & Identity");
              if (/cctv|visitors/.test(url)) return L("CCTV & ผู้มาติดต่อ", "CCTV & Visitors");
              if (/early-warning/.test(url)) return L("AI เตือนล่วงหน้า", "AI Early Warning");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "monitoring") {
              if (/analytics|audit-log/.test(url)) return L("Analytics & Audit", "Analytics & Audit");
              if (/bulk-operations|district-feed/.test(url)) return L("การจัดการชุด & เขต", "Bulk & District");
              if (/test-scores|smsc|obec-standards/.test(url)) return L("มาตรฐาน & คะแนน", "Standards & Scores");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "content_users") {
              if (/users|observers/.test(url)) return L("ผู้ใช้งาน", "Users");
              if (/hub|cms/.test(url)) return L("เนื้อหา & ฮับ", "Content & Hub");
              if (/id-card|print-center/.test(url)) return L("บัตรประจำตัว", "ID Cards");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "system_settings") {
              if (/system-settings|module-toggles|system-update/.test(url)) return L("ระบบ", "System");
              if (/semester-settings|academic-periods/.test(url)) return L("ปีการศึกษา", "Academic Year");
              if (/school-location|field-visibility/.test(url)) return L("ความเป็นส่วนตัว & พิกัด", "Privacy & Location");
              if (/backup/.test(url)) return L("สำรองข้อมูล", "Backup");
              return L("อื่นๆ", "Other");
            }
            if (deptKey === "integrations") {
              if (/webhooks|line-settings|social-feed/.test(url)) return L("ช่องทางสื่อสาร", "Channels");
              if (/api-keys|ai-import|ai-analytics/.test(url)) return L("AI & API", "AI & API");
              return L("อื่นๆ", "Other");
            }
            return "";
          };

          // Build ordered sub-groups preserving original item order
          const subGroups: { label: string; items: MenuItem[] }[] = [];
          const subMap = new Map<string, MenuItem[]>();
          for (const it of dept.items) {
            const g = subGroupFor(dept.key, it.url, it.title);
            if (!subMap.has(g)) {
              subMap.set(g, []);
              subGroups.push({ label: g, items: subMap.get(g)! });
            }
            subMap.get(g)!.push(it);
          }
          // If only one sub-group (or empty labels), render flat
          const useSubGroups = !collapsed && subGroups.length > 1 && subGroups.every((s) => s.label);

          return (
            <Collapsible key={dept.key} defaultOpen={!!q || isActive}>
              <SidebarGroup className="!p-0">
                {collapsed ? (
                  <div className="mx-auto my-2 h-px w-6 bg-sidebar-border/60" />
                ) : (
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="text-sidebar-foreground/60 hover:text-sidebar-foreground/90 cursor-pointer flex items-center justify-between px-2 h-9 mt-2">
                      <span className="flex items-center gap-2">
                        <dept.icon className={`w-4 h-4 ${dept.color || ''}`} />
                        <span className="text-xs font-semibold uppercase tracking-wider">{dept.label}</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent forceMount={collapsed ? true : undefined} className={collapsed ? '!block' : ''}>
                  <SidebarGroupContent>
                    {useSubGroups ? (
                      subGroups.map((sg, sgIdx) => (
                        <div key={`${dept.key}-sg-${sgIdx}`} className="mb-1">
                          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                            {sg.label}
                          </div>
                          <SidebarMenu className="gap-0.5">
                            {sg.items.map((item, dIdx) => (
                              <SidebarMenuItem key={`${dept.key}-${sgIdx}-${dIdx}-${item.url}`}>
                                <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                                  <NavLink onClick={handleNavClick} to={item.url} title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg text-base transition-colors py-2.5`} activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-medium">
                                    <item.icon className={`w-5 h-5 flex-shrink-0 ${item.color || ''} mr-2.5`} />
                                    <span className="truncate">{item.title}</span>
                                  </NavLink>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </div>
                      ))
                    ) : (
                      <SidebarMenu className="gap-0.5">
                        {dept.items.map((item, dIdx) => (
                          <SidebarMenuItem key={`${dept.key}-${dIdx}-${item.url}`}>
                            <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                              <NavLink onClick={handleNavClick} to={item.url} title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg text-base transition-colors ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'py-2.5'}`} activeClassName="bg-sidebar-primary/20 text-sidebar-primary font-medium">
                                <item.icon className={`w-5 h-5 flex-shrink-0 ${item.color || ''} ${collapsed ? '' : 'mr-2.5'}`} />
                                {!collapsed && <span className="truncate">{item.title}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    )}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}

        {!collapsed && q && visibleMain.length === 0 && visibleDepts.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-sidebar-foreground/60">
            {L("ไม่พบเมนูที่ตรงกับคำค้น", "No menu matched your search")}
          </div>
        )}
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
