import { useEffect, useState } from "react";
import { Award, Sparkles, Palette, Trees } from "lucide-react";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { getSchoolInfo } from "@/lib/schoolInfo";

export default function PhilosophyPage() {
  const [phil, setPhil] = useState<any>(null);
  const [id, setId] = useState<any>(null);
  useEffect(() => {
    Promise.all([getSchoolInfo("philosophy"), getSchoolInfo("identity")]).then(([p, i]) => { setPhil(p); setId(i); });
  }, []);
  const p = phil?.content || {};
  const i = id?.content || {};

  return (
    <PublicPageLayout
      title="ปรัชญา / คำขวัญ / อัตลักษณ์"
      subtitle="สิ่งที่หล่อหลอมชาวเรา"
      breadcrumbs={[{ label: "เกี่ยวกับโรงเรียน" }, { label: "ปรัชญา" }]}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-orange-100/30 p-10 text-center shadow-sm">
          <Award className="mx-auto mb-4 h-12 w-12 text-primary" />
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">ปรัชญา</div>
          <p className="mt-3 font-outfit text-2xl font-bold text-foreground sm:text-3xl">{p.philosophy || "—"}</p>
          {p.motto && (
            <>
              <div className="mt-8 text-xs font-semibold uppercase tracking-widest text-orange-600">คำขวัญ</div>
              <p className="mt-2 text-xl italic text-foreground/80">"{p.motto}"</p>
            </>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-background/70 p-6 shadow-sm">
            <Sparkles className="mb-3 h-7 w-7 text-primary" />
            <h3 className="mb-1 text-lg font-bold">อัตลักษณ์</h3>
            <p className="text-sm text-foreground/80">{i.identity || "—"}</p>
            <h3 className="mt-5 mb-1 text-lg font-bold">เอกลักษณ์</h3>
            <p className="text-sm text-foreground/80">{i.uniqueness || "—"}</p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-background/70 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Palette className="h-6 w-6 text-orange-500" />
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">สีประจำโรงเรียน</div>
                <div className="text-lg font-semibold">{p.colors || "—"}</div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Trees className="h-6 w-6 text-emerald-500" />
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">ต้นไม้ประจำโรงเรียน</div>
                <div className="text-lg font-semibold">{p.tree || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  );
}
