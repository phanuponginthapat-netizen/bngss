import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Play, Trophy, ExternalLink, Send } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { BAND_LABEL, gradeToBand } from "@/lib/gameHubGrade";
import { ALL_GRADE_LEVELS } from "@/lib/gradeOrder";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthSession();
  const qc = useQueryClient();
  const [playing, setPlaying] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [scoreInput, setScoreInput] = useState("");

  const { data: game, isLoading } = useQuery({
    queryKey: ["game-hub-game", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("game_hub_games").select("*").eq("id", id!).maybeSingle();
      return data;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["me-student-for-game", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, classrooms!students_classroom_id_fkey(grade_level)")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["game-hub-scores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("game_hub_scores")
        .select("id, score, duration_sec, played_at, student_id, source")
        .eq("game_id", id!)
        .order("score", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const studentIds = useMemo(() => Array.from(new Set(scores.map((s: any) => s.student_id))), [scores]);
  const { data: studentMap = {} } = useQuery({
    queryKey: ["game-hub-students-map", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_code, classrooms!students_classroom_id_fkey(grade_level, name)")
        .in("id", studentIds);
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => { map[s.id] = s; });
      return map;
    },
  });

  const submitScore = useMutation({
    mutationFn: async (score: number) => {
      if (!me?.id || !user?.id) throw new Error("ต้องเป็นนักเรียนถึงจะบันทึกคะแนนได้");
      const { error } = await supabase.from("game_hub_scores").insert({
        game_id: id!,
        student_id: me.id,
        auth_user_id: user.id,
        score,
        source: "in_app",
      });
      if (error) throw error;
      await supabase
        .from("game_hub_games")
        .update({ play_count: (game?.play_count ?? 0) + 1 })
        .eq("id", id!);
    },
    onSuccess: () => {
      toast.success("บันทึกคะแนนแล้ว");
      setSubmitOpen(false);
      setScoreInput("");
      qc.invalidateQueries({ queryKey: ["game-hub-scores", id] });
    },
    onError: (e: any) => toast.error(e.message || "บันทึกคะแนนไม่สำเร็จ"),
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">กำลังโหลด...</div>;
  if (!game) return <div className="p-4">ไม่พบเกมนี้</div>;

  const myGrade = (me as any)?.classrooms?.grade_level as string | undefined;
  const myBand = gradeToBand(myGrade);

  const leaderboardByBand = (band: string | "all") => {
    const rows = scores.filter((s: any) => {
      if (band === "all") return true;
      const stu = studentMap[s.student_id];
      const g = stu?.classrooms?.grade_level;
      return gradeToBand(g) === band;
    });
    // top score per student
    const best = new Map<string, any>();
    for (const r of rows) {
      const cur = best.get(r.student_id);
      if (!cur || Number(r.score) > Number(cur.score)) best.set(r.student_id, r);
    }
    return Array.from(best.values()).sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 20);
  };

  const play = () => {
    if (game.type === "external_link" && game.url) {
      window.open(game.url, "_blank", "noopener,noreferrer");
      setPlaying(true);
    } else if (game.type === "embed") {
      setPlaying(true);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/dashboard/games"><ArrowLeft className="w-4 h-4 mr-1" />กลับคลังเกม</Link></Button>

      <Card>
        <div className="grid md:grid-cols-[320px_minmax(0,1fr)] gap-4">
          <div className="aspect-[16/10] md:aspect-auto md:h-full bg-muted">
            {game.cover_url ? <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Trophy className="w-12 h-12 text-muted-foreground" /></div>}
          </div>
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {game.type === "external_link" && <Badge variant="outline"><ExternalLink className="w-3 h-3 mr-1" />ลิงก์ภายนอก</Badge>}
              {game.type === "embed" && <Badge variant="outline">ฝังในระบบ</Badge>}
              {(game.tags || []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
            <h1 className="text-2xl font-bold">{game.title}</h1>
            {game.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{game.description}</p>}
            <div className="text-xs text-muted-foreground">
              ช่วงชั้น: {game.min_grade != null ? ALL_GRADE_LEVELS[game.min_grade] : "-"} ถึง {game.max_grade != null ? ALL_GRADE_LEVELS[game.max_grade] : "-"}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={play}><Play className="w-4 h-4 mr-1" />เริ่มเล่น</Button>
              {playing && me?.id && (
                <Button variant="outline" onClick={() => setSubmitOpen(true)}><Send className="w-4 h-4 mr-1" />ส่งคะแนน</Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {playing && game.type === "embed" && game.embed_code && (
        <Card>
          <CardHeader><CardTitle className="text-base">เล่นเกม</CardTitle></CardHeader>
          <CardContent>
            <div className="w-full aspect-video rounded-lg overflow-hidden border bg-black">
              {/* If it's raw HTML/iframe code — render in sandboxed iframe via srcdoc */}
              <iframe
                title={game.title}
                srcDoc={game.embed_code}
                sandbox="allow-scripts allow-forms allow-same-origin"
                className="w-full h-full"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" />อันดับคะแนน</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={myBand !== "unknown" ? myBand : "all"}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="primary_early">{BAND_LABEL.primary_early}</TabsTrigger>
              <TabsTrigger value="primary_late">{BAND_LABEL.primary_late}</TabsTrigger>
              <TabsTrigger value="secondary_lower">{BAND_LABEL.secondary_lower}</TabsTrigger>
              <TabsTrigger value="secondary_upper">{BAND_LABEL.secondary_upper}</TabsTrigger>
            </TabsList>
            {(["all", "primary_early", "primary_late", "secondary_lower", "secondary_upper"] as const).map((b) => (
              <TabsContent value={b} key={b}>
                <LeaderboardTable rows={leaderboardByBand(b)} studentMap={studentMap} myStudentId={me?.id} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>บันทึกคะแนนของฉัน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>คะแนนที่ได้</Label>
            <Input type="number" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} placeholder="เช่น 85" />
            <p className="text-xs text-muted-foreground">ระบบจะเก็บคะแนนสูงสุดของแต่ละคนไว้แข่งขันในบอร์ด</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>ยกเลิก</Button>
            <Button
              disabled={submitScore.isPending || !scoreInput}
              onClick={() => {
                const n = Number(scoreInput);
                if (!Number.isFinite(n)) { toast.error("กรอกคะแนนเป็นตัวเลข"); return; }
                submitScore.mutate(n);
              }}
            >บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaderboardTable({ rows, studentMap, myStudentId }: { rows: any[]; studentMap: Record<string, any>; myStudentId?: string }) {
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีคะแนนในช่วงชั้นนี้</div>;
  return (
    <div className="divide-y">
      {rows.map((r, i) => {
        const stu = studentMap[r.student_id];
        const isMe = myStudentId && r.student_id === myStudentId;
        return (
          <div key={r.id} className={`flex items-center gap-3 py-2 ${isMe ? "bg-primary/5" : ""}`}>
            <div className={`w-8 text-center font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {stu ? `${stu.first_name || ""} ${stu.last_name || ""}`.trim() : r.student_id.slice(0, 8)}
                {isMe && <Badge variant="secondary" className="ml-2 text-[10px]">คุณ</Badge>}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {stu?.classrooms?.grade_level || "-"} {stu?.classrooms?.name || ""} · {new Date(r.played_at).toLocaleDateString("th-TH")}
              </div>
            </div>
            <div className="text-lg font-bold">{Number(r.score).toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}
