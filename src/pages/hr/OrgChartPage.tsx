import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Network, Crown, Search, Printer, Users, Building2 } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { formatDateLongBE } from "@/lib/dateBE";
import { SUBJECT_GROUP_DEFS, toSubjectGroupCode } from "@/lib/subjectGroupMap";

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
  "ฝ่ายงบประมาณและแผน",
  "ฝ่ายบุคคล",
  "ConnextED",
];

// map enum (user_departments.department) → Thai label used in this chart
const DEPT_ENUM_TO_LABEL: Record<string, string> = {
  academic: "ฝ่ายวิชาการ",
  student_affairs: "ฝ่ายกิจการนักเรียน",
  general_admin: "ฝ่ายบริหารทั่วไป",
  budget_planning: "ฝ่ายงบประมาณและแผน",
  personnel: "ฝ่ายบุคคล",
};


const DEPT_COLORS: Record<string, string> = {
  "ฝ่ายวิชาการ": "from-info/20 to-info/10 border-info/30",
  "ฝ่ายกิจการนักเรียน": "from-warning/20 to-warning/10 border-warning/30",
  "ฝ่ายบริหารทั่วไป": "from-info/20 to-danger/10 border-info/30",
  "ฝ่ายงบประมาณและแผน": "from-success/20 to-success/10 border-success/30",
  "ฝ่ายบุคคล": "from-info/20 to-info/10 border-info/30",
  "ConnextED": "from-success/20 to-info/10 border-success/30",
};

// Solid hex colors for the printed report (no Tailwind in print window).
const DEPT_PRINT_COLORS: Record<string, { bar: string; soft: string }> = {
  "ฝ่ายวิชาการ":            { bar: "#2563eb", soft: "#eff6ff" },
  "ฝ่ายกิจการนักเรียน":      { bar: "#f59e0b", soft: "#fffbeb" },
  "ฝ่ายบริหารทั่วไป":         { bar: "#a855f7", soft: "#faf5ff" },
  "ฝ่ายงบประมาณและแผน":   { bar: "#10b981", soft: "#ecfdf5" },
  "ฝ่ายบุคคล":              { bar: "#6366f1", soft: "#eef2ff" },
  "ConnextED":              { bar: "#14b8a6", soft: "#f0fdfa" },
};

const fullName = (p: Person) => `${p.prefix || ""}${p.first_name} ${p.last_name}`.trim();
const initials = (p: Person) => (p.first_name?.[0] || "") + (p.last_name?.[0] || "");

const isDeputy = (p: Person) =>
  /รองผู้อำนวยการ|รอง\s*ผอ/.test(p.position_title || "") ||
  /รองผู้อำนวยการ|รอง\s*ผอ/.test(p.position || "");
const isDirector = (p: Person) => {
  if (isDeputy(p)) return false;
  const t = `${p.position_title || ""} ${p.position || ""}`;
  return /ผู้อำนวยการ|(^|\s)ผอ\.?($|\s)/.test(t);
};
const isHead = (p: Person) => /หัวหน้า/.test(p.position_title || "");

const normalizeDepartments = (raw: string | null): string[] => {
  const s = (raw || "").trim();
  if (!s) return [];
  if (/งบประมาณ.*บุคคล|บุคคล.*งบประมาณ/.test(s)) return ["ฝ่ายงบประมาณและแผน", "ฝ่ายบุคคล"];
  if (/แผนงาน|ประกันคุณภาพ/.test(s)) return ["ฝ่ายงบประมาณและแผน"];
  if (/งบประมาณ/.test(s)) return ["ฝ่ายงบประมาณและแผน"];
  if (/บุคคล/.test(s)) return ["ฝ่ายบุคคล"];
  if (/บริหารทั่วไป|อาคาร|สถานที่|ทั่วไป/.test(s)) return ["ฝ่ายบริหารทั่วไป"];
  if (/วิชาการ/.test(s)) return ["ฝ่ายวิชาการ"];
  if (/กิจการนักเรียน|กิจการนร|ปกครอง/.test(s)) return ["ฝ่ายกิจการนักเรียน"];
  return [s];
};


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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      fullName(p).toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q) ||
      (p.subject_group || "").toLowerCase().includes(q) ||
      (p.position_title || "").toLowerCase().includes(q)
    );
  }, [people, search]);


  // Load explicit dept positions (head/deputy/assistant/member) per user
  const { data: deptAssignments = [] } = useQuery({
    queryKey: ["orgchart_user_departments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_departments")
        .select("user_id, department, position");
      return (data || []) as { user_id: string; department: string; position: string }[];
    },
  });

  // map: deptLabel → { deputies: Person[], assistants: Person[] } using user_departments
  const deptRoles = useMemo(() => {
    const out: Record<string, { deputies: any[]; assistants: any[]; heads: any[] }> = {};
    for (const d of DEPARTMENTS) out[d] = { deputies: [], assistants: [], heads: [] };
    const byUser = new Map(people.filter((p) => p.user_id).map((p) => [p.user_id!, p]));
    for (const a of deptAssignments) {
      const label = DEPT_ENUM_TO_LABEL[a.department];
      if (!label || !out[label]) continue;
      const person = byUser.get(a.user_id);
      if (!person) continue;
      if (a.position === "deputy") out[label].deputies.push(person);
      else if (a.position === "assistant") out[label].assistants.push(person);
      else if (a.position === "head") out[label].heads.push(person);
    }
    return out;
  }, [deptAssignments, people]);


  const director = useMemo(() => people.find(isDirector), [people]);
  const deputies = useMemo(() => people.filter(isDeputy), [people]);

  const byDept = useMemo(() => {
    const map: Record<string, (Person & { avatar_url: string | null })[]> = {};
    for (const d of DEPARTMENTS) map[d] = [];
    const other: (Person & { avatar_url: string | null })[] = [];
    for (const p of filtered) {
      if (isDirector(p) || isDeputy(p)) continue;
      const depts = normalizeDepartments(p.department);
      let placed = false;
      for (const d of depts) {
        if (map[d]) {
          map[d].push(p);
          placed = true;
        }
      }
      if (!placed) other.push(p);
    }
    return { map, other };
  }, [filtered]);

  const handlePrint = () => {
    const esc = (s: string | null | undefined) =>
      String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
      );
    const orgName = schoolName || appName || "โรงเรียน";
    const dateStr = formatDateLongBE(new Date());

    const avatarHtml = (p: Person & { avatar_url: string | null }, size: number) => {
      if (p.avatar_url) {
        return `<img src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px;border-radius:9999px;object-fit:cover;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15);" />`;
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
    ${schoolLogo ? `<img class="logo" src="${esc(schoolLogo)}" />` : ""}
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
    <div className="px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6 print:p-0">
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

      {/* Director + Deputies (tree top) */}
      <div className="org-tree flex flex-col items-center">
        {director && (
          <Card className="w-full max-w-md border-2 border-warning/40 bg-gradient-to-br from-warning/20 via-warning/10 to-transparent shadow-elegant">
            <CardContent className="pt-5 pb-4 flex flex-col items-center gap-2 text-center">
              <Crown className="w-5 h-5 text-warning" />
              <Avatar className="w-20 h-20 ring-4 ring-warning/30">
                <AvatarImage src={(director as any).avatar_url || undefined} />
                <AvatarFallback className="text-lg font-bold bg-warning/20 text-warning">{initials(director)}</AvatarFallback>
              </Avatar>
              <div className="font-bold text-lg">{fullName(director)}</div>
              <Badge className="bg-warning text-white border-0 text-[10px]">ผู้อำนวยการสถานศึกษา</Badge>
            </CardContent>
          </Card>
        )}

        {director && deputies.length > 0 && <div className="w-px h-6 bg-border" />}

        {deputies.length > 0 && (
          <div className="w-full max-w-5xl">
            {deputies.length > 1 && <div className="mx-auto h-px bg-border" style={{ width: `${100 - 100 / deputies.length}%` }} />}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(deputies.length, 4)}, minmax(0,1fr))` }}>
              {deputies.map((d) => (
                <div key={d.id} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-border" />
                  <Card className="w-full border-2 border-warning/30 bg-gradient-to-br from-warning/15 to-warning/5">
                    <CardContent className="pt-3 pb-3 flex items-center gap-3">
                      <Avatar className="w-10 h-10 ring-2 ring-warning/30">
                        <AvatarImage src={(d as any).avatar_url || undefined} />
                        <AvatarFallback className="text-xs font-bold bg-warning/20 text-warning">{initials(d)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-wider text-warning font-bold">รองผู้อำนวยการ</div>
                        <div className="font-semibold text-sm truncate">{fullName(d)}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{d.position_title || ""}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-px h-6 bg-border" />
        <div className="w-full max-w-[95%] h-px bg-border" />
      </div>

      {/* Departments – responsive grid that fits the page */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {DEPARTMENTS.map((dept) => {
          const members = byDept.map[dept];
          const head = members.find(isHead) || deptRoles[dept]?.heads[0];
          const deputies = deptRoles[dept]?.deputies || [];
          const assistants = deptRoles[dept]?.assistants || [];
          const leaderIds = new Set([head?.id, ...deputies.map((d: any) => d.id), ...assistants.map((a: any) => a.id)].filter(Boolean));
          const others = members.filter((m) => !leaderIds.has(m.id));
          const accent = DEPT_COLORS[dept] || "from-muted to-muted/50 border-border";
          return (
            <Card key={dept} className={`border-2 bg-gradient-to-br ${accent} backdrop-blur shadow-elegant flex flex-col`}>
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4" />
                    {dept}
                  </CardTitle>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Users className="w-3 h-3" /> {members.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-3 flex-1">
                {head && (
                  <div className="rounded-lg bg-background/80 border-2 border-primary/30 p-2 flex items-center gap-2 shadow-sm">
                    <Avatar className="w-10 h-10 ring-2 ring-primary/40">
                      <AvatarImage src={(head as any).avatar_url || undefined} />
                      <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">{initials(head)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase tracking-wider text-primary font-bold">หัวหน้าฝ่าย</div>
                      <div className="font-semibold text-xs truncate">{fullName(head)}</div>
                    </div>
                  </div>
                )}
                {deputies.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {deputies.map((d: any) => (
                      <div key={d.id} className="rounded-lg bg-background/70 border border-secondary/40 p-1.5 flex items-center gap-2">
                        <Avatar className="w-8 h-8 ring-1 ring-secondary/40">
                          <AvatarImage src={d.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] font-bold">{initials(d)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase tracking-wider text-secondary-foreground/80 font-bold">รองหัวหน้าฝ่าย</div>
                          <div className="font-semibold text-xs truncate">{fullName(d)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {assistants.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {assistants.map((a: any) => (
                      <div key={a.id} className="rounded-lg bg-background/60 border border-muted-foreground/20 p-1.5 flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={a.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] font-bold">{initials(a)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">ผู้ช่วยฝ่าย</div>
                          <div className="font-semibold text-xs truncate">{fullName(a)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {others.length === 0 && !head && deputies.length === 0 && assistants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีบุคลากร</p>
                )}
                {others.map((p) => <PersonCard key={p.id} p={p} />)}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unassigned */}
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

      {/* Subject Groups */}
      <SubjectGroupSection people={people} />

    </div>
  );
}

// --- Subject group section (กลุ่มสาระการเรียนรู้) -----------------------------

function SubjectGroupSection({ people }: { people: (Person & { avatar_url: string | null })[] }) {
  const { data: sghRows = [] } = useQuery({
    queryKey: ["orgchart_subject_group_heads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_group_heads")
        .select("user_id, subject_group, position");
      return (data || []) as any[];
    },
  });
  const posByGroup = useMemo(() => {
    const m = new Map<string, Map<string, "head" | "deputy" | "secretary">>();
    for (const r of sghRows as any[]) {
      const inner = m.get(r.subject_group) || new Map();
      inner.set(r.user_id, r.position as any);
      m.set(r.subject_group, inner);
    }
    return m;
  }, [sghRows]);
  const groups = useMemo(() => {
    return SUBJECT_GROUP_DEFS.map((def) => {
      const members = people.filter((p) => p.user_id && toSubjectGroupCode(p.subject_group) === def.code);
      const inner = posByGroup.get(def.code) || new Map();
      const pick = (pos: "head" | "deputy" | "secretary") =>
        members.filter((m) => inner.get(m.user_id!) === pos);
      const heads = pick("head"), deputies = pick("deputy"), secretaries = pick("secretary");
      const leaderIds = new Set([...heads, ...deputies, ...secretaries].map((m) => m.id));
      const others = members.filter((m) => !leaderIds.has(m.id));
      return { def, heads, deputies, secretaries, others, total: members.length };
    });
  }, [people, posByGroup]);
  if (groups.every((g) => g.total === 0)) return null;
  const LeaderRow = ({ p, label, accent }: { p: Person & { avatar_url: string | null }; label: string; accent: string }) => (
    <div className={`rounded-lg bg-background/80 border ${accent} p-1.5 flex items-center gap-2`}>
      <Avatar className="w-8 h-8"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback className="text-[10px] font-bold">{initials(p)}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider font-bold opacity-70">{label}</div>
        <div className="font-semibold text-xs truncate">{fullName(p)}</div>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-l-4 border-primary pl-3">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">ผังกลุ่มสาระการเรียนรู้</h2>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {groups.filter((g) => g.total > 0).map(({ def, heads, deputies, secretaries, others, total }) => (
          <Card key={def.code} className="border-2 bg-gradient-to-br from-primary/5 to-transparent backdrop-blur shadow-elegant flex flex-col">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">{def.th}</CardTitle>
                <Badge variant="secondary" className="gap-1 text-[10px]"><Users className="w-3 h-3" /> {total}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-3 flex-1">
              {heads.map((p) => <LeaderRow key={p.id} p={p} label="หัวหน้ากลุ่มสาระ" accent="border-warning/40" />)}
              {deputies.map((p) => <LeaderRow key={p.id} p={p} label="รองหัวหน้ากลุ่มสาระ" accent="border-info/40" />)}
              {secretaries.map((p) => <LeaderRow key={p.id} p={p} label="เลขานุการกลุ่มสาระ" accent="border-secondary/40" />)}
              {others.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-card/60 border">
                  <Avatar className="w-7 h-7"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback className="text-[9px] font-bold">{initials(p)}</AvatarFallback></Avatar>
                  <div className="text-xs truncate">{fullName(p)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
