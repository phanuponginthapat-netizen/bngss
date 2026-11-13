import { useState } from "react";
import { ArrowUp, ArrowDown, ExternalLink, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { SOCIAL_PLATFORMS, getEmbedUrl } from "@/lib/socialPlatforms";

interface Props { title?: string; variant?: "card" | "bare"; columns?: string }

export function SocialWallWidget({ title = "ช่องทางติดตามข่าวสาร", variant = "card" }: Props) {
  const { links, loading } = useSocialLinks();
  const active = links.filter(link => link.active !== false && link.url);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, active.length - 1));
  const link = active[index];
  const meta = link ? SOCIAL_PLATFORMS[link.platform] ?? SOCIAL_PLATFORMS.website : null;
  const src = link?.embed ? getEmbedUrl(link) : null;
  const Icon = meta?.icon ?? Link2;
  const move = (direction: number) => setSelected(Math.max(0, Math.min(active.length - 1, index + direction)));

  return <section className="space-y-3" aria-label={title}>
    {variant !== "bare" && <h2 className="flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4 text-primary" />{title}</h2>}
    {loading ? <div className="mx-auto aspect-[9/16] w-full max-w-sm animate-pulse rounded-md bg-muted" />
      : !link ? <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีช่องทางติดตามข่าวสาร</p>
      : <>
        <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="ช่องทางโรงเรียน">
          {active.map((item, i) => {
            const PlatformIcon = SOCIAL_PLATFORMS[item.platform]?.icon ?? Link2;
            return <Button key={item.id} variant={i === index ? "default" : "outline"} size="sm" role="tab"
              id={`social-tab-${item.id}`} aria-selected={i === index} aria-controls="social-feed-panel"
              onClick={() => setSelected(i)} className="gap-2 rounded-md">
              <PlatformIcon className="h-4 w-4" />{SOCIAL_PLATFORMS[item.platform]?.label ?? "เว็บไซต์"}
            </Button>;
          })}
        </div>
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <div id="social-feed-panel" role="tabpanel" aria-labelledby={`social-tab-${link.id}`}
            className="relative flex h-[min(680px,70dvh)] min-h-80 min-w-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-3">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{link.label || meta?.label}</p>
                {link.handle && <p className="text-xs text-muted-foreground">{link.handle}</p>}
              </div>
              <Button asChild variant="ghost" size="icon" className="shrink-0" title="เปิดต้นฉบับ"><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label="เปิดต้นฉบับ"><ExternalLink className="h-4 w-4" /></a></Button>
            </div>
            {src ? <iframe key={link.id} src={src} title={link.label || meta?.label} className="min-h-0 w-full flex-1 border-0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
              : <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-muted/30 px-5 text-center">
                <Icon className="h-16 w-16 text-primary" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">{link.platform === "facebook" ? "Facebook ไม่อนุญาตให้ฝังหน้าโปรไฟล์นี้" : "ช่องทางนี้แสดงได้ในแอปต้นฉบับ"}</p>
                <Button asChild className="gap-2"><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />เปิด {meta?.label}</a></Button>
              </div>}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
              <span>{index + 1} / {active.length}</span>
              <Button asChild variant="ghost" size="sm" className="gap-2"><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />ดูใน {meta?.label}</a></Button>
            </div>
          </div>
          {active.length > 1 && <div className="flex shrink-0 flex-col gap-3">
            <Button variant="outline" size="icon" disabled={index === 0} onClick={() => move(-1)} aria-label="ช่องทางก่อนหน้า" title="ช่องทางก่อนหน้า"><ArrowUp className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" disabled={index === active.length - 1} onClick={() => move(1)} aria-label="ช่องทางถัดไป" title="ช่องทางถัดไป"><ArrowDown className="h-5 w-5" /></Button>
          </div>}
        </div>
      </>}
  </section>;
}
export default SocialWallWidget;
