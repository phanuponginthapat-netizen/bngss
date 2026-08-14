import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Trophy, Users, GitBranch, ListOrdered, ScrollText, Award, Save, Shuffle, Plus, Trash2,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDateBE } from "@/lib/dateBE";
import { categoryLabel } from "@/lib/competitionRules";
import { singleElimination, roundRobin, groupStage, roundsFor, roundLabel, BRACKET_TYPES } from "@/lib/bracket";

const db = supabase as any;

const personName = (p: any) =>
  p?.students
    ? `${p.students.prefix || ""}${p.students.first_name || ""} ${p.students.last_name || ""}`.trim()
    : p?.team_name || "-";

export default function ActivityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useUserRole();
  const canManage = ["admin", "director", "teacher"].includes(role || "");
  const [newTeam, setNewTeam] = useState("");

  const { data: activity } = useQuery({
    queryKey: ["activity", id],
    enabled: !!id,
    queryFn: async () => (await db.from("activities").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["activity_participants", id],
    enabled: !!id,
    queryFn: async () =>
      (await db.from("activity_participants")
        .select("id, team_name, group_name, seed, bib_no, student_id, students(prefix, first_name, last_name, classrooms(name))")
        .eq("activity_id", id)).data || [],
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["activity_matches", id],
    enabled: !!id,
    queryFn: async () =>
      (await db.from("activity_matches").select("*").eq("activity_id", id)
        .order("round").order("match_no")).data || [],
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["activity_scores", id],
    enabled: !!id,
    queryFn: async () =>
      (await db.from("activity_scores").select("*").eq("activity_id", id)).data || [],
  });

  const nameOf = (pid?: string | null) => {
    if (!pid) return "-";
    const p = participants.find((x: any) => x.id === pid);
    return p ? personName(p) : "-";
  };

  const totalRounds = useMemo(
    () => Math.max(1, ...matches.map((m: any) => m.round || 1)),
    [matches],
  );

  const generate = async () => {
    if (participants.length < 2) return toast.error("ต้องมีผู้เข้าแข่งขันอย่างน้อย 2 รายการ");
    const entries = participants.map((p: any) => ({ id: p.id, name: personName(p), seed: p.seed }));
    const type = activity?.bracket_type || "single_elim";
    let generated: any[] = [];
    let groupAssign: { id: string; group: string }[] = [];
    if (type === "round_robin") generated = roundRobin(entries);
    else if (type === "group_knockout") {
      const g = groupStage(entries, activity?.group_count || 2);
      generated = g.matches;
      Object.entries(g.groups).forEach(([name, list]) =>
        list.forEach((e) => groupAssign.push({ id: e.id, group: name })));
    } else generated = singleElimination(entries);

    if (!generated.length) return toast.error("สร้างสายไม่สำเร็จ");
    await db.from("activity_matches").delete().eq("activity_id", id);
    const { error } = await db.from("activity_matches").insert(
      generated.map((m) => ({ ...m, activity_id: id, status: "pending" })),
    );
    if (error) return toast.error(error.message);
    for (const g of groupAssign) {
      await db.from("activity_participants").update({ group_name: `สาย ${g.group}` }).eq("id", g.id);
    }
    qc.invalidateQueries({ queryKey: ["activity_matches", id] });
    qc.invalidateQueries({ queryKey: ["activity_participants", id] });
    toast.success(`จัดสายแล้ว ${generated.length} คู่`);
  };

  const saveMatch = async (m: any, patch: any) => {
    const { error } = await db.from("activity_matches").update(patch).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["activity_matches", id] });
  };

  const finishMatch = async (m: any) => {
    const a = Number(m.score_a ?? 0), b = Number(m.score_b ?? 0);
    const winner = a === b ? null : a > b ? m.participant_a_id : m.participant_b_id;
    if (!winner) return toast.error("คะแนนเสมอกัน ไม่สามารถสรุปผู้ชนะได้");
    await saveMatch(m, { winner_id: winner, status: "finished" });
    // เลื่อนผู้ชนะไปรอบถัดไป (เฉพาะแพ้คัดออก)
    if ((activity?.bracket_type || "single_elim") === "single_elim") {
      const next = matches.find((x: any) => x.round === m.round + 1
        && x.match_no === Math.min(...matches.filter((y: any) => y.round === m.round + 1).map((y: any) => y.match_no))
          + Math.floor((m.match_no - Math.min(...matches.filter((y: any) => y.round === m.round).map((y: any) => y.match_no))) / 2));
      if (next) {
        const slot = (m.match_no % 2 === 1) ? "participant_a_id" : "participant_b_id";
        await db.from("activity_matches").update({ [slot]: winner }).eq("id", next.id);
      }
    }
    qc.invalidateQueries({ queryKey: ["activity_matches", id] });
    toast.success("บันทึกผลแล้ว");
  };

  const setScore = async (pid: string, patch: any) => {
    const existing = scores.find((s: any) => s.participant_id === pid);
    const { data: u } = await supabase.auth.getUser();
    const q = existing
      ? db.from("activity_scores").update(patch).eq("id", existing.id)
      : db.from("activity_scores").insert({ activity_id: id, participant_id: pid, judge_id: u?.user?.id, ...patch });
    const { error } = await q;
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["activity_scores", id] });
  };

  const addTeam = async () => {
    if (!newTeam.trim()) return;
    const { error } = await db.from("activity_participants").insert({ activity_id: id, team_name: newTeam.trim() });
    if (error) return toast.error(error.message);
    setNewTeam("");
    qc.invalidateQueries({ queryKey: ["activity_participants", id] });
  };

  const removeParticipant = async (pid: string) => {
    const { error } = await db.from("activity_participants").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["activity_participants", id] });
  };

  if (!activity) return <div className="p-6 text-muted-foreground">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" /> {activity.title}
          </h1>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground items-center">
            <Badge variant="secondary">{categoryLabel(activity.category)}</Badge>
            {activity.start_at && <span>{formatDateBE(activity.start_at)}</span>}
            {activity.location && <span>· {activity.location}</span>}
            <Badge variant="outline">
              {BRACKET_TYPES.find((b) => b.value === activity.bracket_type)?.label || "ตัดสินด้วยคะแนน"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/certificates/print")}>
          <Award className="w-4 h-4 mr-1" /> ออกเกียรติบัตร
        </Button>
      </div>

      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="participants" className="gap-1.5"><Users className="w-3.5 h-3.5" /> ผู้เข้าร่วม</TabsTrigger>
          <TabsTrigger value="bracket" className="gap-1.5"><GitBranch className="w-3.5 h-3.5" /> สายการแข่งขัน</TabsTrigger>
          <TabsTrigger value="scores" className="gap-1.5"><ListOrdered className="w-3.5 h-3.5" /> คะแนน/อันดับ</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><ScrollText className="w-3.5 h-3.5" /> กติกา</TabsTrigger>
        </TabsList>

        <TabsContent value="participants">
          <Card><CardContent className="p-4 space-y-3">
            {canManage && (
              <div className="flex gap-2">
                <Input placeholder="เพิ่มทีม/สี/หน่วยแข่งขัน" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />
                <Button onClick={addTeam}><Plus className="w-4 h-4 mr-1" /> เพิ่ม</Button>
              </div>
            )}
            <div className="divide-y border rounded-md">
              {participants.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-2 p-2 text-sm">
                  <span className="w-6 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1">{personName(p)}</span>
                  {p.students?.classrooms?.name && <Badge variant="outline" className="text-[10px]">{p.students.classrooms.name}</Badge>}
                  {p.group_name && <Badge className="text-[10px]">{p.group_name}</Badge>}
                  {canManage && (
                    <>
                      <Input className="w-20 h-8" type="number" placeholder="มือวาง" defaultValue={p.seed ?? ""}
                        onBlur={async (e) => {
                          await db.from("activity_participants").update({ seed: e.target.value ? Number(e.target.value) : null }).eq("id", p.id);
                          qc.invalidateQueries({ queryKey: ["activity_participants", id] });
                        }} />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeParticipant(p.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {participants.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">ยังไม่มีผู้สมัคร</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bracket">
          <Card><CardContent className="p-4 space-y-3">
            {canManage && (
              <Button onClick={generate}><Shuffle className="w-4 h-4 mr-1" /> จัด/สุ่มสายการแข่งขันใหม่</Button>
            )}
            {matches.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่ได้จัดสาย</p>}
            <div className="space-y-4">
              {Array.from(new Set(matches.map((m: any) => m.round))).map((round: any) => (
                <div key={round}>
                  <h3 className="font-semibold text-sm mb-2">
                    {(activity.bracket_type === "single_elim")
                      ? roundLabel(round, totalRounds)
                      : `รอบที่ ${round}`}
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {matches.filter((m: any) => m.round === round).map((m: any) => (
                      <div key={m.id} className="border rounded-md p-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>คู่ที่ {m.match_no}{m.bracket_slot ? ` · ${m.bracket_slot}` : ""}</span>
                          <Badge variant={m.status === "finished" ? "default" : "outline"} className="text-[10px]">
                            {m.status === "finished" ? "จบแล้ว" : "รอแข่ง"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`flex-1 ${m.winner_id === m.participant_a_id ? "font-bold text-primary" : ""}`}>{nameOf(m.participant_a_id)}</span>
                          {canManage ? (
                            <Input className="w-16 h-8" type="number" defaultValue={m.score_a ?? ""}
                              onBlur={(e) => saveMatch(m, { score_a: e.target.value === "" ? null : Number(e.target.value) })} />
                          ) : <span className="w-8 text-right">{m.score_a ?? "-"}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`flex-1 ${m.winner_id === m.participant_b_id ? "font-bold text-primary" : ""}`}>{nameOf(m.participant_b_id)}</span>
                          {canManage ? (
                            <Input className="w-16 h-8" type="number" defaultValue={m.score_b ?? ""}
                              onBlur={(e) => saveMatch(m, { score_b: e.target.value === "" ? null : Number(e.target.value) })} />
                          ) : <span className="w-8 text-right">{m.score_b ?? "-"}</span>}
                        </div>
                        {canManage && (
                          <div className="flex gap-2 pt-1">
                            <Input className="h-8 flex-1" placeholder="สนาม/คอร์ท" defaultValue={m.court || ""}
                              onBlur={(e) => saveMatch(m, { court: e.target.value || null })} />
                            <Button size="sm" onClick={() => finishMatch(m)}><Save className="w-3.5 h-3.5 mr-1" /> สรุปผล</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="scores">
          <Card><CardContent className="p-4">
            <div className="divide-y border rounded-md">
              {participants.map((p: any) => {
                const sc = scores.find((s: any) => s.participant_id === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 p-2 text-sm">
                    <span className="flex-1">{personName(p)}</span>
                    {canManage ? (
                      <>
                        <Input className="w-24 h-8" type="number" placeholder="คะแนน" defaultValue={sc?.score ?? ""}
                          onBlur={(e) => setScore(p.id, { score: e.target.value === "" ? null : Number(e.target.value) })} />
                        <Input className="w-20 h-8" type="number" placeholder="อันดับ" defaultValue={sc?.rank ?? ""}
                          onBlur={(e) => setScore(p.id, { rank: e.target.value === "" ? null : Number(e.target.value) })} />
                      </>
                    ) : (
                      <>
                        <Badge variant="outline">{sc?.score ?? "-"} คะแนน</Badge>
                        {sc?.rank && <Badge>อันดับ {sc.rank}</Badge>}
                      </>
                    )}
                  </div>
                );
              })}
              {participants.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">ยังไม่มีผู้เข้าร่วม</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card><CardContent className="p-4 space-y-2">
            {canManage ? (
              <>
                <Label className="text-xs">กติกาการแข่งขัน</Label>
                <Textarea rows={14} defaultValue={activity.rules || ""}
                  onBlur={async (e) => {
                    const { error } = await db.from("activities").update({ rules: e.target.value }).eq("id", id);
                    if (error) toast.error(error.message); else toast.success("บันทึกกติกาแล้ว");
                  }} />
              </>
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-sans">{activity.rules || "ยังไม่ได้กำหนดกติกา"}</pre>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
