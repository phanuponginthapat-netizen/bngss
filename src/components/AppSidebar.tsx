import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap, LayoutDashboard, User, Award, Megaphone, Users, CalendarDays, FolderOpen, FileText, Inbox, Heart, ClipboardList, Shield, BookOpenCheck, Calendar, X, Search } from "lucide-react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { SidebarAccountFooter } from "@/components/SidebarAccountFooter";
import { ViewModeSwitcher } from "@/components/ViewModeSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { areaUrl, buildWorkAreas, findWorkArea, visibleWorkAreas, type NavigationItem } from "@/lib/navigation/workAreas";

export function AppSidebar() {
  const { toggleSidebar, setOpenMobile, isMobile } = useSidebar();
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const { appName, schoolName, schoolLogo } = useSystemSettings();
  const { isModuleEnabled } = useModuleToggles();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const L = (th: string, en: string) => lang === "th" ? th : en;
  const areas = visibleWorkAreas(buildWorkAreas(lang), role, isModuleEnabled);
  const activeArea = findWorkArea(areas, pathname);
  type CompactSection = { label: string; icon?: NavigationItem["icon"]; items: { to: string; icon: NavigationItem["icon"]; label: string }[] };
  const renderCompactSidebar = (sections: CompactSection[]) => sections;
  const alumniSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("หน้าหลัก", "Dashboard") },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile") },
        { to: "/dashboard/portfolio", icon: Award, label: L("ผลงานของฉัน", "Portfolio") },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed") },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members") },
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar") },
      ],
    },
    {
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,
      items: [
        { to: "/dashboard/my-drive", icon: FolderOpen, label: L("Google Drive ของฉัน", "My Drive") },
        { to: "/dashboard/office", icon: FileText, label: L("ชุดเอกสาร Office", "Office Suite") },
      ],
    },
  ]);

  const parentSidebar = renderCompactSidebar([
    {
      label: L("ของฉัน", "My Account"),
      icon: User,
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: L("หน้าหลัก", "Dashboard") },
        { to: "/dashboard/profile", icon: User, label: L("โปรไฟล์", "Profile") },
        { to: "/dashboard/inbox", icon: Inbox, label: L("กล่องข้อความ", "Inbox") },
        { to: "/dashboard/feed", icon: Megaphone, label: L("ฟีดโรงเรียน", "Feed") },
      ],
    },
    {
      label: L("ลูกของฉัน", "My Child"),
      icon: Heart,
      items: [
        { to: "/dashboard/student/attendance", icon: ClipboardList, label: L("การมาเรียน", "Attendance") },
        { to: "/dashboard/student/behavior", icon: Shield, label: L("พฤติกรรม", "Behavior") },
        { to: "/dashboard/student/leave", icon: FileText, label: L("ยื่นใบลา", "Leave") },
        { to: "/dashboard/student/health-trend", icon: Heart, label: L("สุขภาพ", "Health") },
        { to: "/dashboard/homework", icon: BookOpenCheck, label: L("การบ้าน", "Homework") },
        { to: "/dashboard/academic/schedule", icon: Calendar, label: L("ตารางเรียน", "Schedule") },
        // Games hidden — backend functions deleted (quota) — restore from git if needed
        // { to: "/dashboard/games", icon: Gamepad2, label: L("เกมฮับ", "Games") },
      ],
    },
    {
      label: L("โรงเรียน", "School"),
      icon: GraduationCap,
      items: [
        { to: "/dashboard/academic/calendar", icon: CalendarDays, label: L("ปฏิทินโรงเรียน", "Calendar") },
        { to: "/dashboard/members", icon: Users, label: L("สมาชิกโรงเรียน", "Members") },
      ],
    },
    {
      label: L("เครื่องมือ", "Tools"),
      icon: FolderOpen,
      items: [
        { to: "/dashboard/my-drive", icon: FolderOpen, label: L("Google Drive ของฉัน", "My Drive") },
        { to: "/dashboard/office", icon: FileText, label: L("ชุดเอกสาร Office", "Office Suite") },
      ],
    },
  ]);




  // Concise main items

  const compact = role === "parent" ? parentSidebar : role === "alumni" ? alumniSidebar : null;
  const q = search.trim().toLowerCase();
  const shownAreas = areas.filter(a => `${a.label} ${a.groups.flatMap(g => g.items.map(i => i.title)).join(" ")}`.toLowerCase().includes(q));
  const onNavigate = () => { if (isMobile) setOpenMobile(false); };
  const menuItem = (item: { to: string; icon: NavigationItem["icon"]; label: string }, active = pathname === item.to) => (
    <SidebarMenuItem key={item.to}><SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-auto min-h-10 py-2">
      <Link to={item.to} onClick={onNavigate} aria-current={active ? "page" : undefined} className="text-sidebar-foreground"><item.icon className="h-4 w-4 shrink-0" /><span className="break-words whitespace-normal">{item.label}</span></Link>
    </SidebarMenuButton></SidebarMenuItem>
  );
  return <Sidebar side="right" collapsible="offcanvas" className="border-l border-sidebar-border bg-sidebar">
    <SidebarHeader className="border-b border-sidebar-border p-4">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">{schoolLogo ? <img src={schoolLogo} alt="" className="h-full w-full rounded-lg object-cover" /> : <GraduationCap className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold text-sidebar-foreground">{appName}</h2>{schoolName !== appName && <p className="text-xs text-sidebar-foreground/70">{schoolName}</p>}</div><Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="ซ่อนเมนู" className="h-8 w-8 shrink-0 text-sidebar-foreground"><X /></Button></div>
      <div className="relative mt-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-sidebar-foreground/60" /><Input aria-label="ค้นหาเมนู" placeholder={L("ค้นหาเมนู…", "Search menus…")} value={search} onChange={e => setSearch(e.target.value)} className="h-9 border-sidebar-border bg-sidebar-accent pl-9 text-sidebar-foreground" /></div>
    </SidebarHeader>
    <SidebarContent className="gap-1 p-2"><ViewModeSwitcher collapsed={false} />
      {compact ? compact.map(section => <SidebarGroup key={section.label} className="p-0"><SidebarGroupLabel>{section.label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{section.items.filter(i => i.label.toLowerCase().includes(q)).map(i => menuItem(i))}</SidebarMenu></SidebarGroupContent></SidebarGroup>) : <>
        <SidebarGroup className="p-0"><SidebarGroupContent><SidebarMenu>{[{ to: "/dashboard", label: L("หน้าหลัก", "Dashboard"), icon: LayoutDashboard }, { to: "/dashboard/inbox", label: L("กล่องข้อความ", "Inbox"), icon: Inbox }].filter(i => i.label.toLowerCase().includes(q)).map(i => menuItem(i))}</SidebarMenu></SidebarGroupContent></SidebarGroup>
        <SidebarGroup className="p-0"><SidebarGroupLabel>{L("ฝ่ายงานและบริการ", "Departments & services")}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{shownAreas.map(a => menuItem({ to: areaUrl(a.key), label: a.label, icon: a.icon }, activeArea?.key === a.key))}</SidebarMenu></SidebarGroupContent></SidebarGroup>
        {!shownAreas.length && <p className="p-4 text-sm text-sidebar-foreground/70">{L("ไม่พบเมนูที่ตรงกับคำค้น", "No matching menus")}</p>}
      </>}
    </SidebarContent><SidebarAccountFooter />
  </Sidebar>;
}
