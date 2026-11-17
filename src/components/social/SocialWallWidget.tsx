import { ExternalLink, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { SOCIAL_PLATFORMS, getEmbedUrl } from "@/lib/socialPlatforms";

interface Props { title?: string; variant?: "card" | "bare"; columns?: string }

export function SocialWallWidget({ title = "ช่องทางติดตามข่าวสาร", variant = "card" }: Props) {
  const { links, loading } = useSocialLinks();
  const active = links.filter(link => link.active !== false && link.url);

  return <section className="space-y-3" aria-label={title}>
    {variant !== "bare" && <h2 className="flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4 text-primary" />{title}</h2>}
    {loading ? <div className="h-96 animate-pulse rounded-md bg-muted" />
      : !active.length ? <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีช่องทางติดตามข่าวสาร</p>
      : <div className="mx-auto grid w-full max-w-[1032px] grid-cols-1 items-start gap-4 md:grid-cols-2">
        {active.map(link => {
          const meta = SOCIAL_PLATFORMS[link.platform] ?? SOCIAL_PLATFORMS.website;
          const Icon = meta.icon ?? Link2;
          const src = link.embed ? getEmbedUrl(link) : null;
          return <article key={link.id} aria-label={meta.label}
            className="relative flex min-w-0 flex-col overflow-hidden rounded-md border bg-card text-card-foreground">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{link.label || meta?.label}</p>
                {link.handle && <p className="text-xs text-muted-foreground">{link.handle}</p>}
              </div>
              <Button asChild variant="ghost" size="icon" className="shrink-0" title="เปิดต้นฉบับ"><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label="เปิดต้นฉบับ"><ExternalLink className="h-4 w-4" /></a></Button>
            </div>
            {src ? <iframe key={link.id} src={src} title={link.label || meta?.label} className={`w-full shrink-0 border-0 bg-card [color-scheme:normal] ${link.platform === "facebook" ? "h-[645px]" : link.platform === "tiktok" ? "h-[480px]" : "aspect-video"}`}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
              : <div className="flex min-h-80 flex-col items-center justify-center gap-5 bg-muted/30 px-5 text-center">
                <Icon className="h-16 w-16 text-primary" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">ช่องทางนี้แสดงได้ในแอปต้นฉบับ</p>
                <Button asChild className="gap-2"><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />เปิด {meta?.label}</a></Button>
              </div>}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="min-w-0">หากโพสต์ไม่แสดง เปิดดูต้นฉบับ</span>
              <Button asChild variant="ghost" size="sm" className="gap-2"><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />ดูใน {meta?.label}</a></Button>
            </div>
          </article>;
        })}
      </div>}
  </section>;
}
export default SocialWallWidget;
