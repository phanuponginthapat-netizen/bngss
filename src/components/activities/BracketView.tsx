import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shuffle, Trophy, Calendar, MapPin, Megaphone, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { formatFullNamePlain } from "@/lib/nameFormat";
import { formatDateBE } from "@/lib/dateBE";

type Match = {
  id: string;
  activity_id: string;
  round: number;
  match_no: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  status: string;
  scheduled_at?: string | null;
  court?: string | null;
};
type Participant = {
  id: string;
  student?: { prefix: string | null; first_name: string | null; last_name: string | null } | null;
  team_name: string | null;
};

export function BracketView({
  activityId, participants, matches, canManage, onChanged, activityTitle,
}: {
  activityId: string;
  participants: Participant[];
  matches: Match[];
  canManage: boolean;
  onChanged: () => void;
  activityTitle?: string;
}) {
  const [drawing, setDrawing] = useState(false);
  const [posting, setPosting] = useState(false);
  const fixtureRef = useRef<HTMLDivElement>(null);

  const byRound = useMemo(() => {
    const map = new Map<number, Match[]>();
    matches.forEach((m) => {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round)!.push(m);
    });
    map.forEach((arr) => arr.sort((a, b) => a.match_no - b.match_no));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const partMap = useMemo(() => {
    const m = new Map<string, Participant>();
    participants.forEach((p) => m.set(p.id, p));
    return m;
  }, [participants]);

  const labelOf = (pid: string | null) => {
    if (!pid) return "—";
    const p = partMap.get(pid);
    if (!p) return "—";
    return p.team_name ||
      formatFullNamePlain(p.student?.prefix, p.student?.first_name, p.student?.last_name) ||
      "ผู้เข้าร่วม";
  };

  const drawBracket = async () => {
    if (participants.length < 2) return toast.error("ต้องมีผู้เข้าร่วมอย่างน้อย 2 คน");
    if (!confirm("จับฉลากใหม่จะลบสายเดิมทั้งหมด ดำเนินการต่อ?")) return;
    setDrawing(true);
    try {
      await (supabase as any).from("activity_matches").delete().eq("activity_id", activityId);
      const arr = [...participants];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      let size = 1;
      while (size < arr.length) size *= 2;
      const padded: (Participant | null)[] = [...arr];
      while (padded.length < size) padded.push(null);
      const totalRounds = Math.log2(size);
      const rows: any[] = [];
      let prevWinners: (string | null)[] = [];
      for (let i = 0; i < size; i += 2) {
        const a = padded[i];
        const b = padded[i + 1];
        const winner = a && !b ? a.id : !a && b ? b.id : null;
        rows.push({
          activity_id: activityId, round: 1, match_no: i / 2 + 1,
          participant_a_id: a?.id ?? null, participant_b_id: b?.id ?? null,
          winner_id: winner, status: winner ? "completed" : "pending",
        });
        prevWinners.push(winner);
      }
      for (let r = 2; r <= totalRounds; r++) {
        const count = size / Math.pow(2, r);
        const nextWinners: (string | null)[] = [];
        for (let i = 0; i < count; i++) {
          const a = prevWinners[i * 2] ?? null;
          const b = prevWinners[i * 2 + 1] ?? null;
          const winner = a && !b ? a : !a && b ? b : null;
          rows.push({
            activity_id: activityId, round: r, match_no: i + 1,
            participant_a_id: a, participant_b_id: b,
            winner_id: winner, status: winner ? "completed" : "pending",
          });
          nextWinners.push(winner);
        }
        prevWinners = nextWinners;
      }
      const { error } = await (supabase as any).from("activity_matches").insert(rows);
      if (error) throw error;
      toast.success("จับฉลากเรียบร้อย");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "จับฉลากไม่สำเร็จ");
    } finally {
      setDrawing(false);
    }
  };

  const saveScore = async (m: Match, scoreA: string, scoreB: string) => {
    const sa = scoreA === "" ? null : Number(scoreA);
    const sb = scoreB === "" ? null : Number(scoreB);
    let winner: string | null = null;
    let status = "pending";
    if (sa != null && sb != null && m.participant_a_id && m.participant_b_id) {
      if (sa > sb) winner = m.participant_a_id;
      else if (sb > sa) winner = m.participant_b_id;
      status = winner ? "completed" : "pending";
    }
    const { error } = await (supabase as any).from("activity_matches")
      .update({ score_a: sa, score_b: sb, winner_id: winner, status })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    if (winner) {
      const nextRound = m.round + 1;
      const nextMatchNo = Math.ceil(m.match_no / 2);
      const slot = m.match_no % 2 === 1 ? "participant_a_id" : "participant_b_id";
      const next = matches.find((x) => x.round === nextRound && x.match_no === nextMatchNo);
      if (next) {
        await (supabase as any).from("activity_matches").update({ [slot]: winner }).eq("id", next.id);
      }
    }
    onChanged();
  };

  const saveSchedule = async (m: Match, scheduled_at: string | null, court: string | null) => {
    const { error } = await (supabase as any).from("activity_matches")
      .update({ scheduled_at, court }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("บันทึกตารางแข่งแล้ว");
    onChanged();
  };

  const shareFixture = async (target: "feed" | "news") => {
    if (!fixtureRef.current) return;
    setPosting(true);
    try {
      const canvas = await html2canvas(fixtureRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), "image/png"));
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user?.id}/activities/${activityId}/fixture-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("wall-media")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = await supabase.storage.from("wall-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      const detailLink = `${window.location.origin}/dashboard/activities/${activityId}`;
      const caption = `📅 โปรแกรมการแข่งขัน: ${activityTitle || ""}\nดูรายละเอียดและเวลาแข่งทั้งหมด → ${detailLink}`;
      if (target === "feed") {
        const { error: wpErr } = await (supabase as any).from("wall_posts")
          .insert({ author_id: user?.id, content: caption, media_urls: [path] });
        if (wpErr) throw wpErr;
        toast.success("ยิงโปรแกรมแข่งไปฟีดแล้ว");
      } else {
        const { error: nErr } = await (supabase as any).from("news_posts").insert({
          title: `โปรแกรมการแข่งขัน: ${activityTitle || ""}`,
          content: caption,
          category: "activity",
          cover_image_url: pub?.signedUrl || "",
          link_url: detailLink,
          is_published: true,
          published_at: new Date().toISOString(),
          author_id: user?.id,
        });
        if (nErr) throw nErr;
        toast.success("เพิ่มในข่าวล่าสุดแล้ว");
      }
    } catch (e: any) {
      toast.error(e.message || "ส่งไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div className="text-sm text-muted-foreground">
            ผู้เข้าร่วม {participants.length} คน • {matches.length} แมตช์ • {byRound.length} รอบ
          </div>
          <div className="flex gap-2 flex-wrap">
            {matches.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => shareFixture("feed")} disabled={posting} className="gap-2">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                  ยิงโปรแกรมแข่ง → ฟีด
                </Button>
                <Button size="sm" variant="outline" onClick={() => shareFixture("news")} disabled={posting} className="gap-2">
                  <Newspaper className="w-4 h-4" /> ยิง → ข่าวล่าสุด
                </Button>
              </>
            )}
            <Button onClick={drawBracket} disabled={drawing || participants.length < 2} className="gap-2">
              {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              จับฉลาก{matches.length > 0 ? "ใหม่" : ""}
            </Button>
          </div>
        </div>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-md">
          ยังไม่มีสายการแข่งขัน {canManage && "— กดปุ่ม “จับฉลาก” เพื่อสร้าง"}
        </div>
      ) : (
        <div ref={fixtureRef} className="overflow-x-auto pb-3 bg-background p-4 rounded-lg">
          {activityTitle && (
            <div className="text-center mb-3 pb-2 border-b">
              <div className="text-xs text-muted-foreground">โปรแกรมการแข่งขัน</div>
              <div className="text-lg font-bold">{activityTitle}</div>
            </div>
          )}
          <div className="flex gap-6 min-w-max">
            {byRound.map(([round, list]) => (
              <div key={round} className="flex flex-col justify-around gap-4 min-w-[260px]">
                <Badge variant="secondary" className="self-start">
                  รอบที่ {round}{round === byRound.length ? " (ชิงชนะเลิศ)" : ""}
                </Badge>
                {list.map((m) => (
                  <MatchCard
                    key={m.id} m={m} labelOf={labelOf} canManage={canManage}
                    onSave={saveScore} onSaveSchedule={saveSchedule}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ m, labelOf, canManage, onSave, onSaveSchedule }: {
  m: Match;
  labelOf: (id: string | null) => string;
  canManage: boolean;
  onSave: (m: Match, a: string, b: string) => void;
  onSaveSchedule: (m: Match, dt: string | null, court: string | null) => void;
}) {
  const [sa, setSa] = useState(m.score_a?.toString() ?? "");
  const [sb, setSb] = useState(m.score_b?.toString() ?? "");
  const [scheduledAt, setScheduledAt] = useState(m.scheduled_at ? m.scheduled_at.slice(0, 16) : "");
  const [court, setCourt] = useState(m.court ?? "");
  const [editSched, setEditSched] = useState(false);
  const aWon = m.winner_id && m.winner_id === m.participant_a_id;
  const bWon = m.winner_id && m.winner_id === m.participant_b_id;

  return (
    <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
      {(m.scheduled_at || m.court) && !editSched && (
        <div className="px-3 py-1.5 bg-primary/5 text-[11px] flex items-center justify-between gap-2 border-b">
          <div className="flex items-center gap-2 text-primary">
            {m.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDateBE(m.scheduled_at)} {new Date(m.scheduled_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            )}
            {m.court && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.court}</span>}
          </div>
          {canManage && (
            <button className="text-[10px] underline" onClick={() => setEditSched(true)}>แก้ไข</button>
          )}
        </div>
      )}
      {canManage && (editSched || (!m.scheduled_at && !m.court)) && (
        <div className="px-2 py-1.5 bg-muted/30 border-b space-y-1.5">
          <div className="flex gap-1">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-7 text-xs flex-1" />
            <Input placeholder="สนาม" value={court} onChange={(e) => setCourt(e.target.value)} className="h-7 text-xs w-20" />
          </div>
          <div className="flex justify-end gap-1">
            {editSched && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditSched(false)}>ยกเลิก</Button>
            )}
            <Button size="sm" variant="secondary" className="h-6 text-[10px]"
              onClick={() => { onSaveSchedule(m, scheduledAt ? new Date(scheduledAt).toISOString() : null, court || null); setEditSched(false); }}>
              บันทึกเวลา
            </Button>
          </div>
        </div>
      )}
      <Row name={labelOf(m.participant_a_id)} score={sa} setScore={setSa}
        won={!!aWon} canManage={canManage && !!m.participant_a_id && !!m.participant_b_id} />
      <div className="h-px bg-border" />
      <Row name={labelOf(m.participant_b_id)} score={sb} setScore={setSb}
        won={!!bWon} canManage={canManage && !!m.participant_a_id && !!m.participant_b_id} />
      {canManage && m.participant_a_id && m.participant_b_id && (
        <div className="px-2 py-1.5 bg-muted/40 flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSave(m, sa, sb)}>
            บันทึก
          </Button>
        </div>
      )}
      {m.status === "completed" && (
        <div className="px-2 py-1 bg-success/10 text-[10px] text-success flex items-center gap-1">
          <Trophy className="w-3 h-3" /> ตัดสินแล้ว
        </div>
      )}
    </div>
  );
}

function Row({ name, score, setScore, won, canManage }: {
  name: string; score: string; setScore: (v: string) => void; won: boolean; canManage: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${won ? "bg-success/10 font-semibold" : ""}`}>
      <span className="flex-1 truncate text-sm">{name}</span>
      {canManage ? (
        <Input value={score} onChange={(e) => setScore(e.target.value)}
          inputMode="decimal" className="w-16 h-8 text-center" />
      ) : (
        <span className="w-16 text-center text-sm tabular-nums">{score || "—"}</span>
      )}
    </div>
  );
}
