import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Link2, Share2 } from "lucide-react";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import {
  SOCIAL_PLATFORMS,
  getEmbedUrl,
  type SocialLink,
} from "@/lib/socialPlatforms";

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

  const buttonLinks: SocialLink[] = [];
  const embedLinks: { link: SocialLink; src: string }[] = [];
  active.forEach((l) => {
    if (l.embed) {
      const src = getEmbedUrl(l);
      if (src) {
        embedLinks.push({ link: l, src });
        return;
      }
    }
    buttonLinks.push(l);
  });

  const gridCols =
    columns ??
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4";

  const renderButton = (l: SocialLink) => {
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

  const renderEmbed = ({ link, src }: { link: SocialLink; src: string }) => {
    const meta = SOCIAL_PLATFORMS[link.platform] ?? SOCIAL_PLATFORMS.website;
    const Icon = meta.icon;

    // Native iframe size (ตามที่ผู้ให้บริการ render จริง — ปรับให้พอดีไม่มีขอบขาวเหลือ)
    const nativeW =
      link.platform === "tiktok" ? 325 : link.platform === "facebook" ? 500 : 560;
    const nativeH =
      link.platform === "youtube" ? 315 : link.platform === "tiktok" ? 420 : 645;

    const useAspect = link.platform === "youtube";
    return (
      <div
        key={link.id}
        className="group relative rounded-3xl overflow-hidden bg-card shadow-elevated hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 ring-1 ring-border/40 hover:ring-primary/30 w-full"
      >
        {/* Header เบลอ + gradient */}
        <div className={`relative flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r ${meta.gradient} overflow-hidden`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.2),transparent_60%)] pointer-events-none" />
          <div className="relative flex items-center justify-center h-7 w-7 rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate leading-tight drop-shadow-sm">
              {link.label || meta.label}
            </p>
            {link.handle && (
              <p className="text-[10px] text-white/85 truncate leading-tight">{link.handle}</p>
            )}
          </div>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="relative flex items-center justify-center h-7 w-7 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white transition-colors"
            aria-label="เปิดในแท็บใหม่"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {/* iframe: YouTube ใช้ aspect ratio, ที่เหลือ scale ให้เต็มความกว้าง container */}
        {useAspect ? (
          <div className="relative w-full bg-gradient-to-br from-muted/20 via-muted/10 to-muted/30" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={src}
              title={link.label || meta.label}
              className="absolute inset-0 w-full h-full"
              loading="lazy"
              frameBorder={0}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <div
            className="relative w-full bg-gradient-to-br from-muted/20 via-muted/10 to-muted/30 overflow-hidden"
            style={{ aspectRatio: `${nativeW} / ${nativeH}` }}
          >
            <iframe
              src={src}
              title={link.label || meta.label}
              loading="lazy"
              frameBorder={0}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${nativeW}px`,
                height: `${nativeH}px`,
                transformOrigin: "top left",
                // scale ให้ iframe เต็มความกว้าง container (จริงๆคำนวณผ่าน CSS var)
                transform: `scale(var(--embed-scale, 1))`,
              }}
              ref={(el) => {
                if (!el) return;
                const parent = el.parentElement;
                if (!parent) return;
                const apply = () => {
                  const w = parent.clientWidth;
                  const s = w / nativeW;
                  parent.style.setProperty("--embed-scale", String(s));
                };
                apply();
                const ro = new ResizeObserver(apply);
                ro.observe(parent);
              }}
            />
          </div>
        )}
      </div>
    );
  };



  const List = (
    <>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-3xl bg-muted/40 animate-pulse" style={{ aspectRatio: "5 / 7" }} />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          ยังไม่ได้เพิ่มลิงค์ Social Media
        </div>
      ) : (
        <div className="space-y-6">
          {embedLinks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {embedLinks.map(renderEmbed)}
            </div>
          )}
          {buttonLinks.length > 0 && (
            <div className={gridCols}>{buttonLinks.map(renderButton)}</div>
          )}
        </div>
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
