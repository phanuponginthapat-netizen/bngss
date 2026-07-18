import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart3, RefreshCw, Loader2, Infinity as InfinityIcon, AlertTriangle } from "lucide-react";

const TYPE_LABELS: Record<string, { th: string; en: string }> = {
  attendance: { th: "เช็คชื่อ/ขาด-ลา-มาสาย", en: "Attendance" },
  face_scan: { th: "สแกนใบหน้าเข้า-ออก", en: "Face scan" },
  behavior: { th: "พฤติกรรมนักเรียน", en: "Behavior" },
  score: { th: "คะแนน/ผลการเรียน", en: "Scores" },
  homework: { th: "การบ้าน", en: "Homework" },
  news: { th: "ข่าวสาร/ประกาศ", en: "News" },
  emergency: { th: "เหตุฉุกเฉิน", en: "Emergency" },
  leave: { th: "การลา", en: "Leave" },
  eform: { th: "เอกสาร E-Form", en: "E-Form" },
  debug_test: { th: "ทดสอบระบบ", en: "System test" },
  other: { th: "อื่น ๆ", en: "Other" },
};

export default function LineQuotaCard({ enabled }: { enabled: boolean }) {
  const { lang } = useLanguage();
  const isTh = lang === "th";

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["line-quota"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("line-quota", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        quota: { type: string; value: number };
        consumption: { totalUsage: number };
        breakdown: Record<string, { sent: number; failed: number; skipped: number }>;
        totals: { sent: number; failed: number; skipped: number };
        period_start: string;
      };
    },
    enabled,
    staleTime: 60_000,
    retry: 0,
  });

  const unlimited = data?.quota?.type !== "limited";
  const limit = data?.quota?.value ?? 0;
  const used = data?.consumption?.totalUsage ?? 0;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const danger = pct >= 90;

  const sorted = Object.entries(data?.breakdown || {}).sort(
    (a, b) => (b[1].sent + b[1].failed + b[1].skipped) - (a[1].sent + a[1].failed + a[1].skipped)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {isTh ? "โควต้าข้อความ LINE เดือนนี้" : "LINE Message Quota (This Month)"}
          </CardTitle>
          <CardDescription>
            {isTh
              ? "นับเฉพาะข้อความที่กินโควต้า (Push / Multicast / Broadcast) — ข้อความตอบกลับ (Reply) และ Auto-reply ฟรีไม่จำกัด"
              : "Only Push/Multicast/Broadcast count. Reply messages are free unlimited."}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!enabled || isFetching}>
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enabled && (
          <p className="text-sm text-muted-foreground">
            {isTh ? "กรุณาตั้งค่า Channel Access Token ก่อน" : "Configure Channel Access Token first"}
          </p>
        )}

        {enabled && isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {isTh ? "กำลังโหลด..." : "Loading..."}
          </div>
        )}

        {enabled && error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>{(error as Error).message}</span>
          </div>
        )}

        {enabled && data && (
          <>
            {unlimited ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-success-soft dark:bg-success/30 border border-success/30 dark:border-success/30">
                <InfinityIcon className="w-8 h-8 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">{isTh ? "แพ็กเกจ" : "Plan"}</p>
                  <p className="text-lg font-bold text-success dark:text-success">
                    {isTh ? "ไม่จำกัด (Unlimited)" : "Unlimited"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isTh ? `ส่งไปแล้วเดือนนี้ ${used.toLocaleString()} ข้อความ` : `Sent this month: ${used.toLocaleString()} messages`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">
                    {isTh ? "ใช้ไปแล้ว" : "Used"}
                  </span>
                  <span className={`text-sm font-semibold ${danger ? "text-destructive" : ""}`}>
                    {used.toLocaleString()} / {limit.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <Progress value={pct} className={danger ? "[&>div]:bg-destructive" : ""} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{isTh ? "เหลือ" : "Remaining"}: <b className="text-foreground">{remaining.toLocaleString()}</b></span>
                  {danger && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" /> {isTh ? "ใกล้เต็มโควต้า" : "Near limit"}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">
                {isTh ? "ใช้ส่งอะไรไปบ้าง (จากบันทึกระบบ)" : "Breakdown by purpose (from system logs)"}
              </p>
              {sorted.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  {isTh ? "ยังไม่มีการส่งข้อความเดือนนี้" : "No messages sent this month"}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sorted.map(([type, stats]) => {
                    const total = stats.sent + stats.failed + stats.skipped;
                    const label = TYPE_LABELS[type]?.[isTh ? "th" : "en"] || type;
                    return (
                      <div key={type} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                        <span className="flex-1 truncate">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {isTh ? `ส่ง ${stats.sent}` : `sent ${stats.sent}`}
                          </Badge>
                          {stats.failed > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {isTh ? `ล้มเหลว ${stats.failed}` : `failed ${stats.failed}`}
                            </Badge>
                          )}
                          {stats.skipped > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {isTh ? `ข้าม ${stats.skipped}` : `skipped ${stats.skipped}`}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground w-10 text-right">{total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                {isTh
                  ? "* ตัวเลขโควต้าด้านบนมาจาก LINE โดยตรง ส่วนการแยกประเภทนับจากบันทึกการส่งของระบบ (อาจต่างเล็กน้อยถ้ามีการส่งจากนอกระบบ)"
                  : "* Quota numbers come from LINE; breakdown is from system delivery logs."}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
