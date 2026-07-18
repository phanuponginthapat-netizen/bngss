import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Smartphone, Share, Plus, BellOff, CheckCircle2, AlertTriangle, Download, ArrowLeft, SkipForward } from "lucide-react";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushStatus,
  isInIframe,
  isPreviewHost,
} from "@/lib/pushSubscribe";

export default function InstallPage() {
  const navigate = useNavigate();
  function handleSkip() {
    try { localStorage.setItem("install_skipped_at", String(Date.now())); } catch {}
    navigate("/dashboard");
  }
  const [status, setStatus] = useState<"subscribed" | "denied" | "default" | "unsupported" | "loading">("loading");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [branding, setBranding] = useState<{ name: string; logo: string }>(() => {
    const b = (window as any).__branding;
    return { name: b?.name || document.title || "ระบบบริหารโรงเรียน", logo: b?.logo || "/icon-192.png" };
  });
  useEffect(() => {
    const handler = (e: any) => setBranding({ name: e.detail.name, logo: e.detail.logo });
    window.addEventListener("branding:ready", handler);
    return () => window.removeEventListener("branding:ready", handler);
  }, []);
  const inPreview = isInIframe() || isPreviewHost();

  useEffect(() => {
    getCurrentPushStatus().then(setStatus);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") toast.success("เริ่มติดตั้งแอปแล้ว");
    setInstallPrompt(null);
  }

  async function handleEnable() {
    setBusy(true);
    const r = await subscribeToPush();
    setBusy(false);
    if (r.success) {
      toast.success("เปิดแจ้งเตือนสำเร็จ");
      setStatus("subscribed");
    } else {
      toast.error(r.error || "เปิดแจ้งเตือนไม่สำเร็จ");
    }
  }

  async function handleDisable() {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    toast.success("ปิดแจ้งเตือนแล้ว");
    setStatus("default");
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton fallback="/dashboard" />
        <Button variant="outline" size="sm" onClick={handleSkip}>
          ข้ามไปหน้าระบบ <SkipForward className="w-4 h-4 ml-2" />
        </Button>
      </div>
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-2 overflow-hidden">
          {branding.logo && branding.logo !== "/icon-192.png" ? (
            <img src={branding.logo} alt={branding.name} className="w-full h-full object-contain" />
          ) : (
            <Smartphone className="w-8 h-8" />
          )}
        </div>
        <h1 className="text-3xl font-bold">ติดตั้งแอป {branding.name}</h1>
        <p className="text-muted-foreground">รับแจ้งเตือนเรียลไทม์บนมือถือ ฟรีไม่จำกัด ไม่ต้องผ่าน LINE</p>
      </div>


      {inPreview && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>กำลังดูในตัวอย่าง (Preview)</AlertTitle>
          <AlertDescription>
            การติดตั้งแอปและการแจ้งเตือนจะใช้งานได้เมื่อเปิดเว็บจริงผ่านเบราว์เซอร์มือถือเท่านั้น
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Install */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            ขั้นตอนที่ 1: ติดตั้งลงหน้าจอ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isStandalone ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>ติดตั้งเรียบร้อยแล้ว</AlertTitle>
              <AlertDescription>คุณกำลังเปิดผ่านแอปที่ติดตั้งไว้</AlertDescription>
            </Alert>
          ) : isIOS ? (
            <div className="space-y-3">
              <p className="text-sm">สำหรับ iPhone / iPad (Safari เท่านั้น):</p>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">1</Badge>
                  <span>
                    แตะปุ่ม <Share className="inline w-4 h-4" /> <strong>แชร์</strong> ด้านล่าง
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">2</Badge>
                  <span>
                    เลือก <Plus className="inline w-4 h-4" /> <strong>เพิ่มไปยังหน้าจอโฮม</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">3</Badge>
                  <span>แตะ <strong>เพิ่ม</strong> มุมขวาบน</span>
                </li>
              </ol>
              <Alert>
                <AlertDescription className="text-xs">
                  💡 iOS 16.4 ขึ้นไปจึงรองรับการแจ้งเตือน — กรุณาเปิดแอปที่ติดตั้งแล้ว (ไม่ใช่ใน Safari) เพื่อเปิดแจ้งเตือนในขั้นตอนถัดไป
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-3">
              {installPrompt ? (
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  ติดตั้งแอปทันที
                </Button>
              ) : (
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">1</Badge>
                    <span>แตะเมนู <strong>⋮</strong> (สามจุด) มุมขวาบนของเบราว์เซอร์</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">2</Badge>
                    <span>เลือก <strong>"ติดตั้งแอป"</strong> หรือ <strong>"เพิ่มไปที่หน้าจอหลัก"</strong></span>
                  </li>
                </ol>
              )}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">แนะนำ: ใช้ Google Chrome เพื่อความเสถียร</AlertTitle>
                <AlertDescription className="text-xs space-y-1">
                  <p>• Chrome จะสร้าง <strong>WebAPK</strong> (แอปจริง) ที่ไม่หายเมื่อรีสตาร์ทเครื่อง</p>
                  <p>• Samsung Internet / Firefox / Edge จะสร้างแค่ <strong>ทางลัด (Shortcut)</strong> ซึ่ง Samsung/Xiaomi/Huawei อาจล้างทิ้งเมื่อรีบูต</p>
                  <p>• หากไอคอนหายบ่อย → ถอนติดตั้งแล้วเปิดเว็บนี้ผ่าน <strong>Chrome</strong> แล้วติดตั้งใหม่</p>
                </AlertDescription>
              </Alert>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Step 2: Enable notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            ขั้นตอนที่ 2: เปิดการแจ้งเตือน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && <p className="text-sm text-muted-foreground">กำลังตรวจสอบสถานะ...</p>}

          {status === "unsupported" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน Web Push</AlertDescription>
            </Alert>
          )}

          {status === "denied" && (
            <Alert variant="destructive">
              <BellOff className="h-4 w-4" />
              <AlertTitle>ถูกบล็อกอยู่</AlertTitle>
              <AlertDescription>
                ไปที่ตั้งค่าเบราว์เซอร์ → เลือกเว็บนี้ → อนุญาตการแจ้งเตือน แล้วลองใหม่
              </AlertDescription>
            </Alert>
          )}

          {status === "default" && (
            <Button onClick={handleEnable} disabled={busy || inPreview} className="w-full" size="lg">
              <Bell className="w-4 h-4 mr-2" />
              {busy ? "กำลังเปิด..." : "เปิดการแจ้งเตือน"}
            </Button>
          )}

          {status === "subscribed" && (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>เปิดแจ้งเตือนแล้ว ✓</AlertTitle>
                <AlertDescription>คุณจะได้รับการแจ้งเตือนเรียลไทม์เมื่อมีกิจกรรมในระบบ</AlertDescription>
              </Alert>
              <Button onClick={handleDisable} disabled={busy} variant="outline" className="w-full">
                <BellOff className="w-4 h-4 mr-2" />
                ปิดการแจ้งเตือน
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isStandalone && status === "subscribed" && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              ตั้งค่าครบทุกขั้นตอนแล้ว
            </div>
            <Button onClick={handleSkip} className="w-full" size="lg">
              เข้าสู่ระบบ
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-sm space-y-2 text-muted-foreground">
          <p className="font-medium text-foreground">📌 ข้อดีของการแจ้งเตือนผ่านแอป</p>
          <ul className="space-y-1 pl-4 list-disc">
            <li>ฟรี 100% ไม่จำกัดจำนวน (ไม่กินโควต้า LINE OA)</li>
            <li>เรียลไทม์ทันทีเมื่อมีกิจกรรม</li>
            <li>เก็บประวัติแจ้งเตือนในแอปได้เต็มรูปแบบ</li>
            <li>กดแจ้งเตือน → เปิดหน้าที่เกี่ยวข้องทันที</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
