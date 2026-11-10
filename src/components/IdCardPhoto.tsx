import { useEffect, useState } from "react";
import { Loader2, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveProfileImageUrl } from "@/lib/profileImageUrl";

export function IdCardPhoto({ url, name }: { url?: string; name: string }) {
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<{ source?: string; resolved?: string; state: "loading" | "ready" | "error" }>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    setPhoto({ source: url, state: "loading" });
    if (url) {
      resolveProfileImageUrl(url, attempt > 0).then(resolved => {
        if (alive) setPhoto({ source: url, resolved: resolved || undefined, state: resolved ? "loading" : "error" });
      }).catch(() => { if (alive) setPhoto({ source: url, state: "error" }); });
    }
    return () => { alive = false; };
  }, [url, attempt]);

  if (!url) return <User className="h-8 w-8 text-muted-foreground" aria-label="ยังไม่มีรูปประจำตัว" />;
  const state = photo.source === url ? photo.state : "loading";
  return <div className="relative h-full w-full" data-card-photo-state={state}>
    {photo.source === url && photo.resolved && state !== "error" && <img
      key={`${photo.resolved}-${attempt}`} src={photo.resolved} alt={name} crossOrigin="anonymous"
      loading="eager" decoding="sync" className="h-full w-full object-cover"
      onLoad={() => setPhoto(current => ({ ...current, state: "ready" }))}
      onError={() => setPhoto(current => ({ ...current, state: "error" }))}
    />}
    {state === "loading" && <span role="status" className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-label="กำลังโหลดรูป" /></span>}
    {state === "error" && <div role="alert" className="flex h-full flex-col items-center justify-center gap-1 bg-muted text-destructive">
      <span className="text-[10px]">โหลดรูปไม่สำเร็จ</span>
      <Button variant="ghost" size="icon" aria-label="ลองโหลดรูปบัตรใหม่" title="ลองโหลดรูปบัตรใหม่" className="h-7 w-7" onClick={() => setAttempt(value => value + 1)}><RefreshCw className="h-3.5 w-3.5" /></Button>
    </div>}
  </div>;
}