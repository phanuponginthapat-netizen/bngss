import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, AlertCircle, Focus } from "lucide-react";
import { toast } from "sonner";
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

const SCANNER_ID = "barcode-scanner-region";

export const BarcodeScanner = ({ open, onClose, onScan, title = "สแกนบาร์โค้ด / QR Code", continuous = false, children }: Props) => {
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
    const el = document.getElementById(SCANNER_ID);
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
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    const stop = async () => {
      try {
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        await scannerRef.current?.clear();
      } catch {}
      scannerRef.current = null;
    };

    const start = async () => {
      // Wait a tick so the dialog's scanner div is mounted
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        setError("ไม่พบพื้นที่แสดงกล้อง");
        return;
      }

      // Pre-check permissions / availability with a clear error
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("เบราว์เซอร์ไม่รองรับการใช้กล้อง (ต้องใช้ HTTPS)");
        }
      } catch (e: any) {
        const msg = e?.message || "เปิดกล้องไม่สำเร็จ";
        setError(msg);
        toast.error(msg);
        return;
      }

      // เลือก deviceId ของกล้องหลัง (ถ้ามี) เพื่อหลีกเลี่ยง OverconstrainedError บน Android บางรุ่น
      let cameraConfig: any = { facingMode: { ideal: "environment" } };
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        probe.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        const back = cams.find((d) => /back|rear|environment/i.test(d.label)) || cams[cams.length - 1];
        if (back?.deviceId) cameraConfig = { deviceId: { exact: back.deviceId } };
      } catch (e: any) {
        const name = e?.name || "";
        let msg = e?.message || "เปิดกล้องไม่สำเร็จ";
        if (name === "NotAllowedError") msg = "ไม่ได้รับอนุญาตให้ใช้กล้อง — กรุณาอนุญาตในเบราว์เซอร์";
        else if (name === "NotFoundError") msg = "ไม่พบกล้องในอุปกรณ์นี้";
        else if (name === "NotReadableError") msg = "กล้องถูกใช้งานโดยแอปอื่นอยู่";
        else if (name === "SecurityError") msg = "เบราว์เซอร์บล็อกกล้อง (ต้องเปิดผ่าน HTTPS)";
        console.error("Camera permission error", e);
        setError(msg);
        toast.error(msg);
        return;
      }

      try {
        // Clear any previous video/canvas elements that html5-qrcode may have left behind
        if (el) el.innerHTML = "";
        if (scannerRef.current) {
          try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch {}
          try { await scannerRef.current.clear(); } catch {}
          scannerRef.current = null;
        }
        const inst = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
        scannerRef.current = inst;
        const elW = el.clientWidth || 320;
        const boxSize = Math.min(360, Math.floor(elW * 0.75));
        await inst.start(
          cameraConfig,
          {
            fps: 15,
            qrbox: { width: boxSize, height: boxSize },
            aspectRatio: 1.333,
            useBarCodeDetectorIfSupported: true,
            // iOS Safari: บังคับ resolution สูง → บังคับใช้ main sensor (autofocus ดีกว่ากล้อง ultrawide)
            videoConstraints: IS_IOS
              ? { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
              : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          } as any,
          (decoded) => {
            if (cancelled) return;
            const code = decoded.trim();
            if (code.length < 3 || /[\x00-\x1f]/.test(code)) return;
            const now = Date.now();
            if (code === lastScanRef.current.code && now - lastScanRef.current.at < 1500) return;
            lastScanRef.current = { code, at: now };
            onScanRef.current(code);
            if (!continuous) {
              stop();
              onCloseRef.current();
            }
          },

          () => {}
        );

        // เปิด autofocus ต่อเนื่อง + macro focus ให้กล้อง (ช่วยไม่ให้ QR เบลอในระยะใกล้)
        try {
          const videoEl = el.querySelector("video") as HTMLVideoElement | null;
          const stream = (videoEl?.srcObject as MediaStream) || null;
          await applyCameraFocus(stream, "close");
        } catch {}

      } catch (e: any) {
        console.error("Scanner start failed", e);
        const msg = e?.message || "เริ่มสแกนไม่สำเร็จ";
        setError(msg);
        toast.error(msg);
      }
    };

    start();
    return () => { cancelled = true; stop(); };
  }, [open, continuous]);


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
            id={SCANNER_ID}
            onClick={triggerRefocus}
            className="w-full rounded-lg overflow-hidden bg-black/80 min-h-[300px] cursor-pointer select-none"
          />
          {/* ปุ่มโฟกัสใหม่ — จำเป็นสำหรับ iOS Safari ที่ไม่รองรับ focusMode API */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); triggerRefocus(); }}
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-white/90 hover:bg-white text-black shadow-lg backdrop-blur flex items-center justify-center active:scale-95 transition-all"
            aria-label="โฟกัสใหม่"
          >
            <Focus className={`w-5 h-5 ${refocusing ? "animate-spin" : ""}`} />
          </button>
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
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="กรอกรหัสนักเรียน/รหัสบนบัตรแทนการสแกน"
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                autoFocus
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                disabled={manual.trim().length < 2}
              >
                ยืนยัน
              </button>
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
