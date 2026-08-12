import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Focus, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getFocusLockSupport, lockFocusExposure, unlockFocusExposure } from "@/lib/cameraFocus";

interface Props {
  /** ดึง MediaStream ปัจจุบัน (เช่น () => videoRef.current?.srcObject as MediaStream) */
  getStream: () => MediaStream | null | undefined;
  /** กล้องกำลังเปิดอยู่ไหม */
  active?: boolean;
  className?: string;
}

/**
 * ปุ่มล็อกโฟกัส + ค่าแสง (AF/AE Lock) — ช่วยลดภาพเบลอ/แสงกระพริบระหว่างลงทะเบียนบนมือถือ
 * แสดงเฉพาะเมื่อกล้องรองรับ
 */
export function CameraFocusLockToggle({ getStream, active, className }: Props) {
  const [supported, setSupported] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) { setSupported(false); setLocked(false); return; }
    let alive = true;
    const check = () => {
      const s = getStream();
      if (!alive) return;
      setSupported(getFocusLockSupport(s).any);
    };
    check();
    const t = setTimeout(check, 800);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || !supported) return null;

  const toggle = async () => {
    const s = getStream();
    if (!s) return;
    setBusy(true);
    try {
      if (locked) {
        await unlockFocusExposure(s);
        setLocked(false);
        toast.info("ปลดล็อกโฟกัส/ค่าแสงแล้ว");
      } else {
        const ok = await lockFocusExposure(s);
        if (ok) {
          setLocked(true);
          toast.success("ล็อกโฟกัสและค่าแสงแล้ว — ถือกล้องนิ่ง ๆ");
        } else {
          toast.error("กล้องนี้ล็อกโฟกัส/ค่าแสงไม่ได้");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={locked ? "default" : "outline"}
      size="sm"
      disabled={busy}
      onClick={toggle}
      className={`h-9 shrink-0 text-xs ${className || ""}`}
      title="ล็อกโฟกัสและค่าแสงอัตโนมัติ (ลดภาพเบลอ)"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        : locked ? <Lock className="w-3.5 h-3.5 mr-1.5" />
        : <Focus className="w-3.5 h-3.5 mr-1.5" />}
      {locked ? "ล็อกโฟกัส/แสงอยู่" : "ล็อกโฟกัส/แสง"}
    </Button>
  );
}

export default CameraFocusLockToggle;
