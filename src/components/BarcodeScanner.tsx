import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, AlertCircle, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyCameraFocus } from "@/lib/cameraFocus";

const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 1));

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  /** If true, scanner keeps running after each scan (with debounce) */
  continuous?: boolean;
  /** Optional element rendered below the camera view (e.g. live results) */
  children?: React.ReactNode;
}

export const BarcodeScanner = ({ open, onClose, onScan, title = "สแกนบาร์โค้ด / QR Code", continuous = false, children }: Props) => {
  const scannerId = `barcode-scanner-${useId().replace(/:/g, "")}`;
  const [scannerElement, setScannerElement] = useState<HTMLDivElement | null>(null);
  const [retry, setRetry] = useState(0);
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [refocusing, setRefocusing] = useState(false);
  const [manual, setManual] = useState("");

  // Keep latest callbacks in refs so the scanner effect does NOT restart the camera
  // every time the parent re-renders (e.g. after each successful scan updates parent
  // state). Restarting the camera per scan caused flicker / missed reads in continuous mode.
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);


  /**
   * บังคับให้กล้องเริ่ม autofocus cycle ใหม่ — iOS Safari ไม่มี API focusMode,
   * แต่การ pause/play + applyConstraints ใหม่จะ trigger AF re-lock บนเครื่อง iOS
   */
  const triggerRefocus = useCallback(async () => {
    const el = scannerElement;
    const videoEl = el?.querySelector("video") as HTMLVideoElement | null;
    const stream = (videoEl?.srcObject as MediaStream) || null;
    if (!videoEl || !stream) return;
    setRefocusing(true);
    try {
      // iOS: pause แล้ว play ใหม่ = force AF cycle
      try { videoEl.pause(); } catch {}
      await new Promise((r) => setTimeout(r, 120));
      try { await videoEl.play(); } catch {}
      // Android/Chrome: apply focus constraints อีกครั้ง
      await applyCameraFocus(stream, "close");
    } finally {
      setTimeout(() => setRefocusing(false), 400);
    }
  }, [scannerElement]);

  useEffect(() => {
    // Radix mounts portal contents separately; start only after its actual ref exists.
    if (!open || !scannerElement) return;
    let cancelled = false;
    let instance: Html5Qrcode | null = null;
    setError(null);
    lastScanRef.current = { code: "", at: 0 };

    const stop = async () => {
      const current = instance;
      if (!current) return;
      instance = null;
      try { if (current.isScanning) await current.stop(); } catch {}
      try { current.clear(); } catch {}
      if (scannerRef.current === current) scannerRef.current = null;
    };

    const start = async () => {
      if (cancelled) return;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("เบราว์เซอร์ไม่รองรับการใช้กล้อง กรุณาเปิดผ่าน HTTPS");
        }
        const current = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
        instance = current;
        scannerRef.current = current;
        const decoded = (raw: string) => {
          if (cancelled) return;
          const code = raw.trim();
          if (code.length < 3 || /[\x00-\x1f]/.test(code)) return;
          const now = Date.now();
          if (code === lastScanRef.current.code && now - lastScanRef.current.at < 1500) return;
          lastScanRef.current = { code, at: now };
          if (!continuous) cancelled = true;
          onScanRef.current(code);
          if (!continuous) onCloseRef.current();
        };
        // One camera acquisition: probing then reopening can leave mobile cameras busy.
        await current.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.max(1, Math.min(360, Math.floor(Math.min(width, height) * 0.75)));
              return { width: size, height: size };
            },
            aspectRatio: 1.333,
          },
          decoded,
          () => {},
        );
        if (cancelled) { await stop(); return; }
        const video = scannerElement.querySelector("video");
        await applyCameraFocus(video?.srcObject as MediaStream | null, "close");
      } catch (e: unknown) {
        await stop();
        if (cancelled) return;
        const name = typeof e === "object" && e !== null && "name" in e ? String(e.name) : "";
        let message = e instanceof Error ? e.message : typeof e === "string" ? e : "เริ่มสแกนไม่สำเร็จ";
        if (name === "NotAllowedError" || name === "SecurityError") message = "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาตกล้องในเบราว์เซอร์แล้วลองใหม่";
        else if (name === "NotFoundError") message = "ไม่พบกล้องในอุปกรณ์นี้";
        else if (name === "NotReadableError") message = "กล้องถูกใช้งานอยู่ กรุณาปิดแอปที่ใช้กล้องแล้วลองใหม่";
        setError(message);
      }
    };
    // A late permission/start response must release its camera before a reopen starts.
    const starting = lifecycleRef.current.then(start);
    lifecycleRef.current = starting;
    return () => {
      cancelled = true;
      lifecycleRef.current = starting.then(stop);
    };
  }, [open, continuous, scannerElement, scannerId, retry]);


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <div
            id={scannerId}
            ref={setScannerElement}
            onClick={triggerRefocus}
            className="w-full rounded-lg overflow-hidden bg-muted min-h-[300px] cursor-pointer select-none"
          />
          {/* ปุ่มโฟกัสใหม่ — จำเป็นสำหรับ iOS Safari ที่ไม่รองรับ focusMode API */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={(e) => { e.stopPropagation(); triggerRefocus(); }}
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-background/90 hover:bg-background text-foreground shadow-lg backdrop-blur flex items-center justify-center active:scale-95 transition-all"
            aria-label="โฟกัสใหม่"
          >
            <Focus className={`w-5 h-5 ${refocusing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {error ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">{error}</div>
                <div className="mt-1 text-destructive/80">
                  ตรวจสอบว่าเปิดผ่าน HTTPS และอนุญาตสิทธิ์กล้องในเบราว์เซอร์ (คลิกไอคอนกล้องบน address bar)
                </div>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)}>ลองเปิดกล้องอีกครั้ง</Button>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = manual.trim();
                if (code.length < 2) return;
                onScanRef.current(code);
                setManual("");
                if (!continuous) onCloseRef.current();
              }}
            >
              <Input
                aria-label="รหัสนักเรียนแทนการสแกน"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="กรอกรหัสนักเรียน/รหัสบนบัตรแทนการสแกน"
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                autoFocus
              />
              <Button
                type="submit"
                className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                disabled={manual.trim().length < 2}
              >
                ยืนยัน
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            {IS_IOS
              ? "บน iPhone: ถ้าภาพเบลอ ถอยกล้องออกสัก 10–15 ซม. หรือ แตะจอ/ปุ่ม 🎯 เพื่อโฟกัสใหม่"
              : continuous
              ? "เล็งกล้องไปที่ QR บัตรนักเรียนทีละคน — ระบบจะสแกนต่อเนื่อง"
              : "เล็งกล้องไปที่บาร์โค้ดหรือ QR Code ระบบจะสแกนอัตโนมัติ"}
          </p>
        )}


        {children}
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
