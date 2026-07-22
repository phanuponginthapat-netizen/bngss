import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { FileText, Download } from "lucide-react";

export default function DownloadsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (supabase as any).from("cms_downloads").select("*").eq("is_published", true).order("sort_order").then(({ data }: any) => setRows(data || []));
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    rows.forEach((r) => (g[r.category || "general"] ||= []).push(r));
    return g;
  }, [rows]);

  const bump = async (id: string) => {
    try {
      await (supabase as any).from("cms_downloads").update({ download_count: (rows.find(r => r.id === id)?.download_count || 0) + 1 }).eq("id", id);
    } catch { /* ignore */ }
  };

  return (
    <PublicPageLayout title="ดาวน์โหลดเอกสาร" subtitle="เอกสารสำคัญของโรงเรียน" breadcrumbs={[{ label: "วิชาการ" }, { label: "ดาวน์โหลด" }]}>
      <div className="mx-auto max-w-4xl space-y-8">
        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-3 text-lg font-bold text-primary">{cat}</h2>
            <div className="space-y-2">
              {list.map((r) => (
                <a
                  key={r.id}
                  href={r.file_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => bump(r.id)}
                  className="flex items-center gap-4 rounded-2xl border border-border/50 bg-background/70 p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">{r.title}</div>
                    {r.description && <div className="truncate text-xs text-muted-foreground">{r.description}</div>}
                  </div>
                  <Download className="h-5 w-5 text-primary" />
                </a>
              ))}
            </div>
          </section>
        ))}
        {rows.length === 0 && <div className="py-20 text-center text-muted-foreground">ยังไม่มีเอกสาร</div>}
      </div>
    </PublicPageLayout>
  );
}
