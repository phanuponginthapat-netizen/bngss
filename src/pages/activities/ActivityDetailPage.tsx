import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, ArrowLeft, Calendar, MapPin, Loader2, UserPlus, Share2, Image as ImageIcon, Trash2, QrCode, ToggleLeft, ToggleRight, GitBranch, FileDown, X } from "lucide-react";
import { exportActivitySummaryPdf } from "@/lib/exporters/activitySummaryPdf";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { parseLiveEmbed } from "@/lib/liveEmbed";
import { ActivityQrModal } from "@/components/activities/ActivityQrModal";
import { BracketView } from "@/components/activities/BracketView";
import { ActivityFormDialog } from "@/pages/activities/ActivitiesPage";
import { getTemplate } from "@/lib/activityTemplates";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useStudentData } from "@/hooks/useStudentData";
import { formatFullNamePlain } from "@/lib/nameFormat";
import { formatDateBE } from "@/lib/dateBE";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Activity = any;
type Participant = {
  id: string; activity_id: string; student_id: string; team_name: string | null; bib_no: string | null;
  student?: { id: string; prefix: string | null; first_name: string | null; last_name: string | null; student_code: string | null; classrooms?: { name: string } | null };
};
type Criterion = { key: string; name: string; max: number };
type Score = { id: string; participant_id: string; score: number | null; rank: number | null; note: string | null; criteria_scores?: Record<string, number> };

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const { school } = useSchoolContext();
  const canManage = isAdmin || isDirector || isTeacher;
  const canScore = canManage;

  const exportPdf = async () => {
    if (!activity) return;
    try {
      await exportActivitySummaryPdf({
        activity,
        ranked,
        participantsCount: participants.length,
        schoolName: school?.school_name,
      });
    } catch (e: any) {
      toast.error(e?.message || "สร้าง PDF ไม่สำเร็จ");
    }
  };

  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const [editOpen, setEditOpen] = useState(false);

  const hasBracket = useMemo(() => {
    const tpl = getTemplate(activity?.template_id);
    if (tpl) return tpl.bracketSupported;
    // fallback: show if any matches exist or template not set
    return matches.length > 0 || !activity?.template_id;
  }, [activity?.template_id, matches.length]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [a, p, s, m] = await Promise.all([
      (supabase as any).from("activities").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("activity_participants")
        .select("*, student:students!activity_participants_student_id_fkey(id, prefix, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(name))")
        .eq("activity_id", id),
      (supabase as any).from("activity_scores").select("*").eq("activity_id", id),
      (supabase as any).from("activity_matches").select("*").eq("activity_id", id),
    ]);
    if (a.error) toast.error(a.error.message);
    setActivity(a.data);
    setParticipants((p.data as Participant[]) || []);
    setMatches((m.data as any[]) || []);
    const map: Record<string, Score> = {};
    ((s.data as Score[]) || []).forEach((sc) => { map[sc.participant_id] = sc; });
    setScores(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!id) return;
    const ch = (supabase as any).channel(`activity-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_participants", filter: `activity_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_scores", filter: `activity_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_matches", filter: `activity_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "activities", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const toggleRegistration = async () => {
    if (!activity) return;
    const next = !activity.registration_open;
    const { error } = await (supabase as any).from("activities")
      .update({ registration_open: next }).eq("id", activity.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "เปิดรับสมัครแล้ว" : "ปิดรับสมัครแล้ว");
  };

  // Compute ranked leaderboard
  const ranked = useMemo(() => {
    const mode = activity?.scoring_mode || "points";
    const rows = participants.map((p) => ({
      participant: p,
      score: scores[p.id]?.score ?? null,
    })).filter((r) => r.score != null);
    rows.sort((a, b) => {
      const av = a.score as number, bv = b.score as number;
      return mode === "time" ? av - bv : bv - av;
    });
    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [participants, scores, activity]);

  const criteria: Criterion[] = useMemo(() => {
    const c = activity?.criteria;
    if (Array.isArray(c)) return c as Criterion[];
    return [];
  }, [activity?.criteria]);

  const sumCriteria = (cs: Record<string, number> | undefined) => {
    if (!cs) return 0;
    return criteria.reduce((s, c) => s + (Number(cs[c.key]) || 0), 0);
  };

  const updateCriterionScore = async (participantId: string, key: string, value: string) => {
    if (!id) return;
    const num = value === "" ? 0 : Number(value);
    const existing = scores[participantId];
    const nextCs = { ...(existing?.criteria_scores || {}), [key]: num };
    const total = criteria.reduce((s, c) => s + (Number(nextCs[c.key]) || 0), 0);
    setScores((prev) => ({
      ...prev,
      [participantId]: { ...(existing || { id: "", participant_id: participantId, rank: null, note: null }), criteria_scores: nextCs, score: total } as Score,
    }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("activity_scores")
      .upsert({ activity_id: id, participant_id: participantId, score: total, criteria_scores: nextCs, judge_id: user?.id }, { onConflict: "participant_id" });
    if (error) toast.error(error.message);
  };

  const updateScore = async (participantId: string, value: string) => {
    if (!id) return;
    const score = value === "" ? null : Number(value);
    const existing = scores[participantId];
    setScores((prev) => ({
      ...prev,
      [participantId]: { ...(existing || { id: "", participant_id: participantId, rank: null, note: null }), score } as Score,
    }));
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("activity_scores")
      .upsert({ activity_id: id, participant_id: participantId, score, judge_id: user?.id }, { onConflict: "participant_id" });
    if (error) toast.error(error.message);
  };

  const saveCriteria = async (next: Criterion[]) => {
    if (!id) return;
    const { error } = await (supabase as any).from("activities")
      .update({ criteria: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("บันทึกเกณฑ์แล้ว");
  };

  const togglePublish = async () => {
    if (!activity) return;
    const next = !activity.results_published;
    const { error } = await (supabase as any).from("activities")
      .update({ results_published: next, results_published_at: next ? new Date().toISOString() : null })
      .eq("id", activity.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "ประกาศผลแล้ว" : "ยกเลิกการประกาศผล");
  };

  const removeParticipant = async (pid: string) => {
    const { error } = await (supabase as any).from("activity_participants").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    toast.success("ลบผู้เข้าร่วมแล้ว");
  };

  const postToFeed = async () => {
    if (!cardRef.current || !id || !activity) return;
    setPosting(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), "image/png"));
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user?.id}/activities/${id}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("wall-media").upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const top = ranked.slice(0, 3).map((r, i) => `${i + 1}. ${formatFullNamePlain(r.participant.student?.prefix, r.participant.student?.first_name, r.participant.student?.last_name)} — ${r.score}`).join("\n");
      const caption = `🏆 ผลการแข่งขัน: ${activity.title}\n${top || ""}`.trim();
      const { data: wp, error: wpErr } = await (supabase as any).from("wall_posts")
        .insert({ author_id: user?.id, content: caption, media_urls: [path] }).select("id").single();
      if (wpErr) throw wpErr;
      await (supabase as any).from("activity_posts").insert({
        activity_id: id, wall_post_id: wp.id, image_url: path, posted_by: user?.id,
      });
      toast.success("โพสไปฟีดแล้ว");
    } catch (e: any) {
      toast.error(e.message || "โพสไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  };

  if (loading || !activity) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/activities")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> กลับ
      </Button>

      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-xl gradient-primary"><Trophy className="h-6 w-6 text-white" /></div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-2xl truncate">{activity.title}</CardTitle>
              <CardDescription className="flex flex-wrap gap-3 text-xs mt-1">
                {activity.start_at && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDateBE(activity.start_at)}</span>}
                {activity.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{activity.location}</span>}
                <Badge variant="secondary">{activity.status}</Badge>
                {activity.registration_open && <Badge className="bg-success/15 text-success">เปิดรับสมัคร</Badge>}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setQrOpen(true)}>
                <QrCode className="w-4 h-4" /> QR ลงทะเบียน
              </Button>
              {canManage && (
                <>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4" /> แก้ไข
                  </Button>
                  <Button size="sm" variant={activity.registration_open ? "secondary" : "default"} className="gap-2" onClick={toggleRegistration}>
                    {activity.registration_open ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {activity.registration_open ? "ปิดรับสมัคร" : "เปิดรับสมัคร"}
                  </Button>
                </>
              )}
            </div>
          </div>
          {activity.rules && (
            <div className="mt-3 p-3 rounded-md bg-background/50 border">
              <div className="text-xs font-semibold text-muted-foreground mb-1">กฎ/กติกา</div>
              <pre className="text-xs whitespace-pre-wrap font-sans">{activity.rules}</pre>
            </div>
          )}
        </CardHeader>
      </Card>

      <ActivityQrModal open={qrOpen} onOpenChange={setQrOpen} activityId={id!} title={activity.title} />
      <ActivityFormDialog open={editOpen} onOpenChange={setEditOpen} onSaved={load} existing={activity} />

      <Tabs defaultValue="report">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="report">รายงาน</TabsTrigger>
          <TabsTrigger value="participants">ผู้เข้าร่วม ({participants.length})</TabsTrigger>
          {hasBracket && (
            <TabsTrigger value="bracket"><GitBranch className="w-3.5 h-3.5 mr-1" />สายการแข่งขัน</TabsTrigger>
          )}
          <TabsTrigger value="scores" disabled={!canScore}>บันทึกคะแนน</TabsTrigger>
          <TabsTrigger value="dashboard">แดชบอร์ดผล</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          <ActivityReportTab activity={activity} />
        </TabsContent>

        {hasBracket && (
          <TabsContent value="bracket">
            <BracketView activityId={id!} participants={participants} matches={matches} canManage={canScore} onChanged={load} activityTitle={activity.title} />
          </TabsContent>
        )}


        <TabsContent value="participants" className="space-y-3">
          {canManage && <AddParticipantsSection activityId={id!} existing={participants} onAdded={load} />}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-16">เลข</TableHead>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>ห้อง</TableHead>
                  <TableHead>ทีม</TableHead>
                  {canManage && <TableHead className="w-12"></TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {participants.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ยังไม่มีผู้เข้าร่วม</TableCell></TableRow>
                  )}
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.bib_no || "—"}</TableCell>
                      <TableCell>{formatFullNamePlain(p.student?.prefix, p.student?.first_name, p.student?.last_name)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.student?.classrooms?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.team_name || "—"}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeParticipant(p.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-3">
          {canManage && (
            <CriteriaEditor criteria={criteria} onSave={saveCriteria} />
          )}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>ห้อง</TableHead>
                  {criteria.length > 0
                    ? criteria.map((c) => (
                        <TableHead key={c.key} className="w-28 text-center">{c.name}<div className="text-[10px] text-muted-foreground font-normal">เต็ม {c.max}</div></TableHead>
                      ))
                    : <TableHead className="w-40">คะแนน (เต็ม {activity.max_score})</TableHead>}
                  {criteria.length > 0 && <TableHead className="w-24 text-center">รวม</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {participants.map((p) => {
                    const sc = scores[p.id];
                    const total = criteria.length > 0 ? sumCriteria(sc?.criteria_scores) : (sc?.score ?? 0);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{formatFullNamePlain(p.student?.prefix, p.student?.first_name, p.student?.last_name)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.student?.classrooms?.name || "—"}</TableCell>
                        {criteria.length > 0 ? (
                          <>
                            {criteria.map((c) => (
                              <TableCell key={c.key}>
                                <Input type="number" step="0.01" max={c.max} min={0}
                                  defaultValue={sc?.criteria_scores?.[c.key] ?? ""}
                                  onBlur={(e) => updateCriterionScore(p.id, c.key, e.target.value)}
                                  disabled={!canScore} className="text-center" />
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-semibold">{total}</TableCell>
                          </>
                        ) : (
                          <TableCell>
                            <Input type="number" step="0.01" defaultValue={sc?.score ?? ""}
                              onBlur={(e) => updateScore(p.id, e.target.value)} disabled={!canScore} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {participants.length === 0 && (
                    <TableRow><TableCell colSpan={criteria.length + 3} className="text-center text-muted-foreground py-8">เพิ่มผู้เข้าร่วมก่อน</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              {activity.results_published ? (
                <Badge className="bg-success/15 text-success border-success/30">ประกาศผลแล้ว</Badge>
              ) : (
                <Badge variant="secondary">ยังไม่ประกาศผล (แสดงเฉพาะผู้ดูแล)</Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {canManage && (
                <Button onClick={togglePublish} variant={activity.results_published ? "secondary" : "default"} className="gap-2">
                  <Trophy className="w-4 h-4" />
                  {activity.results_published ? "ยกเลิกประกาศผล" : "ประกาศผล"}
                </Button>
              )}
              <Button variant="outline" onClick={exportPdf} className="gap-2">
                <FileDown className="w-4 h-4" /> ดาวน์โหลด PDF
              </Button>
              {canManage && (
                <Button onClick={postToFeed} disabled={posting || ranked.length === 0 || !activity.results_published} className="gap-2">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  โพสรูปสรุปไปฟีด
                </Button>
              )}
            </div>
          </div>

          {!activity.results_published && !canManage ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">ผลการแข่งขันจะแสดงเมื่อผู้ดูแลกดประกาศผล</CardContent></Card>
          ) : (
            <>
              <ResultCard ref={cardRef} activity={activity} ranked={ranked} />
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> กราฟคะแนน</CardTitle></CardHeader>
                <CardContent className="h-72">
                  {ranked.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">ยังไม่มีคะแนน</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ranked.map((r) => ({
                        name: formatFullNamePlain(r.participant.student?.prefix, r.participant.student?.first_name, r.participant.student?.last_name).split(" ").slice(0, 2).join(" "),
                        score: r.score as number,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Result card for snapshot ──
const ResultCard = forwardRef<HTMLDivElement, { activity: Activity; ranked: any[] }>(({ activity, ranked }, ref) => {
  const top3 = ranked.slice(0, 3);
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <div ref={ref} className="rounded-2xl p-8 text-white" style={{
      background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
      minHeight: 360,
    }}>
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-10 h-10" />
        <div>
          <div className="text-xs opacity-80">ผลการแข่งขัน</div>
          <div className="text-2xl font-bold">{activity.title}</div>
          {activity.start_at && <div className="text-xs opacity-80 mt-1">{formatDateBE(activity.start_at)}</div>}
        </div>
      </div>
      {top3.length === 0 ? (
        <div className="text-center py-10 opacity-80">ยังไม่มีผลคะแนน</div>
      ) : (
        <div className="space-y-3">
          {top3.map((r, i) => (
            <div key={r.participant.id} className="flex items-center gap-4 bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="text-3xl">{medal[i]}</div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{formatFullNamePlain(r.participant.student?.prefix, r.participant.student?.first_name, r.participant.student?.last_name)}</div>
                <div className="text-xs opacity-80">{r.participant.student?.classrooms?.name || ""}</div>
              </div>
              <div className="text-2xl font-bold">{r.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
ResultCard.displayName = "ResultCard";

// ── Criteria editor ──
function CriteriaEditor({ criteria, onSave }: { criteria: Criterion[]; onSave: (next: Criterion[]) => any }) {
  const [open, setOpen] = useState(criteria.length === 0);
  const [rows, setRows] = useState<Criterion[]>(criteria);
  useEffect(() => { setRows(criteria); }, [criteria]);
  const addRow = () => setRows((r) => [...r, { key: `c${Date.now()}`, name: "", max: 10 }]);
  const update = (i: number, patch: Partial<Criterion>) => setRows((r) => r.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <CardTitle className="text-sm">เกณฑ์การให้คะแนน {criteria.length > 0 && <span className="text-muted-foreground font-normal">({criteria.length} เกณฑ์ • รวม {criteria.reduce((s, c) => s + (Number(c.max) || 0), 0)} คะแนน)</span>}</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? "ซ่อน" : "จัดการ"}</Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.key} className="flex gap-2 items-center">
              <Input placeholder="ชื่อเกณฑ์ เช่น ความคิดสร้างสรรค์" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input type="number" min={1} className="w-24" placeholder="เต็ม" value={r.max} onChange={(e) => update(i, { max: Number(e.target.value) || 0 })} />
              <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>+ เพิ่มเกณฑ์</Button>
            <Button size="sm" onClick={() => onSave(rows.filter((r) => r.name.trim() && r.max > 0))}>บันทึกเกณฑ์</Button>
          </div>
          <p className="text-xs text-muted-foreground">ระบบจะรวมคะแนนจากทุกเกณฑ์ให้อัตโนมัติเพื่อใช้ในการจัดอันดับและแดชบอร์ดผล</p>
        </CardContent>
      )}
    </Card>
  );
}



// ── Add participants ──
function AddParticipantsSection({ activityId, existing, onAdded }: {
  activityId: string; existing: Participant[]; onAdded: () => void;
}) {
  const { availableClassrooms, gradeOptions, gradeFilter, setGradeFilter, classroomFilter, setClassroomFilter, filteredClassrooms, filteredStudents } = useStudentData();
  const existingIds = useMemo(() => new Set(existing.map((p) => p.student_id)), [existing]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [team, setTeam] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const add = async () => {
    if (picked.size === 0) return toast.error("เลือกนักเรียนก่อน");
    setSaving(true);
    const rows = Array.from(picked).map((sid) => ({
      activity_id: activityId, student_id: sid, team_name: team || null,
    }));
    const { error } = await (supabase as any).from("activity_participants").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`เพิ่ม ${picked.size} คน`);
    setPicked(new Set()); setTeam("");
    onAdded();
  };

  const candidates = filteredStudents.filter((s: any) => !existingIds.has(s.id));

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> เพิ่มผู้เข้าร่วม</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกชั้น</SelectItem>
              {gradeOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classroomFilter} onValueChange={setClassroomFilter}>
            <SelectTrigger><SelectValue placeholder="ห้อง" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกห้อง</SelectItem>
              {filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="ชื่อทีม (ไม่บังคับ)" value={team} onChange={(e) => setTeam(e.target.value)} />
        </div>
        <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
          {candidates.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">ไม่มีนักเรียนให้เลือก</div>}
          {candidates.map((s: any) => (
            <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 cursor-pointer text-sm">
              <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
              <span className="font-mono text-xs text-muted-foreground w-20">{s.student_code}</span>
              <span className="flex-1">{formatFullNamePlain(s.prefix, s.first_name, s.last_name)}</span>
              <span className="text-xs text-muted-foreground">{s.classrooms?.name}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={saving || picked.size === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} เพิ่ม {picked.size > 0 ? `(${picked.size})` : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Report tab with details + gallery lightbox ──
const LEVEL_LABEL_RPT: Record<string, string> = {
  school: "โรงเรียน", sub_district: "กลุ่มโรงเรียน/ตำบล", district: "เขต/อำเภอ",
  province: "จังหวัด", region: "ภาค", national: "ประเทศ", international: "นานาชาติ",
};
function ActivityReportTab({ activity }: { activity: Activity }) {
  const gallery: string[] = Array.isArray(activity.gallery_images) ? activity.gallery_images : [];
  const [lightbox, setLightbox] = useState<number | null>(null);
  const live = parseLiveEmbed(activity.live_stream_url);

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );

  const providerLabel: Record<string, string> = {
    youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok", twitch: "Twitch", unknown: "ลิงก์",
  };

  return (
    <div className="space-y-4">
      {live && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-danger animate-pulse" />
              ถ่ายทอดสดผ่าน {providerLabel[live.provider]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {live.embedUrl ? (
              <div className="relative w-full overflow-hidden rounded-md border bg-black" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={live.embedUrl}
                  title="Live stream"
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  frameBorder={0}
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                ไม่สามารถสร้างวีดีโอฝังจากลิงก์นี้ได้
              </div>
            )}
            <a href={live.originalUrl} target="_blank" rel="noreferrer"
              className="text-xs text-primary underline mt-2 inline-block">
              เปิดในแอป/เว็บไซต์ต้นทาง ↗
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">ข้อมูลกิจกรรม</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="ชื่อกิจกรรม" value={activity.title} />
          <Field label="ระดับการแข่งขัน" value={activity.level ? LEVEL_LABEL_RPT[activity.level] || activity.level : null} />
          <Field label="วันที่" value={activity.start_at ? formatDateBE(activity.start_at) : null} />
          <Field label="สถานที่" value={activity.location} />
          <Field label="ครูผู้ดูแล" value={activity.supervisor_teachers} />
          <Field label="งบประมาณ" value={activity.budget ? `${Number(activity.budget).toLocaleString()} บาท` : null} />
          <div className="sm:col-span-2"><Field label="รายชื่อนักเรียนที่เข้าร่วม" value={activity.participant_names} /></div>
          <div className="sm:col-span-2"><Field label="ผลการแข่งขัน" value={activity.result_summary} /></div>
          <div className="sm:col-span-2"><Field label="สรุปรายงานกิจกรรม" value={activity.report_summary} /></div>
          {activity.certificate_url && (
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">เกียรติบัตร</div>
              <a href={activity.certificate_url} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
                เปิดไฟล์เกียรติบัตร
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">แกลเลอรีรูปภาพ ({gallery.length})</CardTitle></CardHeader>
        <CardContent>
          {gallery.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">ยังไม่มีรูปภาพ</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {gallery.map((url, i) => (
                <button key={i} onClick={() => setLightbox(i)}
                  className="aspect-square rounded-md overflow-hidden border hover:opacity-90 transition-opacity">
                  <img src={url} alt={`รูปที่ ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lightbox !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img src={gallery[lightbox]} alt="" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          {lightbox > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-white/10 hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
            >‹</button>
          )}
          {lightbox < gallery.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-3 rounded-full bg-white/10 hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
            >›</button>
          )}
          <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
            {lightbox + 1} / {gallery.length}
          </div>
        </div>
      )}
    </div>
  );
}
