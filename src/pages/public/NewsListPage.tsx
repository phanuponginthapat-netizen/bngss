import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Calendar } from "lucide-react";

export default function NewsListPage() {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("id, title, content, cover_image_url, category, published_at, is_published")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(60);
      setPosts(data || []);
    })();
  }, []);

  return (
    <PublicPageLayout title="ข่าวสาร / กิจกรรม" subtitle="ข่าวและกิจกรรมของโรงเรียน" breadcrumbs={[{ label: "ข่าวสาร" }]}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.id} to={`/dashboard/news/${p.id}`} className="group overflow-hidden rounded-2xl border border-border/50 bg-background/70 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="aspect-video overflow-hidden bg-muted">
              {p.cover_url ? (
                <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-orange-100">
                  <Calendar className="h-12 w-12 text-primary/50" />
                </div>
              )}
            </div>
            <div className="p-5">
              {p.category && <span className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{p.category}</span>}
              <h3 className="line-clamp-2 font-bold text-foreground group-hover:text-primary">{p.title}</h3>
              {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>}
              {p.published_at && <div className="mt-3 text-xs text-muted-foreground">{new Date(p.published_at).toLocaleDateString("th-TH")}</div>}
            </div>
          </Link>
        ))}
      </div>
      {posts.length === 0 && <div className="py-20 text-center text-muted-foreground">ยังไม่มีข่าว</div>}
    </PublicPageLayout>
  );
}
