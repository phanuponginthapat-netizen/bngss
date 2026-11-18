import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, RefreshCw, ArrowRightLeft } from "lucide-react";
import { loadNotificationEvidence, notificationEvidenceReference } from "./facegateNotificationEvidence";
import { Button } from "@/components/ui/button";

type Reference = { reference_id?: string | null; reference_type?: string | null; reference_table?: string | null };

export function facegateNotificationAlertId(reference: Reference): string | null {
  return (reference.reference_type === "kiosk_agent_alerts" || reference.reference_table === "kiosk_agent_alerts")
    && reference.reference_id ? reference.reference_id : null;
}

export default function FacegateNotificationPhoto({ reference, userId, lang }: {
  reference: Reference; userId: string | null | undefined; lang: string;
}) {
  const source = notificationEvidenceReference(reference);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const { data: evidence, isPending, error, refetch } = useQuery({
    queryKey: ["facegate_notification_photo", userId, source?.table, source?.id],
    enabled: !!userId && !!source,
    staleTime: 2 * 60_000,
    gcTime: 0,
    queryFn: () => loadNotificationEvidence(reference),
  });
  if (!source || !userId) return null;
  const paired = source.table === "face_scan_logs";
  const photo = (url: string | null | undefined, label: string) => <div className={paired ? "w-20 shrink-0" : "w-full"}>
    <div className={`flex items-center justify-center overflow-hidden rounded-md border bg-muted/40 ${paired ? "h-20 w-20" : "h-32 w-full"}`}>
      {url && !failedUrls.includes(url)
        ? <img src={url} alt={label} className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer"
          onError={() => setFailedUrls(previous => [...previous, url])} />
        : <div className="flex flex-col items-center gap-1 p-1 text-center text-[10px] text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <span>{isPending ? (lang === "th" ? "กำลังโหลดรูป" : "Loading photo") : (lang === "th" ? "ไม่มีภาพที่แสดงได้" : "Photo unavailable")}</span>
        </div>}
    </div>
    {paired && <p className="mt-1 text-center text-[10px] text-muted-foreground">{label}</p>}
  </div>;
  return <div className="mt-2 flex max-w-full flex-wrap items-center gap-2">
    {paired && photo(evidence?.portrait, lang === "th" ? "รูปประจำตัว" : "Portrait")}
    {paired && <ArrowRightLeft className="mb-4 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    {photo(evidence?.scan, lang === "th" ? "ภาพจากตู้สแกน" : "Scanner photo")}
    {(error || evidence?.failed || failedUrls.length > 0) && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
      title={lang === "th" ? "ลองโหลดรูปอีกครั้ง" : "Retry photo"}
      onClick={event => { event.stopPropagation(); setFailedUrls([]); void refetch(); }}><RefreshCw className="h-3 w-3" /></Button>}
  </div>;
}