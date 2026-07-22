import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { BookOpen } from "lucide-react";

interface SG { subject_group: string; count: number; head?: string | null }

export default function SubjectGroupsPage() {
  const [groups, setGroups] = useState<SG[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("personnel").select("subject_group");
      const counts = new Map<string, number>();
      (data || []).forEach((r: any) => {
        const g = r.subject_group;
        if (!g) return;
        counts.set(g, (counts.get(g) || 0) + 1);
      });
      setGroups(Array.from(counts.entries()).map(([subject_group, count]) => ({ subject_group, count })).sort((a, b) => b.count - a.count));
    })();
  }, []);

  return (
    <PublicPageLayout
      title="กลุ่มสาระการเรียนรู้"
      subtitle="8 กลุ่มสาระของโรงเรียน"
      breadcrumbs={[{ label: "บุคลากร" }, { label: "กลุ่มสาระ" }]}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.subject_group} className="rounded-2xl border border-border/50 bg-background/70 p-6 shadow-sm backdrop-blur">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold">{g.subject_group}</h3>
            <p className="text-sm text-muted-foreground">ครู {g.count} คน</p>
          </div>
        ))}
      </div>
      {groups.length === 0 && <div className="py-20 text-center text-muted-foreground">ยังไม่มีข้อมูลกลุ่มสาระ</div>}
    </PublicPageLayout>
  );
}
