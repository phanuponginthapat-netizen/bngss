import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useStudentData } from "@/hooks/useStudentData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trophy, Trash2, ArrowLeft, Users, Calendar, Loader2, Medal, Pencil, ExternalLink, Shuffle, Award, Printer, FileText, MapPin, RefreshCw, FileDown, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { formatDateBE } from "@/lib/dateBE";
import { formatFullNamePlain } from "@/lib/nameFormat";
import { ActivityFormDialog } from "./ActivitiesPage";
import { logAudit } from "@/lib/auditLog";
import { exportSportsDayReportPdf } from "@/lib/exporters/sportsDayReportPdf";
import html2canvas from "html2canvas";
import { DateInput } from "@/components/ui/date-input";

type Meet = any;
type House = { id: string; meet_id: string; name: string; color: string; emblem_url: string | null; sort_order: number; motto?: string | null; tent_location?: string | null };
type Member = { id: string; house_id: string; student_id: string; student?: any };
type Activity = any;
type Participant = { id: string; student_id: string; sports_day_house_id: string | null };
type ScoreRow = { participant_id: string; score: number | null };
type Bonus = { id: string; house_id: string; category: string; description: string | null; points: number; awarded_at: string };

export default function SportsDayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return id ? <MeetDetail id={id} navigate={navigate} /> : <MeetList navigate={navigate} />;
}

// ─────────────── List ───────────────
function MeetList({ navigate }: any) {
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const canManage = isAdmin || isDirector || isTeacher;
  const [meets, setMeets] = useState<Meet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("sports_day_meets").select("*").order("start_date", { ascending: false });
    if (error) toast.error(error.message);
    setMeets(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = (supabase as any).channel("sports-day-meets")
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_day_meets" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl gradient-primary"><Trophy className="h-6 w-6 text-white" /></div>
              <div>
                <CardTitle className="text-2xl">กีฬาสี (Sports Day)</CardTitle>
                <CardDescription>จัดการงานกีฬาสี คณะสี รายการแข่งขัน คะแนนพิเศษ และตารางคะแนนรวม</CardDescription>
              </div>
            </div>
            {canManage && (
              <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> สร้างงานกีฬาสี</Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <MeetFormDialog open={open} onOpenChange={setOpen} onSaved={load} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : meets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">ยังไม่มีงานกีฬาสี — กด "สร้างงานกีฬาสี" เพื่อเริ่ม</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meets.map((m) => (
            <Card key={m.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/dashboard/sports-day/${m.id}`)}>
              {m.cover_image_url && <img src={m.cover_image_url} alt={m.title} className="w-full h-32 object-cover rounded-t-lg" />}
              <CardHeader>
                <CardTitle className="text-lg">{m.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                  {m.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateBE(m.start_date)}{m.end_date && m.end_date !== m.start_date ? ` — ${formatDateBE(m.end_date)}` : ""}</span>}
                  {m.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{m.venue}</span>}
                  <Badge variant="secondary">{m.status}</Badge>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────── Detail ───────────────
function MeetDetail({ id, navigate }: any) {
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const canManage = isAdmin || isDirector || isTeacher;
  const [meet, setMeet] = useState<Meet | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreRow[]>>({});
  const [participantsByActivity, setParticipantsByActivity] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [houseDlg, setHouseDlg] = useState<House | null>(null);
  const [addHouseOpen, setAddHouseOpen] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [bonusDlg, setBonusDlg] = useState<Bonus | null>(null);
  const [addBonusOpen, setAddBonusOpen] = useState(false);
  const [resultDlgActivity, setResultDlgActivity] = useState<Activity | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const load = async () => {
    setLoading(true);
    const [mRes, hRes, mbRes, aRes, bRes] = await Promise.all([
      (supabase as any).from("sports_day_meets").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("sports_day_houses").select("*").eq("meet_id", id).order("sort_order"),
      (supabase as any).from("sports_day_house_members").select("*, student:students!sports_day_house_members_student_id_fkey(id, prefix, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(name))").eq("meet_id", id),
      (supabase as any).from("activities").select("*").eq("sports_day_meet_id", id).order("start_at"),
      (supabase as any).from("sports_day_bonus_points").select("*").eq("meet_id", id).order("awarded_at", { ascending: false }),
    ]);
    if (mRes.error) toast.error(mRes.error.message);
    setMeet(mRes.data);
    setHouses(hRes.data || []);
    setMembers(mbRes.data || []);
    setBonuses(bRes.data || []);
    const acts = aRes.data || [];
    setActivities(acts);

    if (acts.length > 0) {
      const ids = acts.map((a: any) => a.id);
      const [pRes, sRes] = await Promise.all([
        (supabase as any).from("activity_participants").select("id, activity_id, student_id, sports_day_house_id").in("activity_id", ids),
        (supabase as any).from("activity_scores").select("participant_id, score, activity_id").in("activity_id", ids),
      ]);
      const pMap: Record<string, Participant[]> = {};
      (pRes.data || []).forEach((p: any) => { (pMap[p.activity_id] ||= []).push(p); });
      setParticipantsByActivity(pMap);
      const sMap: Record<string, ScoreRow[]> = {};
      (sRes.data || []).forEach((s: any) => { (sMap[s.activity_id] ||= []).push(s); });
      setScores(sMap);
    } else {
      setParticipantsByActivity({}); setScores({});
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const ch = (supabase as any).channel(`sports-day-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_day_meets", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_day_houses", filter: `meet_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_day_house_members", filter: `meet_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `sports_day_meet_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sports_day_bonus_points", filter: `meet_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_scores" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_participants" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const leaderboard = useMemo(() => {
    if (!meet) return [];
    const houseStats: Record<string, { house: House; gold: number; silver: number; bronze: number; participation: number; medalPoints: number; bonusPoints: number; points: number; reasoning: string }> = {};
    houses.forEach((h) => { houseStats[h.id] = { house: h, gold: 0, silver: 0, bronze: 0, participation: 0, medalPoints: 0, bonusPoints: 0, points: 0, reasoning: "" }; });
    activities.forEach((a) => {
      if (!a.results_published) return;
      const parts = participantsByActivity[a.id] || [];
      const ss = scores[a.id] || [];
      const mode = a.scoring_mode || "points";
      const rows = parts.map((p) => ({ p, score: ss.find((s) => s.participant_id === p.id)?.score ?? null }))
        .filter((r) => r.score != null);
      rows.sort((x, y) => mode === "time" ? (x.score! - y.score!) : (y.score! - x.score!));
      rows.forEach((r, idx) => {
        const hid = r.p.sports_day_house_id;
        if (!hid || !houseStats[hid]) return;
        houseStats[hid].participation += 1;
        if (idx === 0) { houseStats[hid].gold += 1; houseStats[hid].medalPoints += Number(meet.gold_points) || 0; }
        else if (idx === 1) { houseStats[hid].silver += 1; houseStats[hid].medalPoints += Number(meet.silver_points) || 0; }
        else if (idx === 2) { houseStats[hid].bronze += 1; houseStats[hid].medalPoints += Number(meet.bronze_points) || 0; }
      });
    });
    bonuses.forEach((b) => {
      if (houseStats[b.house_id]) houseStats[b.house_id].bonusPoints += Number(b.points) || 0;
    });
    Object.values(houseStats).forEach((s) => {
      s.points = s.medalPoints + s.bonusPoints;
      const parts: string[] = [];
      const gp = Number(meet.gold_points) || 0, sp = Number(meet.silver_points) || 0, bp = Number(meet.bronze_points) || 0;
      if (s.gold) parts.push(`🥇${s.gold}×${gp}=${s.gold * gp}`);
      if (s.silver) parts.push(`🥈${s.silver}×${sp}=${s.silver * sp}`);
      if (s.bronze) parts.push(`🥉${s.bronze}×${bp}=${s.bronze * bp}`);
      if (s.bonusPoints) parts.push(`พิเศษ ${s.bonusPoints}`);
      s.reasoning = parts.length ? `${parts.join(" + ")} = ${s.points}` : "ยังไม่มีคะแนน";
    });
    return Object.values(houseStats).sort((a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  }, [meet, houses, activities, participantsByActivity, scores, bonuses]);

  const membersByHouse = useMemo(() => {
    const m: Record<string, Member[]> = {};
    members.forEach((mb) => { (m[mb.house_id] ||= []).push(mb); });
    return m;
  }, [members]);

  if (loading || !meet) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportSportsDayReportPdf({ meet, leaderboard, activities, participantsByActivity, scores, houses, bonuses });
      logAudit({ action: "sports_day.export_pdf", target_table: "sports_day_meets", target_id: meet.id, details: { title: meet.title } });
      toast.success("ดาวน์โหลด PDF แล้ว");
    } catch (e: any) { toast.error(e.message || "สร้าง PDF ไม่สำเร็จ"); }
    finally { setExportingPdf(false); }
  };

  const publishToFeed = async () => {
    if (!confirm("ประกาศสรุปผลกีฬาสีลงฟีดข่าวโรงเรียน?")) return;
    setPublishing(true);
    try {
      const el = document.getElementById("sports-day-report-capture");
      if (!el) throw new Error("ไม่พบส่วนรายงาน");
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("ไม่สามารถสร้างรูป")), "image/jpeg", 0.92)
      );
      const path = `sports-day/${meet.id}-${Date.now()}.jpg`;
      const up = await (supabase as any).storage.from("cms-images").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = (supabase as any).storage.from("cms-images").getPublicUrl(path);
      const champ = leaderboard[0]?.house?.name;
      const content = [
        `🏆 สรุปผลการแข่งขัน "${meet.title}"`,
        champ ? `แชมป์: ${champ} (${leaderboard[0].points} คะแนน)` : null,
        `รายการแข่งทั้งหมด ${activities.length} รายการ • ประกาศผลแล้ว ${activities.filter((a) => a.results_published).length} รายการ`,
      ].filter(Boolean).join("\n");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("news_posts").insert({
        title: `🏆 สรุปผลกีฬาสี: ${meet.title}`,
        content, category: "sports", is_published: true, published_at: new Date().toISOString(),
        cover_image_url: pub?.publicUrl || null, author_id: user?.id || null,
      });
      if (error) throw error;
      logAudit({ action: "sports_day.publish_feed", target_table: "sports_day_meets", target_id: meet.id, details: { title: meet.title, cover: pub?.publicUrl } });
      toast.success("ประชาสัมพันธ์ลงฟีดแล้ว");
    } catch (e: any) { toast.error(e.message || "ประกาศไม่สำเร็จ"); }
    finally { setPublishing(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/sports-day")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> กลับ
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={exportingPdf} className="gap-2">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}ส่งออก PDF
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={publishToFeed} disabled={publishing} className="gap-2">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}ประชาสัมพันธ์ลงฟีด
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />พิมพ์</Button>
        </div>
      </div>

      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-xl gradient-primary"><Trophy className="h-6 w-6 text-white" /></div>
              <div>
                <CardTitle className="text-2xl">{meet.title}</CardTitle>
                <CardDescription className="flex flex-wrap gap-3 text-xs mt-1">
                  {meet.start_date && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateBE(meet.start_date)}{meet.end_date && meet.end_date !== meet.start_date ? ` — ${formatDateBE(meet.end_date)}` : ""}</span>}
                  {meet.venue && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{meet.venue}</span>}
                  {meet.academic_year && <span>ปีการศึกษา {meet.academic_year}</span>}
                  <Badge variant="secondary">{meet.status}</Badge>
                  {(meet.gold_points != null || meet.silver_points != null || meet.bronze_points != null) && (
                    <span>🥇 {meet.gold_points ?? 0} • 🥈 {meet.silver_points ?? 0} • 🥉 {meet.bronze_points ?? 0} คะแนน</span>
                  )}
                </CardDescription>
                {meet.description && <p className="text-sm text-muted-foreground mt-2">{meet.description}</p>}
              </div>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" className="gap-2 print:hidden" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4" /> แก้ไข</Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <MeetFormDialog open={editOpen} onOpenChange={setEditOpen} onSaved={load} existing={meet} />
      <ActivityFormDialog open={addActivityOpen} onOpenChange={setAddActivityOpen} onSaved={load} defaultSportsDayMeetId={id} defaultCategory="sport" />
      <BonusFormDialog open={addBonusOpen} onOpenChange={setAddBonusOpen} meetId={id} houses={houses} onSaved={load} />
      <BonusFormDialog open={!!bonusDlg} onOpenChange={(v) => !v && setBonusDlg(null)} meetId={id} houses={houses} existing={bonusDlg || undefined} onSaved={load} />
      <ResultEntryDialog
        open={!!resultDlgActivity}
        onOpenChange={(v) => !v && setResultDlgActivity(null)}
        activity={resultDlgActivity}
        participants={resultDlgActivity ? participantsByActivity[resultDlgActivity.id] || [] : []}
        scores={resultDlgActivity ? scores[resultDlgActivity.id] || [] : []}
        houses={houses}
        members={members}
        onSaved={load}
      />

      <Tabs defaultValue="leaderboard" className="print:hidden">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="leaderboard"><Medal className="w-3.5 h-3.5 mr-1" />คะแนนรวม</TabsTrigger>
          <TabsTrigger value="houses">คณะสี ({houses.length})</TabsTrigger>
          <TabsTrigger value="activities">รายการแข่งขัน ({activities.length})</TabsTrigger>
          <TabsTrigger value="bonus"><Award className="w-3.5 h-3.5 mr-1" />คะแนนพิเศษ ({bonuses.length})</TabsTrigger>
          <TabsTrigger value="report"><FileText className="w-3.5 h-3.5 mr-1" />รายงาน</TabsTrigger>
        </TabsList>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-2" onClick={async () => { await load(); toast.success("คำนวณคะแนนใหม่แล้ว"); }} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />คำนวณใหม่
            </Button>
          </div>
          <LeaderboardTable leaderboard={leaderboard} />
        </TabsContent>

        {/* Houses */}
        <TabsContent value="houses" className="space-y-3">
          {canManage && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setAddHouseOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> เพิ่มคณะสี</Button>
              {houses.length >= 2 && (
                <BulkAssignButton meetId={id} houses={houses} existingMemberIds={new Set(members.map((m) => m.student_id))} onDone={load} />
              )}
            </div>
          )}
          <HouseFormDialog open={addHouseOpen} onOpenChange={setAddHouseOpen} meetId={id} onSaved={load} />
          <HouseFormDialog open={!!houseDlg} onOpenChange={(v) => !v && setHouseDlg(null)} meetId={id} onSaved={load} existing={houseDlg || undefined} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {houses.map((h) => (
              <Card key={h.id} style={{ borderTop: `4px solid ${h.color}` }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full border shrink-0" style={{ background: h.color }} />
                      <CardTitle className="text-base truncate">{h.name}</CardTitle>
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => setHouseDlg(h)}><Pencil className="w-4 h-4" /></Button>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs"><Users className="w-3.5 h-3.5" />{(membersByHouse[h.id] || []).length} คน{h.tent_location ? ` • ${h.tent_location}` : ""}</CardDescription>
                  {h.motto && <p className="text-xs italic text-muted-foreground">"{h.motto}"</p>}
                </CardHeader>
                <CardContent>
                  {canManage && <HouseMembersManager houseId={h.id} meetId={id} members={membersByHouse[h.id] || []} onChanged={load} />}
                </CardContent>
              </Card>
            ))}
            {houses.length === 0 && (
              <Card className="col-span-full"><CardContent className="py-8 text-center text-muted-foreground">ยังไม่มีคณะสี</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="space-y-3">
          {canManage && (
            <Button onClick={() => setAddActivityOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> เพิ่มรายการแข่งขัน</Button>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>รายการ</TableHead>
                  <TableHead>วันแข่ง</TableHead>
                  <TableHead>สนาม</TableHead>
                  <TableHead className="text-center">ผู้เข้าร่วม</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {activities.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">ยังไม่มีรายการแข่งขัน — กด "เพิ่มรายการแข่งขัน"</TableCell></TableRow>
                  )}
                  {activities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.start_at ? formatDateBE(a.start_at) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.location || "—"}</TableCell>
                      <TableCell className="text-center">{(participantsByActivity[a.id] || []).length}</TableCell>
                      <TableCell className="text-center">
                        {a.results_published ? <Badge className="bg-success/15 text-success">ประกาศผลแล้ว</Badge> : <Badge variant="secondary">ยังไม่ประกาศ</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canManage && (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setResultDlgActivity(a)} title="บันทึกผลและเหรียญ">
                              <Medal className="w-3.5 h-3.5" />บันทึกผล
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/dashboard/activities/${a.id}`} title="เปิดหน้ารายการ"><ExternalLink className="w-4 h-4" /></Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bonus */}
        <TabsContent value="bonus" className="space-y-3">
          {canManage && (
            <Button onClick={() => setAddBonusOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> ให้คะแนนพิเศษ</Button>
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>คณะสี</TableHead>
                  <TableHead>หมวด</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="text-right">คะแนน</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bonuses.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">ยังไม่มีคะแนนพิเศษ — เช่น ขบวนพาเหรด, กองเชียร์, มารยาท, สปิริต</TableCell></TableRow>
                  )}
                  {bonuses.map((b) => {
                    const h = houses.find((x) => x.id === b.house_id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm">{formatDateBE(b.awarded_at)}</TableCell>
                        <TableCell><span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full border" style={{ background: h?.color }} />{h?.name || "—"}</span></TableCell>
                        <TableCell>{b.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{b.description || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{b.points}</TableCell>
                        <TableCell>
                          {canManage && <Button variant="ghost" size="icon" onClick={() => setBonusDlg(b)}><Pencil className="w-4 h-4" /></Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report (web view) */}
        <TabsContent value="report">
          <ReportView meet={meet} leaderboard={leaderboard} activities={activities} participantsByActivity={participantsByActivity} scores={scores} houses={houses} bonuses={bonuses} />
        </TabsContent>
      </Tabs>

      {/* Off-screen capture target for feed publishing + always-rendered printable report */}
      <div id="sports-day-report-capture" className="fixed -left-[9999px] top-0 w-[900px] bg-white text-black p-6 print:static print:left-auto print:w-auto print:p-0">
        <ReportView meet={meet} leaderboard={leaderboard} activities={activities} participantsByActivity={participantsByActivity} scores={scores} houses={houses} bonuses={bonuses} />
      </div>
    </div>
  );
}

// ─────────────── Leaderboard ───────────────
function LeaderboardTable({ leaderboard }: { leaderboard: any[] }) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-16 text-center">อันดับ</TableHead>
            <TableHead>คณะสี</TableHead>
            <TableHead className="text-center">🥇</TableHead>
            <TableHead className="text-center">🥈</TableHead>
            <TableHead className="text-center">🥉</TableHead>
            <TableHead className="text-center">ร่วมแข่ง</TableHead>
            <TableHead className="text-right">คะแนนเหรียญ</TableHead>
            <TableHead className="text-right">คะแนนพิเศษ</TableHead>
            <TableHead className="text-right">รวม</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {leaderboard.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">ยังไม่มีคะแนน — เพิ่มคณะสี รายการแข่งขัน และประกาศผลเพื่อสะสมคะแนน</TableCell></TableRow>
            )}
            {leaderboard.map((s, i) => (
              <React.Fragment key={s.house.id}>
                <TableRow>
                  <TableCell className="text-center font-bold text-lg" rowSpan={2}>{i === 0 ? "🏆" : i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border" style={{ background: s.house.color }} />
                      <span className="font-semibold">{s.house.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{s.gold}</TableCell>
                  <TableCell className="text-center">{s.silver}</TableCell>
                  <TableCell className="text-center">{s.bronze}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{s.participation}</TableCell>
                  <TableCell className="text-right">{s.medalPoints}</TableCell>
                  <TableCell className="text-right">{s.bonusPoints}</TableCell>
                  <TableCell className="text-right font-bold text-xl">{s.points}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={8} className="text-xs text-muted-foreground italic py-1">
                    เหตุผล: {s.reasoning}
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────── Report view ───────────────
function ReportView({ meet, leaderboard, activities, participantsByActivity, scores, houses, bonuses }: any) {
  const totalMembers = houses.reduce((acc: number, _h: House) => acc, 0);
  const publishedCount = activities.filter((a: any) => a.results_published).length;
  return (
    <div className="space-y-4 print:space-y-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">รายงานสรุปผลการแข่งขัน</CardTitle>
          <CardDescription>{meet.title}{meet.venue ? ` • ${meet.venue}` : ""}{meet.start_date ? ` • ${formatDateBE(meet.start_date)}` : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/40"><div className="text-2xl font-bold">{houses.length}</div><div className="text-xs text-muted-foreground">คณะสี</div></div>
            <div className="p-3 rounded-lg bg-muted/40"><div className="text-2xl font-bold">{activities.length}</div><div className="text-xs text-muted-foreground">รายการแข่งขัน</div></div>
            <div className="p-3 rounded-lg bg-muted/40"><div className="text-2xl font-bold">{publishedCount}</div><div className="text-xs text-muted-foreground">ประกาศผลแล้ว</div></div>
            <div className="p-3 rounded-lg bg-muted/40"><div className="text-2xl font-bold">{bonuses.length}</div><div className="text-xs text-muted-foreground">รายการคะแนนพิเศษ</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">สรุปคะแนนรวม</CardTitle></CardHeader>
        <CardContent className="p-0"><LeaderboardTable leaderboard={leaderboard} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ผลการแข่งขันรายรายการ</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>รายการ</TableHead>
              <TableHead>🥇 ทอง</TableHead>
              <TableHead>🥈 เงิน</TableHead>
              <TableHead>🥉 ทองแดง</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {activities.filter((a: any) => a.results_published).map((a: any) => {
                const parts = participantsByActivity[a.id] || [];
                const ss = scores[a.id] || [];
                const mode = a.scoring_mode || "points";
                const rows = parts.map((p: any) => ({ p, score: ss.find((s: any) => s.participant_id === p.id)?.score ?? null }))
                  .filter((r: any) => r.score != null)
                  .sort((x: any, y: any) => mode === "time" ? (x.score - y.score) : (y.score - x.score));
                const medalName = (idx: number) => {
                  const hid = rows[idx]?.p?.sports_day_house_id;
                  const h = houses.find((x: House) => x.id === hid);
                  return h ? h.name : "—";
                };
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>{medalName(0)}</TableCell>
                    <TableCell>{medalName(1)}</TableCell>
                    <TableCell>{medalName(2)}</TableCell>
                  </TableRow>
                );
              })}
              {activities.filter((a: any) => a.results_published).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">ยังไม่มีรายการที่ประกาศผล</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────── Bulk assign ───────────────
function BulkAssignButton({ meetId, houses, existingMemberIds, onDone }: { meetId: string; houses: House[]; existingMemberIds: Set<string>; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"random" | "classroom">("random");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data: students, error } = await (supabase as any)
        .from("students")
        .select("id, classroom_id")
        .eq("status", "active");
      if (error) throw error;
      const pool = (students || []).filter((s: any) => !existingMemberIds.has(s.id));
      if (pool.length === 0) { toast.info("ไม่มีนักเรียนที่ยังไม่ได้จัดสี"); setOpen(false); return; }

      const rows: any[] = [];
      if (mode === "random") {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        shuffled.forEach((s, i) => {
          rows.push({ meet_id: meetId, house_id: houses[i % houses.length].id, student_id: s.id });
        });
      } else {
        // group by classroom, then round-robin classrooms across houses
        const byCls: Record<string, any[]> = {};
        pool.forEach((s: any) => { (byCls[s.classroom_id || "_"] ||= []).push(s); });
        let hi = 0;
        Object.values(byCls).forEach((arr) => {
          arr.forEach((s) => {
            rows.push({ meet_id: meetId, house_id: houses[hi % houses.length].id, student_id: s.id });
            hi += 1;
          });
        });
      }
      // chunk insert
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await (supabase as any).from("sports_day_house_members").insert(rows.slice(i, i + 500));
        if (insErr) throw insErr;
      }
      toast.success(`จัดสีนักเรียน ${rows.length} คนเรียบร้อย`);
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message || "เกิดข้อผิดพลาด");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2"><Shuffle className="w-4 h-4" />จัดสีอัตโนมัติ</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>จัดสีนักเรียนอัตโนมัติ</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">ระบบจะกระจายนักเรียนทั้งหมด (ที่ยังไม่ได้อยู่สีใด) ลงในคณะสีทั้ง {houses.length} สีอย่างสมดุล</p>
            <div>
              <Label>วิธีการจัด</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">สุ่ม (Random)</SelectItem>
                  <SelectItem value="classroom">กระจายโดยห้องเรียน (Round-robin per classroom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</Button>
            <Button onClick={run} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}เริ่มจัดสี</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────── Bonus form ───────────────
const BONUS_CATEGORIES = ["ขบวนพาเหรด", "กองเชียร์", "สแตนเชียร์", "มารยาท", "สปิริต", "ความสะอาด", "การแต่งกาย", "อื่นๆ"];
function BonusFormDialog({ open, onOpenChange, meetId, houses, existing, onSaved }: any) {
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (open) setF(existing || { house_id: houses[0]?.id || "", category: BONUS_CATEGORIES[0], points: 0, awarded_at: new Date().toISOString().slice(0, 10) });
  }, [open, existing, houses]);

  const save = async () => {
    if (!f.house_id) return toast.error("เลือกคณะสี");
    if (!f.category) return toast.error("เลือกหมวด");
    const payload = {
      meet_id: meetId, house_id: f.house_id, category: f.category,
      description: f.description || null, points: Number(f.points) || 0,
      awarded_at: f.awarded_at || new Date().toISOString().slice(0, 10),
    };
    if (existing) {
      const { error } = await (supabase as any).from("sports_day_bonus_points").update(payload).eq("id", existing.id);
      if (error) return toast.error(error.message);
      logAudit({ action: "sports_day.bonus.update", target_table: "sports_day_bonus_points", target_id: existing.id, details: { before: existing, after: payload } });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ins, error } = await (supabase as any).from("sports_day_bonus_points").insert({ ...payload, awarded_by: user?.id }).select("id").maybeSingle();
      if (error) return toast.error(error.message);
      logAudit({ action: "sports_day.bonus.create", target_table: "sports_day_bonus_points", target_id: ins?.id, details: payload });
    }
    toast.success("บันทึกแล้ว");
    onOpenChange(false); onSaved?.();
  };
  const del = async () => {
    if (!existing || !confirm("ลบรายการคะแนนพิเศษนี้?")) return;
    const { error } = await (supabase as any).from("sports_day_bonus_points").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    logAudit({ action: "sports_day.bonus.delete", target_table: "sports_day_bonus_points", target_id: existing.id, details: existing });
    toast.success("ลบแล้ว");
    onOpenChange(false); onSaved?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? "แก้ไข" : "ให้"}คะแนนพิเศษ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>คณะสี *</Label>
            <Select value={f.house_id || ""} onValueChange={(v) => setF({ ...f, house_id: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกคณะสี" /></SelectTrigger>
              <SelectContent>
                {houses.map((h: House) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full border" style={{ background: h.color }} />{h.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>หมวด *</Label>
              <Select value={f.category || ""} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BONUS_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>คะแนน *</Label><Input type="number" step="0.5" value={f.points ?? 0} onChange={(e) => setF({ ...f, points: e.target.value })} /></div>
          </div>
          <div><Label>วันที่</Label><DateInput value={f.awarded_at || ""} onChange={(e) => setF({ ...f, awarded_at: e.target.value })} /></div>
          <div><Label>หมายเหตุ</Label><Textarea rows={2} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" /></div>
        </div>
        <DialogFooter className="flex-row sm:justify-between">
          <div>{existing && <Button variant="destructive" onClick={del}>ลบ</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={save}>บันทึก</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── Meet form ───────────────
function MeetFormDialog({ open, onOpenChange, onSaved, existing }: any) {
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (open) setF(existing || { title: "", status: "planning" });
  }, [open, existing]);
  const save = async () => {
    if (!f.title?.trim()) return toast.error("กรอกชื่องาน");
    const payload: any = {
      title: f.title.trim(), description: f.description || null,
      start_date: f.start_date || null, end_date: f.end_date || null,
      venue: f.venue || null, academic_year: f.academic_year || null,
      status: f.status || "planning",
      cover_image_url: f.cover_image_url || null,
    };
    // คะแนนเหรียญ: ไม่บังคับกรอก — ใส่เฉพาะเมื่อระบุค่าจริง (insert ใช้ default 5/3/1 ของฐานข้อมูล)
    if (f.gold_points !== "" && f.gold_points != null) payload.gold_points = Number(f.gold_points) || 0;
    if (f.silver_points !== "" && f.silver_points != null) payload.silver_points = Number(f.silver_points) || 0;
    if (f.bronze_points !== "" && f.bronze_points != null) payload.bronze_points = Number(f.bronze_points) || 0;
    if (existing) {
      const { error } = await (supabase as any).from("sports_day_meets").update(payload).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("sports_day_meets").insert({ ...payload, created_by: user?.id });
      if (error) return toast.error(error.message);
    }
    toast.success("บันทึกแล้ว");
    onOpenChange(false);
    onSaved?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "แก้ไข" : "สร้าง"}งานกีฬาสี</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div><Label>ชื่องาน *</Label><Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="เช่น กีฬาสี ประจำปี 2569" /></div>
          <div><Label>คำอธิบาย</Label><Textarea rows={2} value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>ปีการศึกษา</Label><Input value={f.academic_year || ""} onChange={(e) => setF({ ...f, academic_year: e.target.value })} placeholder="2569" /></div>
            <div><Label>สนาม/สถานที่</Label><Input value={f.venue || ""} onChange={(e) => setF({ ...f, venue: e.target.value })} placeholder="สนามกีฬาโรงเรียน" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>วันเริ่ม</Label><DateInput value={f.start_date || ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div><Label>วันสิ้นสุด</Label><DateInput value={f.end_date || ""} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          </div>
          <div>
            <Label className="text-sm">คะแนนต่อเหรียญ <span className="text-xs text-muted-foreground font-normal">(ไม่บังคับ — เว้นว่างได้ ค่อยใส่ภายหลังเมื่อสร้างรายการแข่งขัน • ค่าเริ่มต้น 5/3/1)</span></Label>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div><Input type="number" min={0} value={f.gold_points ?? ""} onChange={(e) => setF({ ...f, gold_points: e.target.value })} placeholder="🥇 5" /></div>
              <div><Input type="number" min={0} value={f.silver_points ?? ""} onChange={(e) => setF({ ...f, silver_points: e.target.value })} placeholder="🥈 3" /></div>
              <div><Input type="number" min={0} value={f.bronze_points ?? ""} onChange={(e) => setF({ ...f, bronze_points: e.target.value })} placeholder="🥉 1" /></div>
            </div>
          </div>
          <div>
            <Label>สถานะ</Label>
            <Select value={f.status || "planning"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">วางแผน</SelectItem>
                <SelectItem value="ongoing">กำลังแข่งขัน</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={save}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── House form ───────────────
const COLOR_PRESETS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];
function HouseFormDialog({ open, onOpenChange, meetId, onSaved, existing }: any) {
  const [f, setF] = useState<any>({});
  useEffect(() => { if (open) setF(existing || { name: "", color: COLOR_PRESETS[0] }); }, [open, existing]);
  const save = async () => {
    if (!f.name?.trim()) return toast.error("กรอกชื่อสี");
    const payload = { meet_id: meetId, name: f.name.trim(), color: f.color, emblem_url: f.emblem_url || null, motto: f.motto || null, tent_location: f.tent_location || null };
    if (existing) {
      const { error } = await (supabase as any).from("sports_day_houses").update(payload).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("sports_day_houses").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("บันทึกแล้ว");
    onOpenChange(false);
    onSaved?.();
  };
  const del = async () => {
    if (!existing) return;
    if (!confirm(`ลบคณะสี "${existing.name}" และสมาชิกทั้งหมด?`)) return;
    const { error } = await (supabase as any).from("sports_day_houses").delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    onOpenChange(false);
    onSaved?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? "แก้ไข" : "เพิ่ม"}คณะสี</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อสี *</Label><Input value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น สีแดง, สีน้ำเงิน" /></div>
          <div>
            <Label>สีประจำคณะ</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLOR_PRESETS.map((c) => (
                <button key={c} type="button" onClick={() => setF({ ...f, color: c })}
                  className={`w-8 h-8 rounded-full border-2 ${f.color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ background: c }} />
              ))}
              <Input type="color" value={f.color || "#3b82f6"} onChange={(e) => setF({ ...f, color: e.target.value })} className="w-12 h-8 p-1" />
            </div>
          </div>
          <div><Label>คำขวัญ</Label><Input value={f.motto || ""} onChange={(e) => setF({ ...f, motto: e.target.value })} placeholder="คำขวัญประจำคณะสี" /></div>
          <div><Label>ที่ตั้งเต็นท์</Label><Input value={f.tent_location || ""} onChange={(e) => setF({ ...f, tent_location: e.target.value })} placeholder="เช่น ฝั่งตะวันตก" /></div>
          <div><Label>URL สัญลักษณ์ (ไม่บังคับ)</Label><Input value={f.emblem_url || ""} onChange={(e) => setF({ ...f, emblem_url: e.target.value })} placeholder="https://..." /></div>
        </div>
        <DialogFooter className="flex-row sm:justify-between">
          <div>{existing && <Button variant="destructive" onClick={del}>ลบ</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={save}>บันทึก</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── House members manager ───────────────
function HouseMembersManager({ houseId, meetId, members, onChanged }: { houseId: string; meetId: string; members: Member[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const { availableClassrooms, gradeOptions, gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter, filteredStudents } = useStudentData();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const memberIds = useMemo(() => new Set(members.map((m) => m.student_id)), [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (filteredStudents || []).filter((s: any) => {
      if (memberIds.has(s.id)) return false;
      if (!q) return true;
      return `${s.first_name || ""} ${s.last_name || ""} ${s.student_code || ""}`.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [filteredStudents, search, memberIds]);

  const add = async () => {
    if (picked.size === 0) return;
    const rows = Array.from(picked).map((sid) => ({ house_id: houseId, meet_id: meetId, student_id: sid }));
    const { error } = await (supabase as any).from("sports_day_house_members").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`เพิ่ม ${picked.size} คน`);
    setPicked(new Set()); setOpen(false); onChanged();
  };
  const remove = async (mid: string) => {
    const { error } = await (supabase as any).from("sports_day_house_members").delete().eq("id", mid);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <div className="space-y-2">
      <div className="max-h-40 overflow-y-auto space-y-1">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1">
            <span className="truncate">{formatFullNamePlain(m.student?.prefix, m.student?.first_name, m.student?.last_name)} <span className="text-muted-foreground">{m.student?.classrooms?.name || ""}</span></span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(m.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
          </div>
        ))}
        {members.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">ยังไม่มีสมาชิก</div>}
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" /> เพิ่มสมาชิก</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>เพิ่มสมาชิกเข้าสี</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกระดับ</SelectItem>
                  {gradeOptions.map((g: any) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={classroomFilter} onValueChange={setClassroomFilter}>
                <SelectTrigger><SelectValue placeholder="ห้อง" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกห้อง</SelectItem>
                  {(availableClassrooms || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="ค้นหาชื่อ/รหัส" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="max-h-80 overflow-y-auto border rounded">
              {filtered.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">ไม่พบนักเรียน</div>
              ) : filtered.map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b">
                  <Checkbox checked={picked.has(s.id)} onCheckedChange={(v) => {
                    setPicked((prev) => { const n = new Set(prev); v ? n.add(s.id) : n.delete(s.id); return n; });
                  }} />
                  <span className="text-sm flex-1">{formatFullNamePlain(s.prefix, s.first_name, s.last_name)}</span>
                  <span className="text-xs text-muted-foreground">{s.student_code} • {s.classrooms?.name}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={add} disabled={picked.size === 0}>เพิ่ม {picked.size} คน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────── Result entry (medal selection + validation) ───────────────
function ResultEntryDialog({ open, onOpenChange, activity, participants, scores, houses, members, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  activity: any; participants: Participant[]; scores: ScoreRow[];
  houses: House[]; members: Member[]; onSaved: () => void;
}) {
  // Medal value mapping: gold=3, silver=2, bronze=1, none=null
  const MEDAL_SCORE: Record<string, number | null> = { gold: 3, silver: 2, bronze: 1, none: null };
  const SCORE_MEDAL = (s: number | null): "gold" | "silver" | "bronze" | "none" =>
    s === 3 ? "gold" : s === 2 ? "silver" : s === 1 ? "bronze" : "none";

  const [picks, setPicks] = useState<Record<string, "gold" | "silver" | "bronze" | "none">>({});
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [participantStudents, setParticipantStudents] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open || !activity) return;
    // initialise from existing scores
    const init: Record<string, "gold" | "silver" | "bronze" | "none"> = {};
    participants.forEach((p) => {
      const sc = scores.find((s) => s.participant_id === p.id)?.score;
      init[p.id] = SCORE_MEDAL(sc != null ? Number(sc) : null);
    });
    setPicks(init);
    setPublish(!!activity.results_published);

    // load student info for display
    const sids = Array.from(new Set(participants.map((p) => p.student_id).filter(Boolean)));
    if (sids.length === 0) { setParticipantStudents({}); return; }
    (supabase as any).from("students")
      .select("id, prefix, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(name)")
      .in("id", sids).then(({ data }: any) => {
        const map: Record<string, any> = {};
        (data || []).forEach((s: any) => { map[s.id] = s; });
        setParticipantStudents(map);
      });
  }, [open, activity, participants, scores]);

  const counts = useMemo(() => {
    const c = { gold: 0, silver: 0, bronze: 0 };
    Object.values(picks).forEach((m) => { if (m !== "none") c[m] += 1; });
    return c;
  }, [picks]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (counts.gold > 1) e.push("เหรียญทองมีได้เพียง 1 รางวัล");
    if (counts.silver > 1) e.push("เหรียญเงินมีได้เพียง 1 รางวัล");
    if (counts.bronze > 1) e.push("เหรียญทองแดงมีได้เพียง 1 รางวัล");
    return e;
  }, [counts]);

  const setMedal = (pid: string, m: "gold" | "silver" | "bronze" | "none") => {
    setPicks((prev) => ({ ...prev, [pid]: m }));
  };

  const save = async () => {
    if (errors.length > 0) { toast.error(errors[0]); return; }
    if (!activity) return;
    setBusy(true);
    try {
      const upserts: any[] = [];
      const deletes: string[] = [];
      participants.forEach((p) => {
        const m = picks[p.id] || "none";
        const s = MEDAL_SCORE[m];
        if (s == null) deletes.push(p.id);
        else upserts.push({ activity_id: activity.id, participant_id: p.id, score: s });
      });
      if (upserts.length > 0) {
        const { error } = await (supabase as any).from("activity_scores")
          .upsert(upserts, { onConflict: "participant_id" });
        if (error) throw error;
      }
      if (deletes.length > 0) {
        const { error } = await (supabase as any).from("activity_scores").delete().in("participant_id", deletes);
        if (error) throw error;
      }
      const { error: aErr } = await (supabase as any).from("activities")
        .update({ results_published: publish }).eq("id", activity.id);
      if (aErr) throw aErr;
      logAudit({
        action: "sports_day.result.save",
        target_table: "activities",
        target_id: activity.id,
        details: { activity_title: activity.title, picks, results_published: publish, total: participants.length },
      });
      toast.success("บันทึกผลแล้ว");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally { setBusy(false); }
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Medal className="w-5 h-5" />บันทึกผล: {activity.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant={counts.gold === 1 ? "default" : counts.gold > 1 ? "destructive" : "secondary"}>🥇 {counts.gold}/1</Badge>
            <Badge variant={counts.silver === 1 ? "default" : counts.silver > 1 ? "destructive" : "secondary"}>🥈 {counts.silver}/1</Badge>
            <Badge variant={counts.bronze === 1 ? "default" : counts.bronze > 1 ? "destructive" : "secondary"}>🥉 {counts.bronze}/1</Badge>
          </div>
          {errors.length > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{errors.join(" • ")}</div>
          )}
          {participants.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">ยังไม่มีผู้เข้าร่วมในรายการนี้ — เปิดหน้ารายการเพื่อเพิ่มผู้เข้าแข่งขัน</div>
          ) : (
            <div className="border rounded divide-y">
              {participants.map((p) => {
                const st = participantStudents[p.student_id];
                const house = houses.find((h) => h.id === p.sports_day_house_id);
                const cur = picks[p.id] || "none";
                return (
                  <div key={p.id} className="flex items-center gap-2 p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {st ? formatFullNamePlain(st.prefix, st.first_name, st.last_name) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {st?.student_code} • {st?.classrooms?.name || "—"}
                        {house && <span className="inline-flex items-center gap-1 ml-1"><span className="w-2.5 h-2.5 rounded-full border" style={{ background: house.color }} />{house.name}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(["gold", "silver", "bronze", "none"] as const).map((m) => (
                        <Button key={m} type="button" size="sm"
                          variant={cur === m ? "default" : "outline"}
                          onClick={() => setMedal(p.id, m)}
                          className="px-2"
                        >
                          {m === "gold" ? "🥇" : m === "silver" ? "🥈" : m === "bronze" ? "🥉" : "—"}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm pt-2">
            <Checkbox checked={publish} onCheckedChange={(v) => setPublish(!!v)} />
            ประกาศผลทันที (นับคะแนนเข้าตารางคณะสี)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button onClick={save} disabled={busy || errors.length > 0}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
