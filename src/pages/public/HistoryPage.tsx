import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { getSchoolInfo } from "@/lib/schoolInfo";

export default function HistoryPage() {
  const [info, setInfo] = useState<any>(null);
  useEffect(() => { getSchoolInfo("history").then(setInfo); }, []);

  return (
    <PublicPageLayout
      title={info?.title || "ประวัติสถานศึกษา"}
      subtitle={info?.subtitle || "ความเป็นมาของโรงเรียน"}
      breadcrumbs={[{ label: "เกี่ยวกับโรงเรียน" }, { label: "ประวัติ" }]}
      cover={info?.cover_image}
    >
      <article className="prose prose-lg mx-auto max-w-4xl rounded-3xl border border-border/50 bg-background/70 p-8 shadow-sm backdrop-blur">
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(info?.content?.body || "<p>กำลังโหลด...</p>") }} />
        {Array.isArray(info?.content?.timeline) && info.content.timeline.length > 0 && (
          <div className="not-prose mt-10">
            <h3 className="mb-6 text-xl font-bold">ไทม์ไลน์</h3>
            <ol className="relative space-y-6 border-l-2 border-primary/30 pl-6">
              {info.content.timeline.map((t: any, i: number) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[34px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                  <div className="font-semibold text-primary">{t.year}</div>
                  <div className="text-sm text-foreground/80">{t.text}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </article>
    </PublicPageLayout>
  );
}
