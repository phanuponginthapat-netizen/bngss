import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, ArrowRight, AlertTriangle, TrendingUp, Lightbulb,
  PartyPopper, ShieldAlert, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Insight {
  id: string;
  type: "anomaly" | "opportunity" | "warning" | "recommendation" | "celebration";
  title: string;
  detail: string;
  metric?: string;
  action?: { label: string; url: string };
  priority: "high" | "medium" | "low";
}

const TYPE_META: Record<Insight["type"], { icon: typeof Sparkles; tone: string; bg: string }> = {
  anomaly:        { icon: ShieldAlert,   tone: "text-destructive", bg: "from-destructive/10 to-danger/5 border-destructive/20" },
  opportunity:    { icon: TrendingUp,    tone: "text-success",     bg: "from-success/10 to-success/5 border-success/20" },
  warning:        { icon: AlertTriangle, tone: "text-warning",     bg: "from-warning/10 to-warning/5 border-warning/20" },
  recommendation: { icon: Lightbulb,     tone: "text-primary",     bg: "from-primary/10 to-info/5 border-primary/20" },
  celebration:    { icon: PartyPopper,   tone: "text-info",  bg: "from-info/10 to-danger/5 border-info/20" },
};

// Explicit allow-list of valid dashboard routes (must exist in src/App.tsx).
// AI-suggested URLs outside this list would 404, so we map or fall back.
const VALID_ROUTES = new Set<string>([
  "/dashboard",
  "/dashboard/classic",
  "/dashboard/profile",
  "/dashboard/inbox",
  "/dashboard/users",
  "/dashboard/feed",
  "/dashboard/hub",
  "/dashboard/homework",
  "/dashboard/learning",
  "/dashboard/fitness",
  "/dashboard/activities",
  // Student affairs
  "/dashboard/student/attendance",
  "/dashboard/student/face-scan",
  "/dashboard/student/behavior",
  "/dashboard/student/leave",
  "/dashboard/student/screening",
  "/dashboard/student/health-trend",
  "/dashboard/student/homeroom",
  "/dashboard/student/sdq",
  // Academic
  "/dashboard/academic/management",
  "/dashboard/academic/schedule",
  "/dashboard/academic/pp5",
  "/dashboard/academic/pp6",
  "/dashboard/academic/pp3",
  "/dashboard/academic/pp4",
  "/dashboard/academic/pp7",
  "/dashboard/academic/pp8",
  "/dashboard/academic/calendar",
  "/dashboard/academic/all-students",
  "/dashboard/academic/alumni",
  // Admin
  "/dashboard/admin/news",
  "/dashboard/admin/document",
  "/dashboard/admin/eform",
  "/dashboard/admin/rooms",
  "/dashboard/admin/cctv-live",
  "/dashboard/admin/early-warning",
  "/dashboard/admin/ai-logs",
  "/dashboard/admin/line-oa",
  // Finance / HR
  "/dashboard/finance/budget",
  "/dashboard/finance/assets",
  "/dashboard/finance/scholarships",
  "/dashboard/hr/personnel",
  "/dashboard/hr/evaluation",
  // Other modules
  "/dashboard/library/books",
  "/dashboard/cafeteria/menus",
  "/dashboard/bus/routes",
  "/dashboard/clubs",
  "/dashboard/settings/notifications",
]);

// Keyword → canonical route fallback (for when AI returns close-but-wrong paths)
const KEYWORD_ROUTES: Array<[RegExp, string]> = [
  [/attendance|ขาดเรียน|เช็คชื่อ|มาเรียน/i, "/dashboard/student/attendance"],
  [/leave|ใบลา|การลา/i, "/dashboard/student/leave"],
  [/behavior|พฤติกรรม/i, "/dashboard/student/behavior"],
  [/news|ข่าว|ประกาศ/i, "/dashboard/admin/news"],
  [/homework|การบ้าน/i, "/dashboard/homework"],
  [/eform|เอกสาร/i, "/dashboard/admin/eform"],
  [/health|สุขภาพ/i, "/dashboard/student/health-trend"],
  [/schedule|ตารางเรียน|ตารางสอน/i, "/dashboard/academic/schedule"],
  [/budget|งบประมาณ/i, "/dashboard/finance/budget"],
  [/asset|ทรัพย์สิน|ครุภัณฑ์/i, "/dashboard/finance/assets"],
  [/personnel|บุคลากร|ครู/i, "/dashboard/hr/personnel"],
  [/library|ห้องสมุด/i, "/dashboard/library/books"],
  [/cafeteria|โรงอาหาร|อาหาร/i, "/dashboard/cafeteria/menus"],
  [/club|ชุมนุม|ชมรม/i, "/dashboard/clubs"],
];

function resolveInsightUrl(raw?: string, context?: string): string {
  const url = raw ? (raw.startsWith("/") ? raw : `/${raw}`) : "";
  const cleaned = url.split("?")[0].split("#")[0].replace(/\/$/, "") || url;
  if (VALID_ROUTES.has(cleaned)) return cleaned;
  // Try prefixing with /dashboard
  const withDash = cleaned.startsWith("/dashboard") ? cleaned : `/dashboard${cleaned}`;
  if (VALID_ROUTES.has(withDash)) return withDash;
  // Keyword fallback based on URL string + context (title/detail)
  const haystack = `${raw ?? ""} ${context ?? ""}`;
  for (const [re, route] of KEYWORD_ROUTES) {
    if (re.test(haystack)) return route;
  }
  return "/dashboard";
}

export default function AIInsightsWidget() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["ai_insights"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: {},
      });
      if (error) throw error;
      return (data?.insights as Insight[]) ?? [];
    },
  });

  const insights = (data ?? []).sort((a, b) => {
    const w = { high: 0, medium: 1, low: 2 } as const;
    return w[a.priority] - w[b.priority];
  });

  const handleRefresh = async () => {
    const toastId = toast.loading(L("กำลังวิเคราะห์...", "Analyzing..."));
    try {
      await refetch();
      toast.success(L("วิเคราะห์ใหม่แล้ว", "Refreshed"), { id: toastId });
    } catch (e) {
      toast.error(L("วิเคราะห์ไม่สำเร็จ", "Failed"), { id: toastId });
    }
  };

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-info to-danger flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            {L("AI วิเคราะห์", "AI Insights")}
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-1">BETA</Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleRefresh}
            disabled={isFetching}
            title={L("วิเคราะห์ใหม่", "Refresh")}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {L("ยังเชื่อมต่อ AI ไม่ได้", "AI service unavailable")}
            </p>
            <Button variant="link" size="sm" onClick={handleRefresh} className="text-xs mt-1">
              {L("ลองใหม่", "Retry")}
            </Button>
          </div>
        ) : insights.length === 0 ? (
          <div className="py-6 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {L("ยังไม่มี insight ใหม่", "No new insights")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.slice(0, 5).map((ins) => {
              const meta = TYPE_META[ins.type] ?? TYPE_META.recommendation;
              const Icon = meta.icon;
              return (
                <div
                  key={ins.id}
                  className={cn(
                    "rounded-xl border bg-gradient-to-br p-3 transition-all hover:shadow-sm",
                    meta.bg
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-8 h-8 rounded-lg bg-background/70 flex items-center justify-center shrink-0", meta.tone)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight text-foreground">{ins.title}</p>
                        {ins.metric && (
                          <span className={cn("text-xs font-bold tabular-nums shrink-0", meta.tone)}>{ins.metric}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{ins.detail}</p>
                      {ins.action && (
                        <button
                          onClick={() => navigate(resolveInsightUrl(ins.action!.url, `${ins.title} ${ins.detail}`))}
                          className={cn(
                            "mt-1.5 text-[11px] font-medium flex items-center gap-1 hover:gap-1.5 transition-all",
                            meta.tone
                          )}
                        >
                          {ins.action.label}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              {L("วิเคราะห์อัตโนมัติด้วย AI · อาจไม่แม่นยำ 100%", "Auto-generated by AI · may not be 100% accurate")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
