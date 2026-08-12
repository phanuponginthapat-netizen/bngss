import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DriveOAuthCredentialsCard from "./DriveOAuthCredentialsCard";

type Status = {
  nativeOAuthConfigured?: boolean;
  clientIdSuffix?: string | null;
  mode?: string;
};

/** การ์ดรวมขั้นตอนเชื่อม Google Drive จบในหน้าเดียว (กรอก Client ID/Secret → กดเชื่อม) */
export default function DriveConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const loadStatus = async () => {
    setChecking(true);
    try {
      const { data } = await supabase.functions.invoke("gdrive-admin-status", { body: {} });
      setStatus((data ?? {}) as Status);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: conn } = await supabase
          .from("app_user_connections" as any)
          .select("id")
          .eq("user_id", user.id)
          .eq("connector_id", "google_drive")
          .is("revoked_at", null)
          .maybeSingle();
        setConnected(!!conn);
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/dashboard/line-vault?tab=settings`;
      const { data, error } = await supabase.functions.invoke("gdrive-connect-start", {
        body: { return_url: returnUrl },
      });
      if (error) throw new Error(error.message);
      const parsed: any = typeof data === "string" ? JSON.parse(data) : data;
      if (!parsed?.authorize_url) throw new Error("ไม่ได้รับ authorize_url");
      window.location.href = parsed.authorize_url;
    } catch (e: any) {
      toast.error("เริ่มการเชื่อมต่อไม่สำเร็จ: " + (e?.message ?? e));
      setConnecting(false);
    }
  };

  const ready = !!status?.nativeOAuthConfigured;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">เชื่อมต่อ Google Drive</h2>
        </div>
        <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
          <li>คัดลอก Redirect URI ด้านล่างไปใส่ใน Google Cloud Console</li>
          <li>กรอก Client ID / Client Secret แล้วกด “บันทึกค่า OAuth”</li>
          <li>กด “เริ่มเชื่อม Google Drive” เพื่ออนุญาตสิทธิ์</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ready ? "default" : "secondary"}>
            OAuth Client: {ready ? `พร้อมใช้ ${status?.clientIdSuffix ?? ""}` : "ยังไม่ตั้งค่า"}
          </Badge>
          <Badge variant={connected ? "default" : "secondary"}>
            บัญชี Drive: {connected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={loadStatus} disabled={checking}>
            <RefreshCw className={`w-4 h-4 mr-1 ${checking ? "animate-spin" : ""}`} /> ตรวจสอบสถานะ
          </Button>
        </div>
        <Button onClick={connect} disabled={!ready || connecting}>
          <Link2 className="w-4 h-4 mr-2" />
          {connecting ? "กำลังเปิดหน้าอนุญาต…" : connected ? "เชื่อม Google Drive ใหม่" : "เริ่มเชื่อม Google Drive"}
        </Button>
        {!ready && (
          <p className="text-xs text-muted-foreground">กรอกและบันทึก Client ID/Secret ก่อน ปุ่มจึงจะใช้งานได้</p>
        )}
      </Card>

      <DriveOAuthCredentialsCard onSaved={loadStatus} />
    </div>
  );
}
