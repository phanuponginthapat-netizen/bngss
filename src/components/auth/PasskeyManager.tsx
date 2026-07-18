import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Fingerprint, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";

type Cred = {
  id: string;
  credential_id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
};

/**
 * จัดการ Passkey (WebAuthn) ของผู้ใช้ — เพิ่ม/ลบ
 * วางในหน้า ProfilePage / SecuritySettings
 */
export default function PasskeyManager() {
  const [creds, setCreds] = useState<Cred[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("webauthn_credentials")
      .select("id, credential_id, device_label, created_at, last_used_at")
      .order("created_at", { ascending: false });
    setCreds((data as Cred[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const enroll = async () => {
    if (!window.PublicKeyCredential) {
      toast.error("เบราว์เซอร์นี้ไม่รองรับ Passkey");
      return;
    }
    setBusy(true);
    try {
      const origin = window.location.origin;
      const { data: opt, error } = await supabase.functions.invoke("webauthn", {
        body: { action: "register-options", origin },
      });
      if (error || !opt?.options) throw new Error(error?.message || "ไม่ได้ option");
      const attResp = await startRegistration({ optionsJSON: opt.options });
      const { error: vErr } = await supabase.functions.invoke("webauthn", {
        body: { action: "register-verify", origin, response: attResp, deviceLabel: label || navigator.userAgent.slice(0, 60) },
      });
      if (vErr) throw vErr;
      toast.success("เพิ่ม Passkey สำเร็จ");
      setLabel("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "เพิ่ม Passkey ล้มเหลว");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบ Passkey นี้?")) return;
    const { error } = await (supabase as any).from("webauthn_credentials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบแล้ว");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-4 h-4 text-primary" /> Passkey / ลายนิ้วมือ / Face ID
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          ลงทะเบียนอุปกรณ์นี้เพื่อเข้าระบบด้วยลายนิ้วมือ/ใบหน้าโดยไม่ต้องใส่รหัสผ่าน
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="ชื่ออุปกรณ์ (เช่น iPhone ของฉัน)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="text-sm"
          />
          <Button size="sm" onClick={enroll} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Fingerprint className="w-4 h-4 mr-1" />}
            เพิ่ม Passkey
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
        ) : creds.length === 0 ? (
          <p className="text-xs text-muted-foreground">ยังไม่มี Passkey ลงทะเบียน</p>
        ) : (
          <ul className="space-y-2">
            {creds.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.device_label || "ไม่ระบุชื่อ"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    เพิ่มเมื่อ {new Date(c.created_at).toLocaleDateString("th-TH")}
                    {c.last_used_at && ` · ใช้ล่าสุด ${new Date(c.last_used_at).toLocaleDateString("th-TH")}`}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">ใช้งานได้</Badge>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id)} title="ลบ">
                  <Trash2 className="w-4 h-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
