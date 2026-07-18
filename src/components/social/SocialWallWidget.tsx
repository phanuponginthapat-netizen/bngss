import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Facebook, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface SocialPost {
  id: string;
  platform: string;
  content: string | null;
  thumbnail_url: string | null;
  media_urls: string[] | null;
  permalink: string | null;
  posted_at: string | null;
}

interface Props {
  limit?: number;
  compact?: boolean;
  showSync?: boolean;
  title?: string;
  /** "card" = wrap in Card (Dashboard). "bare" = no wrapper, fits inside CMS sections */
  variant?: "card" | "bare";
  /** Tailwind grid cols classes override */
  columns?: string;
}

type RangeKey = "7" | "30" | "all";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7", label: "7 วัน", days: 7 },
  { key: "30", label: "30 วัน", days: 30 },
  { key: "all", label: "ทั้งหมด", days: null },
];

export function SocialWallWidget({
  limit = 6,
  compact = false,
  showSync = false,
  title = "Social Wall",
  variant = "card",
  columns,
}: Props) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState<RangeKey>("30");

  const load = async () => {
    setLoading(true);
    const cfg = RANGES.find((r) => r.key === range)!;
    let q = supabase
      .from("social_posts")
      .select("id,platform,content,thumbnail_url,media_urls,permalink,posted_at")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (cfg.days != null) {
      const since = new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("posted_at", since);
    }
    const { data } = await q;
    setPosts((data as SocialPost[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("social-posts-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_posts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, range]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("social-feed-sync", { body: { broadcast: true, limit: 10 } });
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const gridCols =
    columns ??
    (compact
      ? ""
      : variant === "bare"
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      : "grid grid-cols-1 sm:grid-cols-2 gap-3");

  const RangeTabs = (
    <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
            range === r.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const PostList = (
    <>
      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-6">กำลังโหลด…</div>
      ) : posts.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6">ไม่มีโพสต์ในช่วงเวลานี้</div>
      ) : (
        <div className={compact ? "space-y-2" : gridCols}>
          {posts.map((p) => (
            <a
              key={p.id}
              href={p.permalink ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-2xl border border-border/60 overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 bg-card"
            >
              {p.thumbnail_url ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={p.thumbnail_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-sky-500/10 via-blue-500/10 to-indigo-500/10 flex items-center justify-center">
                  <Facebook className="h-10 w-10 text-sky-600/40" />
                </div>
              )}
              <div className={variant === "bare" ? "p-4 space-y-2" : "p-3 space-y-1.5"}>
                <p
                  className={`leading-relaxed text-foreground ${
                    variant === "bare" ? "text-sm line-clamp-4" : "text-xs line-clamp-3"
                  }`}
                >
                  {p.content || "(ดูรายละเอียดบนเพจ)"}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span className="inline-flex items-center gap-1.5">
                    <Facebook className="h-3 w-3 text-sky-600" />
                    {p.posted_at
                      ? formatDistanceToNow(new Date(p.posted_at), { addSuffix: true, locale: th })
                      : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    อ่านต่อ <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );

  if (variant === "bare") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          {RangeTabs}
          {showSync && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
        {PostList}
      </div>
    );
  }

  return (
    <Card className="h-full border border-border/50 shadow-elevated rounded-2xl">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Facebook className="h-4 w-4 text-sky-600" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">
          {RangeTabs}
          {showSync && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="h-7">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">{PostList}</CardContent>
    </Card>
  );
}

export default SocialWallWidget;
