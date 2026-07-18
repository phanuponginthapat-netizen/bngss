import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
          } as any,
          (decoded) => {
            if (cancelled) return;
            const code = decoded.trim();
            if (code.length < 3 || /[\x00-\x1f]/.test(code)) return;
            const now = Date.now();
            if (code === lastScanRef.current.code && now - lastScanRef.current.at < 1500) return;
            lastScanRef.current = { code, at: now };
            onScan(code);
            if (!continuous) {
              stop();
              onClose();
            }
          },
          () => {}
        );

      } catch (e: any) {
        console.error("Scanner start failed", e);
        const msg = e?.message || "เริ่มสแกนไม่สำเร็จ";
        setError(msg);
        toast.error(msg);
      }
    };

    start();
    return () => { cancelled = true; stop(); };
  }, [open, onScan, onClose, continuous]);


  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div id={SCANNER_ID} className="w-full rounded-lg overflow-hidden bg-black/80 min-h-[300px]" />
        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">{error}</div>
              <div className="mt-1 text-destructive/80">
                ตรวจสอบว่าเปิดผ่าน HTTPS และอนุญาตสิทธิ์กล้องในเบราว์เซอร์ (คลิกไอคอนกล้องบน address bar)
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            {continuous ? "เล็งกล้องไปที่ QR บัตรนักเรียนทีละคน — ระบบจะสแกนต่อเนื่อง" : "เล็งกล้องไปที่บาร์โค้ดหรือ QR Code ระบบจะสแกนอัตโนมัติ"}
          </p>
        )}

        {children}
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
