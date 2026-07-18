import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Facebook, Youtube, Music2, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { fbPageEmbedSrc, postEmbedSrc, detectPlatform, tiktokChannelEmbedSrc, youtubeChannelEmbedSrc, youtubeHandleFromUrl } from "@/lib/socialEmbeds";

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
  showSync?: boolean; // kept for back-compat; ignored
  title?: string;
  variant?: "card" | "bare";
  columns?: string;
  /** ถ้า true จะแสดง Facebook Page Plugin ด้านบน (ถ้ามีลิงก์เพจ) */
  showPagePlugin?: boolean;
}

type RangeKey = "7" | "30" | "all";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7", label: "7 วัน", days: 7 },
  { key: "30", label: "30 วัน", days: 30 },
  { key: "all", label: "ทั้งหมด", days: null },
];

const platformIcon = (p: string) => {
  if (p === "youtube") return <Youtube className="h-3 w-3 text-destructive" />;
  if (p === "tiktok") return <Music2 className="h-3 w-3" />;
  return <Facebook className="h-3 w-3 text-info" />;
};

export function SocialWallWidget({
  limit = 6,
  compact = false,
  title = "Social Wall",
  variant = "card",
  columns,
  showPagePlugin = true,
}: Props) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [ttChannelUrl, setTtChannelUrl] = useState<string>("");
  const [ytChannelUrl, setYtChannelUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
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

  const loadPageUrl = async () => {
    const { data } = await supabase
      .from("school_settings")
      .select("setting_key,setting_value")
      .in("setting_key", ["fb_page_url", "tiktok_channel_url", "youtube_channel_url"]);
    const map = Object.fromEntries((data || []).map((r: any) => [r.setting_key, r.setting_value]));
    setPageUrl(map["fb_page_url"] || "");
    setTtChannelUrl(map["tiktok_channel_url"] || "");
    setYtChannelUrl(map["youtube_channel_url"] || "");
  };

  useEffect(() => {
    load();
    loadPageUrl();
    const channel = supabase
      .channel("social-posts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, range]);

  const gridCols =
    columns ??
    (compact
      ? ""
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4");

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

  const ttEmbedSrc = ttChannelUrl ? tiktokChannelEmbedSrc(ttChannelUrl) : null;
  const ytEmbedSrc = ytChannelUrl ? youtubeChannelEmbedSrc(ytChannelUrl) : null;
  const ytHandle = ytChannelUrl && !ytEmbedSrc ? youtubeHandleFromUrl(ytChannelUrl) : null;
  const hasYt = !!(ytEmbedSrc || ytHandle || ytChannelUrl);
  const channelsOnly = !loading && posts.length === 0 && (pageUrl || ttEmbedSrc || hasYt);
  const channelCount = (pageUrl ? 1 : 0) + (ttEmbedSrc ? 1 : 0) + (hasYt ? 1 : 0);

  // Visible cropped height (matches typical FB Page plugin natural height)
  const PANEL_HEIGHT = 720;
  // Internal iframe heights — large enough so content fills the cropped panel
  const fbHeight = 1600;
  const ttHeight = 1600;

  const renderPagePlugin = () => pageUrl && showPagePlugin ? (
    <div
      className="rounded-2xl border border-border/60 overflow-hidden bg-card"
      style={{ height: PANEL_HEIGHT }}
    >
      <iframe
        src={fbPageEmbedSrc(pageUrl, 900, fbHeight)}
        title="Facebook Page"
        width="100%"
        height={fbHeight}
        style={{ border: 0, display: "block", width: "100%", height: fbHeight }}
        scrolling="no"
        allow="encrypted-media"
        loading="lazy"
      />
    </div>
  ) : null;

  const renderTtChannel = () => ttEmbedSrc ? (
    <div
      className="rounded-2xl border border-border/60 overflow-hidden bg-card"
      style={{ height: PANEL_HEIGHT }}
    >
      <iframe
        src={ttEmbedSrc}
        title="TikTok Channel"
        width="100%"
        height={ttHeight}
        style={{ border: 0, display: "block", width: "100%", height: ttHeight }}
        scrolling="no"
        allow="encrypted-media; autoplay; clipboard-write; picture-in-picture"
        loading="lazy"
      />
    </div>
  ) : null;

  const renderYtChannel = () => {
    if (ytEmbedSrc) {
      return (
        <div
          className="rounded-2xl border border-border/60 overflow-hidden bg-card"
          style={{ height: PANEL_HEIGHT }}
        >
          <iframe
            src={ytEmbedSrc}
            title="YouTube Channel"
            width="100%"
            height={PANEL_HEIGHT}
            style={{ border: 0, display: "block", width: "100%", height: PANEL_HEIGHT }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }
    if (ytChannelUrl) {
      const label = ytHandle ? `@${ytHandle}` : "YouTube Channel";
      return (
        <a
          href={ytChannelUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-border/60 overflow-hidden bg-card flex flex-col items-center justify-center gap-3 hover:shadow-card-hover transition-all"
          style={{ height: PANEL_HEIGHT }}
        >
          <Youtube className="h-16 w-16 text-destructive" />
          <div className="text-center px-4">
            <div className="text-sm font-semibold text-foreground">{label}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              YouTube ไม่อนุญาตให้ฝังช่องโดยตรง<br />
              คลิกเพื่อเปิดช่อง หรือใช้ลิงก์เพลย์ลิสต์ (?list=...) เพื่อฝังในหน้านี้
            </div>
            <div className="text-[11px] text-info mt-2 inline-flex items-center gap-1">
              เปิดช่อง <ExternalLink className="h-3 w-3" />
            </div>
          </div>
        </a>
      );
    }
    return null;
  };

  const gridColsClass =
    channelCount >= 3 ? "grid-cols-1 lg:grid-cols-3" :
    channelCount === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1";

  const ChannelsRow = (pageUrl && showPagePlugin) || ttEmbedSrc || hasYt ? (
    <div className={`grid gap-4 ${gridColsClass}`}>
      {renderPagePlugin()}
      {renderTtChannel()}
      {renderYtChannel()}
    </div>
  ) : null;


  const PostList = (
    <>
      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-6">กำลังโหลด…</div>
      ) : posts.length === 0 ? (
        pageUrl ? null : (
          <div className="text-xs text-muted-foreground text-center py-6">ยังไม่มีโพสต์ในช่วงเวลานี้</div>
        )
      ) : (
        <div className={compact ? "space-y-3" : gridCols}>
          {posts.slice(0, 6).map((p) => {
            const embed = p.permalink ? postEmbedSrc(p.permalink) : null;
            // Facebook embeds get blocked (X-Frame-Options) once user navigates → use card+link instead
            const useEmbed = embed && embed.platform !== "facebook";
            if (useEmbed && embed && p.permalink) {
              const isYt = embed.platform === "youtube";
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-border/60 overflow-hidden bg-card flex justify-center"
                >
                  <iframe
                    src={embed.src}
                    title={`${embed.platform}-${p.id}`}
                    width="100%"
                    height={embed.height}
                    style={{ border: 0, overflow: "hidden", maxWidth: isYt ? 560 : 500 }}
                    scrolling="no"
                    allow="encrypted-media; autoplay; clipboard-write; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              );
            }
            const plat = p.permalink ? detectPlatform(p.permalink) : (p.platform as any);
            // Fallback: legacy post with thumbnail/content
            return (
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
                  <div className="aspect-video bg-gradient-to-br from-info/10 via-info/10 to-info/10 flex items-center justify-center">
                    <Facebook className="h-10 w-10 text-info/40" />
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
                      {platformIcon(plat)}
                      {p.posted_at
                        ? formatDistanceToNow(new Date(p.posted_at), { addSuffix: true, locale: th })
                        : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-info opacity-0 group-hover:opacity-100 transition-opacity">
                      อ่านต่อ <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );

  const Body = (
    <div className="space-y-4">
      {ChannelsRow}
      {!channelsOnly && PostList}
    </div>
  );

  if (variant === "bare") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">{RangeTabs}</div>
        {Body}
      </div>
    );
  }

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Facebook className="h-4 w-4 text-info" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-1">{RangeTabs}</div>
      </CardHeader>
      <CardContent className="p-3">{Body}</CardContent>
    </Card>
  );
}

export default SocialWallWidget;
