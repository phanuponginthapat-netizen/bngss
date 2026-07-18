import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share2, RefreshCw, ArrowLeft } from "lucide-react";
import html2canvas from "html2canvas";
import mascotPoster from "@/assets/fitness-invitation-poster.jpg";

type Stats = {
  users: number;
  active7d: number;
  totalFoodLogs: number;
  totalExLogs: number;
  totalKcalBurned: number;
  totalMinutes: number;
  foodCatalog: number;
  exerciseCatalog: number;
  topExercise: string | null;
  topFood: string | null;
  updatedAt: string;
};

const fmt = (n: number) => n.toLocaleString("th-TH");

export default function FitnessPosterPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const [pf, food7, ex7, foodAll, exAll, foodCat, exCat] = await Promise.all([
      supabase.from("fitness_profiles").select("user_id", { count: "exact", head: true }),
      supabase.from("fitness_food_logs").select("user_id").gte("log_date", since),
      supabase.from("fitness_exercise_logs").select("user_id,kcal_burned,minutes,exercise:exercise_catalog(name)").gte("log_date", since),
      supabase.from("fitness_food_logs").select("id,food:food_catalog(name)", { count: "exact" }),
      supabase.from("fitness_exercise_logs").select("kcal_burned,minutes", { count: "exact" }),
      supabase.from("food_catalog").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("exercise_catalog").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const activeIds = new Set<string>();
    (food7.data || []).forEach((r: any) => r.user_id && activeIds.add(r.user_id));
    (ex7.data || []).forEach((r: any) => r.user_id && activeIds.add(r.user_id));

    const exTally: Record<string, number> = {};
    (ex7.data || []).forEach((r: any) => {
      const n = r.exercise?.name;
      if (n) exTally[n] = (exTally[n] || 0) + 1;
    });
    const foodTally: Record<string, number> = {};
    (foodAll.data || []).forEach((r: any) => {
      const n = r.food?.name;
      if (n) foodTally[n] = (foodTally[n] || 0) + 1;
    });
    const topOf = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const totalKcal = (exAll.data || []).reduce((s: number, r: any) => s + Number(r.kcal_burned || 0), 0);
    const totalMin = (exAll.data || []).reduce((s: number, r: any) => s + Number(r.minutes || 0), 0);

    setStats({
      users: pf.count || 0,
      active7d: activeIds.size,
      totalFoodLogs: foodAll.count || 0,
      totalExLogs: exAll.count || 0,
      totalKcalBurned: Math.round(totalKcal),
      totalMinutes: Math.round(totalMin),
      foodCatalog: foodCat.count || 0,
      exerciseCatalog: exCat.count || 0,
      topExercise: topOf(exTally),
      topFood: topOf(foodTally),
      updatedAt: new Date().toLocaleString("th-TH", { hour12: false }),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const downloadPNG = async () => {
    if (!posterRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `fitness-poster-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/dashboard/student/fitness">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />รีเฟรชข้อมูล
            </Button>
            <Button size="sm" onClick={downloadPNG} disabled={!stats || exporting}>
              <Download className="w-4 h-4 mr-1" />{exporting ? "กำลังสร้าง…" : "ดาวน์โหลด PNG"}
            </Button>
          </div>
        </div>

        {/* Poster — captured by html2canvas */}
        <div ref={posterRef} className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          {/* Hero with mascot */}
          <div className="relative">
            <img src={mascotPoster} alt="น้องผาเกล้าเชิญใช้ Fitness" className="w-full block" crossOrigin="anonymous" />
          </div>

          {/* Live stats panel */}
          <div className="p-6 bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
            <div className="text-center mb-4">
              <div className="text-xs uppercase tracking-wider opacity-80">ข้อมูลสดจากระบบ • Live Stats</div>
              <div className="text-lg font-bold">โรงเรียนเราใช้ Fitness แล้วเท่าไหร่?</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox icon="👥" label="ผู้ใช้ที่ตั้งเป้าหมาย" value={fmt(stats?.users ?? 0)} unit="คน" />
              <StatBox icon="🔥" label="แอคทีฟใน 7 วัน" value={fmt(stats?.active7d ?? 0)} unit="คน" />
              <StatBox icon="🍱" label="บันทึกมื้ออาหารรวม" value={fmt(stats?.totalFoodLogs ?? 0)} unit="ครั้ง" />
              <StatBox icon="🏃" label="บันทึกออกกำลังกาย" value={fmt(stats?.totalExLogs ?? 0)} unit="ครั้ง" />
              <StatBox icon="⚡" label="แคลอรีที่เผาผลาญรวม" value={fmt(stats?.totalKcalBurned ?? 0)} unit="kcal" />
              <StatBox icon="⏱️" label="เวลาออกกำลังกายรวม" value={fmt(stats?.totalMinutes ?? 0)} unit="นาที" />
            </div>
          </div>

          {/* Catalog + highlights */}
          <div className="p-6 grid grid-cols-2 gap-4 bg-white">
            <div className="rounded-xl border-2 border-sky-200 p-4">
              <div className="text-xs text-sky-600 font-semibold mb-1">📚 เมนูในระบบ</div>
              <div className="text-3xl font-bold text-sky-700">{fmt(stats?.foodCatalog ?? 0)}</div>
              <div className="text-xs text-muted-foreground">รายการอาหาร</div>
            </div>
            <div className="rounded-xl border-2 border-emerald-200 p-4">
              <div className="text-xs text-emerald-600 font-semibold mb-1">🏋️ ท่าออกกำลังกาย</div>
              <div className="text-3xl font-bold text-emerald-700">{fmt(stats?.exerciseCatalog ?? 0)}</div>
              <div className="text-xs text-muted-foreground">รายการ</div>
            </div>
            {stats?.topExercise && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 col-span-1">
                <div className="text-xs text-amber-700 font-semibold mb-1">🏆 ท่ามาแรง (7 วัน)</div>
                <div className="text-base font-bold text-amber-800 truncate">{stats.topExercise}</div>
              </div>
            )}
            {stats?.topFood && (
              <div className="rounded-xl bg-pink-50 border border-pink-200 p-4 col-span-1">
                <div className="text-xs text-pink-700 font-semibold mb-1">🍽️ เมนูยอดฮิต</div>
                <div className="text-base font-bold text-pink-800 truncate">{stats.topFood}</div>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="px-6 py-4 bg-slate-900 text-white text-center">
            <div className="text-sm font-bold mb-1">เข้าใช้งานที่เมนู "Fitness" ในระบบโรงเรียน</div>
            <div className="text-[11px] opacity-70">ข้อมูล ณ {stats?.updatedAt || "—"} • น้องผาเกล้าชวนคุณดูแลสุขภาพ ❤️</div>
          </div>
        </div>

        <Card className="p-3 text-xs text-muted-foreground text-center">
          <Share2 className="w-3.5 h-3.5 inline mr-1" />
          ดาวน์โหลดเป็น PNG แล้วโพสต์ลง LINE OA / บอร์ดประชาสัมพันธ์ / Social Wall ได้ทันที — ตัวเลขจะอัปเดตทุกครั้งที่กดรีเฟรช
        </Card>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, unit }: { icon: string; label: string; value: string; unit: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-3 border border-white/20">
      <div className="text-2xl leading-none mb-1">{icon}</div>
      <div className="text-2xl font-bold leading-tight">{value} <span className="text-xs font-normal opacity-80">{unit}</span></div>
      <div className="text-[11px] opacity-90 leading-tight">{label}</div>
    </div>
  );
}
