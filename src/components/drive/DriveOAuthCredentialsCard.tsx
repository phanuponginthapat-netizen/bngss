import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Save, Eye, EyeOff, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { getBackendConfig } from "@/lib/runtimeConfig";

const KEYS = {
  id: "GOOGLE_OAUTH_CLIENT_ID",
  secret: "GOOGLE_OAUTH_CLIENT_SECRET",
} as const;

type MetaRow = { key: string; has_value?: boolean | null };

/**
 * ฟอร์มกรอก Google OAuth Client ID / Secret สำหรับผู้ดูแล
 * ค่าจะถูกเก็บในตาราง app_secrets ของ backend โรงเรียน (ไม่ hardcode ในโค้ด)
 * Edge Functions อ่านผ่าน getSecret() → DB ก่อน แล้วค่อย fallback env
 */
export default function DriveOAuthCredentialsCard({ onSaved }: { onSaved?: () => void }) {
  const callbackUrl = `${getBackendConfig().url}/functions/v1/gdrive-connect-finish`;
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Record<string, boolean>>({});

  const loadStatus = async () => {
    const { data } = await supabase
      .from("app_secrets_meta" as any)
      .select("key,has_value")
      .in("key", [KEYS.id, KEYS.secret]);
    const next: Record<string, boolean> = {};
    for (const row of ((data ?? []) as unknown as MetaRow[])) next[row.key] = !!row.has_value;
    setStatus(next);
  };

  useEffect(() => { loadStatus(); }, []);

  const save = async () => {
    const id = clientId.trim();
    const secret = clientSecret.trim();
    if (!id && !secret) {
      toast.error("กรอก Client ID หรือ Client Secret อย่างน้อยหนึ่งช่อง");
      return;
    }
    if (id && !id.endsWith(".apps.googleusercontent.com")) {
      toast.error("Client ID ต้องลงท้ายด้วย .apps.googleusercontent.com");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      const now = new Date().toISOString();
      const rows: any[] = [];
      if (id) rows.push({ key: KEYS.id, value: id, category: "google", description: "Google OAuth Client ID for Drive", updated_at: now, updated_by: uid });
      if (secret) rows.push({ key: KEYS.secret, value: secret, category: "google", description: "Google OAuth Client Secret for Drive", updated_at: now, updated_by: uid });

      // เขียนตรงเข้าตาราง app_secrets (RLS อนุญาตเฉพาะ admin/director)
      const { error: upsertError } = await supabase
        .from("app_secrets" as any)
        .upsert(rows, { onConflict: "key" });

      if (upsertError) {
        // สำรอง: เรียก edge function (กรณี policy ไม่อนุญาตเขียนตรง)
        const { data, error } = await supabase.functions.invoke("gdrive-admin-status", {
          body: { action: "save_credentials", clientId: id || undefined, clientSecret: secret || undefined },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(upsertError.message || data?.error || "credential_save_failed");
      }

      toast.success("บันทึกค่า Google OAuth แล้ว");
      setClientId("");
      setClientSecret("");
      await loadStatus();
      onSaved?.();
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };


  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Google OAuth Client (ตั้งค่าเอง)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        กรอกค่าจาก Google Cloud Console → Credentials → OAuth client ID (Web application)
        ระบบจะเก็บไว้ในฐานข้อมูลของโรงเรียน ไม่ได้เขียนตายตัวไว้ในโค้ด
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="g-callback-url">Authorized redirect URI (ต้องตรงทุกตัวอักษร)</Label>
        <div className="flex gap-2">
          <Input id="g-callback-url" value={callbackUrl} readOnly className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="คัดลอก Redirect URI"
            onClick={async () => {
              await navigator.clipboard.writeText(callbackUrl);
              toast.success("คัดลอก Redirect URI แล้ว");
            }}
          >
            <Clipboard className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          นำ URL นี้ไปเพิ่มใน Google Cloud Console → OAuth client → Authorized redirect URIs ห้ามมี / ต่อท้าย
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={status[KEYS.id] ? "default" : "secondary"}>
          Client ID: {status[KEYS.id] ? "ตั้งแล้ว" : "ยังไม่ตั้ง"}
        </Badge>
        <Badge variant={status[KEYS.secret] ? "default" : "secondary"}>
          Client Secret: {status[KEYS.secret] ? "ตั้งแล้ว" : "ยังไม่ตั้ง"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="g-client-id">Client ID</Label>
          <Input
            id="g-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-client-secret">Client Secret</Label>
          <div className="flex gap-2">
            <Input
              id="g-client-secret"
              type={showSecret ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-…"
              autoComplete="new-password"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        <Save className="w-4 h-4 mr-2" /> {saving ? "กำลังบันทึก…" : "บันทึกค่า OAuth"}
      </Button>
      <p className="text-xs text-muted-foreground">
         เว้นว่างไว้ = ไม่เปลี่ยนค่าเดิม • หากพบ deleted_client ต้องกรอก Client ID ใหม่ด้วย ไม่ใช่เปลี่ยนเฉพาะ Secret
      </p>
    </Card>
  );
}
