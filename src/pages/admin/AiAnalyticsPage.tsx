import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, MessageSquare, TrendingUp, Users, Loader2, Eye,
  GraduationCap, Briefcase, ArrowUpCircle, ArrowDownCircle, Hash,
} from "lucide-react";
import { toast } from "sonner";

type LogRow = {
  id: string;
  user_id: string | null;
  role: "user" | "assistant";
  content: string;
  topic: string | null;
  sentiment: string | null;
  risk_level: string | null;
  risk_flags: string[] | null;
  user_role: string | null;
  created_at: string;
};

type Profile = { id: string; first_name: string | null; last_name: string | null; nickname: string | null };
type StudentInfo = { auth_user_id: string; student_code: string; first_name: string; last_name: string; classroom_id: string | null };
type PersonnelInfo = { user_id: string; employee_code: string; first_name: string; last_name: string; position: string | null; department: string | null };
type Classroom = { id: string; name: string; grade_level: string };

const riskColor: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-warning text-white",
  low: "bg-warning text-white",
  none: "bg-muted text-muted-foreground",
};

const topicLabel: Record<string, string> = {
  academic: "การเรียน",
  homework: "การบ้าน",
  health: "สุขภาพ",
  social: "สังคม/เพื่อน",
  personal: "ส่วนตัว",
  system: "การใช้ระบบ",
  news: "ข่าวสาร",
  other: "อื่นๆ",
};

const topicColor: Record<string, string> = {
  academic: "bg-info/10 text-info border-info/30",
  homework: "bg-info/10 text-info border-info/30",
  health: "bg-danger/10 text-danger border-danger/30",
  social: "bg-danger/10 text-danger border-danger/30",
  personal: "bg-info/10 text-info border-info/30",
  system: "bg-neutral/10 text-neutral border-neutral/30",
  news: "bg-warning/10 text-warning border-warning/30",
  other: "bg-neutral/10 text-neutral border-neutral/30",
};

type UserBucket = "student" | "staff";

export default function AiAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [students, setStudents] = useState<Record<string, StudentInfo>>({});
  const [personnel, setPersonnel] = useState<Record<string, PersonnelInfo>>({});
  const [classrooms, setClassrooms] = useState<Record<string, Classroom>>({});
  const [allClassrooms, setAllClassrooms] = useState<Classroom[]>([]);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<UserBucket>("student");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classroomFilter, setClassroomFilter] = useState<string>("all");
  const [openUid, setOpenUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("classrooms").select("id,name,grade_level").then(({ data }) => {
      setAllClassrooms((data || []) as Classroom[]);
    });
  }, []);


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_chat_logs" as any)
      .select("id,user_id,role,content,topic,sentiment,risk_level,risk_flags,user_role,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("โหลดข้อมูลไม่สำเร็จ: " + error.message);
      setLoading(false);
      return;
    }
    const rows = (data || []) as any as LogRow[];
    setLogs(rows);

    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
    if (ids.length) {
      const [profsRes, stuRes, perRes] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,nickname").in("id", ids),
        supabase.from("students").select("auth_user_id,student_code,first_name,last_name,classroom_id").in("auth_user_id", ids),
        supabase.from("personnel").select("user_id,employee_code,first_name,last_name,position,department").in("user_id", ids),
      ]);
      const pMap: Record<string, Profile> = {};
      (profsRes.data || []).forEach((p: any) => { pMap[p.id] = p; });
      setProfiles(pMap);

      const sMap: Record<string, StudentInfo> = {};
      (stuRes.data || []).forEach((s: any) => { if (s.auth_user_id) sMap[s.auth_user_id] = s; });
      setStudents(sMap);

      const perMap: Record<string, PersonnelInfo> = {};
      (perRes.data || []).forEach((p: any) => { if (p.user_id) perMap[p.user_id] = p; });
      setPersonnel(perMap);

      const cIds = Array.from(new Set((stuRes.data || []).map((s: any) => s.classroom_id).filter(Boolean)));
      if (cIds.length) {
        const { data: cls } = await supabase.from("classrooms").select("id,name,grade_level").in("id", cIds as string[]);
        const cMap: Record<string, Classroom> = {};
        (cls || []).forEach((c: any) => { cMap[c.id] = c; });
        setClassrooms(cMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ai-chat-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_chat_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const getBucket = (uid: string): UserBucket | "other" => {
    if (students[uid]) return "student";
    if (personnel[uid]) return "staff";
    return "other";
  };

  const stats = useMemo(() => {
    const userMsgs = logs.filter((l) => l.role === "user");
    const byUser: Record<string, { count: number; risky: number; negative: number; topics: Record<string, number>; lastAt: string }> = {};
    let highRisk = 0;
    const topicCounts: Record<string, number> = {};
    const topicQuestions: Record<string, string[]> = {};
    userMsgs.forEach((m) => {
      const uid = m.user_id || "anon";
      byUser[uid] = byUser[uid] || { count: 0, risky: 0, negative: 0, topics: {}, lastAt: m.created_at };
      byUser[uid].count++;
      if (m.risk_level === "high" || m.risk_level === "medium") byUser[uid].risky++;
      if (m.sentiment === "negative") byUser[uid].negative++;
      if (m.topic) byUser[uid].topics[m.topic] = (byUser[uid].topics[m.topic] || 0) + 1;
      if (m.risk_level === "high") highRisk++;
      const t = m.topic || "other";
      topicCounts[t] = (topicCounts[t] || 0) + 1;
      topicQuestions[t] = topicQuestions[t] || [];
      if (topicQuestions[t].length < 5) topicQuestions[t].push(m.content);
    });
    return { byUser, highRisk, totalMsgs: userMsgs.length, uniqueUsers: Object.keys(byUser).length, topicCounts, topicQuestions };
  }, [logs]);

  const allUserRows = useMemo(() => {
    return Object.entries(stats.byUser).map(([uid, s]) => {
      const stu = students[uid];
      const per = personnel[uid];
      const p = profiles[uid];
      const b: UserBucket | "other" = stu ? "student" : per ? "staff" : "other";
      let name = "ไม่ระบุ";
      let code = "";
      let gradeLevel = "";
      let classroomId: string | null = null;
      let classroomName = "";
      let extra = "";
      if (stu) {
        name = `${stu.first_name} ${stu.last_name}`.trim();
        code = stu.student_code;
        classroomId = stu.classroom_id;
        if (classroomId && classrooms[classroomId]) {
          classroomName = classrooms[classroomId].name;
          gradeLevel = classrooms[classroomId].grade_level;
        }
      } else if (per) {
        name = `${per.first_name} ${per.last_name}`.trim();
        code = per.employee_code;
        extra = per.position || per.department || "";
      } else if (p) {
        name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.nickname || uid.slice(0, 8);
      } else {
        name = uid.slice(0, 8);
      }
      const topTopic = Object.entries(s.topics).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { uid, bucket: b, name, code, gradeLevel, classroomId, classroomName, extra, topTopic, ...s };
    });
  }, [stats, profiles, students, personnel, classrooms]);

  const gradesAvailable = useMemo(() => {
    const set = new Set<string>();
    allClassrooms.forEach((c) => { if (c.grade_level) set.add(c.grade_level); });
    allUserRows.forEach((r) => { if (r.bucket === "student" && r.gradeLevel) set.add(r.gradeLevel); });
    return Array.from(set).sort();
  }, [allUserRows, allClassrooms]);

  const classroomsAvailable = useMemo(() => {
    return allClassrooms
      .filter((c) => gradeFilter === "all" || c.grade_level === gradeFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allClassrooms, gradeFilter]);


  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allUserRows
      .filter((r) => r.bucket === bucket)
      .filter((r) => bucket !== "student" || gradeFilter === "all" || r.gradeLevel === gradeFilter)
      .filter((r) => bucket !== "student" || classroomFilter === "all" || r.classroomId === classroomFilter)
      .filter((r) => !term || r.name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term))
      .sort((a, b) => b.risky - a.risky || b.count - a.count);
  }, [allUserRows, bucket, gradeFilter, classroomFilter, q]);

  const usageRanking = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => b.count - a.count);
    return { top: sorted.slice(0, 5), bottom: sorted.slice(-5).reverse() };
  }, [filteredRows]);

  const riskyLogs = logs.filter((l) => l.role === "user" && (l.risk_level === "high" || l.risk_level === "medium"));

  const displayName = (uid: string) => {
    const stu = students[uid];
    if (stu) return `${stu.first_name} ${stu.last_name} (${stu.student_code})`;
    const per = personnel[uid];
    if (per) return `${per.first_name} ${per.last_name} (${per.employee_code})`;
    const p = profiles[uid];
    if (p) return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.nickname || uid.slice(0, 8);
    return uid.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">วิเคราะห์การใช้งาน AI</h1>
        <p className="text-muted-foreground text-sm">ตรวจสอบประวัติการสนทนา หัวข้อคำถาม และความเสี่ยงในการใช้ AI</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><MessageSquare className="w-5 h-5 text-primary" /></div>
          <div><div className="text-2xl font-bold">{stats.totalMsgs}</div><div className="text-xs text-muted-foreground">ข้อความรวม</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><Users className="w-5 h-5 text-info" /></div>
          <div><div className="text-2xl font-bold">{stats.uniqueUsers}</div><div className="text-xs text-muted-foreground">ผู้ใช้ที่คุย AI</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><div className="text-2xl font-bold">{stats.highRisk}</div><div className="text-xs text-muted-foreground">ความเสี่ยงสูง</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><TrendingUp className="w-5 h-5 text-success" /></div>
          <div>
            <div className="text-lg font-bold">
              {Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
                ? topicLabel[Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1])[0][0]] || "—"
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">หัวข้อยอดนิยม</div>
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">ผู้ใช้</TabsTrigger>
          <TabsTrigger value="topics">หัวข้อคำถาม</TabsTrigger>
          <TabsTrigger value="ranking">มาก/น้อยที่สุด</TabsTrigger>
          <TabsTrigger value="risk">เฝ้าระวัง ({riskyLogs.length})</TabsTrigger>
          <TabsTrigger value="recent">ล่าสุด</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={bucket} onValueChange={(v) => { setBucket(v as UserBucket); setGradeFilter("all"); setClassroomFilter("all"); }}>
              <TabsList>
                <TabsTrigger value="student"><GraduationCap className="w-4 h-4 mr-1" />นักเรียน</TabsTrigger>
                <TabsTrigger value="staff"><Briefcase className="w-4 h-4 mr-1" />ครู/บุคลากร</TabsTrigger>
              </TabsList>
            </Tabs>

            {bucket === "student" && (
              <>
                <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassroomFilter("all"); }}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                    {gradesAvailable.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="ห้องเรียน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกห้อง</SelectItem>
                    {classroomsAvailable.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}

            <Input
              placeholder={bucket === "student" ? "ค้นหารหัสนักเรียน/ชื่อ..." : "ค้นหารหัสบุคลากร/ชื่อ..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left p-3">รหัส</th>
                    <th className="text-left p-3">ชื่อ</th>
                    {bucket === "student"
                      ? <th className="text-left p-3">ชั้น/ห้อง</th>
                      : <th className="text-left p-3">ตำแหน่ง</th>}
                    <th className="text-right p-3">ข้อความ</th>
                    <th className="text-right p-3">เสี่ยง</th>
                    <th className="text-right p-3">เชิงลบ</th>
                    <th className="text-left p-3">หัวข้อหลัก</th>
                    <th className="text-left p-3">ใช้ล่าสุด</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={9} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
                  {!loading && filteredRows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">ไม่พบข้อมูล</td></tr>}
                  {filteredRows.map((r) => (
                    <tr key={r.uid} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setOpenUid(r.uid)}>
                      <td className="p-3 font-mono text-xs">{r.code || "—"}</td>
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3 text-xs">
                        {bucket === "student"
                          ? (r.classroomName || r.gradeLevel || "—")
                          : (r.extra || "—")}
                      </td>
                      <td className="p-3 text-right">{r.count}</td>
                      <td className="p-3 text-right">
                        {r.risky > 0 ? <Badge className="bg-destructive text-destructive-foreground">{r.risky}</Badge> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="p-3 text-right">{r.negative}</td>
                      <td className="p-3">
                        {r.topTopic ? (
                          <Badge variant="outline" className={topicColor[r.topTopic] || ""}>{topicLabel[r.topTopic] || r.topTopic}</Badge>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(r.lastAt).toLocaleString("th-TH")}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpenUid(r.uid); }}>
                          <Eye className="w-4 h-4 mr-1" />ดูแชท
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topics" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
              <Card key={t}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={topicColor[t] || ""}>{topicLabel[t] || t}</Badge>
                    <span className="text-2xl font-bold">{c}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((c / Math.max(1, stats.totalMsgs)) * 100).toFixed(1)}% ของทั้งหมด
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {Object.entries(stats.topicQuestions).sort((a, b) => (stats.topicCounts[b[0]] || 0) - (stats.topicCounts[a[0]] || 0)).map(([t, qs]) => (
            <Card key={t}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  <Badge variant="outline" className={topicColor[t] || ""}>{topicLabel[t] || t}</Badge>
                  <span className="text-sm text-muted-foreground font-normal">ตัวอย่างคำถาม</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {qs.map((q, i) => (
                  <p key={i} className="text-sm border-l-2 border-muted pl-3 py-1 line-clamp-2">{q}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ranking" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            จัดอันดับจากกลุ่ม: <strong>{bucket === "student" ? "นักเรียน" : "ครู/บุคลากร"}</strong>
            {bucket === "student" && gradeFilter !== "all" && ` · ${gradeFilter}`}
            {bucket === "student" && classroomFilter !== "all" && classrooms[classroomFilter] && ` · ${classrooms[classroomFilter].name}`}
            {" — ปรับได้ที่แท็บ \"ผู้ใช้\""}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-success" />ใช้มากที่สุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {usageRanking.top.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>}
                {usageRanking.top.map((r, i) => (
                  <div key={r.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer" onClick={() => setOpenUid(r.uid)}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.code}{r.classroomName && ` · ${r.classroomName}`}</div>
                      </div>
                    </div>
                    <Badge>{r.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-info" />ใช้น้อยที่สุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {usageRanking.bottom.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>}
                {usageRanking.bottom.map((r, i) => (
                  <div key={r.uid} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer" onClick={() => setOpenUid(r.uid)}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.code}{r.classroomName && ` · ${r.classroomName}`}</div>
                      </div>
                    </div>
                    <Badge variant="outline">{r.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-2">
          {riskyLogs.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">ไม่มีข้อความความเสี่ยง 🎉</CardContent></Card>}
          {riskyLogs.map((l) => (
            <Card key={l.id} className="border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{l.user_id ? displayName(l.user_id) : "ไม่ระบุ"}</CardTitle>
                  <div className="flex gap-2">
                    <Badge className={riskColor[l.risk_level || "none"]}>{l.risk_level}</Badge>
                    {(l.risk_flags || []).map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{l.content}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(l.created_at).toLocaleString("th-TH")}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recent" className="space-y-2">
          {logs.slice(0, 80).map((l) => (
            <div key={l.id} className="border rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 flex-wrap gap-1">
                <span>
                  {l.user_id ? displayName(l.user_id) : "ไม่ระบุ"} · {l.role === "user" ? "ผู้ใช้" : "AI"}
                  {l.topic ? ` · ${topicLabel[l.topic] || l.topic}` : ""}
                </span>
                <span>{new Date(l.created_at).toLocaleString("th-TH")}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{l.content}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!openUid} onOpenChange={(o) => !o && setOpenUid(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>บทสนทนาของ: {openUid && displayName(openUid)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {openUid && logs
              .filter((l) => l.user_id === openUid)
              .slice()
              .reverse()
              .map((l) => {
                const isRisky = l.role === "user" && (l.risk_level === "high" || l.risk_level === "medium");
                return (
                  <div
                    key={l.id}
                    className={`rounded-lg p-3 text-sm ${
                      l.role === "user"
                        ? isRisky
                          ? "bg-destructive/10 border-l-4 border-destructive"
                          : "bg-primary/5 border-l-4 border-primary"
                        : "bg-muted/50 border-l-4 border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 flex-wrap gap-1">
                      <span>
                        {l.role === "user" ? "👤 ผู้ใช้" : "🤖 AI"}
                        {l.topic ? ` · ${topicLabel[l.topic] || l.topic}` : ""}
                        {l.sentiment ? ` · ${l.sentiment}` : ""}
                      </span>
                      <span>{new Date(l.created_at).toLocaleString("th-TH")}</span>
                    </div>
                    {isRisky && (
                      <div className="flex gap-1 mb-2 flex-wrap">
                        <Badge className={riskColor[l.risk_level || "none"]}>{l.risk_level}</Badge>
                        {(l.risk_flags || []).map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{l.content}</p>
                  </div>
                );
              })}
            {openUid && logs.filter((l) => l.user_id === openUid).length === 0 && (
              <p className="text-center text-muted-foreground p-6">ไม่มีบทสนทนา</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
