import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearScanDedupCache } from "@/lib/scanDedup";
import { SCAN_RECEIPT_EVENT, scanQueryAffected } from "@/lib/scanRealtime";

export default function ScanRealtimeBridge() {
  const queries = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        clearScanDedupCache();
        window.dispatchEvent(new Event(SCAN_RECEIPT_EVENT));
        void queries.invalidateQueries({ predicate: q => scanQueryAffected(q.queryKey) });
      }, 100);
    };
    const channel = supabase.channel(`school-scan-receipts-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "face_scan_logs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, refresh)
      .subscribe(status => { if (status === "SUBSCRIBED") refresh(); });
    window.addEventListener("online", refresh);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [queries]);
  return null;
}