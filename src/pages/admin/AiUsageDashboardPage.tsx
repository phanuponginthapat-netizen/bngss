import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/StatCard";
import {
  Sparkles, Coins, TrendingUp, Activity, Layers, Zap, Cpu, Wallet,
  ArrowDownUp, Gauge, Timer, AlertTriangle,
} from "lucide-react";
import { todayBangkok, bkkDateISO } from "@/lib/dateBE";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
  "#8b5cf6",
  "#f97316",
];

interface KeyRow {
  id: string;
  provider_type: string;
  label: string | null;
  status: string;
  used_today: number;
  used_total: number;
  daily_limit: number | null;
  cooldown_until: string | null;
  last_used_at: string | null;
  priority: number;
}

interface UsageRow {
  provider_name: string | null;
  model: string | null;
  function_name: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  estimated_cost: number | null;
  success: boolean | null;
  latency_ms: number | null;
  created_at: string;
}

function useAiDashboardData() {
  return useQuery({
    queryKey: ["ai-usage-dashboard"],
    staleTime: 30_000,
    queryFn: async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [keysRes, usageRes] = await Promise.all([
        supabase.from("ai_provider_keys")
          .select("id,provider_type,label,status,used_today,used_total,daily_limit,cooldown_until,last_used_at,priority")
          .order("priority", { ascending: true }),
        supabase.from("ai_usage_logs")
          .select("provider_name,model,function_name,tokens_input,tokens_output,estimated_cost,success,latency_ms,created_at")
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .limit(5000),
      ]);
      if (keysRes.error) throw keysRes.error;
      if (usageRes.error) throw usageRes.error;
      return {
        keys: (keysRes.data || []) as KeyRow[],
        usage: (usageRes.data || []) as UsageRow[],
      };
    },
  });
}

const providerLabel: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
};

const providerTone: Record<string, string> = {
  openai: "from-emerald-500/20 to-teal-500/5",
  gemini: "from-sky-500/20 to-blue-500/5",
  groq: "from-orange-500/20 to-amber-500/5",
  openrouter: "from-violet-500/20 to-fuchsia-500/5",
};

const fmtInt = (n: number) => (n || 0).toLocaleString("th-TH");
const fmtMoney = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
};

export default function AiUsageDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useAiDashboardData();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted/60 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-10 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
          <p className="font-semibold">โหลดข้อมูล AI Dashboard ไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">{(error as any)?.message}</p>
          <button onClick={() => refetch()} className="text-sm text-primary underline">ลองใหม่</button>
        </CardContent>
      </Card>
    );
  }

  const { keys, usage } = data;

  // ─── Derive real usage from ai_usage_logs (counters in ai_provider_keys are unreliable) ──
  const todayISO = todayBangkok();
  const mapProviderType = (name: string | null | undefined): string => {
    const n = (name || "").toLowerCase();
    if (n.includes("openrouter")) return "openrouter";
    if (n.includes("openai") || n.includes("gpt")) return "openai";
    if (n.includes("groq") || n.includes("llama")) return "groq";
    if (n.includes("gemini") || n.includes("google")) return "gemini";
    return "other";
  };
  const usedTodayByProv = new Map<string, number>();
  const usedTotalByProv = new Map<string, number>();
  usage.forEach((r) => {
    const p = mapProviderType(r.provider_name);
    const t = (r.tokens_input || 0) + (r.tokens_output || 0);
    usedTotalByProv.set(p, (usedTotalByProv.get(p) || 0) + t);
    if (r.created_at.startsWith(todayISO)) {
      usedTodayByProv.set(p, (usedTodayByProv.get(p) || 0) + t);
    }
  });

  // ─── Pool credits ───────────────────────────────────
  const activeKeys = keys.filter((k) => k.status === "active");
  const cooldownKeys = keys.filter((k) => k.status === "cooldown");
  const disabledKeys = keys.filter((k) => k.status === "disabled");
  const totalDailyLimit = keys.reduce((s, k) => s + (k.daily_limit || 0), 0);
  const hasDailyLimit = totalDailyLimit > 0;
  const totalUsedToday = Array.from(usedTodayByProv.values()).reduce((s, v) => s + v, 0);
  const totalUsedAll = Array.from(usedTotalByProv.values()).reduce((s, v) => s + v, 0);
  const remainingToday = hasDailyLimit ? Math.max(0, totalDailyLimit - totalUsedToday) : 0;
  const usagePct = hasDailyLimit ? Math.min(100, (totalUsedToday / totalDailyLimit) * 100) : 0;

  // Group keys by provider — used is derived from logs, not the stale counter
  const providerMap = new Map<string, { total: number; used: number; limit: number; keys: KeyRow[] }>();
  keys.forEach((k) => {
    const cur = providerMap.get(k.provider_type) || { total: 0, used: 0, limit: 0, keys: [] };
    cur.total += 1;
    cur.limit += k.daily_limit || 0;
    cur.keys.push(k);
    providerMap.set(k.provider_type, cur);
  });
  providerMap.forEach((v, type) => {
    v.used = usedTodayByProv.get(type) || 0;
  });
  const providerCards = Array.from(providerMap.entries()).map(([type, v]) => ({ type, ...v }));


  // ─── Usage logs stats ────────────────────────────────
  const totalTokensIn = usage.reduce((s, r) => s + (r.tokens_input || 0), 0);
  const totalTokensOut = usage.reduce((s, r) => s + (r.tokens_output || 0), 0);
  const totalCost = usage.reduce((s, r) => s + (Number(r.estimated_cost) || 0), 0);
  const totalCalls = usage.length;
  const successCalls = usage.filter((r) => r.success !== false).length;
  const failedCalls = totalCalls - successCalls;
  const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 100;
  const avgLatency = totalCalls > 0
    ? Math.round(usage.reduce((s, r) => s + (r.latency_ms || 0), 0) / totalCalls)
    : 0;

  // Daily trend last 30 days
  const dayMap = new Map<string, { in: number; out: number; cost: number; calls: number }>();
  usage.forEach((r) => {
    const d = r.created_at.slice(0, 10);
    const cur = dayMap.get(d) || { in: 0, out: 0, cost: 0, calls: 0 };
    cur.in += r.tokens_input || 0;
    cur.out += r.tokens_output || 0;
    cur.cost += Number(r.estimated_cost) || 0;
    cur.calls += 1;
    dayMap.set(d, cur);
  });
  const dailyTrend = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date: date.slice(5), tokens: v.in + v.out, ...v, cost: Number(v.cost.toFixed(4)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Today's usage (from logs)

  const todayLogs = usage.filter((r) => r.created_at.startsWith(todayISO));
  const todayTokens = todayLogs.reduce((s, r) => s + (r.tokens_input || 0) + (r.tokens_output || 0), 0);
  const todayCost = todayLogs.reduce((s, r) => s + (Number(r.estimated_cost) || 0), 0);

  // Top functions
  const funcMap = new Map<string, { calls: number; tokens: number; cost: number }>();
  usage.forEach((r) => {
    const f = r.function_name || "ไม่ระบุ";
    const cur = funcMap.get(f) || { calls: 0, tokens: 0, cost: 0 };
    cur.calls += 1;
    cur.tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
    cur.cost += Number(r.estimated_cost) || 0;
    funcMap.set(f, cur);
  });
  const topFunctions = Array.from(funcMap.entries())
    .map(([name, v]) => ({ name, ...v, cost: Number(v.cost.toFixed(4)) }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);

  // Top models
  const modelMap = new Map<string, { calls: number; tokens: number; cost: number }>();
  usage.forEach((r) => {
    const m = r.model || "ไม่ระบุ";
    const cur = modelMap.get(m) || { calls: 0, tokens: 0, cost: 0 };
    cur.calls += 1;
    cur.tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
    cur.cost += Number(r.estimated_cost) || 0;
    modelMap.set(m, cur);
  });
  const topModels = Array.from(modelMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);

  // Provider usage from logs
  const provUsageMap = new Map<string, number>();
  usage.forEach((r) => {
    const p = r.provider_name || "ไม่ระบุ";
    provUsageMap.set(p, (provUsageMap.get(p) || 0) + (r.tokens_input || 0) + (r.tokens_output || 0));
  });
  const providerUsagePie = Array.from(provUsageMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent p-6">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -left-10 -bottom-10 w-56 h-56 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-background/70 backdrop-blur border flex items-center justify-center ring-4 ring-primary/20">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge variant="secondary" className="mb-2 text-[10px] uppercase tracking-widest">AI Providers</Badge>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">แดชบอร์ดการใช้งาน AI</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              เครดิตคงเหลือ · การใช้งานต่อวัน · ฟังก์ชันและโมเดลยอดนิยม (30 วันย้อนหลัง)
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1">
            <Badge variant="outline" className="gap-1"><Layers className="w-3 h-3" />{keys.length} keys</Badge>
            <Badge variant="outline" className="gap-1"><Activity className="w-3 h-3" />{activeKeys.length} active</Badge>
          </div>
        </div>
      </div>

      {/* Pool credits overview */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> เครดิตในคลัง Key Pool (วันนี้)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl border bg-gradient-to-br from-success/10 to-transparent p-4">
              <div className="text-xs text-muted-foreground">คงเหลือวันนี้ (tokens)</div>
              <div className="text-3xl font-bold text-success tabular-nums mt-1">
                {hasDailyLimit ? fmtCompact(remainingToday) : "∞"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {hasDailyLimit ? `จากโควต้ารายวัน ${fmtCompact(totalDailyLimit)}` : "ไม่ได้ตั้งโควต้ารายวัน"}
              </div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-warning/10 to-transparent p-4">
              <div className="text-xs text-muted-foreground">ใช้ไปวันนี้ (tokens)</div>
              <div className="text-3xl font-bold text-warning tabular-nums mt-1">{fmtCompact(totalUsedToday)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {hasDailyLimit ? `${usagePct.toFixed(1)}% ของโควต้ารายวัน` : `${fmtInt(totalUsedToday)} tokens`}
              </div>
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
              <div className="text-xs text-muted-foreground">ใช้สะสม 30 วัน (tokens)</div>
              <div className="text-3xl font-bold text-primary tabular-nums mt-1">{fmtCompact(totalUsedAll)}</div>
              <div className="text-xs text-muted-foreground mt-1">จาก ai_usage_logs</div>
            </div>
          </div>
          {hasDailyLimit ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">การใช้โควต้ารายวัน</span>
                <span className="tabular-nums font-semibold">{fmtCompact(totalUsedToday)} / {fmtCompact(totalDailyLimit)}</span>
              </div>
              <Progress value={usagePct} className="h-3" />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
              <span>ยังไม่ได้ตั้ง <b>daily_limit</b> ให้กับ key — ตั้งค่าที่แท็บ Key Pool เพื่อให้ระบบเตือนเมื่อใกล้เต็มโควต้า</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <Badge className="bg-success/15 text-success border-success/30" variant="outline">
              <Zap className="w-3 h-3 mr-1" /> Active {activeKeys.length}
            </Badge>
            <Badge className="bg-warning/15 text-warning border-warning/30" variant="outline">
              <Timer className="w-3 h-3 mr-1" /> Cooldown {cooldownKeys.length}
            </Badge>
            <Badge className="bg-muted text-muted-foreground" variant="outline">
              Disabled {disabledKeys.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Per-provider pool cards */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> คลัง Key แยกตามผู้ให้บริการ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {providerCards.map((p) => {
            const hasLimit = p.limit > 0;
            const pct = hasLimit ? Math.min(100, (p.used / p.limit) * 100) : 0;
            const remaining = hasLimit ? Math.max(0, p.limit - p.used) : 0;
            return (
              <div key={p.type} className={`rounded-xl border p-4 bg-gradient-to-br ${providerTone[p.type] || "from-primary/10 to-transparent"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{providerLabel[p.type] || p.type}</div>
                  <Badge variant="outline" className="text-[10px]">{p.total} keys</Badge>
                </div>
                <div className="text-2xl font-bold tabular-nums mb-1">
                  {hasLimit ? fmtCompact(remaining) : fmtCompact(p.used)}
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  {hasLimit ? "เครดิตคงเหลือวันนี้" : "ใช้ไปวันนี้ (ไม่จำกัดโควต้า)"}
                </div>
                <Progress value={pct} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                  <span>ใช้ {fmtCompact(p.used)}</span>
                  <span>{hasLimit ? `โควต้า ${fmtCompact(p.limit)}` : "ไม่จำกัด"}</span>
                </div>
              </div>
            );
          })}

          {providerCards.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">ยังไม่มี API key ในคลัง — เพิ่มได้จากแท็บ Key Pool</p>
          )}
        </div>
      </div>

      {/* Usage KPIs */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> สถิติการใช้งาน (30 วัน)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Tokens วันนี้" value={fmtCompact(todayTokens)} icon={Coins} tone="warning" hint={`ค่าใช้จ่าย ${fmtMoney(todayCost)}`} />
          <StatCard label="Tokens (30 วัน)" value={fmtCompact(totalTokensIn + totalTokensOut)} icon={Coins} tone="primary" hint={`in ${fmtCompact(totalTokensIn)} · out ${fmtCompact(totalTokensOut)}`} />
          <StatCard label="ค่าใช้จ่าย (30 วัน)" value={fmtMoney(totalCost)} icon={Wallet} tone="success" hint={`ต่อวันเฉลี่ย ${fmtMoney(totalCost / Math.max(1, dailyTrend.length))}`} />
          <StatCard label="จำนวนคำขอ" value={fmtInt(totalCalls)} icon={ArrowDownUp} tone="info" hint={`สำเร็จ ${successRate.toFixed(1)}%`} />
          <StatCard label="Latency เฉลี่ย" value={`${fmtInt(avgLatency)} ms`} icon={Gauge} tone="accent" />
          <StatCard label="คำขอที่ล้มเหลว" value={fmtInt(failedCalls)} icon={AlertTriangle} tone={failedCalls > 0 ? "destructive" : "muted"} />
          <StatCard label="Models ที่ใช้" value={modelMap.size} icon={Cpu} tone="accent" />
          <StatCard label="Functions ที่ใช้" value={funcMap.size} icon={Sparkles} tone="primary" />
        </div>
      </div>

      {/* Charts row: daily trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Token ต่อวัน (30 วัน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={fmtCompact} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any, n: any) => [fmtInt(Number(v)), n === "in" ? "Input" : n === "out" ? "Output" : n]}
                />
                <Legend />
                <Area type="monotone" dataKey="in" name="Input" stroke="hsl(var(--primary))" fill="url(#gradIn)" />
                <Area type="monotone" dataKey="out" name="Output" stroke="hsl(var(--accent))" fill="url(#gradOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> ค่าใช้จ่ายรายวัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => fmtMoney(Number(v))}
                />
                <Bar dataKey="cost" name="Cost ($)" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top functions + models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> ฟังก์ชันที่ใช้ AI มากสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topFunctions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูลการใช้งาน</p>
            ) : (
              <div className="space-y-3">
                {topFunctions.map((f, i) => {
                  const max = topFunctions[0].tokens || 1;
                  const pct = (f.tokens / max) * 100;
                  return (
                    <div key={f.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0"
                               style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>
                            {i + 1}
                          </div>
                          <span className="font-medium truncate">{f.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                          {fmtCompact(f.tokens)} tokens · {f.calls} calls
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                             style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{fmtMoney(f.cost)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" /> โมเดล AI ที่ใช้มากสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topModels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูลการใช้งาน</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topModels} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={fmtCompact} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: any, n: any) => n === "tokens" ? [fmtInt(Number(v)), "Tokens"] : [v, n]}
                  />
                  <Bar dataKey="tokens" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider usage pie + key detail table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> สัดส่วน Token ตามผู้ให้บริการ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {providerUsagePie.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูล</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={providerUsagePie} dataKey="value" nameKey="name" outerRadius={100} innerRadius={55} paddingAngle={2}>
                    {providerUsagePie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: any) => fmtInt(Number(v)) + " tokens"}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Key ที่ใกล้เต็มโควต้าวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มี key</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                {[...keys]
                  .map((k) => ({
                    ...k,
                    pct: k.daily_limit ? Math.min(100, ((k.used_today || 0) / k.daily_limit) * 100) : 0,
                  }))
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, 12)
                  .map((k) => (
                    <div key={k.id} className="rounded-lg border bg-card/50 p-2.5">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {providerLabel[k.provider_type] || k.provider_type}
                          </Badge>
                          <span className="truncate font-medium">{k.label || "(no label)"}</span>
                        </div>
                        <span className={`text-xs tabular-nums font-semibold ${
                          k.pct >= 90 ? "text-destructive" : k.pct >= 60 ? "text-warning" : "text-success"
                        }`}>
                          {k.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            k.pct >= 90 ? "bg-destructive" : k.pct >= 60 ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${k.pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                        <span>{fmtInt(k.used_today)} / {fmtInt(k.daily_limit || 0)} วันนี้</span>
                        <span>รวม {fmtCompact(k.used_total)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
