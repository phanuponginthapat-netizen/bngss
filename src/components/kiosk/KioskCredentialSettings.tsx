import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getKioskDeviceKey, saveKioskDeviceKey } from "@/lib/kioskDeviceCredential";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function KioskCredentialSettings({ onConnected }: { onConnected: () => void }) {
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(() => !!getKioskDeviceKey());
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("kiosk-face-download", {
        headers: { "x-device-key": key.trim() }, body: { auth_only: true },
      });
      if (error || data?.authorized !== true) throw new Error("รหัสเครื่องไม่ถูกต้อง เครื่องถูกปิดใช้งาน หรือระบบยังไม่ได้อัปเดต");
      saveKioskDeviceKey(key); setKey(""); setConnected(true); onConnected();
      toast.success("เชื่อมต่อเครื่องสแกนแล้ว");
    } catch (error) { toast.error(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 border-t pt-2">
    <Label htmlFor="kiosk-device-key">รหัสเครื่องสแกน</Label>
    <p className="text-xs text-muted-foreground">{connected ? "บันทึกรหัสเครื่องแล้ว" : "ยังไม่ได้ผูกเครื่อง"}</p>
    <Input id="kiosk-device-key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="รหัสจากหน้าตั้งค่าคีออส" />
    <Button size="sm" disabled={busy || !key.trim()} onClick={connect}>{busy ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อเครื่อง"}</Button>
  </div>;
}