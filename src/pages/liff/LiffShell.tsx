import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window { liff: any }
}

export default function LiffShell({ children, title }: { children: (lineUserId: string) => React.ReactNode; title: string }) {
  const [ready, setReady] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        let liffId = (window as any).__LIFF_ID__ || (import.meta.env.VITE_LIFF_ID as string) || "";
        if (!liffId) {
          const { data } = await supabase.from("school_settings").select("setting_value").eq("setting_key", "line_liff_id").maybeSingle();
          liffId = data?.setting_value || "";
        }
        if (!liffId) { setErr("ยังไม่ได้ตั้งค่า LIFF ID (ไปที่ Admin → ตั้งค่า LINE)"); return; }

        if (!window.liff) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            s.onload = () => res(); s.onerror = () => rej(new Error("LIFF SDK load failed"));
            document.head.appendChild(s);
          });
        }
        await window.liff.init({ liffId });
        if (!window.liff.isLoggedIn()) { window.liff.login(); return; }
        const ctx = window.liff.getContext();
        const uid = ctx?.userId || (await window.liff.getProfile()).userId;
        setLineUserId(uid);
        setReady(true);
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    };
    init();
  }, []);

  if (err) return <div className="p-6 text-destructive">⚠️ {err}</div>;
  if (!ready || !lineUserId) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );
  return (
    <div className="min-h-screen bg-background p-4">
      <h1 className="text-xl font-bold mb-4">{title}</h1>
      {children(lineUserId)}
    </div>
  );
}
