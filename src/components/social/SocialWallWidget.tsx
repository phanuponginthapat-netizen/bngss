import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Link2, Share2 } from "lucide-react";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { SOCIAL_PLATFORMS, type SocialLink } from "@/lib/socialPlatforms";

interface Props {
  title?: string;
  variant?: "card" | "bare";
  /** Tailwind grid cols override */
  columns?: string;
}

export function SocialWallWidget({
  title = "ช่องทางติดตามข่าวสาร",
  variant = "card",
  columns,
}: Props) {
  const { links, loading } = useSocialLinks();
  const active = links.filter((l) => l.active !== false && l.url);

  const gridCols =
    columns ??
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4";

  const renderCard = (l: SocialLink) => {
    const meta = SOCIAL_PLATFORMS[l.platform] ?? SOCIAL_PLATFORMS.website;
    const Icon = meta.icon;
    return (
      <a
        key={l.id}
        href={l.url}
        target="_blank"
        rel="noreferrer"
        className="group relative aspect-square rounded-2xl overflow-hidden border border-border/50 bg-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 flex flex-col"
        aria-label={l.label || meta.label}
      >
        <div className={`flex-1 flex items-center justify-center bg-gradient-to-br ${meta.gradient} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <Icon
            className="h-10 w-10 sm:h-12 sm:w-12 text-white drop-shadow-md transition-transform duration-500 group-hover:scale-110"
            strokeWidth={1.8}
          />
          <ExternalLink className="absolute top-2 right-2 h-3.5 w-3.5 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="px-2.5 py-2 bg-card">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate text-center">
            {l.label || meta.label}
          </p>
          {l.handle && (
            <p className="text-[10px] text-muted-foreground truncate text-center mt-0.5">
              {l.handle}
            </p>
          )}
        </div>
      </a>
    );
  };

  const List = (
    <>
      {loading ? (
        <div className={gridCols}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          ยังไม่ได้เพิ่มลิงค์ Social Media
        </div>
      ) : (
        <div className={gridCols}>{active.map(renderCard)}</div>
      )}
    </>
  );

  if (variant === "bare") return <div className="space-y-4">{List}</div>;

  return (
    <Card className="h-full border border-border/50 shadow-elevated rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{List}</CardContent>
    </Card>
  );
}

export default SocialWallWidget;
