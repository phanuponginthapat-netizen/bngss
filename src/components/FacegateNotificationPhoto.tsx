import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveKioskMediaUrl } from "@/lib/kioskMediaUrl";
import { Button } from "@/components/ui/button";

type Reference = { reference_id?: string | null; reference_type?: string | null; reference_table?: string | null };

export function facegateNotificationAlertId(reference: Reference): string | null {
  return (reference.reference_type === "kiosk_agent_alerts" || reference.reference_table === "kiosk_agent_alerts")
    && reference.reference_id ? reference.reference_id : null;
}

export default function FacegateNotificationPhoto({ reference, userId, lang }: {
  reference: Reference; userId: string | null | undefined; lang: string;
}) {
  const alertId = facegateNotificationAlertId(reference);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const { data: url, isPending, error, refetch } = useQuery({
    queryKey: ["facegate_notification_photo", userId, alertId],
    enabled: !!userId && !!alertId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!alertId || !userId) return null;
      const { data, error } = await supabase.from("kiosk_agent_alerts")
        .select("snapshot_url").eq("id", alertId).maybeSingle();
      if (error) throw error;
      return resolveKioskMediaUrl(data?.snapshot_url);
    },
  });
  if (!alertId || !userId) return null;
  return <div className="mt-2 flex h-32 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40">
    {url && failedUrl !== url ? <img src={url} alt={lang === "th" ? "ภาพจากการสแกน FaceGate" : "FaceGate scan photo"}
      className="h-full w-full object-contain" loading="lazy" onError={() => setFailedUrl(url)} />
      : <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" />
        <span>{isPending ? (lang === "th" ? "กำลังโหลดรูป" : "Loading photo") : (lang === "th" ? "ไม่สามารถแสดงรูปสแกนได้" : "Scan photo unavailable")}</span>
        {error && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
          title={lang === "th" ? "ลองโหลดรูปอีกครั้ง" : "Retry photo"}
          onClick={event => { event.stopPropagation(); void refetch(); }}><RefreshCw className="h-3 w-3" /></Button>}
      </div>}
  </div>;
}