import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Globe, Download, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import BrowserShortcutsGrid from "@/components/browser/BrowserShortcutsGrid";
import BrowserUrlBar from "@/components/browser/BrowserUrlBar";
import { openBrowserUrl } from "@/hooks/useBrowserShortcuts";

export default function BrowserPage() {
  const { user } = useAuthSession();
  const cms = useCmsValues(["browser_homepage"]);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [extInstalled, setExtInstalled] = useState<boolean | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const homepage = cms["browser_homepage"] || "https://www.google.com";

  useEffect(() => {
    const check = () => document.documentElement.getAttribute("data-school-safe-browser") === "1";
    if (check()) { setExtInstalled(true); return; }
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; setExtInstalled(v); obs.disconnect(); clearInterval(iv); clearTimeout(to); } };
    const obs = new MutationObserver(() => { if (check()) finish(true); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-school-safe-browser"] });
    const iv = setInterval(() => { if (check()) finish(true); }, 300);
    const to = setTimeout(() => finish(false), 5000);
    return () => { done = true; obs.disconnect(); clearInterval(iv); clearTimeout(to); };
  }, []);

  useEffect(() => {
    if (extInstalled && !autoOpened) {
      setAutoOpened(true);
      const w = window.open(homepage, "_blank", "noopener,noreferrer");
      if (!w) toast.error("เบราว์เซอร์บล็อกป็อปอัพ กรุณาอนุญาตแล้วกดปุ่ม 'เปิดเบราว์เซอร์'");
    }
  }, [extInstalled, autoOpened, homepage]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Safe Browser</h1>
            <p className="text-sm text-muted-foreground">เปิดเว็บผ่านส่วนขยายที่โรงเรียนควบคุม</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback>{(profile?.full_name || user.email || "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <div className="font-medium">{profile?.full_name || user.email}</div>
              <Badge variant="secondary" className="text-[10px] h-4">เข้าสู่ระบบแล้ว</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Extension status */}
      {extInstalled === false && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-amber-600" />
              <div>
                <div className="font-medium">ยังไม่ได้ติดตั้ง School Safe Browser</div>
                <div className="text-sm text-muted-foreground">ติดตั้งส่วนขยายเพื่อให้ระบบควบคุมการใช้งานได้</div>
              </div>
            </div>
            <Button onClick={() => navigate("/dashboard/browser/extension")}>ติดตั้ง Extension</Button>
          </CardContent>
        </Card>
      )}

      {extInstalled && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <div className="text-sm">
              <div className="font-medium">Extension พร้อมใช้งาน</div>
              <div className="text-muted-foreground">ทุกเว็บที่เปิดจะถูกบันทึกและตรวจ blocklist อัตโนมัติ</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* URL bar (พิมพ์เอง) */}
      <Card>
        <CardHeader><CardTitle className="text-base">พิมพ์ URL / คำค้นหา</CardTitle></CardHeader>
        <CardContent>
          <BrowserUrlBar />
        </CardContent>
      </Card>

      {/* Big open homepage button */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">หรือเปิดหน้าแรกของโรงเรียน</p>
          <Button size="lg" className="h-14 px-8 text-base" onClick={() => openBrowserUrl(homepage)}>
            <ExternalLink className="h-5 w-5 mr-2" /> เปิดเบราว์เซอร์
          </Button>
          <div className="text-xs text-muted-foreground break-all">{homepage}</div>
        </CardContent>
      </Card>

      {/* Shortcuts — ชุดเดียวกับ Agent + Sidebar */}
      <Card>
        <CardHeader><CardTitle className="text-base">แอปทางลัด</CardTitle></CardHeader>
        <CardContent>
          <BrowserShortcutsGrid />
        </CardContent>
      </Card>
    </div>
  );
}
