import { useState, useMemo } from "react";
import {
  GraduationCap, BookOpen, Users, ClipboardList, Calendar, CalendarDays, CalendarRange,
  FileText, BarChart3, Shield, ShieldCheck, IdCard,
  Megaphone, Activity, Star, Home, LayoutDashboard,
  UserCog, ChevronDown, Award, Syringe, Globe, User, MessageSquare,
  DollarSign, ShoppingCart, Package, Heart, Banknote, Clock, BookOpenCheck, Brain, AlertTriangle,
  UtensilsCrossed, Milk, ClipboardCheck, FolderOpen, Building2, Network, Database, Inbox, Settings as SettingsIcon,
  Search, X, Recycle, History, TrendingUp, Coins, Trophy, QrCode, Cpu, Wifi, ScanLine, ScanFace, MapPin, Power, Sparkles, DoorOpen, Layers, CloudDownload, Gamepad2, MonitorPlay, StickyNote, Eye
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { useViewMode } from "@/hooks/useViewMode";
import { ViewModeSwitcher } from "@/components/ViewModeSwitcher";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { getModuleKeyForPath } from "@/lib/moduleRegistry";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { SidebarAccountFooter } from "@/components/SidebarAccountFooter";
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

// Soft neumorphic pastel tile that wraps a Lucide icon so the sidebar reads
// like a phone's app icons (rounded chip, tinted bg, subtle inset highlight).
function IconTile({
  icon: Icon,
  color,
  size = "sm",
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "md" ? "w-7 h-7" : "w-6 h-6";
  const glyph = size === "md" ? "w-[15px] h-[15px]" : "w-[13px] h-[13px]";
  return (
    <span
      className={`${color || "text-sidebar-foreground/70"} ${box} inline-flex items-center justify-center rounded-[10px] bg-current/[0.14] ring-1 ring-current/20 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.55),inset_0_-1px_0_hsl(0_0%_0%/0.05),0_1px_2px_hsl(0_0%_0%/0.06)] flex-shrink-0 ${className}`}
      aria-hidden
    >
      <Icon className={`${glyph} drop-shadow-[0_1px_0_hsl(0_0%_100%/0.5)]`} />
    </span>
  );
}

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
  const { toggleSidebar } = useSidebar();
  // Sidebar is offcanvas on both mobile and desktop → when visible it is always "expanded".
  const collapsed = false;
  const { t, lang } = useLanguage();
  const location = useLocation();
  const { role } = useUserRole(); // effective role (respects view-mode override)
  const [search, setSearch] = useState("");
  const { appName, schoolName, schoolLogo } = useSystemSettings();
  const { isModuleEnabled } = useModuleToggles();
  const headerTitle = appName;
  const headerSubtitle = schoolName && schoolName !== appName ? schoolName : "";

  const LogoMark = () => (
    <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
      {schoolLogo ? (
        <img src={schoolLogo} alt={headerTitle} className="w-full h-full object-cover" />
      ) : (
        <GraduationCap className="w-4 h-4 text-primary-foreground" />
      )}
    </div>
  );

  const L = (th: string, en: string) => lang === "th" ? th : en;

  type CompactItem = { to: string; icon: any; label: string; color?: string };
  type CompactSection = { label: string; icon?: any; items: CompactItem[] };

  // Compact sidebar with section headings — used by alumni and parent
  const renderCompactSidebar = (sections: CompactSection[]) => (
    <Sidebar side="right" collapsible="offcanvas" className="gradient-sidebar border-l-0">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border transition-all">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-sidebar-foreground truncate">{headerTitle}</h2>
            <p className="text-xs text-sidebar-foreground/60 truncate">{headerSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="ซ่อนเมนู"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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
                {sec.items.map((it) => (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton asChild tooltip={it.label}>
                      <NavLink to={it.to} end className={`text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors ${collapsed ? 'justify-center' : ''}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                        <it.icon className={`w-4 h-4 flex-shrink-0 ${it.color || 'text-violet-400'} ${collapsed ? '' : 'mr-2'}`} />
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
      <SidebarAccountFooter />
    </Sidebar>
  );

  const alumniSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("หน้าหลัก", "Dashboard"), color: "text-sky-400" },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile"), color: "text-violet-400" },
        { to: "/dashboard/portfolio", icon: Award, label: L("ผลงานของฉัน", "Portfolio"), color: "text-amber-400" },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed"), color: "text-pink-400" },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members"), color: "text-emerald-400" },
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar"), color: "text-teal-400" },
      ],
    },
    {
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,
      items: [
        { to: "/dashboard/my-drive", icon: FolderOpen, label: L("Google Drive ของฉัน", "My Drive"), color: "text-blue-400" },
        { to: "/dashboard/office", icon: FileText, label: L("ชุดเอกสาร Office", "Office Suite"), color: "text-indigo-400" },
      ],
    },
  ]);

  const parentSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("หน้าหลัก", "Dashboard"), color: "text-sky-400" },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile"), color: "text-violet-400" },
        { to: "/dashboard/inbox", icon: Inbox, label: L("กล่องข้อความ", "Inbox"), color: "text-blue-400" },
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed"), color: "text-pink-400" },
      ],
    },
    {
      label: L("ลูกของฉัน", "My Child"),
      icon: Heart,
      items: [
        { to: "/dashboard/student/attendance", icon: ClipboardList, label: L("การมาเรียน", "Attendance"), color: "text-emerald-400" },
        { to: "/dashboard/student/behavior", icon: Shield, label: L("พฤติกรรม", "Behavior"), color: "text-rose-400" },
        { to: "/dashboard/student/leave", icon: FileText, label: L("ยื่นใบลา", "Leave"), color: "text-amber-400" },
        { to: "/dashboard/student/health-trend", icon: Heart, label: L("สุขภาพ", "Health"), color: "text-rose-400" },
        { to: "/dashboard/homework", icon: BookOpenCheck, label: L("การบ้าน", "Homework"), color: "text-emerald-400" },
        { to: "/dashboard/academic/schedule", icon: Calendar, label: L("ตารางเรียน", "Schedule"), color: "text-orange-400" },
        { to: "/dashboard/games", icon: Gamepad2, label: L("เกมฮับ", "Games"), color: "text-fuchsia-400" },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar"), color: "text-teal-400" },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members"), color: "text-emerald-400" },
      ],
    },
    {
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,
      items: [
        { to: "/dashboard/my-drive", icon: FolderOpen, label: L("Google Drive ของฉัน", "My Drive"), color: "text-blue-400" },
        { to: "/dashboard/office", icon: FileText, label: L("ชุดเอกสาร Office", "Office Suite"), color: "text-indigo-400" },
      ],
    },
  ]);




  // Concise main items
  const mainItems: MenuItem[] = [
    { title: L("หน้าหลัก", "Dashboard"), url: "/dashboard", icon: LayoutDashboard, color: "text-sky-400", desc: L("ภาพรวมข้อมูลสำคัญและงานประจำวัน", "Overview and daily stats") },
    
    { title: L("เว็บไซต์โรงเรียน", "School Website"), url: "/", icon: Globe, color: "text-cyan-400", desc: L("หน้าเว็บสำหรับบุคคลภายนอก", "Public school website") },
    // WebBrowser ย้ายไปอยู่ในหมวด "เครื่องมือ" (tools_kit)
    { title: L("ข้อมูลส่วนตัว", "My Profile"), url: "/dashboard/profile", icon: User, color: "text-violet-400", desc: L("ข้อมูลส่วนตัวและตั้งค่าบัญชี", "Personal info & account settings") },
    { title: L("กล่องข้อความ", "Inbox"), url: "/dashboard/inbox", icon: Inbox, color: "text-blue-400", desc: L("ข้อความ แจ้งเตือน และเอกสารถึงคุณ", "Messages, notifications & docs to you") },
    { title: L("ประชาสัมพันธ์ออนไลน์", "Feed"), url: "/dashboard/feed", icon: Megaphone, color: "text-pink-400", desc: L("โพสต์ กิจกรรม ผลงาน จากทุกคน", "Posts, activities & work") },
    { title: L("แฟ้มสะสมผลงาน", "Portfolio"), url: "/dashboard/portfolio", icon: Award, color: "text-amber-400", desc: L("แสดงผลงาน เอกสาร วิดีโอ ในโปรไฟล์", "Showcase your work") },
    { title: L("ทำเนียบสมาชิก", "Members"), url: "/dashboard/members", icon: Users, color: "text-emerald-400", desc: L("ค้นหาสมาชิกและดูผลงาน", "Browse members & portfolios") },
    { title: L("บันทึกเวลาปฏิบัติงาน", "Time Clock"), url: "/dashboard/hr/time-clock", icon: Clock, color: "text-amber-400", roles: ["admin", "director", "teacher"], desc: L("บันทึกเวลาเข้า-ออกงาน", "Staff check-in / check-out") },
    { title: L("เช็คชื่อนักเรียน", "Student Check-in"), url: "/dashboard/student/face-scan", icon: ScanFace, color: "text-cyan-400", roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อด้วยใบหน้า/QR แจ้ง LINE ผู้ปกครอง", "Face/QR check-in + LINE notify") },
    // ── ทางลัดใช้บ่อย (ดึงออกจากฝ่าย เพื่อความเร็ว) ──
    { title: L("ตารางเรียน/ตารางสอน", "Schedule"), url: "/dashboard/academic/schedule", icon: Calendar, color: "text-orange-400", roles: ["admin", "director", "teacher", "student"], desc: L("ตารางเรียนของนักเรียนและตารางสอนของครู", "Class & teaching schedule") },
    { title: L("การบ้าน", "Homework"), url: "/dashboard/homework", icon: BookOpenCheck, color: "text-emerald-400", roles: ["admin", "director", "teacher", "student"], desc: L("มอบหมายและตรวจการบ้านออนไลน์", "Assign & grade homework") },
    { title: L("กระดานโน้ต (Padlet)", "Padlet Boards"), url: "/dashboard/padlet", icon: StickyNote, color: "text-fuchsia-400", roles: ["admin", "director", "teacher", "student"], desc: L("แขวนใบงาน · แปะโน้ตในคาบเรียน", "Hang tasks · post sticky notes") },
    { title: L("การลาของนักเรียน", "Student Leave"), url: "/dashboard/student/leave", icon: FileText, color: "text-amber-400", roles: ["admin", "director", "teacher", "student"], desc: L("ยื่นและอนุมัติใบลานักเรียน", "Student leave requests") },
    { title: L("การลาของครู/บุคลากร", "Staff Leave"), url: "/dashboard/hr/leave", icon: FileText, color: "text-orange-400", roles: ["admin", "director", "teacher"], desc: L("ยื่นและอนุมัติใบลาของครูและบุคลากร", "Staff leave requests") },
    { title: L("บันทึกการมาเรียน", "Attendance"), url: "/dashboard/student/attendance", icon: ClipboardList, color: "text-emerald-400", roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อหน้าเสาธงและรายคาบ", "Assembly & per-period") },
    { title: L("บันทึกพฤติกรรม", "Behavior"), url: "/dashboard/student/behavior", icon: Shield, color: "text-rose-400", roles: ["admin", "director", "teacher"], desc: L("บันทึกคะแนนความประพฤติ", "Conduct points") },
    { title: L("ศูนย์เกมการเรียนรู้", "Game Hub"), url: "/dashboard/hub/games", icon: Gamepad2, color: "text-fuchsia-400", roles: ["admin", "director", "teacher", "student"], desc: L("คลังเกม · จัดการเกม · API Keys", "Store · Manage · API keys") },
    { title: L("ปฏิทินวิชาการ", "Academic Calendar"), url: "/dashboard/academic/calendar", icon: CalendarDays, color: "text-teal-400", roles: ["admin", "director", "teacher", "student"], desc: L("กิจกรรม สอบ และวันสำคัญ", "Events, exams & key dates") },
  ];

  const departments: Department[] = [
    {
      key: "admin_content",
      label: L("งานข้อมูลและระบบเชื่อมโยง", "Content & Integration"),
      icon: UserCog,
      color: "text-indigo-400",
      roles: ["admin", "director"],
      items: [
        { title: L("ทะเบียนผู้ใช้งาน", "Users"), url: "/dashboard/users", icon: UserCog, color: "text-indigo-400", roles: ["admin", "director"], desc: L("เพิ่ม แก้ไข ปิดบัญชีผู้ใช้", "Add, edit and disable accounts") },
        { title: L("จัดการผู้ใช้แบบกลุ่ม", "Bulk Operations"), url: "/dashboard/admin/bulk-operations", icon: Users, color: "text-blue-400", roles: ["admin", "director"], desc: L("เลื่อนชั้น ลบ แก้ไขผู้ใช้ทีละมาก", "Bulk update users") },
        { title: L("จัดการเว็บไซต์โรงเรียน", "Website (CMS)"), url: "/dashboard/admin/cms", icon: FileText, color: "text-pink-400", roles: ["admin", "director"], desc: L("แก้เนื้อหาและเมนูเว็บไซต์", "Edit public site content") },
        { title: L("ศูนย์งานพิมพ์เอกสาร", "Print Center"), url: "/dashboard/admin/print-center", icon: IdCard, color: "text-fuchsia-400", roles: ["admin", "director"], desc: L("บัตร เกียรติบัตร และ ปพ. ในที่เดียว", "ID cards, certificates & PP") },
        { title: L("ช่องทางการแจ้งเตือน", "Communications"), url: "/dashboard/hub/communications", icon: MessageSquare, color: "text-green-400", roles: ["admin", "director"], desc: L("Google Chat · LINE · Social · District API", "Chat, LINE, Social & District API") },
        { title: L("เชื่อมต่อ API และ AI", "API & AI"), url: "/dashboard/admin/api-keys", icon: Sparkles, color: "text-fuchsia-400", roles: ["admin", "director"], desc: L("Secrets ผู้ให้บริการ AI และคีย์พูล", "Secrets, AI providers & key pool") },
      ],
    },
    {
      key: "admin_system",
      label: L("ระบบและรายงานผู้ดูแล", "System & Reports (Admin)"),
      icon: SettingsIcon,
      color: "text-slate-300",
      roles: ["admin", "director"],
      items: [
        { title: L("ตั้งค่าข้อมูลโรงเรียน", "School Settings"), url: "/dashboard/admin/school-settings", icon: SettingsIcon, color: "text-orange-400", roles: ["admin", "director"], desc: L("ระบบ ระดับชั้น ปีการศึกษา GPS ฟิลด์ โมดูล", "System, grades, year, GPS, fields, modules") },
        { title: L("บัญชีผู้สังเกตการณ์ (ศน.)", "Observer Access"), url: "/dashboard/admin/observation", icon: Eye, color: "text-cyan-400", roles: ["admin", "director"], desc: L("QR + Username/Password สำหรับแชร์ให้ผู้ตรวจ · PDPA", "QR + credentials for external reviewers · PDPA") },
        { title: L("ระบบและรายงานผู้ดูแล", "System & Reports (Admin)"), url: "/dashboard/hub/admin-reports", icon: BarChart3, color: "text-teal-400", roles: ["admin", "director"], desc: L("อัปเดต · Log · วิเคราะห์ · Audit · O-NET/NT/PISA · สมศ.", "Updates, logs, analytics, audit, tests") },
      ],
    },
    {
      key: "admin_kiosk",
      label: L("เครื่องนักเรียนและการเฝ้าดู", "Kiosk & Monitor"),
      icon: MonitorPlay,
      color: "text-cyan-400",
      roles: ["admin"],
      items: [
        { title: L("ติดตั้งเครื่อง Kiosk", "Kiosk Setup"), url: "/dashboard/admin/kiosk-setup", icon: SettingsIcon, color: "text-cyan-400", roles: ["admin"], desc: L("ติดตั้งเครื่องนักเรียนโหมด Kiosk + Safe Browser", "Kiosk installer & Safe Browser") },
        { title: L("เฝ้าดูหน้าจอนักเรียน", "Classroom Monitor"), url: "/dashboard/admin/monitor", icon: MonitorPlay, color: "text-sky-400", roles: ["admin"], desc: L("ดูจอ ส่งข้อความ ล็อก ปิดเครื่องนักเรียนแบบเรียลไทม์", "Live view, message, lock, shutdown") },
        { title: L("ส่วนขยายเบราว์เซอร์ปลอดภัย", "Safe Browser Extension"), url: "/dashboard/browser/extension", icon: Layers, color: "text-fuchsia-400", roles: ["admin"], desc: L("ดาวน์โหลด/ตั้งค่าส่วนขยาย Safe Browser", "Download & configure extension") },
        { title: L("ปุ่มลัดเว็บไซต์นักเรียน", "Browser Shortcuts"), url: "/dashboard/admin/browser-shortcuts", icon: Globe, color: "text-blue-400", roles: ["admin"], desc: L("จัดการเว็บไซต์ปุ่มลัดสำหรับนักเรียน", "Manage student browser shortcuts") },
        { title: L("นโยบาย Safe Browser", "Safe Browser Policy"), url: "/dashboard/admin/browser-policy", icon: Shield, color: "text-rose-400", roles: ["admin"], desc: L("บังคับ login + บล็อกโซเชียลตามเวลาเรียน", "Auth gate + time-based blocking") },
        { title: L("ประวัติการใช้เบราว์เซอร์นักเรียน", "Browser History"), url: "/dashboard/browser/logs", icon: History, color: "text-amber-400", roles: ["admin"], desc: L("บันทึกการเข้าเว็บของนักเรียน", "Student browsing logs") },
        { title: L("หน้า Agent (สำหรับทดสอบ)", "Agent Page (Preview)"), url: "/dashboard/monitor/agent", icon: ShieldCheck, color: "text-emerald-400", roles: ["admin"], desc: L("หน้า Agent ที่รันบนเครื่องนักเรียน", "Student-side Agent view") },
      ],
    },



    // ── วิชาการ ────────────────────────────────────────────────
    {
      key: "academic_manage",
      label: L("งานทะเบียนและหลักสูตร", "Registry & Curriculum"),
      icon: BookOpen,
      color: "text-blue-400",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("จัดการงานวิชาการ", "Academic Setup"), url: "/dashboard/academic/management", icon: BookOpen, color: "text-blue-400", roles: ["admin", "director", "teacher"], desc: L("ห้องเรียน รายวิชา ครูประจำชั้น ตัวชี้วัด", "Classes, subjects, homeroom & indicators") },
        { title: L("ทะเบียนนักเรียน (DMC)", "Students (DMC)"), url: "/dashboard/academic/all-students", icon: Users, color: "text-sky-400", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลนักเรียนทั้งหมดตามมาตรฐาน DMC", "All student records (DMC)") },
        { title: L("ทะเบียนศิษย์เก่า", "Alumni"), url: "/dashboard/academic/alumni", icon: GraduationCap, color: "text-violet-400", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลศิษย์เก่าที่จบการศึกษาแล้ว", "Alumni database") },
        { title: L("ตารางเรียนและตารางสอน", "Schedule"), url: "/dashboard/academic/schedule", icon: Calendar, color: "text-orange-400", roles: ["admin", "director", "teacher", "student"], desc: L("ตารางเรียนนักเรียนและตารางสอนครู", "Class & teaching schedules") },
        { title: L("ปฏิทินวิชาการ", "Calendar"), url: "/dashboard/academic/calendar", icon: CalendarDays, color: "text-teal-400", roles: ["admin", "director", "teacher", "student"], desc: L("กิจกรรม สอบ และวันสำคัญ", "Events, exams & key dates") },
      ],
    },
    {
      key: "academic_records",
      label: L("เอกสารระเบียนผลการเรียน (ปพ.)", "PP Documents"),
      icon: FileText,
      color: "text-emerald-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ปพ.1 ระเบียนแสดงผลการเรียน", "PP.1 Transcript"), url: "/dashboard/academic/transcript", icon: FileText, color: "text-emerald-400", roles: ["admin", "director", "teacher"], desc: L("ระเบียนแสดงผลการเรียนรายบุคคล", "Individual transcript") },
        { title: L("ปพ.5 บันทึกผลการพัฒนาผู้เรียน", "PP.5 Grade Book"), url: "/dashboard/academic/pp5", icon: ClipboardList, color: "text-fuchsia-400", roles: ["admin", "director", "teacher"], desc: L("ลงคะแนน คุณลักษณะ อ่าน-คิด-เขียน รายวิชา", "Per-subject grading") },
        { title: L("ปพ.6 รายงานผลการพัฒนาผู้เรียน", "PP.6 Report"), url: "/dashboard/academic/pp6", icon: FileText, color: "text-purple-400", roles: ["admin", "director", "teacher"], desc: L("รายงานผลการพัฒนาผู้เรียนรายภาคเรียน", "Per-semester report") },
        { title: L("ปพ.2 · 3 · 4 · 7 · 8", "PP.2/3/4/7/8"), url: "/dashboard/academic/pp-docs", icon: FolderOpen, color: "text-pink-400", roles: ["admin", "director", "teacher"], desc: L("รวมเอกสาร ปพ.2 3 4 7 8", "Combined PP.2/3/4/7/8") },
      ],
    },
    {
      key: "academic_learn",
      label: L("การเรียนการสอนและการวัดผล", "Learning & Exams"),
      icon: BookOpenCheck,
      color: "text-emerald-400",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("งานที่มอบหมาย", "Homework"), url: "/dashboard/homework", icon: BookOpenCheck, color: "text-emerald-400", roles: ["admin", "director", "teacher", "student"], desc: L("มอบหมายและตรวจการบ้านออนไลน์", "Assign & grade homework") },
        { title: L("คลังข้อสอบและวัดผล", "Exams"), url: "/dashboard/exam", icon: ClipboardList, color: "text-cyan-400", roles: ["admin", "director", "teacher"], desc: L("สร้าง พิมพ์ สแกน ตรวจข้อสอบอัตโนมัติ", "Create, print, scan & auto-grade") },
      ],
    },
    {
      key: "academic_teaching",
      label: L("งานสอนและแผนการจัดการเรียนรู้", "Teaching"),
      icon: Sparkles,
      color: "text-blue-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ศูนย์งานสอน", "Teaching Hub"), url: "/dashboard/academic/teaching-hub", icon: Sparkles, color: "text-blue-400", roles: ["admin", "director", "teacher"], desc: L("ภาพรวมแผนสอน · logbook · วPA", "Plans · logbook · vPA overview") },
        { title: L("แผนการจัดการเรียนรู้", "Lesson Plans"), url: "/dashboard/academic/lesson-plans", icon: BookOpenCheck, color: "text-indigo-400", roles: ["admin", "director", "teacher"], desc: L("สร้าง ส่งนิเทศ และคลัง PLC", "Create, submit & PLC library") },
        { title: L("บันทึกหลังการสอน", "Teaching Logbook"), url: "/dashboard/academic/logbook", icon: ClipboardList, color: "text-fuchsia-400", roles: ["admin", "director", "teacher"], desc: L("บันทึกรายคาบใช้ประกอบ วPA", "Per-period log for vPA") },
      ],
    },

    // ── กิจการนักเรียน ────────────────────────────────────────────
    {
      key: "student_daily",
      label: L("งานประจำวันชั้นเรียน", "Daily"),
      icon: ClipboardList,
      color: "text-emerald-400",
      roles: ["admin", "director", "teacher", "student", "parent"],
      items: [
        { title: L("บันทึกการมาเรียน", "Attendance"), url: "/dashboard/student/attendance", icon: ClipboardList, color: "text-emerald-400", roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อหน้าเสาธงและรายคาบ", "Assembly & per-period") },
        { title: L("บันทึกพฤติกรรมนักเรียน", "Behavior"), url: "/dashboard/student/behavior", icon: Shield, color: "text-rose-400", roles: ["admin", "director", "teacher"], desc: L("บันทึกคะแนนความประพฤติ", "Conduct points") },
        { title: L("การลาของนักเรียน", "Student Leave"), url: "/dashboard/student/leave", icon: FileText, color: "text-amber-400", roles: ["admin", "director", "teacher", "student", "parent"], desc: L("ยื่นและอนุมัติใบลา", "Leave requests") },
        { title: L("บันทึกโฮมรูม", "Homeroom"), url: "/dashboard/student/homeroom", icon: Home, color: "text-sky-400", roles: ["admin", "director", "teacher"], desc: L("บันทึกกิจกรรมโฮมรูม", "Daily homeroom notes") },
      ],
    },
    {
      key: "student_health",
      label: L("งานอนามัยและคัดกรองนักเรียน", "Student Health & Screening"),
      icon: Heart,
      color: "text-rose-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("งานอนามัยและคัดกรองนักเรียน", "Student Health & Screening"), url: "/dashboard/hub/student-health", icon: Heart, color: "text-rose-400", roles: ["admin", "director", "teacher"], desc: L("สุขภาพ วัคซีน คัดกรอง SDQ เยี่ยมบ้าน", "Health, vaccine, screening, SDQ, visits") },
      ],
    },
    {
      key: "student_games",
      label: L("ศูนย์เกมการเรียนรู้", "Game Hub"),
      icon: Gamepad2,
      color: "text-fuchsia-400",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("ศูนย์เกมการเรียนรู้", "Game Hub"), url: "/dashboard/hub/games", icon: Gamepad2, color: "text-fuchsia-400", roles: ["admin", "director", "teacher", "student"], desc: L("คลังเกม · จัดการเกม · API Keys", "Store · Manage · API keys") },
      ],
    },

    // ── บริหารทั่วไป ──────────────────────────────────────────────
    {
      key: "office_docs",
      label: L("งานสารบรรณและประกาศ", "Documents & Announcements"),
      icon: Megaphone,
      color: "text-orange-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("งานสารบรรณและประกาศ", "Documents & Announcements"), url: "/dashboard/hub/documents", icon: Megaphone, color: "text-orange-400", roles: ["admin", "director", "teacher"], desc: L("ข่าว หนังสือ E-Form ต้นแบบ PDF Smart Fill แจ้งเหตุ", "News, docs, e-forms, templates, PDF fill, emergency") },
      ],
    },
    {
      key: "office_ops",
      label: L("งานบริหารทั่วไป", "Operations"),
      icon: ClipboardCheck,
      color: "text-teal-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("อาหารกลางวันและนมโรงเรียน", "Lunch & Milk"), url: "/dashboard/admin/school-lunch", icon: UtensilsCrossed, color: "text-yellow-400", roles: ["admin", "director", "teacher"], desc: L("อาหารกลางวันและนมโรงเรียน", "Lunch & milk program") },
        { title: L("แผนปฏิบัติการ PDCA", "Action Plan (PDCA)"), url: "/dashboard/admin/action-plan", icon: ClipboardCheck, color: "text-teal-400", roles: ["admin", "director", "teacher"], desc: L("วงจร Plan-Do-Check-Act", "Plan-Do-Check-Act") },
      ],
    },
    // ── เครื่องมือ (Tools) — ใช้ร่วมทุก role ไม่ผูกกับฝ่ายงาน ─────
    {
      key: "tools_kit",
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,
      color: "text-cyan-400",
      roles: ["admin", "director", "teacher", "student", "parent", "alumni"],
      items: [
        { title: L("WebBrowser", "WebBrowser"), url: "/dashboard/browser", icon: Globe, color: "text-cyan-400", roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("เปิดเว็บไซต์ภายในระบบ", "In-app web browser") },
        { title: L("Google Drive ของฉัน", "My Drive"), url: "/dashboard/my-drive", icon: FolderOpen, color: "text-blue-400", roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("เชื่อม Google Drive ส่วนตัว เปิดไฟล์ในระบบ", "Connect your own Google Drive & browse in-app") },
        { title: L("ชุดเอกสาร Office", "Office Suite"), url: "/dashboard/office", icon: FileText, color: "text-indigo-400", roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("Docs · Sheets · Slides · PDF บันทึกลง Google Drive", "Docs, Sheets, Slides, PDF — save to Google Drive") },
        { title: L("คลังไฟล์ LINE Vault", "LINE Vault"), url: "/dashboard/line-vault", icon: StickyNote, color: "text-teal-400", roles: ["admin", "director", "teacher"], desc: L("รูป · ไฟล์ · โน้ตจาก LINE OA ไม่หมดอายุ", "Photos, files & notes from LINE OA — never expire") },
      ],
    },

    // ── บุคลากรและงบประมาณ ───────────────────────────────────────
    {
      key: "hr_records",
      label: L("บุคลากร (HR)", "Personnel (HR)"),
      icon: Users,
      color: "text-purple-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("บุคลากร (HR)", "Personnel (HR)"), url: "/dashboard/hub/hr", icon: Users, color: "text-purple-400", roles: ["admin", "director", "teacher"], desc: L("ทะเบียน โครงสร้าง เวลา ลา สอนแทน ประเมิน เงินเดือน ID Plan", "Records, org, attendance, leave, sub, eval, salary, ID Plan") },
        { title: L("ครูเวรประจำวัน", "Duty Teachers"), url: "/dashboard/admin/duty-teachers", icon: ShieldCheck, color: "text-amber-400", roles: ["admin", "director"], desc: L("จัดเวร · จุดเวร · บันทึกเหตุการณ์ · แจ้งเตือนอัตโนมัติ", "Schedule · locations · logs · auto-notify") },
      ],
    },
    {
      key: "finance",
      label: L("งานการเงินและพัสดุ", "Finance & Assets"),
      icon: DollarSign,
      color: "text-green-400",
      roles: ["admin", "director"],
      items: [
        { title: L("งานการเงินและพัสดุ", "Finance & Assets"), url: "/dashboard/hub/finance", icon: DollarSign, color: "text-green-400", roles: ["admin", "director"], desc: L("งบประมาณ จัดซื้อ ทรัพย์สิน เงินอุดหนุน โครงการฮับ", "Budget, procurement, assets, subsidy, hub") },
      ],
    },
    {
      key: "services_garbage",
      label: L("ธนาคารขยะโรงเรียน", "Garbage Bank"),
      icon: Recycle,
      color: "text-emerald-400",
      roles: ["admin", "director", "teacher", "student", "alumni"],
      items: [
        { title: L("ธนาคารขยะโรงเรียน", "Garbage Bank"), url: "/dashboard/hub/garbage", icon: Recycle, color: "text-emerald-400", roles: ["admin", "director", "teacher", "student", "alumni"], desc: L("ภาพรวม แต้ม เคาน์เตอร์ รายการ ประวัติ รายงาน เหรียญตรา", "Dashboard, points, counter, items, history, badges") },
      ],
    },
    {
      key: "services_rooms",
      label: L("การใช้ห้องเรียนพิเศษ", "Special Rooms"),
      icon: DoorOpen,
      color: "text-emerald-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("จองห้องและตารางการใช้งาน", "Book & Schedule"), url: "/dashboard/academic/learning-center", icon: CalendarDays, color: "text-emerald-400", roles: ["admin", "director", "teacher"], desc: L("จองห้องพิเศษและดูตารางการใช้", "Reserve rooms & view schedules") },
        { title: L("จัดการห้องพิเศษ", "Manage Rooms"), url: "/dashboard/admin/special-rooms", icon: SettingsIcon, color: "text-amber-400", roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไขห้องพิเศษ", "Add/edit special rooms") },
      ],
    },
    {
      key: "services_ict",
      label: L("ยืม-คืนอุปกรณ์ ICT", "ICT Loans"),
      icon: Package,
      color: "text-indigo-400",
      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("คลังอุปกรณ์สำหรับยืม", "Loan Catalog"), url: "/dashboard/admin/ict-catalog", icon: Package, color: "text-fuchsia-400", roles: ["admin", "director", "teacher", "student"], desc: L("ดูอุปกรณ์ที่ว่างให้ยืมตามหมวด", "Browse available devices") },
        { title: L("บันทึกยืม-คืนและประวัติ", "Loans & History"), url: "/dashboard/admin/ict-loans", icon: ScanLine, color: "text-indigo-400", roles: ["admin", "director", "teacher", "student"], desc: L("สแกนยืม-คืน ดูประวัติและรายงาน", "Scan, history & reports") },
        { title: L("จัดการอุปกรณ์ ICT", "Manage Devices"), url: "/dashboard/admin/ict-devices", icon: SettingsIcon, color: "text-amber-400", roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไขอุปกรณ์ ICT", "Add or edit devices") },
      ],
    },
    {
      key: "services_iot",
      label: L("อุปกรณ์อัจฉริยะ (IoT)", "IoT / Smart Devices"),
      icon: Cpu,
      color: "text-cyan-400",
      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ภาพรวมอุปกรณ์ IoT", "IoT Dashboard"), url: "/dashboard/iot", icon: Wifi, color: "text-cyan-400", roles: ["admin", "director", "teacher"], desc: L("ข้อมูลเรียลไทม์จากเซ็นเซอร์", "Live sensor data") },
        { title: L("จัดการอุปกรณ์ IoT", "Manage Devices"), url: "/dashboard/iot/devices", icon: SettingsIcon, color: "text-amber-400", roles: ["admin", "director"], desc: L("ลงทะเบียนและตั้งค่าอุปกรณ์ IoT", "Register & configure IoT") },
      ],
    },
  ];



  const canSee = (item: { roles?: AppRole[]; url?: string }) => {
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
  const ACADEMIC_KEYS = ["academic_manage", "academic_records", "academic_learn", "academic_teaching"];
  const STUDENT_KEYS  = ["student_daily", "student_health", "student_games"];
  const OFFICE_KEYS   = ["office_docs", "office_ops"];
  const HR_KEYS       = ["hr_records"];
  const ADMIN_KEYS    = ["admin_content", "admin_system", "admin_kiosk"];
  const SERVICES_KEYS = ["services_garbage", "services_rooms", "services_ict", "services_iot"];
  const TOOLS_KEYS    = ["tools_kit"];

  const roleConfig: Record<string, { order: string[]; hide?: string[] }> = {
    admin: {
      order: [
        ...ACADEMIC_KEYS, ...STUDENT_KEYS, ...OFFICE_KEYS, ...HR_KEYS, "finance",
        ...SERVICES_KEYS, ...TOOLS_KEYS, ...ADMIN_KEYS,
      ],
    },
    director: {
      order: [
        ...ACADEMIC_KEYS, ...STUDENT_KEYS, ...OFFICE_KEYS, ...HR_KEYS, "finance",
        ...SERVICES_KEYS, ...TOOLS_KEYS,
      ],
      hide: ["admin_content", "admin_system", "admin_kiosk"],
    },
    teacher: {
      order: [
        ...ACADEMIC_KEYS, ...STUDENT_KEYS, ...OFFICE_KEYS, ...HR_KEYS,
        ...SERVICES_KEYS, ...TOOLS_KEYS,
      ],
      hide: ["admin_content", "admin_system", "admin_kiosk", "finance"],
    },
    student: { order: [...TOOLS_KEYS] },
    parent: { order: [...TOOLS_KEYS] },
    alumni: { order: [...TOOLS_KEYS] },
  };

  // Super-sections = 4 ฝ่ายหลักของโรงเรียน + เครื่องมือ + กลุ่มผู้ดูแลระบบ (admin เท่านั้น)
  type SuperSec = { key: string; label: string; icon: any; depts: string[]; color: string; dot: string; adminOnly?: boolean };
  const DIV_ACADEMIC = [...ACADEMIC_KEYS, "student_games"];
  const DIV_STUDENT  = ["student_daily", "student_health", "services_garbage"];
  const DIV_GENERAL  = ["office_docs", "office_ops", "services_rooms", "services_ict", "services_iot"];
  const DIV_BUDGET   = ["hr_records", "finance"];
  const DIV_TOOLS    = [...TOOLS_KEYS];
  const DIV_ADMIN    = [...ADMIN_KEYS];

  const SUPER_SECTIONS: SuperSec[] = [
    { key: "div_academic", label: L("ฝ่ายวิชาการ",         "Academic"),         icon: BookOpen,    depts: DIV_ACADEMIC, color: "text-sky-400",     dot: "bg-sky-400" },
    { key: "div_student",  label: L("ฝ่ายกิจการนักเรียน",   "Student Affairs"),  icon: Heart,       depts: DIV_STUDENT,  color: "text-rose-400",    dot: "bg-rose-400" },
    { key: "div_general",  label: L("ฝ่ายบริหารทั่วไป",     "General Admin"),    icon: Megaphone,   depts: DIV_GENERAL,  color: "text-amber-400",   dot: "bg-amber-400" },
    { key: "div_budget",   label: L("ฝ่ายงบประมาณและงานบุคคล", "Budget & Personnel"), icon: DollarSign, depts: DIV_BUDGET, color: "text-emerald-400", dot: "bg-emerald-400" },
    { key: "div_tools",    label: L("เครื่องมือ",                "Tools"),            icon: FolderOpen,  depts: DIV_TOOLS,    color: "text-cyan-400",    dot: "bg-cyan-400" },
    { key: "div_admin",    label: L("งานผู้ดูแลระบบ",           "System Admin"),     icon: Shield,      depts: DIV_ADMIN,    color: "text-slate-300",   dot: "bg-slate-300", adminOnly: true },
  ];

  // Section ordering per role — 4 divisions + tools (+ admin group for admin only)
  const sectionOrderPerRole: Record<string, string[]> = {
    admin:    ["div_tools", "div_academic", "div_student", "div_general", "div_budget", "div_admin"],
    director: ["div_tools", "div_academic", "div_student", "div_budget", "div_general"],
    teacher:  ["div_tools", "div_academic", "div_student", "div_general", "div_budget"],
    student:  ["div_tools"],
    parent:   ["div_tools"],
    alumni:   ["div_tools"],
  };





  const visibleDepts = useMemo(
    () => {
      const cfg = roleConfig[role || ""] || { order: [] };
      const hide = new Set(cfg.hide || []);
      // URLs already promoted to Main — don't duplicate them under departments
      const promotedUrls = new Set(visibleMain.map((i) => i.url));
      return departments
        .filter((d) => !hide.has(d.key))
        .filter(canSeeDept)
        .map((dept) => ({
          ...dept,
          items: dept.items
            .filter(canSee)
            .filter((i) => !promotedUrls.has(i.url))
            .filter((i) => matches(i.title) || matches(dept.label)),
        }))
        .filter((dept) => dept.items.length > 0);
    },
    [departments, role, q, visibleMain]
  );

  const groupedDepts = useMemo(() => {
    const map = new Map(visibleDepts.map((d) => [d.key, d]));
    const used = new Set<string>();
    const order = sectionOrderPerRole[role || ""] || SUPER_SECTIONS.map((s) => s.key);
    const out = order
      .map((k) => SUPER_SECTIONS.find((s) => s.key === k))
      .filter(Boolean)
      .map((sec) => {
        const s = sec as SuperSec;
        const items = s.depts.map((k) => map.get(k)).filter(Boolean) as typeof visibleDepts;
        items.forEach((d) => used.add(d.key));
        return { ...s, items };
      })
      .filter((s) => s.items.length > 0);
    const leftover = visibleDepts.filter((d) => !used.has(d.key));
    if (leftover.length) out.push({ key: "more", label: L("อื่นๆ", "More"), icon: FolderOpen, depts: [], color: "text-slate-400", dot: "bg-slate-400", items: leftover });
    return out;
  }, [visibleDepts, lang, role]);

  if (role === "alumni") return alumniSidebar;
  if (role === "parent") return parentSidebar;

  return (
    <Sidebar side="right" collapsible="offcanvas" className="gradient-sidebar border-l-0">
      <SidebarHeader className="px-3 py-2.5 border-b border-sidebar-border/70 bg-gradient-to-b from-sidebar-accent/20 to-transparent transition-all">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <LogoMark />
            <span className="absolute -inset-1 rounded-2xl bg-primary/20 blur-md -z-10" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold text-sidebar-foreground tracking-tight truncate leading-tight">{headerTitle}</h2>
            {headerSubtitle && <p className="text-[11px] text-sidebar-foreground/55 truncate">{headerSubtitle}</p>}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="ซ่อนเมนู"
            className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!collapsed && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L("ค้นหาเมนู...", "Search menu...")}
              className="h-8 pl-8 pr-7 text-sm bg-sidebar-accent/40 border-sidebar-border/60 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:border-primary/40 rounded-lg"
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

      <SidebarContent className={`${collapsed ? 'px-1' : 'px-2'} py-1 gap-0 transition-all`}>
        <ViewModeSwitcher collapsed={collapsed} />
        
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
            const serviceItems = mark(uniq.filter((i) =>
              i.url.startsWith("/dashboard/garbage") ||
              i.url.startsWith("/dashboard/admin/ict") ||
              i.url.startsWith("/dashboard/iot")
            ));
            const toolItems = mark(uniq.filter((i) =>
              i.url === "/dashboard/my-drive" ||
              i.url === "/dashboard/office" ||
              i.url === "/dashboard/line-vault" ||
              i.url === "/dashboard/browser"
            ));
            const otherItems = uniq.filter((i) => !usedUrls.has(i.url));

            const sections = [
              { label: L("ของฉัน", "My Account"), icon: User, items: myItems },
              { label: L("การเรียน", "Learning"), icon: BookOpen, items: learnItems },
              { label: L("บริการ", "Services"), icon: Sparkles, items: serviceItems },
              { label: L("เครื่องมือ", "Tools"), icon: FolderOpen, items: toolItems },
              ...(otherItems.length ? [{ label: L("อื่นๆ", "More"), icon: FolderOpen, items: otherItems }] : []),
            ].filter((s) => s.items.length > 0);

            return sections.map((sec, idx) => (
              <SidebarGroup key={idx} className="!p-0">
                {!collapsed ? (
                  <SidebarGroupLabel className="text-sidebar-foreground/60 text-[10px] font-semibold uppercase tracking-wider px-2 h-6 mt-0 flex items-center gap-2">

                    <sec.icon className="w-3.5 h-3.5" />
                    <span>{sec.label}</span>
                  </SidebarGroupLabel>
                ) : (
                  idx > 0 && <div className="mx-auto my-2 h-px w-6 bg-sidebar-border/60" />
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {sec.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                          <NavLink to={item.url} end title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors text-sm ${collapsed ? "justify-center w-9 h-9 mx-auto" : "py-1"}`} activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                            <IconTile icon={item.icon} color={item.color} className={collapsed ? '' : 'mr-2'} />
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
        {visibleMain.length > 0 && (() => {
          const pick = (urls: string[]) =>
            urls.map((u) => visibleMain.find((i) => i.url === u)).filter(Boolean) as MenuItem[];
          const used = new Set<string>();
          const take = (urls: string[]) => {
            const items = pick(urls);
            items.forEach((i) => used.add(i.url));
            return items;
          };
          const mainSections = [
            {
              key: "me",
              label: L("ของฉัน", "My Account"),
              color: "text-sky-400",
              dot: "bg-sky-400",
              icon: User,
              items: take([
                "/dashboard", "/", "/dashboard/profile",
                "/dashboard/inbox", "/dashboard/feed",
                "/dashboard/portfolio", "/dashboard/members",
              ]),
            },
            {
              key: "work",
              label: L("งานประจำวัน", "Daily Work"),
              color: "text-amber-400",
              dot: "bg-amber-400",
              icon: Clock,
              items: take([
                "/dashboard/hr/time-clock",
                "/dashboard/student/face-scan",
                "/dashboard/student/attendance",
                "/dashboard/student/behavior",
                "/dashboard/student/leave",
                "/dashboard/hr/leave",
              ]),
            },
            {
              key: "learn",
              label: L("การเรียนการสอน", "Learning"),
              color: "text-emerald-400",
              dot: "bg-emerald-400",
              icon: BookOpen,
              items: take([
                "/dashboard/academic/schedule",
                "/dashboard/academic/calendar",
                "/dashboard/homework",
                "/dashboard/padlet",
                "/dashboard/hub/games",
              ]),
            },
          ];
          // ให้ /dashboard/browser ตกไปหมวด "เครื่องมือ" (div_tools) แทน เพื่อไม่ให้ซ้ำ
          used.add("/dashboard/browser");

          const leftover = visibleMain.filter((i) => !used.has(i.url));
          if (leftover.length) {
            mainSections.push({
              key: "more",
              label: L("อื่นๆ", "More"),
              color: "text-slate-300",
              dot: "bg-slate-300",
              icon: FolderOpen,
              items: leftover,
            });
          }
          const shown = mainSections.filter((s) => s.items.length > 0);
          return shown.map((sec, sIdx) => {
            const isActive = sec.items.some((i) => location.pathname === i.url);
            const body = (
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {sec.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                        <NavLink to={item.url} end title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className={`relative text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5 rounded-lg text-sm transition-all duration-150 ${collapsed ? 'justify-center w-9 h-9 mx-auto' : 'py-1 pl-3 pr-2'}`} activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary">
                          <IconTile icon={item.icon} color={item.color} className={collapsed ? '' : 'mr-2'} />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            );
            if (collapsed) {
              return (
                <SidebarGroup key={sec.key} className="!p-0">
                  {sIdx > 0 && <div className={`mx-auto my-3 h-0.5 w-6 rounded-full ${sec.dot} opacity-70`} />}
                  {body}
                </SidebarGroup>
              );
            }
            return (
              <Collapsible key={sec.key} defaultOpen={!!q || isActive || sec.key === "me"}>
                <SidebarGroup className="!p-0">
                  <CollapsibleTrigger className="w-full group/sec">
                    <div className="px-2 mt-0.5 mb-0.5">
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-sidebar-border to-transparent mb-1" />
                      <div className="flex items-center gap-2 h-6 px-1 rounded-md hover:bg-sidebar-accent/30 transition-colors cursor-pointer">
                        <span className={`w-1.5 h-1.5 rounded-full ${sec.dot} shadow-[0_0_8px_currentColor] ${sec.color}`} />
                        <sec.icon className={`w-3.5 h-3.5 ${sec.color}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${sec.color}`}>
                          {sec.label}
                        </span>
                        <span className="text-[10px] font-medium text-sidebar-foreground/40 tabular-nums">{sec.items.length}</span>
                        <div className={`flex-1 h-px bg-gradient-to-r from-current/30 to-transparent ${sec.color}`} />
                        <ChevronDown className={`w-3.5 h-3.5 ${sec.color} opacity-70 transition-transform duration-200 [[data-state=open]>div>div>&]:rotate-180`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>{body}</CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          });

        })()}


        {groupedDepts.map((sec, sIdx) => {
          const flatItems = sec.items.flatMap((d) => d.items);
          const isActive = flatItems.some((i) => location.pathname === i.url);
          return (
            <div key={sec.key} className="mt-3">
              {collapsed ? (
                sIdx > 0 && <div className={`mx-auto my-3 h-0.5 w-6 rounded-full ${sec.dot} opacity-70`} />
              ) : (
                <Collapsible defaultOpen={!!q || isActive}>
                  <SidebarGroup className="!p-0">
                    <CollapsibleTrigger className="w-full group/sec">
                      <div className="px-2 mb-0.5">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-sidebar-border to-transparent mb-1" />
                        <div className="flex items-center gap-2 h-6 px-1 rounded-md hover:bg-sidebar-accent/30 transition-colors cursor-pointer">
                          <span className={`w-1.5 h-1.5 rounded-full ${sec.dot} shadow-[0_0_8px_currentColor] ${sec.color}`} />
                          {sec.icon && <sec.icon className={`w-3.5 h-3.5 ${sec.color}`} />}
                          <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${sec.color}`}>
                            {sec.label}
                          </span>
                          <span className="text-[10px] font-medium text-sidebar-foreground/40 tabular-nums">{flatItems.length}</span>
                          <div className={`flex-1 h-px bg-gradient-to-r from-current/30 to-transparent ${sec.color}`} />
                          <ChevronDown className={`w-3.5 h-3.5 ${sec.color} opacity-70 transition-transform duration-200 [[data-state=open]>div>div>&]:rotate-180`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        {null}

                        {sec.items.length > 1 ? (
                          <div className="space-y-2">
                            {sec.items.map((d) => (
                              d.items.length === 0 ? null : (
                                <div key={d.label}>
                                  <div className="flex items-center gap-1.5 px-3 pt-1 pb-1">
                                    {d.icon && <d.icon className={`w-3 h-3 ${sec.color} opacity-70`} />}
                                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${sec.color} opacity-80`}>
                                      {d.label}
                                    </span>
                                    <div className={`flex-1 h-px bg-gradient-to-r from-current/20 to-transparent ${sec.color}`} />
                                  </div>
                                  <SidebarMenu className="gap-0.5">
                                    {d.items.map((item) => (
                                      <SidebarMenuItem key={item.url}>
                                        <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                                          <NavLink to={item.url} title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className="relative text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5 rounded-lg text-sm transition-all duration-150 py-1 pl-3 pr-2" activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary">
                                            <IconTile icon={item.icon} color={item.color} className="mr-2" />
                                            <span className="truncate">{item.title}</span>
                                          </NavLink>
                                        </SidebarMenuButton>
                                      </SidebarMenuItem>
                                    ))}
                                  </SidebarMenu>
                                </div>
                              )
                            ))}
                          </div>
                        ) : (
                          <SidebarMenu className="gap-0.5">
                            {flatItems.map((item) => (
                              <SidebarMenuItem key={item.url}>
                                <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                                  <NavLink to={item.url} title={`${item.title}${item.desc ? " — " + item.desc : ""}`} className="relative text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5 rounded-lg text-sm transition-all duration-150 py-1 pl-3 pr-2" activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary">
                                    <IconTile icon={item.icon} color={item.color} className="mr-2" />
                                    <span className="truncate">{item.title}</span>
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
              )}
              {collapsed && (
                <SidebarMenu className="gap-0.5">
                  {flatItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={renderTooltip(item.title, item.desc)}>
                        <NavLink to={item.url} title={item.title} className="text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground rounded-lg transition-colors justify-center w-10 h-10 mx-auto" activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold">
                          <IconTile icon={item.icon} color={item.color} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </div>
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
      <SidebarAccountFooter />
    </Sidebar>
  );
}
