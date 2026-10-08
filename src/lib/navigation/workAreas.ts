import type { ComponentType } from "react";
import type { AppRole } from "@/hooks/useUserRole";
import { GraduationCap, BookOpen, Users, ClipboardList, Calendar, CalendarDays, FileText, BarChart3, Shield, ShieldCheck, IdCard, Lock, Wrench, UserX, Bell, Bot, Megaphone, Activity, Home, LayoutDashboard, UserCog, Award, Globe, User, MessageSquare, DollarSign, Package, Heart, Clock, BookOpenCheck, UtensilsCrossed, ClipboardCheck, FolderOpen, Database, Inbox, Settings as SettingsIcon, Sparkles, ScanLine, ScanFace, MapPin, History, Trophy, DoorOpen, Layers, CloudDownload, MonitorPlay, StickyNote, Eye, Boxes, Settings2, Recycle } from "lucide-react";
import { getModuleKeyForPath } from "@/lib/moduleRegistry";
export type NavigationItem = { title: string; url: string; icon: ComponentType<{ className?: string }>; roles?: AppRole[]; desc?: string; moduleKey?: string };
export type NavigationGroup = { key: string; label: string; icon: NavigationItem["icon"]; roles?: AppRole[]; items: NavigationItem[] };
export type WorkArea = { key: string; label: string; icon: NavigationItem["icon"]; groups: NavigationGroup[] };
export const areaUrl = (key: string) => `/dashboard/work/${key}`;
export function buildWorkAreas(lang = "th"): WorkArea[] {
  const L = (th: string, en: string) => lang === "th" ? th : en;
  const mainItems: NavigationItem[] = [
    { title: L("หน้าหลัก", "Dashboard"), url: "/dashboard", icon: LayoutDashboard, desc: L("ภาพรวมข้อมูลสำคัญและงานประจำวัน", "Overview and daily stats") },
    
    { title: L("เว็บไซต์โรงเรียน", "School Website"), url: "/", icon: Globe, desc: L("หน้าเว็บสำหรับบุคคลภายนอก", "Public school website") },
    // WebBrowser ย้ายไปอยู่ในหมวด "เครื่องมือ" (tools_kit)
    { title: L("ข้อมูลส่วนตัว", "My Profile"), url: "/dashboard/profile", icon: User, desc: L("ข้อมูลส่วนตัวและตั้งค่าบัญชี", "Personal info & account settings") },
    { title: L("กล่องข้อความ", "Inbox"), url: "/dashboard/inbox", icon: Inbox, desc: L("ข้อความ แจ้งเตือน และเอกสารถึงคุณ", "Messages, notifications & docs to you") },
    { title: L("ประชาสัมพันธ์ออนไลน์", "Feed"), url: "/dashboard/feed", icon: Megaphone, desc: L("โพสต์ กิจกรรม ผลงาน จากทุกคน", "Posts, activities & work") },
    { title: L("แฟ้มสะสมผลงาน", "Portfolio"), url: "/dashboard/portfolio", icon: Award, desc: L("แสดงผลงาน เอกสาร วิดีโอ ในโปรไฟล์", "Showcase your work") },
    { title: L("ทำเนียบสมาชิก", "Members"), url: "/dashboard/members", icon: Users, desc: L("ค้นหาสมาชิกและดูผลงาน", "Browse members & portfolios") },
    { title: L("บันทึกเวลาปฏิบัติงาน", "Time Clock"), url: "/dashboard/hr/time-clock", icon: Clock, roles: ["admin", "director", "teacher"], desc: L("บันทึกเวลาเข้า-ออกงาน", "Staff check-in / check-out") },
    { title: L("เช็คชื่อนักเรียน", "Student Check-in"), url: "/dashboard/student/face-scan", icon: ScanFace, roles: ["admin", "director", "teacher"], desc: L("เช็คชื่อด้วยใบหน้า/QR แจ้ง LINE ผู้ปกครอง", "Face/QR check-in + LINE notify") },
    { title: L("ลงทะเบียนใบหน้าบุคลากร", "Staff Face Enrollment"), url: "/dashboard/student/face-scan?tab=staff", icon: ScanFace, roles: ["admin", "director", "teacher"], desc: L("ลงทะเบียนใบหน้าครูและบุคลากรเพื่อทดสอบ/สแกนเข้าโรงเรียน", "Enroll staff faces for test/check-in") },
    { title: L("ลงทะเบียนใบหน้าของฉัน", "My Face Enrollment"), url: "/dashboard/student/my-face", icon: ScanFace, roles: ["student"], desc: L("ลงทะเบียนใบหน้าเพื่อสแกนเข้าโรงเรียน", "Enroll your face for check-in") },
    // ── ทางลัดใช้บ่อย (ดึงออกจากฝ่าย เพื่อความเร็ว) ──
    { title: L("ตารางเรียน/ตารางสอน", "Schedule"), url: "/dashboard/academic/schedule", icon: Calendar, roles: ["admin", "director", "teacher", "student"], desc: L("ตารางเรียนของนักเรียนและตารางสอนของครู", "Class & teaching schedule") },
    { title: L("การบ้าน", "Homework"), url: "/dashboard/homework", icon: BookOpenCheck, roles: ["admin", "director", "teacher", "student"], desc: L("มอบหมายและตรวจการบ้านออนไลน์", "Assign & grade homework") },
    { title: L("กระดานโน้ต (Padlet)", "Padlet Boards"), url: "/dashboard/padlet", icon: StickyNote, roles: ["admin", "director", "teacher", "student"], desc: L("แขวนใบงาน · แปะโน้ตในคาบเรียน", "Hang tasks · post sticky notes") },
    { title: L("การลาของนักเรียน", "Student Leave"), url: "/dashboard/student/leave", icon: FileText, roles: ["admin", "director", "teacher", "student"], desc: L("ยื่นและอนุมัติใบลานักเรียน", "Student leave requests") },
    { title: L("การลาของครู/บุคลากร", "Staff Leave"), url: "/dashboard/hr/leave", icon: FileText, roles: ["admin", "director", "teacher"], desc: L("ยื่นและอนุมัติใบลาของครูและบุคลากร", "Staff leave requests") },
    { title: L("บันทึกการมาเรียน", "Attendance"), url: "/dashboard/student/attendance", icon: ClipboardList, roles: ["admin", "director", "teacher"], desc: L("สแกนเข้าโรงเรียนและเช็คชื่อรายคาบ", "Gate scan & per-period") },
    { title: L("บันทึกพฤติกรรม", "Behavior"), url: "/dashboard/student/behavior", icon: Shield, roles: ["admin", "director", "teacher"], desc: L("บันทึกคะแนนความประพฤติ", "Conduct points") },
    // Game Hub hidden — backend deleted (quota)
    // { title: L("ศูนย์เกมการเรียนรู้", "Game Hub"), url: "/dashboard/hub/games", icon: Gamepad2, roles: ["admin", "director", "teacher", "student"], desc: L("คลังเกม · จัดการเกม · API Keys", "Store · Manage · API keys") },
    { title: L("กิจกรรมและการแข่งขัน", "Activities & Competitions"), url: "/dashboard/activities", icon: Trophy, roles: ["admin", "director", "teacher", "student", "parent"], desc: L("กีฬาสี วันวิทยาศาสตร์ วันภาษาไทย · สมัคร จัดสาย บันทึกผล", "Register, brackets & results") },
    { title: L("เกียรติบัตร", "Certificates"), url: "/dashboard/certificates", icon: Award, roles: ["admin", "director", "teacher"], desc: L("ออกแบบเทมเพลตและพิมพ์เกียรติบัตรหลายใบ", "Design & bulk print certificates") },
    { title: L("สั่งงานบุคลากร", "Assign Staff Tasks"), url: "/dashboard/admin/staff-tasks", icon: ClipboardList, roles: ["admin", "director"], desc: L("ผอ. มอบหมายงานให้ครู/บุคลากร · ติดตามสถานะ", "Assign & track staff tasks") },
    { title: L("ปฏิทินวิชาการ", "Academic Calendar"), url: "/dashboard/academic/calendar", icon: CalendarDays, roles: ["admin", "director", "teacher", "student"], desc: L("กิจกรรม สอบ และวันสำคัญ", "Events, exams & key dates") },
  ];

  const departments: NavigationGroup[] = [
    {
      key: "admin_content",
      label: L("งานข้อมูลและระบบเชื่อมโยง", "Content & Integration"),
      icon: UserCog,

      roles: ["admin", "director"],
      items: [
        { title: L("ทะเบียนผู้ใช้งาน", "Users"), url: "/dashboard/users", icon: UserCog, roles: ["admin", "director"], desc: L("เพิ่ม แก้ไข ปิดบัญชีผู้ใช้", "Add, edit and disable accounts") },
        { title: L("จัดการผู้ใช้แบบกลุ่ม", "Bulk Operations"), url: "/dashboard/admin/bulk-operations", icon: Users, roles: ["admin", "director"], desc: L("เลื่อนชั้น ลบ แก้ไขผู้ใช้ทีละมาก", "Bulk update users") },
        { title: L("จัดการเว็บไซต์โรงเรียน", "Website (CMS)"), url: "/dashboard/admin/cms", icon: FileText, roles: ["admin", "director"], desc: L("แก้เนื้อหาและเมนูเว็บไซต์", "Edit public site content") },
        { title: L("ออกแบบต้นแบบบัตรประจำตัว", "ID Card Template"), url: "/dashboard/admin/id-card", icon: IdCard, roles: ["admin", "director"], desc: L("ตั้งค่าธีม โลโก้ QR และพิมพ์บัตร", "Design theme, logo, QR & print cards") },
        { title: L("ศูนย์งานพิมพ์เอกสาร", "Print Center"), url: "/dashboard/admin/print-center", icon: IdCard, roles: ["admin", "director"], desc: L("บัตร เกียรติบัตร และ ปพ. ในที่เดียว", "ID cards, certificates & PP") },
        { title: L("ช่องทางการแจ้งเตือน", "Communications"), url: "/dashboard/hub/communications", icon: MessageSquare, roles: ["admin", "director"], desc: L("Google Chat · LINE · Social · District API", "Chat, LINE, Social & District API") },
        { title: L("เชื่อมต่อ API และ AI", "API & AI"), url: "/dashboard/admin/api-keys", icon: Sparkles, roles: ["admin", "director"], desc: L("Secrets ผู้ให้บริการ AI และคีย์พูล", "Secrets, AI providers & key pool") },
      ],
    },
    {
      key: "admin_system",
      label: L("ระบบและรายงานผู้ดูแล", "System & Reports (Admin)"),
      icon: SettingsIcon,

      roles: ["admin", "director"],
      items: [
        { title: L("ตั้งค่าข้อมูลโรงเรียน", "School Settings"), url: "/dashboard/admin/school-settings", icon: SettingsIcon, roles: ["admin", "director"], desc: L("ระบบ ระดับชั้น ปีการศึกษา GPS ฟิลด์ โมดูล", "System, grades, year, GPS, fields, modules") },
        { title: L("บัญชีผู้สังเกตการณ์ (ศน.)", "Observer Access"), url: "/dashboard/admin/observation", icon: Eye, roles: ["admin", "director"], desc: L("QR + Username/Password สำหรับแชร์ให้ผู้ตรวจ · PDPA", "QR + credentials for external reviewers · PDPA") },
        { title: L("สังเกตการสอน", "Observation Sessions"), url: "/dashboard/admin/observation-sessions", icon: Eye, roles: ["admin", "director"], desc: L("ตารางสังเกตการสอน · บันทึกผล · รายงาน", "Observation schedule & reports") },
        { title: L("BigData", "BigData"), url: "/dashboard/admin/bigdata", icon: Database, roles: ["admin", "director"], desc: L("คลังข้อมูลขนาดใหญ่ · วิเคราะห์เชิงลึก", "BigData analytics dashboard") },
        { title: L("แจ้งเตือนเสี่ยง", "Early Warning"), url: "/dashboard/admin/early-warning", icon: Bell, roles: ["admin", "director", "teacher"], desc: L("แจ้งเตือนนักเรียนเสี่ยง · ขาดเรียน ผลตก", "At-risk student alerts") },
        { title: L("ระบบและรายงานผู้ดูแล", "System & Reports (Admin)"), url: "/dashboard/hub/admin-reports", icon: BarChart3, roles: ["admin", "director"], desc: L("อัปเดต · Log · วิเคราะห์ · Audit · O-NET/NT/PISA · สมศ.", "Updates, logs, analytics, audit, tests") },
      ],
    },
    {
      key: "admin_cloud",
      label: L("ระบบ & Cloud (ผู้ดูแล)", "System & Cloud (Admin)"),
      icon: CloudDownload,

      roles: ["admin", "director"],
      items: [
        { title: L("ตรวจความสมบูรณ์ข้อมูล", "Data Quality"), url: "/dashboard/admin/data-quality", icon: Activity, roles: ["admin", "director"], desc: L("ผู้ใช้ไม่มีบทบาท · นักเรียนไม่มีห้อง · ครูไม่มีตารางสอน", "Missing roles, classrooms & schedules") },
        { title: L("จัดเก็บ/สำรองข้อมูล (Drive)", "Data Archive"), url: "/dashboard/admin/data-archive", icon: Database, roles: ["admin", "director"], desc: L("เก็บย้อนหลังตามระเบียบ · สำรองขึ้น Google Drive ตามปีการศึกษา", "Retention policy & Google Drive backup") },

        { title: L("สุขภาพระบบ (Health)", "System Health"), url: "/dashboard/admin/system-health", icon: Activity, roles: ["admin", "director"], desc: L("สถานะ Realtime · Edge · Cron · Live Feed", "Realtime, edge, cron & live feed status") },
        { title: L("ตรวจสอบ RLS Policy", "RLS Audit"), url: "/dashboard/admin/rls-audit", icon: Shield, roles: ["admin"], desc: L("สรุปสถานะสิทธิ์ INSERT/UPDATE/DELETE ทุกตาราง", "Policy coverage per table") },
        { title: L("โครงสร้างฐานข้อมูล", "Database Schema"), url: "/dashboard/admin/database-schema", icon: Database, roles: ["admin", "director"], desc: L("เปิดดู Schema · Foreign Keys · API endpoints", "Browse schema, FKs & API endpoints") },
        { title: L("สำรอง & ย้ายระบบ", "Backup & Migration"), url: "/dashboard/admin/backup-center", icon: CloudDownload, roles: ["admin", "director"], desc: L("One-Click Backup · Restore · ย้าย Supabase", "One-click ZIP backup, restore & migration") },
        { title: L("Setup Wizard", "Setup Wizard"), url: "/setup", icon: Sparkles, roles: ["admin"], desc: L("ตั้งค่าเริ่มต้น · Auto Provision · กู้คืนจาก Backup", "First-run setup, auto provision & restore") },
      ],
    },
    {
      key: "admin_kiosk",
      label: L("เครื่องนักเรียนและการเฝ้าดู", "Kiosk & Monitor"),
      icon: MonitorPlay,

      roles: ["admin"],
      items: [
        { title: L("ติดตั้งเครื่อง Kiosk", "Kiosk Setup"), url: "/dashboard/admin/kiosk-setup", icon: SettingsIcon, roles: ["admin"], desc: L("ติดตั้งเครื่องนักเรียนโหมด Kiosk + Safe Browser", "Kiosk installer & Safe Browser") },
        { title: L("สถานะตู้ Kiosk หน้าประตู", "Door Kiosk Health"), url: "/dashboard/admin/kiosk-health", icon: DoorOpen, roles: ["admin"], desc: L("เช็ค online/offline และความปกติของตู้สแกนหน้าประตู", "Door kiosk online/offline & health") },
        { title: L("รายงาน Smart Gate", "Smart Gate Report"), url: "/dashboard/admin/smart-gate", icon: DoorOpen, roles: ["admin"], desc: L("ไข้สูง วัตถุต้องสงสัย และอุณหภูมิจากจุดคัดกรอง", "Fever, weapon & temperature screening") },
        { title: L("เฝ้าดูหน้าจอนักเรียน", "Classroom Monitor"), url: "/dashboard/admin/monitor", icon: MonitorPlay, roles: ["admin"], desc: L("ดูจอ ส่งข้อความ ล็อก ปิดเครื่องนักเรียนแบบเรียลไทม์", "Live view, message, lock, shutdown") },
        { title: L("ส่วนขยายเบราว์เซอร์ปลอดภัย", "Safe Browser Extension"), url: "/dashboard/browser/extension", icon: Layers, roles: ["admin"], desc: L("ดาวน์โหลด/ตั้งค่าส่วนขยาย Safe Browser", "Download & configure extension") },
        { title: L("ปุ่มลัดเว็บไซต์นักเรียน", "Browser Shortcuts"), url: "/dashboard/admin/browser-shortcuts", icon: Globe, roles: ["admin"], desc: L("จัดการเว็บไซต์ปุ่มลัดสำหรับนักเรียน", "Manage student browser shortcuts") },
        { title: L("นโยบาย Safe Browser", "Safe Browser Policy"), url: "/dashboard/admin/browser-policy", icon: Shield, roles: ["admin"], desc: L("บังคับ login + บล็อกโซเชียลตามเวลาเรียน", "Auth gate + time-based blocking") },
        { title: L("ประวัติการใช้เบราว์เซอร์นักเรียน", "Browser History"), url: "/dashboard/browser/logs", icon: History, roles: ["admin"], desc: L("บันทึกการเข้าเว็บของนักเรียน", "Student browsing logs") },
        { title: L("หน้า Agent (สำหรับทดสอบ)", "Agent Page (Preview)"), url: "/dashboard/monitor/agent", icon: ShieldCheck, roles: ["admin"], desc: L("หน้า Agent ที่รันบนเครื่องนักเรียน", "Student-side Agent view") },
      ],
    },



    // ── วิชาการ ────────────────────────────────────────────────
    {
      key: "academic_manage",
      label: L("งานทะเบียนและหลักสูตร", "Registry & Curriculum"),
      icon: BookOpen,

      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("จัดการงานวิชาการ", "Academic Setup"), url: "/dashboard/academic/management", icon: BookOpen, roles: ["admin", "director", "teacher"], desc: L("ห้องเรียน รายวิชา ครูประจำชั้น ตัวชี้วัด", "Classes, subjects, homeroom & indicators") },
        { title: L("ทะเบียนนักเรียน (DMC)", "Students (DMC)"), url: "/dashboard/academic/all-students", icon: Users, roles: ["admin", "director", "teacher"], desc: L("ข้อมูลนักเรียนทั้งหมดตามมาตรฐาน DMC", "All student records (DMC)") },
        { title: L("ทะเบียนศิษย์เก่า", "Alumni"), url: "/dashboard/academic/alumni", icon: GraduationCap, roles: ["admin", "director", "teacher"], desc: L("ข้อมูลศิษย์เก่าที่จบการศึกษาแล้ว", "Alumni database") },
      ],
    },
    {
      key: "academic_records",
      label: L("เอกสารระเบียนผลการเรียน (ปพ.)", "PP Documents"),
      icon: FileText,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ปพ.1 ระเบียนแสดงผลการเรียน", "PP.1 Transcript"), url: "/dashboard/academic/transcript", icon: FileText, roles: ["admin", "director", "teacher"], desc: L("ระเบียนแสดงผลการเรียนรายบุคคล", "Individual transcript") },
        { title: L("ปพ.5 บันทึกผลการพัฒนาผู้เรียน", "PP.5 Grade Book"), url: "/dashboard/academic/pp5", icon: ClipboardList, roles: ["admin", "director", "teacher"], desc: L("ลงคะแนน คุณลักษณะ อ่าน-คิด-เขียน รายวิชา", "Per-subject grading") },
        { title: L("ปพ.6 รายงานผลการพัฒนาผู้เรียน", "PP.6 Report"), url: "/dashboard/academic/pp6", icon: FileText, roles: ["admin", "director", "teacher"], desc: L("รายงานผลการพัฒนาผู้เรียนรายภาคเรียน", "Per-semester report") },
        { title: L("เอกสาร ปพ.3 / 7 / 8", "PP.2/3/4/7/8"), url: "/dashboard/academic/pp-docs", icon: FolderOpen, roles: ["admin", "director", "teacher"], desc: L("รวมเอกสาร ปพ.2 3 4 7 8", "Combined PP.2/3/4/7/8") },
        { title: L("ล็อกเกรด 80%", "Grade Lock"), url: "/dashboard/academic/grade-lock", icon: Lock, roles: ["admin", "director", "teacher"], desc: L("ล็อกเกรดเมื่อส่งครบ 80% · ป้องกันแก้ไข", "Lock grades at 80% submission") },
        { title: L("แก้ 0 ร มส", "Grade Remediation"), url: "/dashboard/academic/grade-remediation", icon: Wrench, roles: ["admin", "director", "teacher"], desc: L("แก้ผลการเรียน 0 ร มส · ลงทะเบียนซ้ำ", "Remediate 0/R/MS grades") },
        { title: L("พักการเรียน", "Probation"), url: "/dashboard/academic/probation", icon: UserX, roles: ["admin", "director", "teacher"], desc: L("พักการเรียน · ติดตามสถานะนักเรียน", "Academic probation tracking") },
      ],
    },
    {
      key: "academic_learn",
      label: L("การเรียนการสอนและการวัดผล", "Learning & Exams"),
      icon: BookOpenCheck,

      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("คลังข้อสอบและวัดผล", "Exams"), url: "/dashboard/exam", icon: ClipboardList, roles: ["admin", "director", "teacher"], desc: L("สร้าง พิมพ์ สแกน ตรวจข้อสอบอัตโนมัติ", "Create, print, scan & auto-grade") },
        { title: L("ออกแบบกระดาษคำตอบ", "Design Answer Sheet"), url: "/dashboard/exam", icon: Settings2, roles: ["admin", "director", "teacher"], desc: L("ออกแบบรูปแบบกระดาษคำตอบ (เลือกช้อย, โลโก้, หลักรหัส)", "Choice format, school logo, student code digits") },
      ],
    },
    {
      key: "academic_teaching",
      label: L("งานสอนและแผนการจัดการเรียนรู้", "Teaching"),
      icon: Sparkles,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("ศูนย์งานสอน", "Teaching Hub"), url: "/dashboard/academic/teaching-hub", icon: Sparkles, roles: ["admin", "director", "teacher"], desc: L("ภาพรวมแผนสอน · logbook · วPA", "Plans · logbook · vPA overview") },
        { title: L("แผนการจัดการเรียนรู้", "Lesson Plans"), url: "/dashboard/academic/lesson-plans", icon: BookOpenCheck, roles: ["admin", "director", "teacher"], desc: L("สร้าง ส่งนิเทศ และคลัง PLC", "Create, submit & PLC library") },
        { title: L("บันทึกหลังการสอน", "Teaching Logbook"), url: "/dashboard/academic/logbook", icon: ClipboardList, roles: ["admin", "director", "teacher"], desc: L("บันทึกรายคาบใช้ประกอบ วPA", "Per-period log for vPA") },
      ],
    },

    // ── กิจการนักเรียน ────────────────────────────────────────────
    {
      key: "student_daily",
      label: L("งานประจำวันชั้นเรียน", "Daily"),
      icon: ClipboardList,

      roles: ["admin", "director", "teacher", "student", "parent"],
      items: [
        { title: L("บันทึกโฮมรูม", "Homeroom"), url: "/dashboard/student/homeroom", icon: Home, roles: ["admin", "director", "teacher"], desc: L("บันทึกกิจกรรมโฮมรูม", "Daily homeroom notes") },
        { title: L("พานักเรียนออกนอกพื้นที่", "Off-site Trips"), url: "/dashboard/student/offsite-trips", icon: MapPin, roles: ["admin", "director", "teacher"], desc: L("ทริป/อบรม · เช็คชื่อนอกพื้นที่", "Trips · off-site attendance") },
      ],

    },
    {
      key: "student_health",
      label: L("งานอนามัยและคัดกรองนักเรียน", "Student Health & Screening"),
      icon: Heart,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("งานอนามัยและคัดกรองนักเรียน", "Student Health & Screening"), url: "/dashboard/hub/student-health", icon: Heart, roles: ["admin", "director", "teacher"], desc: L("สุขภาพ วัคซีน คัดกรอง SDQ เยี่ยมบ้าน", "Health, vaccine, screening, SDQ, visits") },
      ],
    },
    {
      key: "wellbeing",
      label: L("สุขภาพใจและแววอาชีพ", "Wellbeing & Career Aptitude"),
      icon: Sparkles,

      roles: ["admin", "director", "teacher", "student", "parent"],
      items: [
        { title: L("เช็คใจ & ค้นหาแววอาชีพ", "Mind Check & Career Aptitude"), url: "/dashboard/hub/wellbeing", icon: Sparkles, roles: ["admin", "director", "teacher", "student", "parent"], desc: L("แบบประเมิน 2Q/9Q/8Q/ST-5 และวัดแวว 8 ด้าน", "Mental health screening & 8 intelligences") },
      ],
    },
    // Game Hub hidden — backend deleted (quota)
    // {
    //   key: "student_games",
    //   label: L("ศูนย์เกมการเรียนรู้", "Game Hub"),
    //   icon: Gamepad2,
    //   color: "text-fuchsia-400",
    //   roles: ["admin", "director", "teacher", "student"],
    //   items: [
    //     { title: L("ศูนย์เกมการเรียนรู้", "Game Hub"), url: "/dashboard/hub/games", icon: Gamepad2, roles: ["admin", "director", "teacher", "student"], desc: L("คลังเกม · จัดการเกม · API Keys", "Store · Manage · API keys") },
    //   ],
    // },

    // ── บริหารทั่วไป ──────────────────────────────────────────────
    {
      key: "office_docs",
      label: L("งานสารบรรณและประกาศ", "Documents & Announcements"),
      icon: Megaphone,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("งานสารบรรณและประกาศ", "Documents & Announcements"), url: "/dashboard/hub/documents", icon: Megaphone, roles: ["admin", "director", "teacher"], desc: L("ข่าว หนังสือ E-Form ต้นแบบ PDF Smart Fill แจ้งเหตุ", "News, docs, e-forms, templates, PDF fill, emergency") },
      ],
    },
    {
      key: "office_ops",
      label: L("งานบริหารทั่วไป", "Operations"),
      icon: ClipboardCheck,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("อาหารกลางวันและนมโรงเรียน", "Lunch & Milk"), url: "/dashboard/admin/school-lunch", icon: UtensilsCrossed, roles: ["admin", "director", "teacher"], desc: L("อาหารกลางวันและนมโรงเรียน", "Lunch & milk program") },
        { title: L("แผนปฏิบัติการ PDCA", "Action Plan (PDCA)"), url: "/dashboard/admin/action-plan", icon: ClipboardCheck, roles: ["admin", "director", "teacher"], desc: L("วงจร Plan-Do-Check-Act", "Plan-Do-Check-Act") },
      ],
    },
    // ── เครื่องมือ (Tools) — ใช้ร่วมทุก role ไม่ผูกกับฝ่ายงาน ─────
    {
      key: "tools_kit",
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,

      roles: ["admin", "director", "teacher", "student", "parent", "alumni"],
      items: [
        { title: L("WebBrowser", "WebBrowser"), url: "/dashboard/browser", icon: Globe, roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("เปิดเว็บไซต์ภายในระบบ", "In-app web browser") },
        { title: L("Google Drive ของฉัน", "My Drive"), url: "/dashboard/my-drive", icon: FolderOpen, roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("เชื่อม Google Drive ส่วนตัว เปิดไฟล์ในระบบ", "Connect your own Google Drive & browse in-app") },
        { title: L("ชุดเอกสาร Office", "Office Suite"), url: "/dashboard/office", icon: FileText, roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("Docs · Sheets · Slides · PDF บันทึกลง Google Drive", "Docs, Sheets, Slides, PDF — save to Google Drive") },
        { title: L("คลังไฟล์ LINE Vault", "LINE Vault"), url: "/dashboard/line-vault", icon: StickyNote, roles: ["admin", "director", "teacher"], desc: L("รูป · ไฟล์ · โน้ตจาก LINE OA ไม่หมดอายุ", "Photos, files & notes from LINE OA — never expire") },
        { title: L("ตั้งค่าแจ้งเตือน", "Notification Settings"), url: "/dashboard/settings/notifications", icon: Bell, roles: ["admin", "director", "teacher", "student", "parent", "alumni"], desc: L("ตั้งค่าการรับแจ้งเตือน · LINE · อีเมล", "Notification preferences · LINE · email") },
        
        { title: L("AI ติวเตอร์", "AI Tutor"), url: "/dashboard/ai-tutor", icon: Bot, roles: ["admin", "director", "teacher", "student", "parent"], desc: L("ติวเตอร์ส่วนตัว วิเคราะห์จุดอ่อน · แนะนำบทเรียน", "Personal AI tutor · weak spots & lessons") },
      ],
    },

    // ── บุคลากรและงบประมาณ ───────────────────────────────────────
    {
      key: "hr_records",
      label: L("บุคลากร (HR)", "Personnel (HR)"),
      icon: Users,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("บุคลากร (HR)", "Personnel (HR)"), url: "/dashboard/hub/hr", icon: Users, roles: ["admin", "director", "teacher"], desc: L("ทะเบียน โครงสร้าง เวลา ลา สอนแทน ประเมิน เงินเดือน ID Plan", "Records, org, attendance, leave, sub, eval, salary, ID Plan") },
        { title: L("ครูเวรประจำวัน", "Duty Teachers"), url: "/dashboard/admin/duty-teachers", icon: ShieldCheck, roles: ["admin", "director"], desc: L("จัดเวร · จุดเวร · บันทึกเหตุการณ์ · แจ้งเตือนอัตโนมัติ", "Schedule · locations · logs · auto-notify") },
      ],
    },
    {
      key: "finance",
      label: L("งานการเงินและพัสดุ", "Finance & Assets"),
      icon: DollarSign,

      roles: ["admin", "director"],
      items: [
        { title: L("งานการเงินและพัสดุ", "Finance & Assets"), url: "/dashboard/hub/finance", icon: DollarSign, roles: ["admin", "director"], desc: L("งบประมาณ จัดซื้อ ทรัพย์สิน เงินอุดหนุน โครงการฮับ", "Budget, procurement, assets, subsidy, hub") },
      ],
    },
    {
      key: "services_garbage",
      label: L("ธนาคารขยะโรงเรียน", "Garbage Bank"),
      icon: Recycle,

      roles: ["admin", "director", "teacher", "student", "alumni"],
      items: [
        { title: L("ธนาคารขยะโรงเรียน", "Garbage Bank"), url: "/dashboard/hub/garbage", icon: Recycle, roles: ["admin", "director", "teacher", "student", "alumni"], desc: L("ภาพรวม แต้ม เคาน์เตอร์ รายการ ประวัติ รายงาน เหรียญตรา", "Dashboard, points, counter, items, history, badges") },
      ],
    },
    {
      key: "services_rooms",
      label: L("การใช้ห้องเรียนพิเศษ", "Special Rooms"),
      icon: DoorOpen,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("จองห้องและตารางการใช้งาน", "Book & Schedule"), url: "/dashboard/academic/learning-center", icon: CalendarDays, roles: ["admin", "director", "teacher"], desc: L("จองห้องพิเศษและดูตารางการใช้", "Reserve rooms & view schedules") },
        { title: L("จัดการห้องพิเศษ", "Manage Rooms"), url: "/dashboard/admin/special-rooms", icon: SettingsIcon, roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไขห้องพิเศษ", "Add/edit special rooms") },
      ],
    },
    {
      key: "services_ar",
      label: L("สื่อ AR / QR แหล่งเรียนรู้", "AR Learning"),
      icon: Boxes,

      roles: ["admin", "director", "teacher"],
      items: [
        { title: L("จัดการงาน AR", "Manage AR Projects"), url: "/dashboard/admin/ar", icon: Boxes, roles: ["admin", "director", "teacher"], desc: L("สร้าง QR ที่สแกนแล้วเห็นภาพ/วิดีโอ/3D", "QR to image, video, 3D") },
      ],
    },
    {
      key: "services_ict",
      label: L("ยืม-คืนอุปกรณ์ ICT", "ICT Loans"),
      icon: Package,

      roles: ["admin", "director", "teacher", "student"],
      items: [
        { title: L("คลังอุปกรณ์สำหรับยืม", "Loan Catalog"), url: "/dashboard/admin/ict-catalog", icon: Package, roles: ["admin", "director", "teacher", "student"], desc: L("ดูอุปกรณ์ที่ว่างให้ยืมตามหมวด", "Browse available devices") },
        { title: L("บันทึกยืม-คืนและประวัติ", "Loans & History"), url: "/dashboard/admin/ict-loans", icon: ScanLine, roles: ["admin", "director", "teacher", "student"], desc: L("สแกนยืม-คืน ดูประวัติและรายงาน", "Scan, history & reports") },
        { title: L("จัดการอุปกรณ์ ICT", "Manage Devices"), url: "/dashboard/admin/ict-devices", icon: SettingsIcon, roles: ["admin", "director"], desc: L("เพิ่ม/แก้ไขอุปกรณ์ ICT", "Add or edit devices") },
      ],
    },
  ];




  const staff: AppRole[] = ["admin", "director", "teacher"];
  const management: AppRole[] = ["admin", "director"];
  const task = (title: string, path: string, icon: NavigationItem["icon"], roles = staff): NavigationItem => ({ title, url: `/dashboard/${path}`, icon, roles });
  const replaceTasks = (key: string, items: NavigationItem[]) => {
    const department = departments.find(d => d.key === key);
    if (department) department.items = items;
  };
  replaceTasks("hr_records", [
    task(L("ทะเบียนบุคลากร", "Personnel records"), "hr/personnel", Users, management),
    task(L("โครงสร้างองค์กร", "Organization chart"), "hr/org-chart", Users),
    task(L("สรุปการมาปฏิบัติงาน", "Staff attendance report"), "hr/attendance-dashboard", BarChart3, management),
    task(L("สอนแทน", "Substitute teaching"), "hr/substitute", UserCog),
    task(L("ประเมิน วPA / DPA", "PA / DPA evaluation"), "hr/evaluation", Award),
    task(L("แผนพัฒนาตนเอง ID Plan", "ID Plan"), "hr/id-plan", BookOpenCheck),
    task(L("เงินเดือนและสวัสดิการ", "Salary & benefits"), "hr/salary", DollarSign, management),
    task(L("สิทธิ์และยอดวันลา", "Leave balance"), "hr/leave-balance", CalendarDays),
    task(L("ครูเวรประจำวัน", "Teacher duty"), "admin/duty-teachers", ShieldCheck, management),
  ]);
  replaceTasks("finance", [
    task(L("งบประมาณและบัญชี", "Budget & accounting"), "finance/budget", DollarSign, management),
    task(L("จัดซื้อจัดจ้าง", "Procurement"), "finance/procurement", ClipboardCheck, management),
    task(L("ทะเบียนพัสดุและครุภัณฑ์", "Asset register"), "finance/assets", Package, management),
    task(L("รายงานพัสดุ", "Asset reports"), "finance/assets/reports", BarChart3, management),
    task(L("เงินอุดหนุนนักเรียน", "Student subsidies"), "finance/subsidy", Heart, management),
  ]);
  replaceTasks("office_docs", [
    task(L("หนังสือราชการรับ–ส่ง", "Official correspondence"), "admin/document", FileText),
    task(L("แบบฟอร์มอิเล็กทรอนิกส์", "Electronic forms"), "admin/eform", ClipboardList),
    task(L("แม่แบบแบบฟอร์ม", "Form templates"), "admin/eform-templates", Layers, management),
    task(L("แม่แบบและกรอกเอกสาร PDF", "PDF documents"), "admin/document-templates", FileText, management),
    task(L("ข่าวและประกาศโรงเรียน", "School announcements"), "admin/news", Megaphone),
    task(L("แจ้งเหตุฉุกเฉิน", "Emergency broadcast"), "admin/emergency", Bell),
    task(L("ศูนย์งานพิมพ์", "Print center"), "admin/print-center", IdCard),
  ]);
  replaceTasks("student_health", [
    task(L("น้ำหนัก ส่วนสูง และสุขภาพ", "Growth & health"), "student/health-trend", Heart),
    task(L("บันทึกวัคซีน", "Vaccinations"), "admin/vaccine", ClipboardCheck),
    task(L("คัดกรองนักเรียน", "Student screening"), "student/screening", Activity),
    task(L("แบบประเมิน SDQ", "SDQ assessment"), "student/sdq", ClipboardList),
    task(L("เยี่ยมบ้านนักเรียน", "Home visits"), "student/home-visit", Home),
  ]);
  const operations = departments.find(d => d.key === "office_ops");
  if (operations) operations.items.push(
    task(L("นมโรงเรียน", "School milk"), "admin/school-milk", Package),
    task(L("โครงการและติดตามงบโครงการ", "Projects & project budgets"), "projects/hub", FolderOpen),
    task(L("รายงานประเมินตนเอง SAR", "SAR report"), "admin/sar", BarChart3, management),
    task(L("มาตรฐาน สมศ. / สพฐ.", "School quality standards"), "admin/smsc", ShieldCheck, management),
    task(L("คะแนน O-NET / NT / PISA", "National test results"), "admin/test-scores", BarChart3, management),
    task(L("สร้างรายงาน", "Report builder"), "admin/report-builder", FileText, management),
    task(L("วิเคราะห์แนวโน้มโรงเรียน", "School trends"), "admin/trend-analytics", BarChart3, management),
  );
  const systemTasks = departments.find(d => d.key === "admin_system");
  if (systemTasks) systemTasks.items.push(
    task(L("จัดการฝ่ายงาน", "Department management"), "admin/departments", Users, management),
    task(L("จัดการสิทธิ์การใช้งาน", "Permission management"), "admin/permissions", ShieldCheck, management),
    task(L("จัดการการแจ้งเตือน", "Notification management"), "admin/notifications", Bell, management),
    task(L("ประวัติการใช้งานระบบ", "Audit log"), "admin/audit-log", History, management),
  );
  const group = (key: string, label: string, icon: NavigationItem["icon"], urls: string[]): NavigationGroup => ({ key, label, icon, items: urls.flatMap(url => mainItems.filter(i => i.url === url)) });
  const groups = (...keys: string[]) => departments.filter(d => keys.includes(d.key));
  const records = departments.find(d => d.key === "academic_records");
  if (records) records.items.unshift({ title: L("สถานะการส่งคะแนน", "Score submission status"), url: "/dashboard/academic/score-status", icon: ClipboardCheck, roles: ["admin", "director", "teacher"] });
  const areas: WorkArea[] = [
    { key: "assessment", label: L("งานวัดผลและทะเบียน", "Assessment & records"), icon: ClipboardCheck, groups: [
      ...groups("academic_records"),
      { key: "registry", label: L("ทะเบียนและรายงาน", "Records & reports"), icon: Users, items: [
        ...groups("academic_manage").flatMap(g => g.items).filter(i => i.url !== "/dashboard/academic/management"),
        { title: "รายงาน SAR", url: "/dashboard/admin/sar", icon: BarChart3, roles: ["admin", "director"] },
      ] },
    ] },
    { key: "academic", label: L("ฝ่ายวิชาการ", "Academic affairs"), icon: BookOpen, groups: [
      group("learning", L("งานเรียนและงานสอน", "Learning & teaching"), BookOpen, ["/dashboard/academic/schedule", "/dashboard/academic/calendar", "/dashboard/homework", "/dashboard/padlet"]),
      ...groups("academic_teaching", "academic_learn", "services_ar"),
      { key: "curriculum", label: L("หลักสูตรและห้องเรียน", "Curriculum & classrooms"), icon: SettingsIcon, items: groups("academic_manage").flatMap(g => g.items).filter(i => i.url === "/dashboard/academic/management") },
    ] },
    { key: "student", label: L("ฝ่ายกิจการนักเรียน", "Student affairs"), icon: Heart, groups: [
      group("attendance", L("การมาเรียนและพฤติกรรม", "Attendance & behavior"), ClipboardList, ["/dashboard/student/face-scan", "/dashboard/student/face-scan?tab=staff", "/dashboard/student/my-face", "/dashboard/student/attendance", "/dashboard/student/behavior", "/dashboard/student/leave"]),
      { key: "mobile-scan", label: L("งานสแกน", "Scanning"), icon: ScanLine, items: [task(L("สแกน QR นักเรียนด้วยมือถือ", "Mobile student QR scanner"), "staff/mobile-qr-scan", ScanLine)] },
      ...groups("student_daily", "student_health", "wellbeing"),
      group("activities", L("กิจกรรมและเกียรติบัตร", "Activities & certificates"), Trophy, ["/dashboard/activities", "/dashboard/certificates"]),
      ...groups("services_garbage"),
    ] },
    { key: "general", label: L("ฝ่ายบริหารทั่วไป", "General administration"), icon: Megaphone, groups: groups("office_docs", "office_ops", "services_rooms", "services_ict") },
    { key: "hr", label: L("ฝ่ายบริหารงานบุคคล", "Personnel"), icon: Users, groups: [
      group("staff_daily", L("งานบุคลากรประจำวัน", "Daily staff work"), Clock, ["/dashboard/hr/time-clock", "/dashboard/hr/leave", "/dashboard/admin/staff-tasks"]), ...groups("hr_records"),
    ] },
    { key: "finance", label: L("ฝ่ายงบประมาณและพัสดุ", "Budget & assets"), icon: DollarSign, groups: groups("finance") },
    { key: "tools", label: L("เครื่องมือและไฟล์", "Tools & files"), icon: FolderOpen, groups: groups("tools_kit") },
    { key: "system", label: L("ผู้ดูแลระบบ", "System administration"), icon: Shield, groups: groups("admin_content", "admin_system", "admin_cloud", "admin_kiosk") },
    { key: "personal", label: L("ข้อมูลส่วนตัวและโรงเรียน", "My account & school"), icon: User, groups: [group("personal", L("ข้อมูลและข่าวสาร", "Account & news"), User, ["/dashboard/profile", "/dashboard/portfolio", "/dashboard/feed", "/dashboard/members", "/"])] },
  ];
  // A repeated destination belongs to one group only; parameterized tasks must be opened from their parent module.
  return areas.map(area => {
    const seen = new Set<string>();
    return { ...area, groups: area.groups.map(g => ({ ...g, items: g.items.filter(i => {
      if (seen.has(i.url) || i.url.includes(":id")) return false;
      seen.add(i.url); return true;
    }) })) };
  });
}
export function visibleWorkAreas(areas: WorkArea[], role: AppRole | null, isEnabled: (key?: string | null) => boolean): WorkArea[] {
  if (!role) return [];
  return areas.map(area => ({ ...area, groups: area.groups.filter(g => !g.roles || g.roles.includes(role)).map(g => ({ ...g, items: g.items.filter(i => (!i.roles || i.roles.includes(role)) && isEnabled(i.moduleKey ?? getModuleKeyForPath(i.url.split("?")[0]))) })).filter(g => g.items.length) })).filter(a => a.groups.length);
}
export function findWorkArea(areas: WorkArea[], pathname: string): WorkArea | undefined {
  return areas.find(a => areaUrl(a.key) === pathname) ?? areas.find(a => a.groups.some(g => g.items.some(i => i.url.split("?")[0] === pathname))) ?? areas.find(a => a.groups.some(g => g.items.some(i => pathname.startsWith(i.url.split("?")[0] + "/"))));
}
export function dailyNavigationItems(visibleAreas: WorkArea[]): NavigationItem[] {
  const urls = [
    "/dashboard/hr/time-clock", "/dashboard/student/face-scan",
    "/dashboard/student/attendance", "/dashboard/academic/schedule",
    "/dashboard/homework", "/dashboard/padlet", "/dashboard/student/behavior",
    "/dashboard/student/leave", "/dashboard/hr/leave",
    "/dashboard/admin/staff-tasks", "/dashboard/academic/calendar",
    "/dashboard/feed",
  ];
  const items = visibleAreas.flatMap(a => a.groups.flatMap(g => g.items));
  return urls.flatMap(url => {
    const item = items.find(i => i.url === url);
    return item ? [item] : [];
  });
}
