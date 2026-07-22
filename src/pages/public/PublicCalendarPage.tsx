import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Calendar as CalIcon, MapPin } from "lucide-react";

export default function PublicCalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("academic_events")
        .select("id, title, description, start_at, end_at, location, category")
        .gte("start_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        .order("start_at", { ascending: true })
        .limit(80);
      setEvents(data || []);
    })();
  }, []);

  return (
    <PublicPageLayout title="ปฏิทินการศึกษา" subtitle="กิจกรรมและวันสำคัญ" breadcrumbs={[{ label: "วิชาการ" }, { label: "ปฏิทิน" }]}>
      <div className="mx-auto max-w-3xl space-y-3">
        {events.map((e) => {
          const d = new Date(e.start_at);
          return (
            <div key={e.id} className="flex gap-4 rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm backdrop-blur">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                <div className="text-xs font-semibold uppercase">{d.toLocaleString("th-TH", { month: "short" })}</div>
                <div className="text-2xl font-bold leading-none">{d.getDate()}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-foreground">{e.title}</div>
                {e.description && <p className="line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalIcon className="h-3.5 w-3.5" />{d.toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && <div className="py-20 text-center text-muted-foreground">ไม่มีกิจกรรมในช่วงนี้</div>}
      </div>
    </PublicPageLayout>
  );
}
