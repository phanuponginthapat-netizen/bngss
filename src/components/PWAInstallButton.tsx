import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !("MSStream" in window);

export default function PWAInstallButton({
  variant = "ghost",
  className = "",
}: {
  variant?: "ghost" | "outline" | "default" | "secondary";
  className?: string;
}) {
  const [prompt, setPrompt] = useState<any>(
    typeof window !== "undefined" ? (window as any).__deferredInstallPrompt : null
  );
  const [installed, setInstalled] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) setInstalled(true);
    const onInstallable = () =>
      setPrompt((window as any).__deferredInstallPrompt);
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("pwa:installable", onInstallable);
    window.addEventListener("pwa:installed", onInstalled);
    return () => {
      window.removeEventListener("pwa:installable", onInstallable);
      window.removeEventListener("pwa:installed", onInstalled);
    };
  }, []);

  // ซ่อนเมื่อ: ติดตั้งแล้ว / อยู่ใน iframe (preview) / ไม่มี prompt และไม่ใช่ iOS
  if (installed) return null;
  if (isInIframe()) return null;
  if (!prompt && !isIOS) return null;

  async function handleClick() {
    if (isIOS && !prompt) {
      setIosOpen(true);
      return;
    }
    if (!prompt) return;
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        toast.success("กำลังติดตั้งแอป…");
      }
      (window as any).__deferredInstallPrompt = null;
      setPrompt(null);
    } catch {
      toast.error("ไม่สามารถเปิดหน้าต่างติดตั้งได้");
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        onClick={handleClick}
        className={`gap-1.5 ${className}`}
        aria-label="ติดตั้งลงหน้าจอหลัก"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">ติดตั้งแอป</span>
      </Button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ติดตั้งลงหน้าจอหลัก (iPhone / iPad)</DialogTitle>
            <DialogDescription>
              Safari บน iOS ไม่มีปุ่มติดตั้งอัตโนมัติ ให้ทำตามขั้นตอนนี้:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm pl-1">
            <li className="flex gap-2">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-1">
                แตะปุ่ม <Share className="inline w-4 h-4" /> Share
                ด้านล่างของ Safari
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
