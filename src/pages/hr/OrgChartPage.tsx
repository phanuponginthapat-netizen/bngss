import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Crown, Search, Printer, Users, Building2, BookOpen, Star, Bookmark } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatDateLongBE } from "@/lib/dateBE";
import { SUBJECT_GROUPS, SUBJECT_GROUP_COLORS } from "@/hooks/useUserSubjectGroups";
import type { DeptRole } from "@/hooks/useUserDepartments";

type Person = {
  id: string;
  prefix: string | null;
  first_name: string;
  last_name: string;
  position: string | null;
  position_title?: string | null;
  department: string | null;
  subject_group: string | null;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type ProfileLite = { id: string; avatar_url: string | null; position_title: string | null };

const DEPARTMENTS = [
  "ฝ่ายวิชาการ",
  "ฝ่ายกิจการนักเรียน",
  "ฝ่ายบริหารทั่วไป",
  "ฝ่ายงบประมาณและบุคคล",
  "ฝ่ายอาคารสถานที่",
  "ฝ่ายแผนงานและประกันคุณภาพ",
  "ConnextED",
];

const DEPT_COLORS: Record<string, string> = {
  "ฝ่ายวิชาการ": "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
  "ฝ่ายกิจการนักเรียน": "from-amber-500/20 to-orange-500/10 border-amber-500/30",
  "ฝ่ายบริหารทั่วไป": "from-purple-500/20 to-fuchsia-500/10 border-purple-500/30",
  "ฝ่ายงบประมาณและบุคคล": "from-emerald-500/20 to-green-500/10 border-emerald-500/30",
  "ฝ่ายอาคารสถานที่": "from-rose-500/20 to-pink-500/10 border-rose-500/30",
  "ฝ่ายแผนงานและประกันคุณภาพ": "from-indigo-500/20 to-violet-500/10 border-indigo-500/30",
  "ConnextED": "from-teal-500/20 to-cyan-500/10 border-teal-500/30",
};

// Solid hex colors for the printed report (no Tailwind in print window).
const DEPT_PRINT_COLORS: Record<string, { bar: string; soft: string }> = {
  "ฝ่ายวิชาการ":            { bar: "#2563eb", soft: "#eff6ff" },
  "ฝ่ายกิจการนักเรียน":      { bar: "#f59e0b", soft: "#fffbeb" },
  "ฝ่ายบริหารทั่วไป":         { bar: "#a855f7", soft: "#faf5ff" },
  "ฝ่ายงบประมาณและบุคคล":   { bar: "#10b981", soft: "#ecfdf5" },
  "ฝ่ายอาคารสถานที่":         { bar: "#f43f5e", soft: "#fff1f2" },
  "ฝ่ายแผนงานและประกันคุณภาพ": { bar: "#6366f1", soft: "#eef2ff" },
  "ConnextED":              { bar: "#14b8a6", soft: "#f0fdfa" },
};

const fullName = (p: Person) => `${p.prefix || ""}${p.first_name} ${p.last_name}`.trim();
const initials = (p: Person) => (p.first_name?.[0] || "") + (p.last_name?.[0] || "");

const isDirector = (p: Person) => /ผู้อำนวยการ(?!รอง)/.test(p.position_title || "") || /^ผู้อำนวยการ/.test(p.position || "");
const isDeputy = (p: Person) => /รองผู้อำนวยการ/.test(p.position_title || "") || /รองผู้อำนวยการ/.test(p.position || "");
const isHead = (p: Person) => /หัวหน้า/.test(p.position_title || "");

export default function OrgChartPage() {
  const [search, setSearch] = useState("");
  const { schoolName, appName, schoolLogo } = useSystemSettings();

  const { data: people = [] } = useQuery({
    queryKey: ["orgchart_personnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name, position, department, subject_group, user_id, email, phone, status")
        .eq("status", "active")
        .order("last_name");
      if (error) throw error;
      // load position_title + avatar via SECURITY DEFINER RPC so every role sees photos
      const ids = (data || []).map((p: any) => p.user_id).filter(Boolean);
      let profMap: Record<string, ProfileLite> = {};
      if (ids.length) {
        const { data: profs } = await (supabase.rpc as any)("get_personnel_avatars", {
          _user_ids: ids,
        });
        for (const pr of (profs || []) as ProfileLite[]) profMap[pr.id] = pr;
      }
      return (data || []).map((p: any) => ({
        ...p,
        position_title: profMap[p.user_id]?.position_title || null,
        avatar_url: profMap[p.user_id]?.avatar_url || null,
      })) as (Person & { avatar_url: string | null })[];
    },
  });

  // Load role assignments so หัวหน้า/รอง/หัวหน้าหมวด แสดงถูกต้องแม้ position_title ไม่ระบุ
  const { data: deptRoles = [] } = useQuery({
    queryKey: ["orgchart_dept_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_departments").select("user_id, department, dept_role");
      return (data || []) as { user_id: string; department: string; dept_role: DeptRole }[];
    },
  });
  const { data: groupRoles = [] } = useQuery({
    queryKey: ["orgchart_group_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subject_groups").select("user_id, subject_group, group_role");
      return (data || []) as { user_id: string; subject_group: string; group_role: DeptRole }[];
    },
  });

  // ฝ่ายเก็บใน personnel เป็นภาษาไทย, ใน user_departments เป็น enum — สร้าง map แปลง
  const DEPT_ENUM_TO_TH: Record<string, string> = {
    academic: "ฝ่ายวิชาการ",
    student_affairs: "ฝ่ายกิจการนักเรียน",
    general_admin: "ฝ่ายบริหารทั่วไป",
    finance_personnel: "ฝ่ายงบประมาณและบุคคล",
    director_office: "สำนักผู้อำนวยการ",
  };

  // สร้าง lookup: userId+deptTH → role
  const roleByUserDept = useMemo(() => {
    const m = new Map<string, DeptRole>();
    for (const r of deptRoles) {
      const th = DEPT_ENUM_TO_TH[r.department] || r.department;
      m.set(`${r.user_id}::${th}`, r.dept_role);
    }
    return m;
  }, [deptRoles]);
  const roleByUserGroup = useMemo(() => {
    const m = new Map<string, DeptRole>();
    for (const r of groupRoles) m.set(`${r.user_id}::${r.subject_group}`, r.group_role);
    return m;
  }, [groupRoles]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p =>
      fullName(p).toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q) ||
      (p.subject_group || "").toLowerCase().includes(q) ||
      (p.position_title || "").toLowerCase().includes(q)
    );
  }, [people, search]);

  const director = useMemo(() => people.find(isDirector), [people]);
  const deputies = useMemo(() => people.filter(isDeputy), [people]);

  const rankOrder: Record<DeptRole | "none", number> = { head: 0, deputy_head: 1, section_head: 2, member: 3, none: 4 };
  const getDeptRole = (p: Person, dept: string): DeptRole | null =>
    (p.user_id ? roleByUserDept.get(`${p.user_id}::${dept}`) : null) ??
    (isHead(p) ? "head" : null);
  const getGroupRole = (p: Person, group: string): DeptRole | null =>
    p.user_id ? roleByUserGroup.get(`${p.user_id}::${group}`) ?? null : null;

  const byDept = useMemo(() => {
    const map: Record<string, (Person & { avatar_url: string | null })[]> = {};
    for (const d of DEPARTMENTS) map[d] = [];
    const other: (Person & { avatar_url: string | null })[] = [];
    for (const p of filtered) {
      if (isDirector(p) || isDeputy(p)) continue;
      const d = (p.department || "").trim();
      if (d && map[d]) map[d].push(p);
      else other.push(p);
    }
    // เรียงตามตำแหน่ง: หัวหน้าฝ่าย → รอง → หัวหน้าหมวด → สมาชิก
    for (const d of DEPARTMENTS) {
      map[d].sort((a, b) => rankOrder[getDeptRole(a, d) ?? "none"] - rankOrder[getDeptRole(b, d) ?? "none"]);
    }
    return { map, other };
  }, [filtered, roleByUserDept]);

  const byGroup = useMemo(() => {
    const map: Record<string, (Person & { avatar_url: string | null })[]> = {};
    for (const g of SUBJECT_GROUPS) map[g] = [];
    const other: (Person & { avatar_url: string | null })[] = [];
    for (const p of filtered) {
      if (isDirector(p) || isDeputy(p)) continue;
      // ผูกจาก user_subject_groups ก่อน — ถ้าไม่มีข้อมูล ใช้ personnel.subject_group เป็น fallback
      const explicit = groupRoles.filter((r) => r.user_id === p.user_id).map((r) => r.subject_group);
      const groups = explicit.length ? explicit : (p.subject_group ? [p.subject_group] : []);
      if (groups.length === 0) { other.push(p); continue; }
      for (const g of groups) {
        if (map[g]) map[g].push(p);
        else other.push(p);
      }
    }
    for (const g of SUBJECT_GROUPS) {
      map[g].sort((a, b) => rankOrder[getGroupRole(a, g) ?? "none"] - rankOrder[getGroupRole(b, g) ?? "none"]);
    }
    return { map, other };
  }, [filtered, groupRoles, roleByUserGroup]);


  const handlePrint = () => {
    const esc = (s: string | null | undefined) =>
      String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
      );
    const orgName = schoolName || appName || "โรงเรียน";
    const dateStr = formatDateLongBE(new Date());

    const avatarHtml = (p: Person & { avatar_url: string | null }, size: number) => {
      if (p.avatar_url) {
        return `<img loading="lazy" decoding="async" src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px;border-radius:9999px;object-fit:cover;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15);" />`;
      }
      return `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#eef2ff;color:#3b3b8c;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size * 0.36)}px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15);">${esc(initials(p))}</div>`;
    };

    const personRow = (p: Person & { avatar_url: string | null }) => `
      <div class="person">
        ${avatarHtml(p, 30)}
        <div class="person-info">
          <div class="person-name">${esc(fullName(p))}</div>
          <div class="person-sub">${esc(p.position_title || p.position || "บุคลากร")}${p.subject_group ? ` · <span class="accent">${esc(p.subject_group)}</span>` : ""}</div>
        </div>
      </div>`;

    const deptCard = (dept: string) => {
      const members = byDept.map[dept] || [];
      const head = members.find(isHead);
      const others = members.filter((m) => m.id !== head?.id);
      const accent = DEPT_PRINT_COLORS[dept] || { bar: "#64748b", soft: "#f1f5f9" };
      return `
        <section class="dept" style="border-color:${accent.bar}40;">
          <header class="dept-h" style="background:linear-gradient(90deg, ${accent.bar}1f, transparent);">
            <span class="dept-bar" style="background:${accent.bar};"></span>
            <h3>${esc(dept)}</h3>
            <span class="dept-count">${members.length}</span>
          </header>
          <div class="dept-body">
            ${
              head
                ? `<div class="head-card" style="background:${accent.soft};border-color:${accent.bar}55;">
                    ${avatarHtml(head, 34)}
                    <div class="person-info">
                      <div class="head-label" style="color:${accent.bar};">หัวหน้าฝ่าย</div>
                      <div class="person-name">${esc(fullName(head))}</div>
                      <div class="person-sub">${esc(head.position_title || head.position || "")}</div>
                    </div>
                  </div>`
                : ""
            }
            ${
              others.length === 0 && !head
                ? `<div class="empty">— ไม่มีบุคลากร —</div>`
                : others.map(personRow).join("")
            }
          </div>
        </section>`;
    };

    const directorBlock = director
      ? `<section class="director">
          <div class="director-card">
            <div class="crown">♛</div>
            ${avatarHtml(director as any, 78)}
            <div class="director-name">${esc(fullName(director))}</div>
            <div class="director-title">ผู้อำนวยการสถานศึกษา</div>
            ${director.subject_group ? `<div class="person-sub">${esc(director.subject_group)}</div>` : ""}
          </div>
          ${
            deputies.length > 0
              ? `<div class="deputies">
                  ${deputies
                    .map(
                      (d) => `
                    <div class="deputy-card">
                      ${avatarHtml(d as any, 42)}
                      <div class="person-info">
                        <div class="deputy-label">รองผู้อำนวยการ</div>
                        <div class="person-name">${esc(fullName(d))}</div>
                        <div class="person-sub">${esc(d.position_title || "")}</div>
                      </div>
                    </div>`,
                    )
                    .join("")}
                </div>`
              : ""
          }
        </section>`
      : "";

    const otherBlock =
      byDept.other.length > 0
        ? `<section class="dept other-dept">
            <header class="dept-h"><h3>ยังไม่ระบุฝ่ายงาน</h3><span class="dept-count">${byDept.other.length}</span></header>
            <div class="dept-body grid-other">${byDept.other.map(personRow).join("")}</div>
          </section>`
        : "";

    const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"/>
<title>ผังโครงสร้างองค์กร · ${esc(orgName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin:0; padding:0; font-family: 'Sarabun', sans-serif; color:#0f172a; }
  body { background:#fff; }
  .sheet { width: 277mm; min-height: 190mm; padding: 0; margin: 0 auto; }
  .doc-h { display:flex; align-items:center; gap:14px; padding-bottom:10px; border-bottom:2px solid #0f172a; margin-bottom:14px; }
  .doc-h img.logo { height:54px; width:54px; object-fit:contain; }
  .doc-h .htxt h1 { margin:0; font-size:20px; font-weight:800; letter-spacing:.2px; }
  .doc-h .htxt .sub { margin-top:2px; font-size:12px; color:#475569; }
  .doc-h .meta { margin-left:auto; text-align:right; font-size:11px; color:#475569; }
  .director { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:14px; }
  .director-card { text-align:center; padding:10px 18px; border:2px solid #f59e0b66; border-radius:14px;
    background:linear-gradient(135deg,#fef3c7,#fffbeb); min-width:280px; }
  .director-card .crown { color:#d97706; font-size:18px; margin-bottom:2px; }
  .director-name { font-weight:800; font-size:15px; margin-top:6px; }
  .director-title { display:inline-block; margin-top:4px; padding:2px 10px; border-radius:9999px;
    background:#f59e0b; color:#fff; font-size:11px; font-weight:600; }
  .deputies { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; max-width:760px; margin-top:6px; }
  .deputy-card { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1.5px solid #fb923c66;
    background:linear-gradient(135deg,#ffedd5,#fff7ed); border-radius:10px; }
  .deputy-label { font-size:9px; color:#c2410c; font-weight:700; text-transform:uppercase; letter-spacing:.6px; }
  .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
  .dept { border:1.5px solid #cbd5e1; border-radius:12px; overflow:hidden; background:#fff;
    break-inside:avoid; page-break-inside:avoid; }
  .dept-h { display:flex; align-items:center; gap:8px; padding:7px 10px; border-bottom:1px solid #e2e8f0; }
  .dept-h .dept-bar { width:4px; height:16px; border-radius:2px; display:inline-block; }
  .dept-h h3 { margin:0; font-size:13px; font-weight:700; }
  .dept-h .dept-count { margin-left:auto; font-size:11px; background:#f1f5f9; color:#334155;
    border-radius:9999px; padding:1px 8px; font-weight:600; }
  .dept-body { padding:8px; display:flex; flex-direction:column; gap:5px; }
  .head-card { display:flex; gap:8px; align-items:center; padding:7px 9px; border:1.5px solid; border-radius:9px; }
  .head-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; margin-bottom:1px; }
  .person { display:flex; align-items:center; gap:8px; padding:5px 7px; border-radius:8px;
    background:#f8fafc; border:1px solid #eef2f7; }
  .person-info { min-width:0; flex:1; }
  .person-name { font-size:11.5px; font-weight:600; line-height:1.15; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .person-sub { font-size:10px; color:#64748b; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .person-sub .accent { color:#1d4ed8; font-weight:600; }
  .empty { font-size:10.5px; color:#94a3b8; text-align:center; padding:14px 0; }
  .other-dept { margin-top:10px; }
  .grid-other { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
  .footer { margin-top:12px; padding-top:6px; border-top:1px dashed #cbd5e1; font-size:10px; color:#94a3b8;
    display:flex; justify-content:space-between; }
</style></head><body>
<div class="sheet">
  <header class="doc-h">
    ${schoolLogo ? `<img loading="lazy" decoding="async" class="logo" src="${esc(schoolLogo)}" />` : ""}
    <div class="htxt">
      <h1>${esc(orgName)}</h1>
      <div class="sub">ผังโครงสร้างองค์กรและบุคลากร</div>
    </div>
    <div class="meta">
      <div>พิมพ์เมื่อ ${esc(dateStr)}</div>
      <div>บุคลากรทั้งหมด ${people.length} คน</div>
    </div>
  </header>

  ${directorBlock}

  <div class="grid">
    ${DEPARTMENTS.map(deptCard).join("")}
  </div>

  ${otherBlock}

  <div class="footer">
    <span>${esc(orgName)} — รายงานผังบุคลากร</span>
    <span>หน้า 1</span>
  </div>
</div>
<script>
  (function(){
    function ready(){
      var imgs = Array.from(document.images);
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(imgs.map(function(img){
        if (img.complete) return;
        return new Promise(function(res){ img.onload = img.onerror = res; });
      }));
    }
    ready().then(function(){
      setTimeout(function(){ window.focus(); window.print(); }, 200);
    });
  })();
</script>
</body></html>`;

    const w = window.open("", "_blank", "width=1200,height=850");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const PersonCard = ({ p, accent }: { p: Person & { avatar_url: string | null }; accent?: string }) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-card/60 backdrop-blur border ${accent || "border-border"} hover:shadow-md transition-all`}>
      <Avatar className="w-11 h-11 ring-2 ring-background shadow">
        <AvatarImage src={p.avatar_url || undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">{initials(p)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{fullName(p)}</div>
        <div className="text-xs text-muted-foreground truncate">
          {p.position_title || p.position || "บุคลากร"}
          {p.subject_group && <span className="text-primary"> • {p.subject_group}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
            <Network className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">แผนผังฝ่ายงานในระบบ</h1>
            <p className="text-sm text-muted-foreground">โครงสร้างองค์กรของโรงเรียนตามฝ่ายงานและบุคลากร</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / ฝ่าย / หมวดวิชา" className="pl-9 w-64" />
          </div>
          <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> พิมพ์</Button>
        </div>
      </div>

      {/* Director */}
      {director && (
        <div className="flex flex-col items-center gap-2">
          <Card className="w-full max-w-md border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 shadow-elegant">
            <CardContent className="pt-6 pb-5 flex flex-col items-center gap-2 text-center">
              <Crown className="w-6 h-6 text-amber-500" />
              <Avatar className="w-20 h-20 ring-4 ring-amber-500/30">
                <AvatarImage src={(director as any).avatar_url || undefined} />
                <AvatarFallback className="text-lg font-bold bg-amber-500/20 text-amber-700">{initials(director)}</AvatarFallback>
              </Avatar>
              <div className="font-bold text-lg">{fullName(director)}</div>
              <Badge className="bg-amber-500 text-white border-0">ผู้อำนวยการสถานศึกษา</Badge>
              {director.subject_group && <div className="text-xs text-muted-foreground">{director.subject_group}</div>}
            </CardContent>
          </Card>

          {deputies.length > 0 && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
                {deputies.map(d => (
                  <Card key={d.id} className="border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/15 to-amber-500/5">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <Avatar className="w-12 h-12 ring-2 ring-orange-500/30">
                        <AvatarImage src={(d as any).avatar_url || undefined} />
                        <AvatarFallback className="text-xs font-bold bg-orange-500/20 text-orange-700">{initials(d)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{fullName(d)}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.position_title || "รองผู้อำนวยการ"}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs: ฝ่ายงาน / กลุ่มสาระ */}
      <Tabs defaultValue="departments">
        <TabsList className="grid grid-cols-2 w-full max-w-md print:hidden">
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            ฝ่ายงาน
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <BookOpen className="w-4 h-4" />
            กลุ่มสาระ
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB: ฝ่ายงาน ==================== */}
        <TabsContent value="departments" className="mt-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 print:grid-cols-2">
            {DEPARTMENTS.map(dept => {
              const members = byDept.map[dept];
              const head = members.find(m => getDeptRole(m, dept) === "head");
              const deputyList = members.filter(m => getDeptRole(m, dept) === "deputy_head");
              const sectionHeads = members.filter(m => getDeptRole(m, dept) === "section_head");
              const others = members.filter(m => m.id !== head?.id && !deputyList.includes(m) && !sectionHeads.includes(m));
              const accent = DEPT_COLORS[dept] || "from-muted to-muted/50 border-border";
              return (
                <Card key={dept} className={`border-2 bg-gradient-to-br ${accent} backdrop-blur shadow-elegant overflow-hidden`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="w-4 h-4" />
                        {dept}
                      </CardTitle>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Users className="w-3 h-3" /> {members.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {head && (
                      <div className="rounded-xl bg-background/80 border-2 border-amber-500/40 p-3 flex items-center gap-3 shadow-sm">
                        <Avatar className="w-12 h-12 ring-2 ring-amber-500/40">
                          <AvatarImage src={(head as any).avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-amber-500/20 text-amber-700">{initials(head)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1"><Crown className="w-3 h-3" /> หัวหน้าฝ่าย</div>
                          <div className="font-semibold text-sm truncate">{fullName(head)}</div>
                          <div className="text-xs text-muted-foreground truncate">{head.position_title || head.position}</div>
                        </div>
                      </div>
                    )}
                    {deputyList.map(dp => (
                      <div key={dp.id} className="rounded-xl bg-background/70 border border-violet-500/30 p-2.5 flex items-center gap-3">
                        <Avatar className="w-10 h-10 ring-2 ring-violet-500/25">
                          <AvatarImage src={(dp as any).avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-violet-500/15 text-violet-700">{initials(dp)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300 font-bold flex items-center gap-1"><Star className="w-3 h-3" /> รองหัวหน้าฝ่าย</div>
                          <div className="font-medium text-sm truncate">{fullName(dp)}</div>
                        </div>
                      </div>
                    ))}
                    {sectionHeads.map(sh => (
                      <div key={sh.id} className="rounded-xl bg-background/60 border border-blue-500/30 p-2.5 flex items-center gap-3">
                        <Avatar className="w-9 h-9 ring-2 ring-blue-500/25">
                          <AvatarImage src={(sh as any).avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-blue-500/15 text-blue-700">{initials(sh)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1"><Bookmark className="w-3 h-3" /> หัวหน้าหมวด</div>
                          <div className="font-medium text-sm truncate">{fullName(sh)}</div>
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">ยังไม่มีบุคลากรในฝ่ายนี้</p>
                    )}
                    {others.map(p => (
                      <PersonCard key={p.id} p={p} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {byDept.other.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> ยังไม่ระบุฝ่ายงาน ({byDept.other.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {byDept.other.map(p => <PersonCard key={p.id} p={p} />)}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== TAB: กลุ่มสาระ ==================== */}
        <TabsContent value="groups" className="mt-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {SUBJECT_GROUPS.map(group => {
              const members = byGroup.map[group];
              const head = members.find(m => getGroupRole(m, group) === "head");
              const others = members.filter(m => m.id !== head?.id);
              const accent = SUBJECT_GROUP_COLORS[group] || "from-muted to-muted/50 border-border";
              return (
                <Card key={group} className={`border-2 bg-gradient-to-br ${accent} backdrop-blur shadow-elegant overflow-hidden`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4" />
                        {group}
                      </CardTitle>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Users className="w-3 h-3" /> {members.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {head && (
                      <div className="rounded-xl bg-background/80 border-2 border-amber-500/40 p-3 flex items-center gap-3 shadow-sm">
                        <Avatar className="w-12 h-12 ring-2 ring-amber-500/40">
                          <AvatarImage src={(head as any).avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-amber-500/20 text-amber-700">{initials(head)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1"><Crown className="w-3 h-3" /> หัวหน้ากลุ่มสาระ</div>
                          <div className="font-semibold text-sm truncate">{fullName(head)}</div>
                          <div className="text-xs text-muted-foreground truncate">{head.position_title || head.position}</div>
                        </div>
                      </div>
                    )}
                    {members.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">ยังไม่มีบุคลากรในกลุ่มสาระนี้</p>
                    )}
                    {others.map(p => (
                      <PersonCard key={p.id} p={p} />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {byGroup.other.length > 0 && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> ยังไม่ระบุกลุ่มสาระ ({byGroup.other.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {byGroup.other.map(p => <PersonCard key={p.id} p={p} />)}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
