import { useEffect, useState } from "react";
import { CloudOff, CloudUpload, Wifi } from "lucide-react";
import { count, flush, installOfflineSync } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pending, setPending] = useState(0);

  const refresh = async () => {
    try { setPending(await count()); } catch { /* idb may be blocked */ }
  };

  useEffect(() => {
    installOfflineSync();
    refresh();
    const goOn = () => { setOnline(true); refresh(); };
    const goOff = () => { setOnline(false); toast.warning("ออฟไลน์ — การบันทึกจะถูก sync เมื่อกลับมาออนไลน์"); };
    const onSynced = (e: Event) => {
      const d = (e as CustomEvent).detail as { ok: number; failed: number };
      if (d.ok > 0) toast.success(`ซิงค์สำเร็จ ${d.ok} รายการ${d.failed ? ` (พลาด ${d.failed})` : ""}`);
      refresh();
    };
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    window.addEventListener("offline-queue:synced", onSynced as EventListener);
    const t = setInterval(refresh, 5_000);
    return () => {
      window.removeEventListener("online", goOn);
      window.removeEventListener("offline", goOff);
      window.removeEventListener("offline-queue:synced", onSynced as EventListener);
      clearInterval(t);
    };
  }, []);

  // nothing to show when online and queue empty
  if (online && pending === 0) return null;

  if (!online) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
        <CloudOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">ออฟไลน์</span>
        {pending > 0 && <span className="font-bold">· {pending}</span>}
      </div>
    );
  }

  // online with pending queue → show sync button
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-warning hover:text-warning"
      onClick={async () => {
        const r = await flush();
        if (r.ok === 0 && r.failed === 0) toast.info("ไม่มีรายการรอซิงค์");
      }}
      title="กดเพื่อซิงค์รายการที่ค้าง"
    >
      <CloudUpload className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{pending} รอซิงค์</span>
    </Button>
  );
}
