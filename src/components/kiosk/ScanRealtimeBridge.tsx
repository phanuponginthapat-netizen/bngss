import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearScanDedupCache } from "@/lib/scanDedup";
import { SCAN_RECEIPT_EVENT, scanQueryAffected } from "@/lib/scanRealtime";

export default function ScanRealtimeBridge() {
  const queries = useQueryClient();
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer || disposed) return;
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
      .on("postgres_changes", { event: "*", schema: "public", table: "kiosk_agent_alerts" }, refresh)
      .subscribe(status => {
        if (status === "SUBSCRIBED") refresh();
        else if (["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status) && !disposed && !reconnect)
          reconnect = setTimeout(() => { if (!disposed) setConnection(n=>n+1); },3000);
      });
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const {data:auth} = supabase.auth.onAuthStateChange((event)=> {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        refresh(); setConnection(n=>n+1);
      }
    });
    window.addEventListener("online", refresh);
    window.addEventListener("offline-queue:synced",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",visible);
    let removeResume: (()=>void) | undefined;
    void import("@capacitor/app").then(({App})=>App.addListener("resume",refresh)).then(h=>{
      if(disposed)void h.remove();else removeResume=()=>{void h.remove();};
    }).catch(()=>{});
    return () => {
      disposed=true;
      auth.subscription.unsubscribe();
      removeResume?.();
      if (timer) clearTimeout(timer);
      if (reconnect) clearTimeout(reconnect);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline-queue:synced",refresh);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",visible);
      void supabase.removeChannel(channel);
    };
  }, [queries,connection]);
  return null;
}