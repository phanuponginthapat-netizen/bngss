import { useEffect, useState } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_KEY = "pwa_banner_dismissed_v1";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isInIframe() {
  try { return window.self !== window.top; } catch { return true; }
}

function isPreviewHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith("lovableproject.com") ||
    h.endsWith("lovable.app") ||
    h.endsWith("lovable.dev")
  );
}

function isDismissedRecently() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || "0");
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  typeof window !== "undefined" &&
  !("MSStream" in window);

/**
 * Smart, non-intrusive install banner.
 * Shows only:
 *   - on mobile viewport
 *   - when not already installed
 *   - when not in iframe/preview
 *   - when not dismissed in last 7 days
 *   - after a small engagement delay (8s) so it doesn't annoy first impression
 */
export default function PWAInstallBanner() {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<any>(
    typeof window !== "undefined" ? (window as any).__deferredInstallPrompt : null
  );
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    if (isStandalone() || isInIframe() || isPreviewHost()) return;
    if (isDismissedRecently()) return;

    const onInstallable = () =>
      setPrompt((window as any).__deferredInstallPrompt);
    const onInstalled = () => { setVisible(false); setPrompt(null); };
    window.addEventListener("pwa:installable", onInstallable);
    window.addEventListener("pwa:installed", onInstalled);

    const t = setTimeout(() => {
      // Show on iOS even without prompt (manual instructions)
      if (isIOS || (window as any).__deferredInstallPrompt) setVisible(true);
    }, 8000);

    return () => {
      clearTimeout(t);
      window.removeEventListener("pwa:installable", onInstallable);
      window.removeEventListener("pwa:installed", onInstalled);
    };
  }, [isMobile]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (isIOS && !prompt) {
      setIosOpen(true);
      return;
    }
    if (!prompt) return;
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        dismiss();
      }
      (window as any).__deferredInstallPrompt = null;
      setPrompt(null);
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed bottom-20 left-3 right-3 z-50 md:hidden animate-in slide-in-from-bottom-5 fade-in duration-300"
        role="dialog"
        aria-label="ติดตั้งแอป"
      >
        <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-elevated p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">ติดตั้งแอปลงหน้าจอ</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              เปิดเร็วขึ้น · รับแจ้งเตือน · ใช้งานเหมือนแอปจริง
            </p>
          </div>
          <Button size="sm" onClick={handleInstall} className="shrink-0 h-8 px-3">
            <Download className="w-3.5 h-3.5 mr-1" />
            ติดตั้ง
          </Button>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ติดตั้งลงหน้าจอ (iPhone / iPad)</DialogTitle>
            <DialogDescription>
              Safari บน iOS ติดตั้งด้วยขั้นตอนนี้:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm pl-1">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-1">
                แตะปุ่ม <Share className="inline w-4 h-4" /> Share ด้านล่างของ Safari
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">2.</span>
              <span>เลือก "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold">3.</span>
              <span>แตะ "เพิ่ม" (Add) ที่มุมขวาบน</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
