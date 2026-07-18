import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, ShieldAlert, Save, Users, Ban, Activity, TrendingUp, Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface Row {
  id: string;
  user_id: string;
  url: string;
  domain: string;
  action: string;
  reason: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null } | null;
  classroom_id?: string | null;
  classroom_name?: string | null;
}

interface StudentOpt { auth_user_id: string; name: string; classroom_id: string | null; classroom_name: string | null; }

const CATEGORY_RULES: { name: string; match: RegExp }[] = [
  { name: "การศึกษา", match: /(edu|school|wiki|learn|course|khan|coursera|scholar|obec|deep|dltv|dlit)/i },
  { name: "วิดีโอ/สตรีมมิ่ง", match: /(youtube|youtu\.be|tiktok|twitch|netflix|primevideo|vimeo|bilibili)/i },
  { name: "โซเชียล", match: /(facebook|instagram|twitter|x\.com|threads|line|discord|snapchat|reddit)/i },
  { name: "เกม", match: /(roblox|minecraft|steam|epicgames|itch|game|garena|riot)/i },
  { name: "ค้นหา/ทั่วไป", match: /(google|bing|duckduckgo|yahoo|baidu)/i },
  { name: "ข่าว", match: /(news|thairath|matichon|sanook|kapook|bbc|cnn|nation)/i },
  { name: "ช้อปปิ้ง", match: /(shopee|lazada|amazon|ebay|aliexpress|jd\.co)/i },
  { name: "AI/เครื่องมือ", match: /(chatgpt|openai|claude|anthropic|gemini|copilot|perplexity)/i },
];
function categorize(domain: string) {
  for (const r of CATEGORY_RULES) if (r.match.test(domain)) return r.name;
  return "อื่นๆ";
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 200 90% 55%))", "hsl(var(--chart-3, 30 90% 55%))", "hsl(var(--chart-4, 280 70% 60%))", "hsl(var(--chart-5, 140 60% 45%))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--accent-foreground))", "hsl(var(--secondary-foreground))"];

export default function BrowserLogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [days, setDays] = useState<string>("7");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const cms = useCmsValues(["browser_blocklist", "browser_ad_domains", "browser_block_message", "browser_default_homepage"]);
  const [blockList, setBlockList] = useState("");
  const [adList, setAdList] = useState("");
  const [msg, setMsg] = useState("");
  const [home, setHome] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setBlockList(cms.browser_blocklist); setAdList(cms.browser_ad_domains); setMsg(cms.browser_block_message); setHome(cms.browser_default_homepage); }, [cms.browser_blocklist, cms.browser_ad_domains, cms.browser_block_message, cms.browser_default_homepage]);

  async function loadStudents() {
    const { data } = await supabase
      .from("students")
      .select("auth_user_id, prefix, first_name, last_name, classroom_id, classrooms!students_classroom_id_fkey(id, name)")
      .not("auth_user_id", "is", null);
    const opts: StudentOpt[] = (data || []).map((s: any) => ({
      auth_user_id: s.auth_user_id,
      name: `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
      classroom_id: s.classroom_id ?? null,
      classroom_name: s.classrooms?.name ?? null,
    }));
    setStudents(opts);
  }

  async function load() {
    setLoading(true);
    const since = subDays(new Date(), parseInt(days) || 7).toISOString();
    const { data } = await supabase
      .from("browser_logs")
      .select("id, user_id, url, domain, action, reason, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    const list = (data || []) as any as Row[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const [{ data: profs }, { data: stu }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", ids),
        supabase.from("students").select("auth_user_id, classroom_id, classrooms!students_classroom_id_fkey(name)").in("auth_user_id", ids),
      ]);
      const pmap = new Map<string, any>();
      (profs || []).forEach((p: any) => pmap.set(p.id, p));
      const smap = new Map<string, any>();
      (stu || []).forEach((s: any) => smap.set(s.auth_user_id, s));
      list.forEach((r) => {
        r.profile = pmap.get(r.user_id) || null;
        const st = smap.get(r.user_id);
        r.classroom_id = st?.classroom_id ?? null;
        r.classroom_name = st?.classrooms?.name ?? null;
      });
    }
    setRows(list);
    setLoading(false);
  }
  useEffect(() => { loadStudents(); }, []);
  useEffect(() => { load(); }, [days]);

  async function saveSettings() {
    setSaving(true);
    const entries = [
      { key: "browser_blocklist", value: blockList },
      { key: "browser_ad_domains", value: adList },
      { key: "browser_block_message", value: msg },
      { key: "browser_default_homepage", value: home },
    ];
    const { error } = await supabase.from("cms_settings").upsert(entries as any, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("บันทึกไม่สำเร็จ: " + error.message);
    else toast.success("บันทึกการตั้งค่าเรียบร้อย");
  }

  const classrooms = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => { if (s.classroom_id && s.classroom_name) m.set(s.classroom_id, s.classroom_name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [students]);

  const studentsInClass = useMemo(() => {
    return students.filter((s) => classFilter === "all" || s.classroom_id === classFilter).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [students, classFilter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (classFilter !== "all" && r.classroom_id !== classFilter) return false;
      if (studentFilter !== "all" && r.user_id !== studentFilter) return false;
      if (s && !(r.url.toLowerCase().includes(s) || r.domain.toLowerCase().includes(s) || `${r.profile?.first_name ?? ""} ${r.profile?.last_name ?? ""}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, q, classFilter, studentFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const blocked = filtered.filter((r) => r.action !== "visit").length;
    const users = new Set(filtered.map((r) => r.user_id)).size;
    const domains = new Set(filtered.map((r) => r.domain)).size;
    return { total, blocked, users, domains };
  }, [filtered]);

  const timeSeries = useMemo(() => {
    const buckets = new Map<string, { date: string; visits: number; blocked: number }>();
    const d = parseInt(days) || 7;
    for (let i = d - 1; i >= 0; i--) {
      const day = format(startOfDay(subDays(new Date(), i)), "MM-dd");
      buckets.set(day, { date: day, visits: 0, blocked: 0 });
    }
    filtered.forEach((r) => {
      const key = format(new Date(r.created_at), "MM-dd");
      const b = buckets.get(key);
      if (!b) return;
      if (r.action === "visit") b.visits++;
      else b.blocked++;
    });
    return Array.from(buckets.values());
  }, [filtered, days]);

  const topDomains = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.domain, (m.get(r.domain) || 0) + 1));
    return Array.from(m.entries()).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filtered]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => { const c = categorize(r.domain); m.set(c, (m.get(c) || 0) + 1); });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const topUsers = useMemo(() => {
    const m = new Map<string, { name: string; count: number; blocked: number }>();
    filtered.forEach((r) => {
      const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || r.user_id.slice(0, 8);
      const cur = m.get(r.user_id) || { name, count: 0, blocked: 0 };
      cur.count++;
      if (r.action !== "visit") cur.blocked++;
      m.set(r.user_id, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filtered]);

  function exportCsv() {
    const header = ["timestamp_iso", "user_id", "user_name", "classroom", "action", "domain", "url", "reason"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ");
      lines.push([
        new Date(r.created_at).toISOString(),
        r.user_id,
        name,
        r.classroom_name ?? "",
        r.action,
        r.domain,
        r.url,
        r.reason ?? "",
      ].map(esc).join(","));
    });
    // BOM สำหรับ Excel อ่านภาษาไทยได้ถูกต้อง
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `browser-logs-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`ส่งออก ${filtered.length.toLocaleString("th-TH")} รายการเรียบร้อย`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-primary" /> แดชบอร์ดการใช้เบราว์เซอร์ในระบบ</h1>
            <p className="text-sm text-muted-foreground mt-1">ติดตามการเข้าเว็บ, การบล็อก, และหมวดหมู่ที่นักเรียนใช้งานมากที่สุด</p>
          </div>
          <Button onClick={exportCsv} variant="outline" className="gap-2"><Download className="w-4 h-4" /> ส่งออก CSV</Button>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <ScrollText className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>พรบ.คอมพิวเตอร์ ม.26:</b> ระบบเก็บ log การใช้เบราว์เซอร์ (URL / โดเมน / เวลา / ผู้ใช้ / User-Agent)
            อัตโนมัติเป็นเวลา <b>90 วัน</b> แล้วลบทิ้ง (cron 03:15 น. รายวัน) — ใช้เป็นหลักฐานส่ง จนท. กระทรวง DE เมื่อได้รับคำสั่งเป็นลายลักษณ์อักษรเท่านั้น
          </div>
        </div>
      </div>


      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ช่วงเวลา</label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">วันนี้</SelectItem>
                <SelectItem value="7">7 วัน</SelectItem>
                <SelectItem value="14">14 วัน</SelectItem>
                <SelectItem value="30">30 วัน</SelectItem>
                <SelectItem value="90">90 วัน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ชั้นเรียน</label>
            <Select value={classFilter} onValueChange={(v) => { setClassFilter(v); setStudentFilter("all"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกชั้น</SelectItem>
                {classrooms.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">นักเรียน</label>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">ทุกคน</SelectItem>
                {studentsInClass.map((s) => <SelectItem key={s.auth_user_id} value={s.auth_user_id}>{s.name}{s.classroom_name ? ` · ${s.classroom_name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ค้นหา</label>
            <Input placeholder="URL / โดเมน / ชื่อ" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Activity className="w-5 h-5" />} label="การเข้าชมทั้งหมด" value={stats.total.toLocaleString("th-TH")} tone="primary" />
        <StatCard icon={<Ban className="w-5 h-5" />} label="ถูกบล็อก" value={stats.blocked.toLocaleString("th-TH")} tone="destructive" />
        <StatCard icon={<Users className="w-5 h-5" />} label="ผู้ใช้ที่ active" value={stats.users.toLocaleString("th-TH")} tone="accent" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="โดเมนที่ไม่ซ้ำ" value={stats.domains.toLocaleString("th-TH")} tone="secondary" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">แนวโน้มการใช้งาน</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="visits" name="เข้าชม" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="blocked" name="บล็อก" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">หมวดหมู่เว็บที่ใช้มากที่สุด</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categories} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">10 โดเมนยอดนิยม</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer>
              <BarChart data={topDomains} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="domain" fontSize={12} width={160} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">ผู้ใช้ที่ใช้งานมากที่สุด</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {topUsers.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>}
              {topUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{i + 1}</div>
                    <span className="text-sm font-medium">{u.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{u.count} ครั้ง</Badge>
                    {u.blocked > 0 && <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" />{u.blocked}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table + Settings */}
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">ประวัติล่าสุด</TabsTrigger>
          <TabsTrigger value="settings">ตั้งค่าการบล็อก</TabsTrigger>
        </TabsList>
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                รายการ <Badge variant="secondary">{filtered.length}</Badge>
                {stats.blocked > 0 && <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> บล็อก {stats.blocked}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">กำลังโหลด…</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p> : (
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เวลา</TableHead>
                        <TableHead>ผู้ใช้</TableHead>
                        <TableHead>ชั้น</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>โดเมน</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>เหตุผล</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 300).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("th-TH")}</TableCell>
                          <TableCell className="text-sm">{[r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || r.user_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.classroom_name ?? "-"}</TableCell>
                          <TableCell>{r.action === "visit" ? <Badge variant="secondary">เข้าชม</Badge> : r.action === "ad_blocked" ? <Badge className="bg-amber-500">บล็อกโฆษณา</Badge> : <Badge variant="destructive">บล็อก</Badge>}</TableCell>
                          <TableCell className="text-xs">{r.domain}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={r.url}>{r.url}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.reason ?? ""}>{r.reason ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-base">ตั้งค่ารายการบล็อก (CMS)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">โดเมนที่บล็อก (บรรทัดละ 1)</label>
                <Textarea rows={8} value={blockList} onChange={(e) => setBlockList(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">โดเมนโฆษณา/แทร็กเกอร์ (บรรทัดละ 1)</label>
                <Textarea rows={8} value={adList} onChange={(e) => setAdList(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ข้อความหน้าเตือน</label>
                <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">หน้าแรกเริ่มต้น</label>
                <Input value={home} onChange={(e) => setHome(e.target.value)} placeholder="https://…" />
              </div>
              <div className="md:col-span-2">
                <Button onClick={saveSettings} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> บันทึกการตั้งค่า</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "destructive" | "accent" | "secondary" }) {
  const toneMap = {
    primary: "from-primary/15 to-primary/5 text-primary",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
    accent: "from-accent/40 to-accent/10 text-accent-foreground",
    secondary: "from-secondary to-secondary/40 text-secondary-foreground",
  } as const;
  return (
    <Card className="overflow-hidden">
      <CardContent className={`p-4 bg-gradient-to-br ${toneMap[tone]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-80">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-background/60 flex items-center justify-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
