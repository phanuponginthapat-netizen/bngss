import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap, LayoutDashboard, User, Award, Megaphone, Users, CalendarDays, FolderOpen, FileText, Inbox, Heart, ClipboardList, Shield, BookOpenCheck, Calendar, X, Search, ChevronDown, BriefcaseBusiness, Sun } from "lucide-react";
import { Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { SidebarAccountFooter } from "@/components/SidebarAccountFooter";
import { ViewModeSwitcher } from "@/components/ViewModeSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { areaUrl, buildWorkAreas, dailyNavigationItems, findWorkArea, visibleWorkAreas, type NavigationItem } from "@/lib/navigation/workAreas";

export function AppSidebar() {
  const { toggleSidebar, setOpenMobile, isMobile } = useSidebar();
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const { appName, appShortName, schoolName, schoolLogo } = useSystemSettings();
  const { isModuleEnabled } = useModuleToggles();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const [closedSections, setClosedSections] = useState<string[]>([]);
  const L = (th: string, en: string) => lang === "th" ? th : en;
  // แสดงชื่อบรืการสั้น ๆ บรรทัดเดียว (เช่น "BNG Smart School") โดยไม่แสดงชื่โรงเรียนยาวซ้ำ
  const brandTitle = (() => {
    const base = ((appName || appShortName || schoolName) || "").replace(/\s+/g, " ").trim();
    const latin = (base.match(/^[A-Za-z0-9][A-Za-z0-9&.,'’+\- ]*/) ?? [""])[0].trim();
    return latin.length >= 3 ? latin : base || "BNG Smart School";
  })();
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
  const dailyItems = dailyNavigationItems(areas).filter(i => i.title.toLowerCase().includes(q));
  const onNavigate = () => { if (isMobile) setOpenMobile(false); };
  const menuItem = (item: { to: string; icon: NavigationItem["icon"]; label: string }, active = pathname === item.to) => (
    <SidebarMenuItem key={item.to}><SidebarMenuButton asChild isActive={active} tooltip={item.label} className="group/nav relative h-auto min-h-7 gap-2 rounded-md px-1.5 py-[3px] text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sidebar-primary">
      <Link to={item.to} onClick={onNavigate} aria-current={active ? "page" : undefined}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-sidebar-accent/70 text-sidebar-foreground/65 group-hover/nav:text-sidebar-foreground group-data-[active=true]/nav:bg-sidebar-primary/15 group-data-[active=true]/nav:text-sidebar-primary"><item.icon className="h-3 w-3" /></span>
        <span className="min-w-0 flex-1 !whitespace-normal !overflow-visible break-words text-[12px] leading-[17px]">{item.label}</span>
      </Link>
    </SidebarMenuButton></SidebarMenuItem>
  );
  const section = (key: string, label: string, Icon: NavigationItem["icon"], items: { to: string; icon: NavigationItem["icon"]; label: string; active?: boolean }[]) => {
    if (!items.length) return null;
    const expanded = Boolean(q) || items.some(item => item.active || item.to === pathname) || !closedSections.includes(key);
    return <SidebarGroup key={key} className="border-t border-sidebar-border/60 px-0 pb-1 pt-1.5">
      <SidebarGroupLabel asChild className="mb-0.5 h-auto px-0">
        <Button variant="ghost" onClick={() => setClosedSections(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])} aria-expanded={expanded} aria-controls={`sidebar-section-${key}`} className="h-auto min-h-6 w-full justify-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
          <Icon className="h-3 w-3 shrink-0" /><span className="min-w-0 flex-1 whitespace-normal text-left">{label}</span><span className="text-[9px] font-normal tabular-nums text-sidebar-foreground/45">{items.length}</span><ChevronDown className={`h-3 w-3 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`} />
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent id={`sidebar-section-${key}`} hidden={!expanded}><SidebarMenu className="gap-0.5">{items.map(item => menuItem(item, item.active ?? pathname === item.to))}</SidebarMenu></SidebarGroupContent>
    </SidebarGroup>;
  };
  return <Sidebar side="right" collapsible="offcanvas" className="border-l border-sidebar-border bg-sidebar">
    <SidebarHeader className="gap-2 border-b border-sidebar-border/70 px-2.5 pb-2.5 pt-3">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary ring-1 ring-sidebar-primary/25">{schoolLogo ? <img src={schoolLogo} alt="" className="h-full w-full rounded-lg object-cover" /> : <GraduationCap className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><h2 title={appName} className="truncate text-[13px] font-semibold leading-5 !tracking-normal text-sidebar-foreground">{brandTitle}</h2></div><Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="ซ่อนเมนู" title={L("ซ่อนเมนู", "Hide menu")} className="h-6 w-6 shrink-0 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"><X className="h-3.5 w-3.5" /></Button></div>
      <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/45" /><Input aria-label="ค้นหาเมนู" placeholder={L("ค้นหาเมนู…", "Search menus…")} value={search} onChange={e => setSearch(e.target.value)} className="h-8 rounded-md border-sidebar-border/80 bg-sidebar-accent/50 pl-7 pr-7 text-[11px] text-sidebar-foreground placeholder:text-sidebar-foreground/45 focus-visible:ring-sidebar-ring" />{search && <Button variant="ghost" size="icon" aria-label={L("ล้างคำค้น", "Clear search")} onClick={() => setSearch("")} className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"><X className="h-3 w-3" /></Button>}</div>
    </SidebarHeader>
    <SidebarContent className="gap-0.5 px-2 py-2"><ViewModeSwitcher collapsed={false} />
      {compact ? compact.map((group, index) => section(`compact-${index}`, group.label, group.icon ?? FolderOpen, group.items.filter(i => i.label.toLowerCase().includes(q)))) : <>
        <SidebarGroup className="px-0 pb-1 pt-0"><SidebarGroupContent><SidebarMenu className="gap-0.5">{[{ to: "/dashboard", label: L("หน้าหลัก", "Dashboard"), icon: LayoutDashboard }, { to: "/dashboard/inbox", label: L("กล่องข้อความ", "Inbox"), icon: Inbox }].filter(i => i.label.toLowerCase().includes(q)).map(i => menuItem(i))}</SidebarMenu></SidebarGroupContent></SidebarGroup>
        {section("daily", L("ใช้งานประจำวัน", "Daily work"), Sun, dailyItems.map(i => ({ to: i.url, label: i.title, icon: i.icon })))}
        {section("departments", L("ฝ่ายงานและบริการ", "Departments & services"), BriefcaseBusiness, shownAreas.map(a => ({ to: areaUrl(a.key), label: a.label, icon: a.icon, active: activeArea?.key === a.key })))}
        {!shownAreas.length && !dailyItems.length && q && ![L("หน้าหลัก", "Dashboard"), L("กล่องข้อความ", "Inbox")].some(label => label.toLowerCase().includes(q)) && <p role="status" className="p-3 text-center text-[11px] leading-4 text-sidebar-foreground/60">{L("ไม่พบเมนูที่ตรงกับคำค้น", "No matching menus")}</p>}
      </>}
    </SidebarContent><SidebarAccountFooter />
  </Sidebar>;
}
