import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCurrentPushStatus,
  isInIframe,
  isPreviewHost,
  isPwaCapable,
} from "@/lib/pushSubscribe";

const DISMISS_KEY = "push_banner_dismissed_at";
const DISMISS_DAYS = 3;

export default function EnablePushBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInIframe() || isPreviewHost()) return;
    if (!isPwaCapable()) return;

    // honor dismiss window
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return;

    getCurrentPushStatus().then((s) => {
      if (s === "default") setShow(true);
    });
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <div className="md:hidden sticky top-14 z-20 mx-2 mt-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 backdrop-blur-sm shadow-elevated">
      <div className="flex items-center gap-2 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">เปิดแจ้งเตือนบนมือถือ</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            ติดตั้งแอปลงหน้าจอโฮม เพื่อรับแจ้งเตือนเรียลไทม์ ฟรี
          </p>
        </div>
        <Button asChild size="sm" className="h-8 shrink-0">
          <Link to="/install">เปิด</Link>
        </Button>
        <button
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted shrink-0"
          aria-label="ปิด"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
