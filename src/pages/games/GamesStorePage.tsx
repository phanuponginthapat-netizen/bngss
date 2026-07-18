import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Search, Play, Trophy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { gradeToBand, BAND_LABEL, gradeInRange } from "@/lib/gameHubGrade";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ALL_GRADE_LEVELS } from "@/lib/gradeOrder";

export default function GamesStorePage() {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<string>("all");
  const { user } = useAuthSession();

  const { data: myStudent } = useQuery({
    queryKey: ["me-student-grade", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, classrooms!students_classroom_id_fkey(grade_level)")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      const grade = (data as any)?.classrooms?.grade_level ?? null;
      return { id: (data as any)?.id ?? null, grade };
    },
  });

  const { data: games = [], isLoading } = useQuery({
    queryKey: ["game-hub-store"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_hub_games")
        .select("id,title,description,cover_url,type,url,min_grade,max_grade,tags,play_count,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return games.filter((g: any) => {
      if (query && !`${g.title} ${g.description || ""} ${(g.tags || []).join(" ")}`.toLowerCase().includes(query)) return false;
      if (band !== "all") {
        // Show if game covers user's band, or if band selected filter matches game grade range using rank of first grade in band
        const bandGradeMap: Record<string, string> = {
          primary_early: "ป.2",
          primary_late: "ป.5",
          secondary_lower: "ม.2",
          secondary_upper: "ม.5",
          kinder: "อ.2",
        };
        const rep = bandGradeMap[band];
        if (rep && !gradeInRange(rep, g.min_grade, g.max_grade)) return false;
      }
      return true;
    });
  }, [games, q, band]);

  const recommended = useMemo(() => {
    if (!myStudent?.grade) return [];
    return games.filter((g: any) => gradeInRange(myStudent.grade, g.min_grade, g.max_grade)).slice(0, 6);
  }, [games, myStudent?.grade]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shadow">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Game Hub</h1>
            <p className="text-sm text-muted-foreground">คลังเกม/บทเรียนโต้ตอบ แยกตามช่วงชั้น</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/games/admin">จัดการเกม</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อเกม / แท็ก" className="pl-10" />
          </div>
          <Select value={band} onValueChange={setBand}>
            <SelectTrigger className="w-56"><SelectValue placeholder="ช่วงชั้น" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกช่วงชั้น</SelectItem>
              <SelectItem value="kinder">{BAND_LABEL.kinder}</SelectItem>
              <SelectItem value="primary_early">{BAND_LABEL.primary_early}</SelectItem>
              <SelectItem value="primary_late">{BAND_LABEL.primary_late}</SelectItem>
              <SelectItem value="secondary_lower">{BAND_LABEL.secondary_lower}</SelectItem>
              <SelectItem value="secondary_upper">{BAND_LABEL.secondary_upper}</SelectItem>
            </SelectContent>
          </Select>
          {myStudent?.grade && (
            <Badge variant="secondary">ระดับชั้นของฉัน: {myStudent.grade} ({BAND_LABEL[gradeToBand(myStudent.grade)]})</Badge>
          )}
        </CardContent>
      </Card>

      {recommended.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">แนะนำสำหรับคุณ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map((g: any) => <GameCard key={g.id} game={g} />)}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">เกมทั้งหมด ({filtered.length})</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">ยังไม่มีเกมในหมวดนี้</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((g: any) => <GameCard key={g.id} game={g} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function GameCard({ game }: { game: any }) {
  const bandLabel = (() => {
    if (game.min_grade == null && game.max_grade == null) return "ทุกช่วงชั้น";
    const from = game.min_grade != null ? gradeLabelFromRank(game.min_grade) : "-";
    const to = game.max_grade != null ? gradeLabelFromRank(game.max_grade) : "-";
    return `${from} — ${to}`;
  })();
  return (
    <Link to={`/dashboard/games/${game.id}`} className="group">
      <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
        <div className="aspect-[16/10] bg-muted overflow-hidden">
          {game.cover_url ? (
            <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Gamepad2 className="w-12 h-12" />
            </div>
          )}
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-base line-clamp-1">{game.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {game.description && <p className="text-xs text-muted-foreground line-clamp-2">{game.description}</p>}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">{bandLabel}</Badge>
            {game.type === "external_link" && <Badge variant="outline" className="text-[10px]"><ExternalLink className="w-3 h-3 mr-1" />ลิงก์ภายนอก</Badge>}
            <Badge variant="secondary" className="text-[10px]"><Trophy className="w-3 h-3 mr-1" />{game.play_count || 0}</Badge>
          </div>
          <Button size="sm" className="w-full mt-2"><Play className="w-3.5 h-3.5 mr-1" />เล่น</Button>
        </CardContent>
      </Card>
    </Link>
  );
}

function gradeLabelFromRank(rank: number): string {
  return ALL_GRADE_LEVELS[rank] || String(rank);
}
