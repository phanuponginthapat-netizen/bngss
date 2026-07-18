import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Trophy, Award, Crown, Medal, Sparkles } from "lucide-react";

type Badge = {
  id: string; code: string; name: string; description: string | null;
  icon: string; tier: string; criteria_type: string; criteria_value: number;
};

const tierStyle: Record<string, string> = {
  bronze: "from-orange-500/20 to-orange-700/20 border-orange-500/40 text-orange-200",
  silver: "from-slate-300/20 to-slate-500/20 border-slate-400/40 text-slate-200",
  gold: "from-amber-400/20 to-yellow-600/20 border-amber-400/40 text-amber-200",
  platinum: "from-cyan-300/20 to-blue-500/20 border-cyan-400/40 text-cyan-100",
  diamond: "from-fuchsia-400/20 to-purple-600/20 border-fuchsia-400/40 text-fuchsia-100",
};

const tierLabel: Record<string, string> = {
  bronze: "ทองแดง", silver: "เงิน", gold: "ทอง", platinum: "แพลทินัม", diamond: "เพชร",
};

export default function GarbageAchievementsPage() {
  const { user, isReady } = useAuthSession();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());
  const [classroomLeaderboard, setClassroomLeaderboard] = useState<any[]>([]);
  const [studentLeaderboard, setStudentLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        // โหลด badges
        const { data: bd } = await supabase
          .from("garbage_badges")
          .select("*")
          .eq("is_active", true)
          .order("criteria_value", { ascending: true });
        setBadges((bd as any) || []);

        // หา holder ปัจจุบัน → ดู earned
        if (user) {
          const { data: s } = await supabase.from("students").select("id").eq("auth_user_id", user.id).maybeSingle();
          const { data: pr } = await supabase.from("personnel").select("id").eq("user_id", user.id).maybeSingle();
          if (s || pr) {
            let q = supabase.from("garbage_user_badges").select("badge_id");
            if (s) q = q.eq("student_id", (s as any).id);
            else if (pr) q = q.eq("personnel_id", (pr as any).id);
            const { data: ub } = await q;
            setEarnedBadgeIds(new Set(((ub as any) || []).map((x: any) => x.badge_id)));
          } else {
            setEarnedBadgeIds(new Set());
          }
        }

        // Top นักเรียน (10)
        const { data: tops } = await supabase
          .from("garbage_student_points")
          .select("total_points, students(prefix, first_name, last_name, student_code, classroom_id, classrooms!students_classroom_id_fkey(name))")
          .order("total_points", { ascending: false })
          .limit(10);
        setStudentLeaderboard(((tops as any) || []).filter((x: any) => x.students));

        // Leaderboard ห้องเรียน — รวมแต้มต่อห้อง
        const { data: allPts } = await supabase
          .from("garbage_student_points")
          .select("total_points, students(classroom_id, classrooms!students_classroom_id_fkey(name))");
        const byClass: Record<string, { name: string; total: number; count: number }> = {};
        ((allPts as any) || []).forEach((row: any) => {
          const cid = row.students?.classroom_id;
          const cname = row.students?.classrooms?.name;
          if (!cid || !cname) return;
          if (!byClass[cid]) byClass[cid] = { name: cname, total: 0, count: 0 };
          byClass[cid].total += row.total_points || 0;
          byClass[cid].count += 1;
        });
        const arr = Object.values(byClass).sort((a, b) => b.total - a.total).slice(0, 10);
        setClassroomLeaderboard(arr);
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, user?.id]);

  const grouped = useMemo(() => {
    const g: Record<string, Badge[]> = { bronze: [], silver: [], gold: [], platinum: [], diamond: [] };
    badges.forEach((b) => g[b.tier]?.push(b));
    return g;
  }, [badges]);

  const earnedCount = earnedBadgeIds.size;

  return (
    <div className="space-y-6 p-2 md:p-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-7 h-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">เหรียญตรา & อันดับ</h1>
          <p className="text-sm text-muted-foreground">สะสมเหรียญตราจากการฝากขยะและไต่อันดับห้องเรียน</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-700/5 border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="w-10 h-10 text-amber-400" />
            <div>
              <div className="text-3xl font-bold text-amber-300">{earnedCount}</div>
              <div className="text-xs text-muted-foreground">เหรียญที่ได้รับ / {badges.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-700/5 border-emerald-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Crown className="w-10 h-10 text-emerald-400" />
            <div>
              <div className="text-3xl font-bold text-emerald-300">{classroomLeaderboard[0]?.name || "-"}</div>
              <div className="text-xs text-muted-foreground">ห้องอันดับ 1</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-fuchsia-500/10 to-purple-700/5 border-fuchsia-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Medal className="w-10 h-10 text-fuchsia-400" />
            <div>
              <div className="text-3xl font-bold text-fuchsia-200">
                {studentLeaderboard[0] ? `${(studentLeaderboard[0].students?.first_name || "")} ${(studentLeaderboard[0].students?.last_name || "")}` : "-"}
              </div>
              <div className="text-xs text-muted-foreground">นักเรียนแต้มสูงสุด</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="badges">
        <TabsList>
          <TabsTrigger value="badges">เหรียญตรา</TabsTrigger>
          <TabsTrigger value="classroom">อันดับห้องเรียน</TabsTrigger>
          <TabsTrigger value="students">อันดับนักเรียน</TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="space-y-6 pt-4">
          {(["bronze", "silver", "gold", "platinum", "diamond"] as const).map((tier) => (
            grouped[tier].length > 0 && (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="font-bold">ระดับ{tierLabel[tier]}</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {grouped[tier].map((b) => {
                    const earned = earnedBadgeIds.has(b.id);
                    return (
                      <Card
                        key={b.id}
                        className={cn(
                          "transition-all relative overflow-hidden",
                          earned
                            ? `bg-gradient-to-br ${tierStyle[tier]}`
                            : "bg-card border-border shadow-sm text-foreground"
                        )}
                      >
                        <CardContent className="p-4 text-center">
                          <div className={cn("text-5xl mb-2", earned ? "" : "opacity-75")}>{b.icon}</div>
                          <div className={cn("font-bold text-sm leading-snug", earned ? "" : "text-foreground")}>{b.name}</div>
                          <div className={cn("mt-1 text-sm leading-relaxed", earned ? "opacity-80" : "text-foreground/80")}>
                            {b.description}
                          </div>
                          {earned && <Badge className="mt-2 bg-emerald-500/30 text-emerald-100">ได้รับแล้ว</Badge>}
                          {!earned && <Badge className="mt-2 border border-border bg-muted text-foreground">ยังไม่ได้รับ</Badge>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </TabsContent>

        <TabsContent value="classroom" className="pt-4">
          <Card>
            <CardHeader><CardTitle>🏆 ห้องเรียนที่สะสมแต้มสูงสุด</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">อันดับ</TableHead>
                    <TableHead>ห้องเรียน</TableHead>
                    <TableHead className="text-right">จำนวนนักเรียน</TableHead>
                    <TableHead className="text-right">รวมแต้ม</TableHead>
                    <TableHead className="text-right">เฉลี่ย/คน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classroomLeaderboard.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  ) : classroomLeaderboard.map((c, i) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-bold">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </TableCell>
                      <TableCell className="font-semibold">{c.name}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right text-amber-400 font-bold">{c.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{c.count ? Math.round(c.total / c.count).toLocaleString() : 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="pt-4">
          <Card>
            <CardHeader><CardTitle>⭐ Top 10 นักเรียน</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">อันดับ</TableHead>
                    <TableHead>นักเรียน</TableHead>
                    <TableHead>ห้อง</TableHead>
                    <TableHead className="text-right">แต้มสะสม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentLeaderboard.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  ) : studentLeaderboard.map((row, i) => {
                    const s = row.students || {};
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-bold">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </TableCell>
                        <TableCell>
                          {(s.prefix || "")}{s.first_name} {s.last_name}
                          <div className="text-xs text-muted-foreground">{s.student_code}</div>
                        </TableCell>
                        <TableCell>{s.classrooms?.name || "-"}</TableCell>
                        <TableCell className="text-right text-amber-400 font-bold">{(row.total_points || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
