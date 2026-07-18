import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FitnessRewardsTab from "@/components/fitness/FitnessRewardsTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Apple, Dumbbell, Flame, Heart, Plus, Sparkles, Trash2, Utensils, Activity, Target, Salad, History, TrendingUp, TrendingDown, Moon, Search, Minus, ChefHat, Image as ImageIcon,
} from "lucide-react";
import {
  calcBMI, calcBMR, calcDailyTarget, calcTDEE, bmiCategory, kcalBurned, generateAdvice,
  type FitnessProfile, type Goal, type ActivityLevel,
} from "@/lib/fitnessCalc";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { Time24Input } from "@/components/ui/time24-input";
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";

type FoodItem = { id: string; name: string; category: string; kcal_per_serving: number; serving_label: string | null };
type ExItem = { id: string; name: string; category: string; met: number };
type FoodLog = { id: string; meal_type: string; custom_name: string | null; kcal: number; portion: number; source: string; food_id: string | null; food?: { name: string } };
type ExLog = { id: string; custom_name: string | null; duration_min: number; kcal_burned: number; exercise_id: string | null; exercise?: { name: string } };
type SleepLog = { id: string; sleep_date: string; bedtime: string | null; wake_time: string | null; duration_minutes: number; quality: number | null; note: string | null };

const todayISO = () => {
  const d = new Date();
  // local date as YYYY-MM-DD
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
};

export default function FitnessPage() {
  const { user } = useAuthSession();
  const { lang: rawLang } = useLanguage();
  const lang: "th" | "en" = rawLang === "en" ? "en" : "th";
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const today = todayISO();

  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [exLogs, setExLogs] = useState<ExLog[]>([]);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [exercises, setExercises] = useState<ExItem[]>([]);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategory, setFoodCategory] = useState<string>("all");
  const [selectedFood, setSelectedFood] = useState<string>("");
  const [foodMeal, setFoodMeal] = useState<string>(() => suggestMealByHour(new Date().getHours()));
  const [foodPortion, setFoodPortion] = useState(1);
  const [foodKcalOverride, setFoodKcalOverride] = useState<string>("");
  const [selectedEx, setSelectedEx] = useState<string>("");
  const [exMinutes, setExMinutes] = useState(30);
  const [history, setHistory] = useState<{ date: string; kcalIn: number; kcalOut: number; foodCount: number; exCount: number; minutes: number }[]>([]);
  const [historyDays, setHistoryDays] = useState<14 | 30>(14);
  const [historyFoods, setHistoryFoods] = useState<FoodLog[]>([]);
  const [historyEx, setHistoryEx] = useState<ExLog[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [sleepDate, setSleepDate] = useState<string>(today);
  const [sleepBed, setSleepBed] = useState<string>("23:00");
  const [sleepWake, setSleepWake] = useState<string>("06:30");
  const [sleepQuality, setSleepQuality] = useState<string>("4");
  const [sleepNote, setSleepNote] = useState<string>("");

  const kcalIn = useMemo(() => foodLogs.reduce((s, l) => s + Number(l.kcal || 0), 0), [foodLogs]);
  const kcalOut = useMemo(() => exLogs.reduce((s, l) => s + Number(l.kcal_burned || 0), 0), [exLogs]);
  const target = useMemo(() => calcDailyTarget(profile || {}), [profile]);
  const bmi = useMemo(() => calcBMI(profile || {}), [profile]);
  const advice = useMemo(() => generateAdvice(profile || {}, kcalIn, kcalOut, lang), [profile, kcalIn, kcalOut, lang]);

  // ─── load ───
  const refresh = async () => {
    if (!user) return;
    const [pf, fl, el, fc, ec, sl] = await Promise.all([
      supabase.from("fitness_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("fitness_food_logs").select("*, food:food_catalog(name)").eq("user_id", user.id).eq("log_date", today).order("created_at", { ascending: false }),
      supabase.from("fitness_exercise_logs").select("*, exercise:exercise_catalog(name)").eq("user_id", user.id).eq("log_date", today).order("created_at", { ascending: false }),
      supabase.from("food_catalog").select("id,name,category,kcal_per_serving,serving_label").eq("is_active", true).order("name"),
      supabase.from("exercise_catalog").select("id,name,category,met").eq("is_active", true).order("name"),
      supabase.from("fitness_sleep_logs" as any).select("*").eq("user_id", user.id).order("sleep_date", { ascending: false }).limit(30),
    ]);
    setProfile((pf.data as any) || { activity_level: "moderate", goal: "maintain" });
    setFoodLogs((fl.data as any) || []);
    setExLogs((el.data as any) || []);
    setFoods((fc.data as any) || []);
    setExercises((ec.data as any) || []);
    setSleepLogs(((sl as any).data as any) || []);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  // ─── history ───
  const loadHistory = async (days: number) => {
    if (!user) return;
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const fromISO = from.toISOString().slice(0, 10);
    const [fl, el] = await Promise.all([
      supabase.from("fitness_food_logs").select("*, food:food_catalog(name)").eq("user_id", user.id).gte("log_date", fromISO).order("log_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("fitness_exercise_logs").select("*, exercise:exercise_catalog(name)").eq("user_id", user.id).gte("log_date", fromISO).order("log_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    const foods = (fl.data as any[]) || [];
    const exs = (el.data as any[]) || [];
    setHistoryFoods(foods as any);
    setHistoryEx(exs as any);
    // build per-day aggregates for the full window (zero-filled)
    const map = new Map<string, { kcalIn: number; kcalOut: number; foodCount: number; exCount: number; minutes: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), { kcalIn: 0, kcalOut: 0, foodCount: 0, exCount: 0, minutes: 0 });
    }
    foods.forEach((f: any) => {
      const r = map.get(f.log_date); if (!r) return;
      r.kcalIn += Number(f.kcal || 0); r.foodCount += 1;
    });
    exs.forEach((e: any) => {
      const r = map.get(e.log_date); if (!r) return;
      r.kcalOut += Number(e.kcal_burned || 0); r.exCount += 1; r.minutes += Number(e.duration_min || 0);
    });
    const arr = Array.from(map.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setHistory(arr);
  };
  useEffect(() => { if (user) loadHistory(historyDays); /* eslint-disable-next-line */ }, [user?.id, historyDays, foodLogs.length, exLogs.length]);

  // ─── profile save ───
  const saveProfile = async () => {
    if (!user || !profile) return;
    const payload = {
      user_id: user.id,
      weight_kg: profile.weight_kg ?? null,
      height_cm: profile.height_cm ?? null,
      birth_date: profile.birth_date || null,
      sex: profile.sex || null,
      activity_level: profile.activity_level || "moderate",
      goal: profile.goal || "maintain",
      target_weight_kg: profile.target_weight_kg ?? null,
      daily_kcal_target: profile.daily_kcal_target ?? null,
    };
    const { error } = await supabase.from("fitness_profiles").upsert(payload, { onConflict: "user_id" });
    if (error) toast.error(error.message); else toast.success(L("บันทึกข้อมูลแล้ว", "Saved"));
    refresh();
  };

  // ─── food ───
  const addFood = async () => {
    if (!user) return;
    const food = foods.find((f) => f.id === selectedFood);
    if (!food) { toast.error(L("เลือกเมนูก่อน", "Pick a food")); return; }
    const override = parseInt(foodKcalOverride, 10);
    const kcal = override > 0 ? override : Math.round(food.kcal_per_serving * foodPortion);
    const { error } = await supabase.from("fitness_food_logs").insert({
      user_id: user.id, log_date: today, meal_type: foodMeal, food_id: food.id,
      custom_name: food.name, portion: foodPortion, kcal, source: "manual",
    });
    if (error) toast.error(error.message); else { toast.success(L(`+${kcal} kcal`, `+${kcal} kcal`)); refresh(); setSelectedFood(""); setFoodPortion(1); setFoodKcalOverride(""); }
  };

  const addCustomFood = async (name: string, kcal: number) => {
    if (!user || !name || !kcal) return;
    const { error } = await supabase.from("fitness_food_logs").insert({
      user_id: user.id, log_date: today, meal_type: foodMeal,
      custom_name: name, portion: 1, kcal, source: "manual",
    });
    if (error) toast.error(error.message); else { toast.success(L(`+${kcal} kcal`, `+${kcal} kcal`)); refresh(); }
  };

  const pullSchoolLunch = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("school_lunch_records")
      .select("menu_name, nutrition_info")
      .eq("lunch_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.menu_name) {
      toast.error(L("ยังไม่มีเมนูกลางวันของวันนี้", "No school lunch today"));
      return;
    }
    // ดึงแคลจาก nutrition_info ถ้าระบุไว้ ไม่งั้นประเมิน 500 kcal
    const m = data.nutrition_info?.match(/(\d{2,4})\s*(?:kcal|cal|แคล)/i);
    const kcal = m ? parseInt(m[1], 10) : 500;
    const { error } = await supabase.from("fitness_food_logs").insert({
      user_id: user.id, log_date: today, meal_type: "lunch",
      custom_name: data.menu_name, portion: 1, kcal, source: "school_lunch",
    });
    if (error) toast.error(error.message);
    else { toast.success(L(`ดึงเมนู "${data.menu_name}" แล้ว (+${kcal} kcal)`, `Added: ${data.menu_name}`)); refresh(); }
  };

  const deleteFood = async (id: string) => {
    await supabase.from("fitness_food_logs").delete().eq("id", id);
    refresh();
  };

  // ─── exercise ───
  const addExercise = async () => {
    if (!user) return;
    const ex = exercises.find((e) => e.id === selectedEx);
    if (!ex) { toast.error(L("เลือกกิจกรรมก่อน", "Pick an activity")); return; }
    const w = profile?.weight_kg || 50;
    const burned = kcalBurned(ex.met, w, exMinutes);
    const { error } = await supabase.from("fitness_exercise_logs").insert({
      user_id: user.id, log_date: today, exercise_id: ex.id,
      custom_name: ex.name, duration_min: exMinutes, kcal_burned: burned,
    });
    if (error) toast.error(error.message);
    else { toast.success(L(`เผาผลาญ ${burned} kcal`, `Burned ${burned} kcal`)); refresh(); setSelectedEx(""); }
  };

  const deleteEx = async (id: string) => {
    await supabase.from("fitness_exercise_logs").delete().eq("id", id);
    refresh();
  };

  const filteredFoods = useMemo(() => {
    let list = foods;
    if (foodCategory !== "all") list = list.filter((f) => f.category === foodCategory);
    const q = foodSearch.trim().toLowerCase();
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q));
    return list.slice(0, 80);
  }, [foods, foodSearch, foodCategory]);

  const foodCategoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    foods.forEach((f) => { m[f.category] = (m[f.category] || 0) + 1; });
    return m;
  }, [foods]);

  const net = kcalIn - kcalOut;
  const remaining = target - net;
  const pct = target > 0 ? Math.min(100, Math.round((net / target) * 100)) : 0;

  // ─── extra contextual daily advice ───
  const dailyExtras = useMemo(() => {
    const tips: string[] = [];
    const meals = new Set(foodLogs.map((f) => f.meal_type));
    const hour = new Date().getHours();
    // meal coverage
    if (hour >= 9 && !meals.has("breakfast")) tips.push(L("ยังไม่ได้บันทึกมื้อเช้า — งดมื้อเช้าทำให้กินมื้ออื่นเยอะกว่าปกติ", "Breakfast not logged — skipping it tends to increase later meals."));
    if (hour >= 14 && !meals.has("lunch")) tips.push(L("ยังไม่ได้บันทึกมื้อกลางวัน อย่าลืมเติมพลังงาน", "Lunch not logged yet — refuel for the afternoon."));
    if (hour >= 20 && !meals.has("dinner")) tips.push(L("ใกล้ค่ำแล้ว ถ้าจะกินมื้อเย็นเน้นโปรตีน+ผัก เลี่ยงของทอด", "Evening — choose protein + vegetables, avoid fried foods."));
    // snack overload
    const snackKcal = foodLogs.filter((f) => f.meal_type === "snack").reduce((s, f) => s + Number(f.kcal || 0), 0);
    if (snackKcal > 300) tips.push(L(`ของว่างวันนี้ ${snackKcal} kcal ค่อนข้างเยอะ ลองเปลี่ยนเป็นผลไม้/นมจืด`, `Snacks today ${snackKcal} kcal — try fruit or unsweetened milk instead.`));
    // very low intake
    if (hour >= 18 && kcalIn < target * 0.5) tips.push(L("วันนี้กินน้อยมาก ร่างกายอาจขาดพลังงาน — เติมข้าว/โปรตีนสักจาน", "Very low intake today — add a balanced meal."));
    // no exercise
    if (kcalOut === 0 && hour >= 16) tips.push(L("วันนี้ยังไม่ได้ขยับร่างกาย ลองเดินเร็ว 20–30 นาทีก่อนค่ำ", "No activity yet — try a 20–30 min brisk walk."));
    // BMI-specific
    if (bmi != null) {
      if (bmi >= 25 && profile?.goal !== "lose") tips.push(L(`BMI ${bmi} อยู่ในเกณฑ์น้ำหนักเกิน พิจารณาเปลี่ยนเป้าหมายเป็น "ลดน้ำหนัก"`, `BMI ${bmi} is overweight — consider switching goal to "Lose".`));
      if (bmi < 18.5) tips.push(L(`BMI ${bmi} ต่ำกว่าเกณฑ์ เพิ่มมื้อโปรตีนและพักผ่อนให้พอ`, `BMI ${bmi} is underweight — add protein and rest.`));
    }
    // water reminder (always)
    if (hour >= 12) tips.push(L("ดื่มน้ำเปล่าให้ครบวันละ ~8 แก้ว (เช็คสีปัสสาวะให้ใส)", "Aim for ~8 glasses of water/day."));
    // streak from history
    const last7 = history.slice(-7);
    const onTrackDays = last7.filter((d) => d.kcalIn > 0 && Math.abs(d.kcalIn - d.kcalOut - target) <= target * 0.15).length;
    if (last7.length >= 5 && onTrackDays >= 5) tips.push(L(`👏 ทำได้ดีมาก! 7 วันที่ผ่านมาเข้าเป้า ${onTrackDays}/${last7.length} วัน`, `Great streak! ${onTrackDays}/${last7.length} days on target.`));
    return tips;
  }, [foodLogs, exLogs, kcalIn, kcalOut, target, bmi, history, profile?.goal, lang]);

  // macro-ish breakdown for pie (using meal_type as proxy since we don't have macros)
  const mealBreakdown = useMemo(() => {
    const m: Record<string, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    foodLogs.forEach((f) => { m[f.meal_type] = (m[f.meal_type] || 0) + Number(f.kcal || 0); });
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({ name: mealLabel(k, lang), value: v }));
  }, [foodLogs, lang]);

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-danger to-danger flex items-center justify-center shadow-lg">
          <Heart className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{L("สุขภาพฉัน", "My Fitness")}</h1>
          <p className="text-sm text-muted-foreground">{L("บันทึกอาหารและการออกกำลังกาย", "Log food & exercise")}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/dashboard/student/fitness/poster">
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{L("สร้างโปสเตอร์", "Make Poster")}</span>
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="flex flex-wrap gap-2 h-auto p-2 bg-muted/40 rounded-xl w-full justify-start">
          <TabsTrigger value="today" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Flame className="w-4 h-4" />{L("สรุปวันนี้", "Today's Summary")}
          </TabsTrigger>
          <TabsTrigger value="food" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Utensils className="w-4 h-4" />{L("บันทึกการทานอาหาร", "Log Meals")}
          </TabsTrigger>
          <TabsTrigger value="ex" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Dumbbell className="w-4 h-4" />{L("บันทึกการออกกำลังกาย", "Log Exercise")}
          </TabsTrigger>
          <TabsTrigger value="sleep" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Moon className="w-4 h-4" />{L("บันทึกการนอน", "Log Sleep")}
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Sparkles className="w-4 h-4" />{L("แต้มสุขภาพและรางวัล", "Points & Rewards")}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-slate-500 data-[state=active]:to-slate-700 data-[state=active]:text-white data-[state=active]:shadow-md">
            <History className="w-4 h-4" />{L("ประวัติย้อนหลัง", "History")}
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1 min-w-[110px] gap-1.5 rounded-lg border border-border bg-background shadow-sm data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Target className="w-4 h-4" />{L("ตั้งเป้าหมายสุขภาพ", "Set Goals")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards"><FitnessRewardsTab /></TabsContent>


        {/* ============= TODAY ============= */}
        <TabsContent value="today" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="pt-5">
              <div className="text-xs text-muted-foreground">{L("กินเข้า", "Intake")}</div>
              <div className="text-2xl font-bold text-success">{kcalIn} <span className="text-sm font-normal text-muted-foreground">kcal</span></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <div className="text-xs text-muted-foreground">{L("เผาผลาญ", "Burned")}</div>
              <div className="text-2xl font-bold text-warning">{kcalOut} <span className="text-sm font-normal text-muted-foreground">kcal</span></div>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <div className="text-xs text-muted-foreground">{L("คงเหลือถึงเป้า", "Remaining")}</div>
              <div className={`text-2xl font-bold ${remaining < 0 ? "text-danger" : "text-info"}`}>{remaining}</div>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-warning" />{L("ความก้าวหน้าวันนี้", "Daily progress")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{net} / {target} kcal</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <Progress value={pct} />
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <div className="text-muted-foreground">BMR</div>
                  <div className="font-semibold">{calcBMR(profile || {})} kcal</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <div className="text-muted-foreground">TDEE</div>
                  <div className="font-semibold">{calcTDEE(profile || {})} kcal</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 text-center">
                  <div className="text-muted-foreground">BMI</div>
                  <div className="font-semibold">{bmi ?? "—"} <span className="text-[10px] text-muted-foreground">{bmiCategory(bmi, lang)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advice */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-info" />{advice.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {advice.warning && (
                <div className="mb-3 rounded-lg bg-warning-soft dark:bg-warning/40 text-warning dark:text-warning p-3 text-sm">
                  ⚠️ {advice.warning}
                </div>
              )}
              <ul className="space-y-1.5 text-sm">
                {advice.tips.map((t, i) => (
                  <li key={`t-${i}`} className="flex gap-2"><span className="text-primary">•</span><span>{t}</span></li>
                ))}
                {dailyExtras.map((t, i) => (
                  <li key={`e-${i}`} className="flex gap-2"><span className="text-danger">★</span><span>{t}</span></li>
                ))}
              </ul>
              {mealBreakdown.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs text-muted-foreground mb-1">{L("สัดส่วนพลังงานแต่ละมื้อ", "Energy by meal")}</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={mealBreakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {mealBreakdown.map((_, i) => (
                          <Cell key={i} fill={["#10b981","#f59e0b","#6366f1","#ec4899"][i % 4]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${v} kcal`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= FOOD ============= */}
        <TabsContent value="food" className="space-y-3">
          <Card className="overflow-hidden border-success/20 shadow-sm">
            <div className="bg-gradient-to-r from-success/15 via-success/5 to-transparent px-4 py-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-success/20 flex items-center justify-center">
                  <Salad className="w-5 h-5 text-success" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{L("บันทึกอาหาร", "Log food")}</div>
                  <div className="text-[11px] text-muted-foreground">{L("เลือกมื้อ → ค้นเมนู → ระบุจำนวน", "Pick meal → search → portion")}</div>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">{kcalIn} / {target} kcal</Badge>
            </div>

            <CardContent className="space-y-4 pt-4">
              <Button variant="outline" className="w-full border-dashed hover:border-success hover:bg-success/5" onClick={pullSchoolLunch}>
                <ChefHat className="w-4 h-4 mr-2 text-success" />{L("ดึงเมนูกลางวันของโรงเรียนวันนี้", "Pull today's school lunch")}
              </Button>

              {/* Meal selector — visual chips */}
              <div>
                <Label className="text-xs mb-2 block text-muted-foreground">{L("1. เลือกมื้ออาหาร", "1. Choose meal")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_OPTIONS.map((m) => {
                    const active = foodMeal === m.key;
                    const suggested = suggestMealByHour(new Date().getHours()) === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setFoodMeal(m.key)}
                        className={`relative rounded-xl border-2 px-2 py-2.5 text-xs flex flex-col items-center gap-1 transition-all ${active ? "border-success bg-success/10 text-success font-semibold shadow-sm scale-[1.02]" : "border-border hover:border-success/40 hover:bg-success/5"}`}
                      >
                        <span className="text-xl leading-none">{m.icon}</span>
                        <span>{L(m.th, m.en)}</span>
                        <span className="text-[10px] text-muted-foreground">{m.time}</span>
                        {suggested && !active && (
                          <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-info text-white px-1.5 py-0.5 rounded-full shadow">now</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search */}
              <div>
                <Label className="text-xs mb-2 block text-muted-foreground">{L("2. ค้นหาเมนู", "2. Search menu")}</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={foodSearch}
                    onChange={(e) => setFoodSearch(e.target.value)}
                    placeholder={L("เช่น ข้าวผัด, ก๋วยเตี๋ยว, ส้มตำ", "e.g. rice, noodle")}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2 -mx-1 px-1 scrollbar-thin">
                  {FOOD_CATEGORIES.map((c) => {
                    const active = foodCategory === c.key;
                    const count = c.key === "all" ? foods.length : (foodCategoryCounts[c.key] || 0);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setFoodCategory(c.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition whitespace-nowrap ${active ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-muted border-border"}`}
                      >
                        <span className="mr-1">{c.icon}</span>{L(c.th, c.en)}
                        <span className={`ml-1.5 ${active ? "opacity-80" : "opacity-50"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Food list */}
              <div className="max-h-80 overflow-y-auto border rounded-xl bg-muted/20">
                {filteredFoods.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    <Utensils className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {L("ไม่พบเมนูที่ค้นหา", "No menu found")}
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredFoods.map((f) => {
                      const cat = FOOD_CATEGORIES.find((c) => c.key === f.category);
                      const selected = selectedFood === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFood(f.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition text-left ${selected ? "bg-success/10 border-l-4 border-success pl-2" : "hover:bg-background border-l-4 border-transparent pl-2"}`}
                        >
                          <span className="text-lg shrink-0">{cat?.icon || "🍽️"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{f.name}</div>
                            {f.serving_label && <div className="text-[11px] text-muted-foreground">{L("ต่อ", "per")} {f.serving_label}</div>}
                          </div>
                          <Badge variant={selected ? "default" : "secondary"} className="shrink-0">{f.kcal_per_serving} kcal</Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected food panel */}
              {selectedFood && (() => {
                const sf = foods.find(x => x.id === selectedFood);
                const unit = sf?.serving_label || "หน่วย";
                const calc = sf ? Math.round(sf.kcal_per_serving * foodPortion) : 0;
                const ovr = parseInt(foodKcalOverride, 10);
                const finalKcal = ovr > 0 ? ovr : calc;
                const cat = FOOD_CATEGORIES.find((c) => c.key === sf?.category);
                return (
                  <div className="rounded-xl border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat?.icon || "🍽️"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{sf?.name}</div>
                        <div className="text-[11px] text-muted-foreground">{sf?.kcal_per_serving} kcal / {unit}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-success">{finalKcal}</div>
                        <div className="text-[10px] text-muted-foreground -mt-1">kcal</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">{L(`จำนวน (${unit})`, `Portion (${unit})`)}</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setFoodPortion(Math.max(0.25, foodPortion - 0.5))}><Minus className="w-3.5 h-3.5" /></Button>
                          <Input type="number" step="0.25" min="0.25" value={foodPortion} onChange={(e) => setFoodPortion(Math.max(0.25, parseFloat(e.target.value) || 1))} className="text-center h-9" />
                          <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setFoodPortion(foodPortion + 0.5)}><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">{L("kcal จากฉลาก (ถ้ามี)", "Custom kcal")}</Label>
                        <Input type="number" min="0" placeholder={`${calc}`} value={foodKcalOverride} onChange={(e) => setFoodKcalOverride(e.target.value)} className="h-9 mt-1" />
                      </div>
                    </div>
                    <Button className="w-full bg-success hover:bg-success/90 text-white" onClick={addFood}>
                      <Plus className="w-4 h-4 mr-1" />{L(`บันทึก ${finalKcal} kcal`, `Log ${finalKcal} kcal`)}
                    </Button>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {L(
                        "* ค่าแคลอรีเป็นค่าประมาณ (±20%) ขึ้นกับสูตร/น้ำมัน/ขนาดจริง",
                        "* Calorie values are approximate (±20%).",
                      )}
                    </p>
                  </div>
                );
              })()}

              <CustomFoodInput onAdd={addCustomFood} lang={lang} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4 text-success" />{L("รายการอาหารวันนี้", "Today's food log")}</CardTitle>
              {foodLogs.length > 0 && <Badge variant="outline" className="text-xs">{foodLogs.length} {L("รายการ", "items")} • {kcalIn} kcal</Badge>}
            </CardHeader>
            <CardContent>
              {foodLogs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Salad className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{L("ยังไม่มีรายการวันนี้", "No entries today")}</p>
                  <p className="text-xs mt-1 opacity-70">{L("เริ่มบันทึกมื้อแรกของวันได้เลย", "Start logging your first meal")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {MEAL_OPTIONS.map((m) => {
                    const items = foodLogs.filter((l) => l.meal_type === m.key);
                    if (items.length === 0) return null;
                    const sub = items.reduce((s, l) => s + Number(l.kcal || 0), 0);
                    return (
                      <div key={m.key} className="rounded-lg border bg-muted/20 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="text-base">{m.icon}</span>{L(m.th, m.en)}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{sub} kcal</span>
                        </div>
                        <div className="divide-y divide-border/60">
                          {items.map((l) => (
                            <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-background/50">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate flex items-center gap-2">
                                  {l.food?.name || l.custom_name}
                                  {l.source === "school_lunch" && <Badge variant="outline" className="text-[10px]">🍱</Badge>}
                                </div>
                                <div className="text-[11px] text-muted-foreground">{l.portion} {L("หน่วย", "serving")}</div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge className="bg-success/15 text-success hover:bg-success/20 border-0">{l.kcal} kcal</Badge>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteFood(l.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* ============= EXERCISE ============= */}
        <TabsContent value="ex" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-warning" />{L("เพิ่มกิจกรรม", "Add activity")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs mb-2 block">{L("เลือกกิจกรรม", "Choose activity")}</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {exercises.map((e) => {
                    const cat = (e.category || "").toLowerCase();
                    const icon =
                      /run|วิ่ง/.test(e.name + cat) ? "🏃" :
                      /walk|เดิน/.test(e.name + cat) ? "🚶" :
                      /bike|cycl|จักรยาน/.test(e.name + cat) ? "🚴" :
                      /swim|ว่ายน้ำ/.test(e.name + cat) ? "🏊" :
                      /yoga|โยคะ/.test(e.name + cat) ? "🧘" :
                      /weight|gym|เวท|ยก/.test(e.name + cat) ? "🏋️" :
                      /foot|soccer|บอล/.test(e.name + cat) ? "⚽" :
                      /basket|บาส/.test(e.name + cat) ? "🏀" :
                      /badmin|แบด/.test(e.name + cat) ? "🏸" :
                      /tennis|เทนนิส/.test(e.name + cat) ? "🎾" :
                      /dance|เต้น|แอโรบิค|aerobic/.test(e.name + cat) ? "💃" :
                      /jump|กระโดด/.test(e.name + cat) ? "🤸" :
                      /climb|ปีน/.test(e.name + cat) ? "🧗" :
                      /box|มวย/.test(e.name + cat) ? "🥊" :
                      "💪";
                    const active = selectedEx === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelectedEx(e.id)}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-md ${
                          active
                            ? "border-warning bg-warning/10 shadow-md ring-2 ring-warning/40"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="text-2xl leading-none">{icon}</span>
                        <span className="text-xs font-medium line-clamp-2">{e.name}</span>
                        <span className="text-[10px] text-muted-foreground">MET {e.met}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="max-w-xs">
                <Label className="text-xs">{L("เวลา (นาที)", "Duration (min)")}</Label>
                <Input type="number" min="1" value={exMinutes} onChange={(e) => setExMinutes(Math.max(1, parseInt(e.target.value) || 30))} />
              </div>

              {selectedEx && profile?.weight_kg ? (
                <div className="text-xs text-muted-foreground">
                  {L("ประมาณการเผาผลาญ", "Estimated burn")}: <span className="font-semibold text-warning">
                    {kcalBurned(exercises.find((e) => e.id === selectedEx)!.met, profile.weight_kg, exMinutes)} kcal
                  </span>
                </div>
              ) : null}

              {!profile?.weight_kg && (
                <div className="text-xs text-warning">{L("กรุณากรอกน้ำหนักในแท็บ \"เป้าหมาย\" ก่อน เพื่อคำนวณแคลเผาผลาญ", "Set weight in Profile tab first")}</div>
              )}

              <Button onClick={addExercise} disabled={!selectedEx || !profile?.weight_kg}><Plus className="w-4 h-4 mr-1" />{L("บันทึก", "Log")}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("กิจกรรมวันนี้", "Today's activity")}</CardTitle></CardHeader>
            <CardContent>
              {exLogs.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">{L("ยังไม่มีรายการ", "No entries yet")}</div>
              ) : (
                <div className="divide-y">
                  {exLogs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="font-medium">{l.exercise?.name || l.custom_name}</div>
                        <div className="text-xs text-muted-foreground">{l.duration_min} {L("นาที", "min")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-warning">-{l.kcal_burned} kcal</Badge>
                        <Button size="icon" variant="ghost" onClick={() => deleteEx(l.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= SLEEP ============= */}
        <TabsContent value="sleep" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="w-4 h-4 text-info" />
                {L("บันทึกการนอน", "Log sleep")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                <div className="col-span-2 md:col-span-2">
                  <Label className="text-xs">{L("วันที่ตื่น", "Wake date")}</Label>
                  <BEDatePicker value={sleepDate} onChange={setSleepDate} />
                </div>
                <div>
                  <Label className="text-xs">{L("เข้านอน", "Bedtime")}</Label>
                  <Time24Input withSeconds={false} value={sleepBed} onChange={setSleepBed} />
                </div>
                <div>
                  <Label className="text-xs">{L("ตื่น", "Wake")}</Label>
                  <Time24Input withSeconds={false} value={sleepWake} onChange={setSleepWake} />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <Label className="text-xs">{L("คุณภาพการนอน", "Sleep quality")}</Label>
                  <Select value={sleepQuality} onValueChange={setSleepQuality}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">😴 {L("แย่มาก – หลับไม่สนิท ตื่นบ่อย","Very bad – restless")}</SelectItem>
                      <SelectItem value="2">😪 {L("แย่ – ตื่นมาไม่สดชื่น","Bad – tired")}</SelectItem>
                      <SelectItem value="3">😐 {L("ปานกลาง – พอใช้ได้","OK – average")}</SelectItem>
                      <SelectItem value="4">🙂 {L("ดี – หลับสบาย","Good – restful")}</SelectItem>
                      <SelectItem value="5">😄 {L("ดีมาก – ตื่นมาสดชื่นเต็มที่","Excellent – fully refreshed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-end">
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (!user) return;
                      const wd = new Date(`${sleepDate}T${sleepWake}:00`);
                      const bd = new Date(`${sleepDate}T${sleepBed}:00`);
                      if (bd >= wd) bd.setDate(bd.getDate() - 1);
                      const mins = Math.round((wd.getTime() - bd.getTime()) / 60000);
                      const { error } = await supabase.from("fitness_sleep_logs" as any).insert({
                        user_id: user.id,
                        sleep_date: sleepDate,
                        bedtime: bd.toISOString(),
                        wake_time: wd.toISOString(),
                        duration_minutes: mins,
                        quality: parseInt(sleepQuality),
                        note: sleepNote || null,
                      });
                      if (error) { toast.error(error.message); return; }
                      toast.success(L("บันทึกแล้ว", "Saved"));
                      setSleepNote("");
                      refresh();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />{L("บันทึก","Save")}
                  </Button>
                </div>
              </div>
              <Input
                placeholder={L("บันทึกเพิ่มเติม (ฝันร้าย, ตื่นกลางดึก ฯลฯ)", "Note (dreams, awakenings...)")}
                value={sleepNote}
                onChange={(e) => setSleepNote(e.target.value)}
              />
              {(() => {
                const wd = new Date(`${sleepDate}T${sleepWake}:00`);
                const bd = new Date(`${sleepDate}T${sleepBed}:00`);
                if (bd >= wd) bd.setDate(bd.getDate() - 1);
                const mins = Math.max(0, Math.round((wd.getTime() - bd.getTime()) / 60000));
                const h = Math.floor(mins / 60), m = mins % 60;
                const ok = mins >= 7 * 60 && mins <= 9 * 60;
                return (
                  <div className="text-xs text-muted-foreground">
                    {L("ระยะเวลา", "Duration")}: <span className={`font-medium ${ok ? "text-success" : "text-warning"}`}>{h} {L("ชม.","h")} {m} {L("น.","m")}</span>
                    {" "}· {ok ? L("เหมาะสม (7–9 ชม.)", "Healthy (7–9 h)") : L("ควรนอน 7–9 ชม.", "Aim for 7–9 h")}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{L("ประวัติ 30 วัน", "Last 30 days")}</CardTitle>
            </CardHeader>
            <CardContent>
              {sleepLogs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{L("ยังไม่มีบันทึก", "No entries yet")}</div>
              ) : (
                <>
                  {(() => {
                    const last7 = sleepLogs.slice(0, 7);
                    const avg = last7.length ? Math.round(last7.reduce((s, x) => s + (x.duration_minutes || 0), 0) / last7.length) : 0;
                    const avgQ = last7.filter(x => x.quality).length
                      ? (last7.reduce((s, x) => s + (x.quality || 0), 0) / last7.filter(x => x.quality).length).toFixed(1)
                      : "-";
                    return (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                        <Stat label={L("เฉลี่ย 7 วัน", "7-day avg")} value={`${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, "0")}`} unit={L("ชม.", "h")} />
                        <Stat label={L("คุณภาพเฉลี่ย", "Avg quality")} value={`${avgQ}`} unit="/5" />
                        <Stat label={L("จำนวนคืน", "Nights")} value={`${sleepLogs.length}`} unit={L("คืน", "nights")} />
                      </div>
                    );
                  })()}
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={sleepLogs.slice(0, 14).slice().reverse().map(x => ({
                      date: x.sleep_date.slice(5),
                      [L("ชั่วโมง","Hours")]: +(x.duration_minutes / 60).toFixed(1),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 12]} />
                      <Tooltip />
                      <Bar dataKey={L("ชั่วโมง","Hours")} fill="#6366f1" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="divide-y mt-3">
                    {sleepLogs.map((s) => {
                      const h = Math.floor(s.duration_minutes / 60);
                      const m = s.duration_minutes % 60;
                      const ok = s.duration_minutes >= 7 * 60 && s.duration_minutes <= 9 * 60;
                      const fmtT = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }) : "-";
                      return (
                        <div key={s.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <div className="font-medium">{s.sleep_date}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {fmtT(s.bedtime)} → {fmtT(s.wake_time)}
                              {s.quality ? ` · ${"★".repeat(s.quality)}` : ""}
                              {s.note ? ` · ${s.note}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className={ok ? "bg-success-soft text-success dark:bg-success/40 dark:text-success" : "bg-warning-soft text-warning dark:bg-warning/40 dark:text-warning"}>
                              {h}:{String(m).padStart(2, "0")} {L("ชม.","h")}
                            </Badge>
                            <Button size="icon" variant="ghost" onClick={async () => {
                              await supabase.from("fitness_sleep_logs" as any).delete().eq("id", s.id);
                              refresh();
                            }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= HISTORY ============= */}
        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-info" />
                {L("กราฟพลังงาน", "Energy chart")}
              </CardTitle>
              <Select value={String(historyDays)} onValueChange={(v) => setHistoryDays(parseInt(v) as 14 | 30)}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">{L("14 วัน", "14 days")}</SelectItem>
                  <SelectItem value="30">{L("30 วัน", "30 days")}</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{L("ยังไม่มีข้อมูล", "No data")}</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={history.map((d) => ({
                      date: d.date.slice(5),
                      [L("กินเข้า", "Intake")]: d.kcalIn,
                      [L("เผาผลาญ", "Burned")]: d.kcalOut,
                      [L("เป้าหมาย", "Target")]: target,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey={L("กินเข้า", "Intake")} fill="#10b98133" stroke="#10b981" />
                      <Bar dataKey={L("เผาผลาญ", "Burned")} fill="#f97316" barSize={14} />
                      <Line type="monotone" dataKey={L("เป้าหมาย", "Target")} stroke="#6366f1" strokeDasharray="4 4" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {(() => {
                    const valid = history.filter((d) => d.kcalIn > 0);
                    if (valid.length === 0) return null;
                    const avgIn = Math.round(valid.reduce((s, d) => s + d.kcalIn, 0) / valid.length);
                    const avgOut = Math.round(history.reduce((s, d) => s + d.kcalOut, 0) / Math.max(1, history.filter(d => d.kcalOut > 0).length));
                    const onTarget = valid.filter((d) => Math.abs(d.kcalIn - d.kcalOut - target) <= target * 0.15).length;
                    return (
                      <div className="grid grid-cols-4 gap-2 mt-3 text-center text-xs">
                        <Stat label={L("เฉลี่ยกิน", "Avg in")} value={`${avgIn}`} unit="kcal" />
                        <Stat label={L("เฉลี่ยเผา", "Avg out")} value={`${avgOut || 0}`} unit="kcal" />
                        <Stat label={L("เข้าเป้า", "On target")} value={`${onTarget}/${valid.length}`} unit={L("วัน", "days")} />
                        <Stat label={L("รวมนาที", "Total min")} value={`${history.reduce((s,d)=>s+d.minutes,0)}`} unit={L("นาที","min")} />
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                {L("รายวันย้อนหลัง", "Daily log")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {history.slice().reverse().filter(d => d.kcalIn > 0 || d.kcalOut > 0).map((d) => {
                  const net = d.kcalIn - d.kcalOut;
                  const diff = net - target;
                  const onTarget = Math.abs(diff) <= target * 0.15;
                  const expanded = expandedDay === d.date;
                  const dayFoods = historyFoods.filter((f: any) => f.log_date === d.date);
                  const dayEx = historyEx.filter((e: any) => e.log_date === d.date);
                  return (
                    <div key={d.date} className="py-2">
                      <button className="w-full flex items-center justify-between text-left" onClick={() => setExpandedDay(expanded ? null : d.date)}>
                        <div>
                          <div className="font-medium text-sm">{d.date}</div>
                          <div className="text-xs text-muted-foreground">
                            {L("กิน", "In")} {d.kcalIn} · {L("เผา", "Out")} {d.kcalOut} · {d.foodCount} {L("รายการ", "items")} · {d.minutes} {L("นาที", "min")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {onTarget ? (
                            <Badge variant="secondary" className="bg-success-soft text-success dark:bg-success/40 dark:text-success">{L("เข้าเป้า", "On target")}</Badge>
                          ) : diff > 0 ? (
                            <Badge variant="secondary" className="bg-danger-soft text-danger dark:bg-danger/40 dark:text-danger"><TrendingUp className="w-3 h-3 mr-1" />+{diff}</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-info-soft text-info dark:bg-info/40 dark:text-info"><TrendingDown className="w-3 h-3 mr-1" />{diff}</Badge>
                          )}
                        </div>
                      </button>
                      {expanded && (
                        <div className="mt-2 pl-2 border-l-2 border-muted space-y-2">
                          {dayFoods.length > 0 && (
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground mb-1">{L("อาหาร", "Food")}</div>
                              {dayFoods.map((f: any) => (
                                <div key={f.id} className="flex justify-between text-xs py-0.5">
                                  <span>{f.food?.name || f.custom_name} <span className="text-muted-foreground">· {mealLabel(f.meal_type, lang)}</span></span>
                                  <span className="text-success">+{f.kcal}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {dayEx.length > 0 && (
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground mb-1">{L("ออกกำลังกาย", "Exercise")}</div>
                              {dayEx.map((e: any) => (
                                <div key={e.id} className="flex justify-between text-xs py-0.5">
                                  <span>{e.exercise?.name || e.custom_name} <span className="text-muted-foreground">· {e.duration_min} {L("นาที","min")}</span></span>
                                  <span className="text-warning">-{e.kcal_burned}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {history.every(d => d.kcalIn === 0 && d.kcalOut === 0) && (
                  <div className="py-8 text-center text-sm text-muted-foreground">{L("ยังไม่มีบันทึก", "No entries yet")}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============= PROFILE ============= */}
        <TabsContent value="profile" className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("ข้อมูลสุขภาพและเป้าหมาย", "Health profile & goal")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">{L("น้ำหนัก (kg)", "Weight (kg)")}</Label>
                  <Input type="number" step="0.1" value={profile?.weight_kg ?? ""} onChange={(e) => setProfile({ ...(profile || {}), weight_kg: parseFloat(e.target.value) || null })} />
                </div>
                <div>
                  <Label className="text-xs">{L("ส่วนสูง (cm)", "Height (cm)")}</Label>
                  <Input type="number" step="0.1" value={profile?.height_cm ?? ""} onChange={(e) => setProfile({ ...(profile || {}), height_cm: parseFloat(e.target.value) || null })} />
                </div>
                <div>
                  <Label className="text-xs">{L("เกิด (วันที่)", "Birth date")}</Label>
                  <BEDatePicker value={profile?.birth_date ?? ""} onChange={(v) => setProfile({ ...(profile || {}), birth_date: v || null })} />
                </div>
                <div>
                  <Label className="text-xs">{L("เพศ", "Sex")}</Label>
                  <Select value={profile?.sex || ""} onValueChange={(v) => setProfile({ ...(profile || {}), sex: v as any })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{L("ชาย", "Male")}</SelectItem>
                      <SelectItem value="female">{L("หญิง", "Female")}</SelectItem>
                      <SelectItem value="other">{L("อื่น ๆ", "Other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{L("ระดับการเคลื่อนไหว", "Activity level")}</Label>
                  <Select value={profile?.activity_level || "moderate"} onValueChange={(v) => setProfile({ ...(profile || {}), activity_level: v as ActivityLevel })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">{L("นั่งทำงานเป็นหลัก", "Sedentary")}</SelectItem>
                      <SelectItem value="light">{L("ออกกำลังเบา 1–3 วัน", "Light (1–3/wk)")}</SelectItem>
                      <SelectItem value="moderate">{L("ปานกลาง 3–5 วัน", "Moderate (3–5/wk)")}</SelectItem>
                      <SelectItem value="active">{L("หนัก 6–7 วัน", "Active (6–7/wk)")}</SelectItem>
                      <SelectItem value="very_active">{L("นักกีฬา", "Very active")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{L("เป้าหมาย", "Goal")}</Label>
                  <Select value={profile?.goal || "maintain"} onValueChange={(v) => setProfile({ ...(profile || {}), goal: v as Goal })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">{L("ลดน้ำหนัก", "Lose weight")}</SelectItem>
                      <SelectItem value="maintain">{L("รักษาน้ำหนัก", "Maintain")}</SelectItem>
                      <SelectItem value="gain_muscle">{L("เสริมกล้ามเนื้อ", "Gain muscle")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={saveProfile} className="w-full md:w-auto">{L("บันทึก", "Save")}</Button>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <Stat label="BMR" value={`${calcBMR(profile || {})}`} unit="kcal" />
                <Stat label="TDEE" value={`${calcTDEE(profile || {})}`} unit="kcal" />
                <Stat label={L("เป้าหมาย/วัน", "Target/day")} value={`${target}`} unit="kcal" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-bold text-lg">{value} <span className="text-xs font-normal text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function mealLabel(m: string, lang: "th" | "en"): string {
  const opt = MEAL_OPTIONS.find((o) => o.key === m);
  if (!opt) return m;
  return lang === "th" ? opt.th : opt.en;
}

const MEAL_OPTIONS = [
  { key: "breakfast", th: "เช้า", en: "Breakfast", icon: "🌅", time: "06–10น." },
  { key: "lunch",     th: "กลางวัน", en: "Lunch",  icon: "🍱", time: "11–14น." },
  { key: "dinner",    th: "เย็น", en: "Dinner",    icon: "🌙", time: "17–21น." },
  { key: "snack",     th: "ของว่าง", en: "Snack",  icon: "🍿", time: "ตลอดวัน" },
];

const FOOD_CATEGORIES = [
  { key: "all",     th: "ทั้งหมด", en: "All",       icon: "🍽️" },
  { key: "rice",    th: "ข้าว/จานเดียว", en: "Rice", icon: "🍚" },
  { key: "noodle",  th: "เส้น/ก๋วยเตี๋ยว", en: "Noodle", icon: "🍜" },
  { key: "snack",   th: "ของว่าง/ยำ", en: "Snack",  icon: "🥗" },
  { key: "dessert", th: "ขนมหวาน", en: "Dessert",   icon: "🍰" },
  { key: "fruit",   th: "ผลไม้", en: "Fruit",       icon: "🍎" },
  { key: "drink",   th: "เครื่องดื่ม", en: "Drink", icon: "🥤" },
];

function suggestMealByHour(h: number): string {
  if (h >= 4 && h < 10) return "breakfast";
  if (h >= 10 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

function CustomFoodInput({ onAdd, lang }: { onAdd: (name: string, kcal: number) => void; lang: "th" | "en" }) {
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState<number>(0);
  return (
    <div className="border-t pt-3 space-y-2">
      <Label className="text-xs flex items-center gap-1"><Apple className="w-3.5 h-3.5" />{L("หรือเพิ่มอาหารเอง", "Or add custom food")}</Label>
      <div className="grid grid-cols-5 gap-2">
        <Input className="col-span-3" placeholder={L("ชื่ออาหาร", "Food name")} value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="col-span-1" type="number" placeholder="kcal" value={kcal || ""} onChange={(e) => setKcal(parseInt(e.target.value) || 0)} />
        <Button className="col-span-1" onClick={() => { onAdd(name, kcal); setName(""); setKcal(0); }} disabled={!name || !kcal}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}