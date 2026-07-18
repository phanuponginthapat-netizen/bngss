import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Typed wrapper around the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string; client_uri?: string };
type AuthDetails = { client?: OAuthClient; redirect_url?: string; redirect_to?: string };
const oauthApi = () => (supabase.auth as any).oauth as {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  if (error)
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <h1 className="text-lg font-semibold">ไม่สามารถโหลดคำขอเชื่อมต่อได้</h1>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    );

  if (!details)
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p>กำลังโหลด…</p>
      </main>
    );

  const clientName = details.client?.name ?? "แอปพลิเคชันภายนอก";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
      <Card className="max-w-md w-full">
        <CardHeader>
          <h1 className="text-xl font-semibold">อนุญาตให้ {clientName} เข้าถึงบัญชีของคุณ?</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {clientName} จะสามารถเรียกใช้เครื่องมือของระบบโรงเรียนในนามของคุณ
            เช่น ดูข้อมูลโปรไฟล์ ข่าวสาร และกล่องข้อความส่วนตัวของคุณ
          </p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
              อนุญาต
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
              ปฏิเสธ
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
