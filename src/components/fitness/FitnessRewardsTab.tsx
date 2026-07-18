import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Sparkles, Coins, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirmAction";

type Achievement = {
  id: string; code: string; name: string; description: string | null;
  icon: string | null; metric: string; threshold: number; reward_points: number;
};
type Reward = {
  id: string; name: string; description: string | null; image_url: string | null;
  cost_points: number; stock: number; is_active: boolean;
};
type Ledger = { id: string; points: number; reason: string; created_at: string };
type Redemption = { id: string; reward_id: string; cost_points: number; status: string; created_at: string; reward?: { name: string } };

export default function FitnessRewardsTab() {
  const { session } = useAuthSession();
  const uid = session?.user.id;
  const [balance, setBalance] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!uid) return;
    setLoading(true);
    const [a, ua, r, l, rd] = await Promise.all([
      supabase.from("fitness_achievements").select("*").eq("is_active", true).order("threshold"),
      supabase.from("fitness_user_achievements").select("achievement_id").eq("user_id", uid),
      supabase.from("fitness_rewards").select("*").eq("is_active", true).order("cost_points"),
      supabase.from("fitness_points_ledger").select("id,points,reason,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("fitness_redemptions").select("id,reward_id,cost_points,status,created_at,reward:fitness_rewards(name)").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
    ]);
    setAchievements((a.data || []) as any);
    setUnlocked(new Set((ua.data || []).map((x: any) => x.achievement_id)));
    setRewards((r.data || []) as any);
    setLedger((l.data || []) as any);
    setRedemptions((rd.data || []) as any);
    setBalance((l.data || []).reduce((s, x: any) => s + x.points, 0));
    // accurate balance via rpc
    const { data: bal } = await supabase.rpc("fitness_points_balance", { _user_id: uid });
    if (typeof bal === "number") setBalance(bal);
    setLoading(false);
  };

  useEffect(() => { load(); }, [uid]);

  const redeem = async (rw: Reward) => {
    if (!uid) return;
    if (balance < rw.cost_points) { toast.error("แต้มไม่พอ"); return; }
    const ok = await confirmAction({ title: `แลก "${rw.name}"?`, text: `ใช้ ${rw.cost_points} แต้ม • แต้มคงเหลือหลังแลก ${balance - rw.cost_points}`, confirmText: "แลกเลย" });
    if (!ok) return;
    const { error } = await supabase.from("fitness_redemptions").insert({ user_id: uid, reward_id: rw.id, cost_points: rw.cost_points });
    if (error) { toast.error(error.message); return; }
    toast.success("แลกของสำเร็จ! รอแอดมินส่งมอบ");
    load();
  };

  return (
    <div className="space-y-4">
      {/* Balance hero */}
      <Card className="bg-gradient-to-br from-amber-400 to-orange-500 text-white border-0 shadow-lg">
        <CardContent className="pt-6 pb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-90 flex items-center gap-1"><Coins className="w-3.5 h-3.5" />แต้มสุขภาพคงเหลือ</div>
            <div className="text-4xl font-bold leading-tight mt-1">{balance.toLocaleString("th-TH")} <span className="text-base font-medium opacity-80">แต้ม</span></div>
            <div className="text-xs opacity-90 mt-1">ออกกำลังกาย 10 kcal = 1 แต้ม • ทุก 5 นาที = 1 แต้ม • ปลดล็อกความสำเร็จได้แต้มเพิ่ม</div>
          </div>
          <Sparkles className="w-12 h-12 opacity-30" />
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />ความสำเร็จ ({unlocked.size}/{achievements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {achievements.map(a => {
              const got = unlocked.has(a.id);
              // metric → themed gradient + ring color (matches topic)
              const theme: Record<string, { grad: string; ring: string; chip: string }> = {
                total_kcal:       { grad: "from-orange-400 via-red-500 to-rose-600",     ring: "ring-orange-300",  chip: "bg-orange-100 text-orange-700" },
                total_minutes:    { grad: "from-sky-400 via-blue-500 to-indigo-600",     ring: "ring-sky-300",     chip: "bg-sky-100 text-sky-700" },
                total_logs:       { grad: "from-emerald-400 via-green-500 to-teal-600",  ring: "ring-emerald-300", chip: "bg-emerald-100 text-emerald-700" },
                food_logs:        { grad: "from-lime-400 via-green-500 to-emerald-600",  ring: "ring-lime-300",    chip: "bg-lime-100 text-lime-700" },
                exercise_variety: { grad: "from-fuchsia-400 via-purple-500 to-violet-600", ring: "ring-fuchsia-300", chip: "bg-fuchsia-100 text-fuchsia-700" },
              };
              const t = theme[a.metric] || { grad: "from-amber-400 to-pink-500", ring: "ring-amber-300", chip: "bg-amber-100 text-amber-700" };
              return (
                <div key={a.id} className={`group relative rounded-2xl p-3 text-center transition-all border ${got ? "bg-card border-amber-200 shadow-md hover:-translate-y-0.5 hover:shadow-lg" : "bg-muted/20 border-muted opacity-70"}`}>
                  {got && <span className="absolute top-1.5 right-1.5 text-[9px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5 font-bold">✓</span>}
                  {/* Medallion */}
                  <div className="relative mx-auto w-20 h-20 mb-2">
                    {/* outer ring */}
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${got ? t.grad : "from-slate-300 to-slate-400"} ${got ? "shadow-lg" : "grayscale"}`} />
                    {/* ribbon decoration */}
                    {got && (
                      <>
                        <div className="absolute -bottom-1 left-1/2 -translate-x-[14px] w-3 h-4 bg-rose-500 rotate-12 rounded-sm opacity-90" />
                        <div className="absolute -bottom-1 left-1/2 translate-x-[2px] w-3 h-4 bg-rose-600 -rotate-12 rounded-sm opacity-90" />
                      </>
                    )}
                    {/* inner disc */}
                    <div className={`absolute inset-1.5 rounded-full bg-white/95 flex items-center justify-center ring-2 ${got ? t.ring : "ring-slate-200"}`}>
                      <span className="text-3xl drop-shadow-sm">{got ? (a.icon || "🏆") : "🔒"}</span>
                    </div>
                    {/* sparkle */}
                    {got && <span className="absolute -top-1 -right-1 text-sm animate-pulse">✨</span>}
                  </div>
                  <div className={`text-xs font-bold leading-tight ${got ? "" : "text-muted-foreground"}`}>{a.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2 min-h-[24px]">{a.description}</div>
                  {a.reward_points > 0 && (
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold rounded-full px-2 py-0.5 ${got ? t.chip : "bg-muted text-muted-foreground"}`}>+{a.reward_points} แต้ม</span>
                  )}
                </div>
              );
            })}
            {achievements.length === 0 && !loading && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-4">ยังไม่มีความสำเร็จ</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rewards shop */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4 text-pink-500" />คลังของรางวัล</CardTitle>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">ยังไม่มีของรางวัล — แอดมินสามารถเพิ่มได้ที่หน้าจัดการรางวัล</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rewards.map(rw => {
                const canAfford = balance >= rw.cost_points && rw.stock > 0;
                return (
                  <div key={rw.id} className="rounded-xl border p-3 flex flex-col">
                    {rw.image_url ? (
                      <img src={rw.image_url} alt={rw.name} className="w-full h-32 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-32 rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-5xl mb-2">🎁</div>
                    )}
                    <div className="font-semibold text-sm">{rw.name}</div>
                    {rw.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{rw.description}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="gap-1"><Coins className="w-3 h-3" />{rw.cost_points}</Badge>
                      <span className="text-xs text-muted-foreground">เหลือ {rw.stock}</span>
                    </div>
                    <Button size="sm" className="mt-2" disabled={!canAfford} onClick={() => redeem(rw)}>
                      {rw.stock <= 0 ? <><Lock className="w-3.5 h-3.5 mr-1" />หมด</> : (balance < rw.cost_points ? "แต้มไม่พอ" : "แลกเลย")}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">รายการแต้มล่าสุด</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 max-h-72 overflow-auto">
            {ledger.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">ยังไม่มีรายการ</div>}
            {ledger.map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs border-b pb-1.5">
                <div className="truncate">
                  <div className="font-medium truncate">{l.reason}</div>
                  <div className="text-muted-foreground text-[10px]">{new Date(l.created_at).toLocaleString("th-TH", { hour12: false })}</div>
                </div>
                <span className={`font-bold ${l.points > 0 ? "text-success" : "text-destructive"}`}>{l.points > 0 ? "+" : ""}{l.points}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">การแลกของของฉัน</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 max-h-72 overflow-auto">
            {redemptions.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">ยังไม่เคยแลกของ</div>}
            {redemptions.map(r => (
              <div key={r.id} className="flex items-center justify-between text-xs border-b pb-1.5">
                <div className="truncate">
                  <div className="font-medium truncate">{r.reward?.name || "—"}</div>
                  <div className="text-muted-foreground text-[10px]">{new Date(r.created_at).toLocaleString("th-TH", { hour12: false })} • {r.cost_points} แต้ม</div>
                </div>
                <Badge variant={r.status === "delivered" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
                  {r.status === "delivered" ? <><Check className="w-3 h-3 mr-0.5" />ส่งแล้ว</> : r.status === "cancelled" ? "ยกเลิก" : "รอส่งมอบ"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
