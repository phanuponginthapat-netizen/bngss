import { useEffect, useState } from "react";
import LiffShell from "./LiffShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Star, FileText, Newspaper, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";

type FeedItem = {
  id: string;
  date: string;
  kind: "attendance" | "behavior" | "leave" | "news" | "homework";
  title: string;
  detail?: string;
  studentName?: string;
  meta?: any;
};

function fmtDate(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return d;
  }
}

function iconFor(item: FeedItem) {
  if (item.kind === "attendance") {
    const s = item.meta?.status;
    if (s === "present") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (s === "absent") return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  }
  if (item.kind === "behavior") return <Star className="h-4 w-4 text-info" />;
  if (item.kind === "leave") return <FileText className="h-4 w-4 text-info" />;
  if (item.kind === "news") return <Newspaper className="h-4 w-4 text-primary" />;
  return <CalendarDays className="h-4 w-4 text-muted-foreground" />;
}

function Timeline({ lineUserId }: { lineUserId: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentNames, setStudentNames] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: studs } = await supabase
          .from("students")
          .select("id,prefix,first_name,last_name")
          .or(`line_user_id.eq.${lineUserId},line_user_id_2.eq.${lineUserId},line_user_id_3.eq.${lineUserId}`);
        const ids = (studs ?? []).map((s) => s.id);
        const nameMap = new Map<string, string>(
          (studs ?? []).map((s: any) => [s.id, `${s.prefix ?? ""}${s.first_name} ${s.last_name}`]),
        );
        setStudentNames(Array.from(nameMap.values()));

        if (!ids.length) {
          setItems([]);
          return;
        }

        const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
        const feed: FeedItem[] = [];

        const [{ data: att }, { data: bh }, { data: lv }, { data: news }] = await Promise.all([
          supabase
            .from("attendance")
            .select("id,student_id,status,attendance_date,note")
            .in("student_id", ids)
            .gte("attendance_date", since)
            .order("attendance_date", { ascending: false }),
          supabase
            .from("behavior_records")
            .select("id,student_id,description,behavior_type,points,record_date")
            .in("student_id", ids)
            .gte("record_date", since)
            .order("record_date", { ascending: false }),
          supabase
            .from("student_leaves")
            .select("id,student_id,leave_type,reason,start_date,end_date,status")
            .in("student_id", ids)
            .gte("start_date", since)
            .order("start_date", { ascending: false }),
          supabase
            .from("news_posts")
            .select("id,title,published_at,content")
            .eq("is_published", true)
            .gte("published_at", since)
            .order("published_at", { ascending: false })
            .limit(5),
        ]);

        (att ?? []).forEach((a: any) =>
          feed.push({
            id: `att-${a.id}`,
            date: a.attendance_date,
            kind: "attendance",
            title: `เช็คชื่อ: ${a.status === "present" ? "มาเรียน" : a.status === "absent" ? "ขาด" : a.status === "late" ? "สาย" : a.status}`,
            detail: a.note ?? undefined,
            studentName: nameMap.get(a.student_id),
            meta: { status: a.status },
          }),
        );
        (bh ?? []).forEach((b: any) =>
          feed.push({
            id: `bh-${b.id}`,
            date: b.record_date,
            kind: "behavior",
            title: `${b.behavior_type === "positive" ? "พฤติกรรมเชิงบวก" : "พฤติกรรมที่ต้องปรับ"} (${b.points > 0 ? "+" : ""}${b.points})`,
            detail: b.description,
            studentName: nameMap.get(b.student_id),
          }),
        );
        (lv ?? []).forEach((l: any) =>
          feed.push({
            id: `lv-${l.id}`,
            date: l.start_date,
            kind: "leave",
            title: `คำขอลา (${l.leave_type}) — ${l.status}`,
            detail: `${l.start_date} → ${l.end_date}: ${l.reason ?? ""}`,
            studentName: nameMap.get(l.student_id),
          }),
        );
        (news ?? []).forEach((n: any) =>
          feed.push({
            id: `news-${n.id}`,
            date: (n.published_at ?? "").slice(0, 10),
            kind: "news",
            title: n.title,
            detail: typeof n.content === "string" ? n.content.slice(0, 120) : undefined,
          }),
        );

        feed.sort((a, b) => (a.date < b.date ? 1 : -1));
        setItems(feed);
      } finally {
        setLoading(false);
      }
    })();
  }, [lineUserId]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-6 w-6 text-primary" />
      </div>
    );

  if (!items.length)
    return (
      <EmptyState
        icon={Inbox}
        title="ยังไม่มีกิจกรรม"
        description="ยังไม่มีรายการเช็คชื่อ พฤติกรรม หรือคำขอลาภายใน 14 วันที่ผ่านมา"
      />
    );

  // Group by date
  const grouped = new Map<string, FeedItem[]>();
  items.forEach((i) => {
    if (!grouped.has(i.date)) grouped.set(i.date, []);
    grouped.get(i.date)!.push(i);
  });

  return (
    <div className="space-y-4">
      {studentNames.length > 0 && (
        <div className="text-sm text-muted-foreground">
          กำลังดูข้อมูลของ:{" "}
          <span className="font-medium text-foreground">{studentNames.join(", ")}</span>
        </div>
      )}
      {Array.from(grouped.entries()).map(([date, list]) => (
        <div key={date}>
          <div className="text-xs font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
            {fmtDate(date)}
          </div>
          <div className="space-y-2">
            {list.map((it) => (
              <Card key={it.id} className="border-l-4 border-l-primary/40">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-1">{iconFor(it)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{it.title}</span>
                        {it.studentName && (
                          <Badge variant="outline" className="text-xs">
                            {it.studentName}
                          </Badge>
                        )}
                      </div>
                      {it.detail && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">{it.detail}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LiffTimelinePage() {
  return (
    <LiffShell title="ไทม์ไลน์นักเรียน (14 วัน)">
      {(uid) => <Timeline lineUserId={uid} />}
    </LiffShell>
  );
}
