import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Target, Compass, Flag, CheckCircle2 } from "lucide-react";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { getSchoolInfo } from "@/lib/schoolInfo";

export default function VisionPage() {
  const [vision, setVision] = useState<any>(null);
  const [mission, setMission] = useState<any>(null);
  const [goals, setGoals] = useState<any>(null);

  useEffect(() => {
    Promise.all([getSchoolInfo("vision"), getSchoolInfo("mission"), getSchoolInfo("goals")]).then(([v, m, g]) => {
      setVision(v); setMission(m); setGoals(g);
    });
  }, []);

  return (
    <PublicPageLayout
      title="วิสัยทัศน์ / พันธกิจ / เป้าประสงค์"
      subtitle="ทิศทางการพัฒนาของโรงเรียน"
      breadcrumbs={[{ label: "เกี่ยวกับโรงเรียน" }, { label: "วิสัยทัศน์" }]}
    >
      <div className="grid gap-6 md:grid-cols-3">
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-7 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="h-6 w-6" />
          </div>
          <h2 className="mb-3 text-xl font-bold">{vision?.title || "วิสัยทัศน์"}</h2>
          <div className="prose prose-sm text-foreground/85" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(vision?.content?.body || "") }} />
        </section>

        <section className="rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-100/60 to-orange-50/30 p-7 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400 text-white">
            <Target className="h-6 w-6" />
          </div>
          <h2 className="mb-3 text-xl font-bold">{mission?.title || "พันธกิจ"}</h2>
          <ul className="space-y-2 text-sm text-foreground/85">
            {(mission?.content?.items || []).map((m: string, i: number) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/60 to-emerald-50/30 p-7 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Flag className="h-6 w-6" />
          </div>
          <h2 className="mb-3 text-xl font-bold">{goals?.title || "เป้าประสงค์"}</h2>
          <ul className="space-y-2 text-sm text-foreground/85">
            {(goals?.content?.items || []).map((m: string, i: number) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PublicPageLayout>
  );
}
