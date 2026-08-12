import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SwitchCamera, Camera } from "lucide-react";
import { listCameras, nextCameraId, type CameraInfo } from "@/lib/cameraStream";

interface Props {
  /** deviceId ที่กำลังใช้อยู่ */
  value?: string;
  onChange: (deviceId: string) => void;
  /** เรียกหลังเปิดกล้องสำเร็จ เพื่อรีเฟรช label */
  refreshKey?: unknown;
  disabled?: boolean;
  className?: string;
}

/** เลือกกล้อง (รองรับเครื่องที่มีกล้องหลายตัว) + ปุ่มสลับกล้องเร็ว */
export function CameraSourcePicker({ value, onChange, refreshKey, disabled, className }: Props) {
  const [cams, setCams] = useState<CameraInfo[]>([]);

  useEffect(() => {
    let alive = true;
    listCameras().then((c) => { if (alive) setCams(c); });
    const onDev = () => listCameras().then((c) => { if (alive) setCams(c); });
    navigator.mediaDevices?.addEventListener?.("devicechange", onDev);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDev);
    };
  }, [refreshKey]);

  if (cams.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 min-w-[10rem] flex-1 text-xs">
          <Camera className="w-3.5 h-3.5 mr-1 shrink-0 opacity-70" />
          <SelectValue placeholder="เลือกกล้อง" />
        </SelectTrigger>
        <SelectContent className="z-[100] bg-popover">
          {cams.map((c) => (
            <SelectItem key={c.deviceId} value={c.deviceId} className="text-xs">
              {c.label}
              {c.facing === "user" ? " (หน้า)" : c.facing === "environment" ? " (หลัง)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {cams.length > 1 && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
          title="สลับกล้อง"
          onClick={() => {
            const id = nextCameraId(cams, value);
            if (id) onChange(id);
          }}
        >
          <SwitchCamera className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

export default CameraSourcePicker;
