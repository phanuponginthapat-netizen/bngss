import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { QRCodeSVG } from "qrcode.react";
import { Apple, ArrowRight, Bell, BellOff, CheckCircle2, Copy, Download, ExternalLink, Loader2, Monitor, ScanFace, Share, Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import BackButton from "@/components/BackButton";
import IosIpaDownload from "@/components/install/IosIpaDownload";
import { toast } from "sonner";
import { subscribeToPush, unsubscribeFromPush, getCurrentPushStatus, isInIframe, isPreviewHost } from "@/lib/pushSubscribe";
import { isNativeFcmSupported } from "@/lib/fcmPush";
import { useAndroidRelease, formatReleaseSize, formatReleaseDate } from "@/lib/githubRelease";
import { useFacegateRelease } from "@/lib/facegateRelease";
import { parseScannerRelease } from "@/lib/scannerRelease";
import { fetchAppDownloadsJson } from "@/lib/storageUrl";
import { detectInstallPlatform, isEmbeddedBrowser, type InstallPlatform } from "@/lib/installPlatform";
import { useQuery } from "@tanstack/react-query";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return <ol className="space-y-4">{items.map((item, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground">{i + 1}</span><div className="pt-0.5">{item}</div></li>)}</ol>;
}

export default function InstallPage() {
  const navigate = useNavigate();
  const device = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const [platform, setPlatform] = useState<InstallPlatform>(device);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [status, setStatus] = useState<"subscribed" | "denied" | "default" | "unsupported" | "loading" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(() => Capacitor.isNativePlatform() || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [branding, setBranding] = useState(() => {
    const b = (window as Window & { __branding?: { name?: string; logo?: string } }).__branding;
    return { name: b?.name || "BNG Smart School", logo: b?.logo || "/icon-192.png" };
  });
  const preview = isInIframe() || isPreviewHost();
  const embedded = isEmbeddedBrowser(navigator.userAgent);
  const native = Capacitor.isNativePlatform();
  const nativePush = isNativeFcmSupported();
  const { release, isLive, isFetching, refetch } = useAndroidRelease();
  const facegate = useFacegateRelease();
  const scanner = useQuery({
    queryKey: ["install-scanner-release"],
    queryFn: async () => parseScannerRelease(await fetchAppDownloadsJson("release-scanner.json")),
    staleTime: 5 * 60_000,
  });
  const scannerFile = scanner.data?.files[0];
  const publicInstallUrl = "https://bngss.lovable.app/install";

  async function checkStatus() {
    setStatus("loading");
    try { setStatus(await getCurrentPushStatus()); } catch { setStatus("error"); }
  }

  useEffect(() => {
    void checkStatus();
    const beforeInstall = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const installed = () => { setStandalone(true); setPrompt(null); };
    const brand = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; logo?: string }>).detail;
      if (detail) setBranding(current => ({ name: detail.name || current.name, logo: detail.logo || current.logo }));
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("branding:ready", brand);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("branding:ready", brand);
    };
  }, []);

  function enter() {
    try { localStorage.setItem("install_skipped_at", String(Date.now())); } catch { /* storage may be blocked */ }
    navigate("/dashboard");
  }
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") toast.success("รับคำขอติดตั้งแล้ว");
      setPrompt(null);
    } catch { toast.error("เปิดหน้าติดตั้งไม่ได้ กรุณาใช้เมนูของเบราว์เซอร์"); }
    finally { setBusy(false); }
  }
  async function togglePush(enable: boolean) {
    setBusy(true);
    try {
      if (enable) {
        const result = await subscribeToPush();
        if (!result.success) throw new Error(result.error || "เปิดแจ้งเตือนไม่สำเร็จ");
        setStatus("subscribed");
        toast.success("เปิดแจ้งเตือนสำเร็จ");
      } else {
        await unsubscribeFromPush();
        setStatus("default");
        toast.success("ปิดแจ้งเตือนแล้ว");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "เปลี่ยนการแจ้งเตือนไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicInstallUrl); toast.success("คัดลอกลิงก์ติดตั้งแล้ว"); }
    catch { toast.error("คัดลอกไม่ได้ กรุณาเปิด bngss.lovable.app/install ในเบราว์เซอร์"); }
  }

  return <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 text-foreground">
    <div className="mb-8 flex items-center justify-between gap-3"><BackButton fallback="/" /><Button variant="ghost" onClick={enter}>เข้าใช้งานระบบ <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
    <header className="mb-8 flex items-center gap-4 sm:gap-6">
      <img src={branding.logo} alt="โลโก้โรงเรียน" className="h-16 w-16 shrink-0 rounded-lg object-contain sm:h-20 sm:w-20" />
      <div className="min-w-0"><p className="mb-1 text-sm font-medium text-primary">ติดตั้งแอปโรงเรียน</p><h1 className="break-words text-2xl font-bold leading-snug sm:text-3xl">{branding.name}</h1><p className="mt-2 text-sm text-muted-foreground">Android · iPhone / iPad · Windows / macOS / Linux</p></div>
    </header>
    {preview && <Alert className="mb-6"><AlertTriangle className="h-4 w-4" /><AlertTitle>เปิดเว็บไซต์จริงเพื่อติดตั้ง</AlertTitle><AlertDescription>การติดตั้งและเปิดแจ้งเตือนต้องทำจากเบราว์เซอร์โดยตรง<Button asChild variant="link" className="h-auto px-0 ml-2"><a href={publicInstallUrl} target="_blank" rel="noopener noreferrer">เปิดเว็บไซต์ <ExternalLink className="ml-1 h-3 w-3" /></a></Button></AlertDescription></Alert>}
    {embedded && <Alert className="mb-6"><ExternalLink className="h-4 w-4" /><AlertTitle>กำลังเปิดผ่าน LINE หรือแอปโซเชียล</AlertTitle><AlertDescription>เปิดเมนูแล้วเลือกเปิดในเบราว์เซอร์ ใช้ Safari สำหรับ iPhone/iPad หรือ Chrome สำหรับ Android<Button onClick={copyLink} variant="outline" size="sm" className="mt-3 flex"><Copy className="mr-2 h-4 w-4" />คัดลอกลิงก์</Button></AlertDescription></Alert>}
    {standalone && <Alert className="mb-6"><CheckCircle2 className="h-4 w-4" /><AlertTitle>เครื่องนี้กำลังเปิดผ่านแอปแล้ว</AlertTitle><AlertDescription>ไม่ต้องติดตั้งซ้ำ สามารถเข้าใช้งานระบบได้เลย</AlertDescription></Alert>}
    <Tabs value={platform} onValueChange={value => setPlatform(value as InstallPlatform)}>
      <TabsList className="grid w-full grid-cols-3 mb-6"><TabsTrigger value="android" className="px-2 gap-1.5"><Smartphone className="h-4 w-4 shrink-0" />Android</TabsTrigger><TabsTrigger value="ios" className="px-2 gap-1.5"><Apple className="h-4 w-4 shrink-0" />iPhone/iPad</TabsTrigger><TabsTrigger value="desktop" className="px-2 gap-1.5"><Monitor className="h-4 w-4 shrink-0" />คอมพิวเตอร์</TabsTrigger></TabsList>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <TabsContent value="android" className="mt-0 space-y-6">
            <div><Badge variant="secondary" className="mb-3">แอป Android</Badge><h2 className="text-xl font-semibold">ดาวน์โหลด BNG Smart</h2><p className="mt-2 text-sm text-muted-foreground">สำหรับมือถือและแท็บเล็ต Android 7.0 ขึ้นไป</p></div>
            {native ? <Button onClick={enter}><ArrowRight className="mr-2 h-4 w-4" />เข้าใช้งานแอป</Button> : <Button asChild size="lg" className="w-full sm:w-auto"><a href={release.downloadUrl}><Download className="mr-2 h-4 w-4" />ดาวน์โหลดแอป Android (.apk)</a></Button>}
            <p className="text-xs leading-relaxed text-muted-foreground">{isLive ? "รุ่นล่าสุด" : "ข้อมูลรุ่นที่ตรวจสอบไว้"} {release.version} · {formatReleaseSize(release.sizeBytes)} · {formatReleaseDate(release.publishedAt)}{!isLive && <Button variant="link" size="sm" className="h-auto px-2" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? "กำลังตรวจสอบ…" : "ตรวจสอบอีกครั้ง"}</Button>}</p>
            <Steps items={[
              <>ดาวน์โหลดไฟล์ <strong>bngss-app.apk</strong> แล้วเปิดจากโฟลเดอร์ดาวน์โหลด</>,
              <>ถ้าเครื่องถาม ให้อนุญาตติดตั้งจากเบราว์เซอร์ที่ใช้ดาวน์โหลด เฉพาะไฟล์จากโรงเรียน</>,
              <>แตะ <strong>ติดตั้ง</strong> แล้วเปิดแอป เข้าสู่ระบบด้วยบัญชีของคุณ</>,
              <>อนุญาตการแจ้งเตือนเมื่อแอปถาม และปิดสิทธิ์ติดตั้งจากแหล่งภายนอกเมื่อเสร็จ</>,
            ]} />
            <Accordion type="single" collapsible><AccordionItem value="android-web"><AccordionTrigger>ไม่ต้องการดาวน์โหลด APK?</AccordionTrigger><AccordionContent><p className="mb-3 text-muted-foreground">เปิดเว็บไซต์ด้วย Chrome แล้วเลือกเมนู ⋮ → เพิ่มไปยังหน้าจอหลัก ชื่อเมนูอาจเป็น “ติดตั้งแอป” ตามเครื่องที่ใช้</p>{prompt && device === "android" && !standalone && <Button onClick={install} disabled={preview || busy}><Download className="mr-2 h-4 w-4" />เพิ่มแอปลงหน้าจอหลัก</Button>}</AccordionContent></AccordionItem></Accordion>
          </TabsContent>
          <TabsContent value="ios" className="mt-0 space-y-6">
            <div><Badge variant="secondary" className="mb-3">ติดตั้งจาก Safari</Badge><h2 className="text-xl font-semibold">เพิ่มแอปลงหน้าจอ iPhone / iPad</h2><p className="mt-2 text-sm text-muted-foreground">ไม่ต้องดาวน์โหลด APK และไม่ต้องติดตั้งผ่าน App Store</p></div>
            <Steps items={[
              <>เปิด <strong>bngss.lovable.app</strong> ด้วย Safari</>,
              <>แตะ <Share className="inline h-4 w-4" /> <strong>แชร์</strong> ในแถบเครื่องมือของ Safari</>,
              <>เลือก <strong>เพิ่มไปยังหน้าจอโฮม</strong> หากมี “เปิดเป็นเว็บแอป” ให้เปิดไว้ แล้วแตะ <strong>เพิ่ม</strong></>,
              <>เปิดแอปจากไอคอนบนหน้าจอโฮม แล้วเข้าสู่ระบบ</>,
            ]} />
            <Alert><Bell className="h-4 w-4" /><AlertTitle>การแจ้งเตือนบน iPhone / iPad</AlertTitle><AlertDescription>ต้องใช้ iOS / iPadOS 16.4 ขึ้นไป และเปิดจากไอคอนที่เพิ่มบนหน้าจอโฮมก่อนอนุญาตแจ้งเตือน</AlertDescription></Alert>
            <Accordion type="single" collapsible><AccordionItem value="ipa"><AccordionTrigger>ไฟล์ iOS สำหรับเครื่องที่โรงเรียนจัดการ</AccordionTrigger><AccordionContent><IosIpaDownload /></AccordionContent></AccordionItem></Accordion>
          </TabsContent>
          <TabsContent value="desktop" className="mt-0 space-y-6">
            <div><Badge variant="secondary" className="mb-3">Windows · macOS · Linux</Badge><h2 className="text-xl font-semibold">ใช้ระบบบนคอมพิวเตอร์</h2><p className="mt-2 text-sm text-muted-foreground">เปิดใช้งานผ่านเว็บไซต์ได้ทันที ไม่ต้องติดตั้งไฟล์ APK</p></div>
            <Button onClick={enter} size="lg"><Monitor className="mr-2 h-4 w-4" />เปิดระบบโรงเรียน</Button>
            <div className="space-y-4"><h3 className="font-semibold">เพิ่มเป็นแอปหรือทางลัด</h3><Steps items={[
              <>เปิดเว็บไซต์ด้วย Chrome หรือ Edge บน Windows, macOS หรือ Linux</>,
              <>เปิดเมนูเบราว์เซอร์ แล้วเลือก <strong>ติดตั้งแอป</strong> หากมี หรือ <strong>สร้างทางลัด</strong> ชื่อเมนูขึ้นอยู่กับรุ่นเบราว์เซอร์</>,
              <>บน macOS Sonoma ขึ้นไป ใช้ Safari → <strong>ไฟล์ → เพิ่มไปยัง Dock</strong> ได้เช่นกัน</>,
            ]} /></div>
            {prompt && device === "desktop" && !standalone && <Button onClick={install} disabled={preview || busy}><Download className="mr-2 h-4 w-4" />ติดตั้งบนคอมพิวเตอร์เครื่องนี้</Button>}
          </TabsContent>
        </div>
        <aside className="border-t pt-6 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 flex flex-col items-center lg:items-start gap-3">
          <h2 className="text-sm font-semibold">ติดตั้งบนโทรศัพท์อีกเครื่อง</h2>
          <div className="rounded-lg bg-background p-3 border border-border"><QRCodeSVG value={publicInstallUrl} size={152} level="M" title="ลิงก์หน้าติดตั้งแอปโรงเรียน" /></div>
          <p className="text-xs text-muted-foreground text-center lg:text-left">สแกนเพื่อเปิดหน้าติดตั้งบนมือถือ</p><Button variant="outline" size="sm" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />คัดลอกลิงก์</Button>
        </aside>
      </div>
    </Tabs>
    <section className="mt-8 border-t pt-6 space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5 text-primary" />การแจ้งเตือนของเครื่องนี้</h2>
      {nativePush ? <p className="text-sm text-muted-foreground">อนุญาตแจ้งเตือนในแอปเมื่อระบบถาม หากเคยปิดไว้ ให้เปิดจากการตั้งค่าของเครื่อง → แอป BNG Smart → การแจ้งเตือน</p> : device === "ios" && !standalone ? <p className="text-sm text-muted-foreground">เพิ่มแอปลงหน้าจอโฮมก่อน แล้วเปิดจากไอคอนเพื่อเปิดแจ้งเตือน (iOS / iPadOS 16.4 ขึ้นไป)</p> : <>
        {status === "loading" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />กำลังตรวจสอบการแจ้งเตือน…</p>}
        {status === "default" && <Button onClick={() => void togglePush(true)} disabled={busy || preview || embedded}><Bell className="mr-2 h-4 w-4" />{busy ? "กำลังเปิด…" : "เปิดการแจ้งเตือน"}</Button>}
        {status === "subscribed" && <div className="flex flex-wrap items-center gap-4"><span className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />เปิดแจ้งเตือนแล้ว</span><Button variant="outline" size="sm" onClick={() => void togglePush(false)} disabled={busy || preview}><BellOff className="mr-2 h-4 w-4" />ปิดแจ้งเตือน</Button></div>}
        {status === "denied" && <Alert><BellOff className="h-4 w-4" /><AlertTitle>การแจ้งเตือนถูกบล็อก</AlertTitle><AlertDescription>เปิดการตั้งค่าเบราว์เซอร์หรือสิทธิ์เว็บไซต์ อนุญาตแจ้งเตือนสำหรับเว็บโรงเรียน แล้วกลับมาตรวจสอบอีกครั้ง</AlertDescription></Alert>}
        {status === "unsupported" && <p className="text-sm text-muted-foreground">เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน คุณยังอ่านรายการแจ้งเตือนในระบบได้</p>}
        {(status === "error" || status === "denied") && <Button variant="outline" size="sm" onClick={() => void checkStatus()}>ตรวจสอบอีกครั้ง</Button>}
      </>}
    </section>
    <section className="mt-6 border-t">
      <Accordion type="single" collapsible>
        <AccordionItem value="help"><AccordionTrigger>ติดตั้งไม่ได้ หรือไม่พบเมนูเพิ่มแอป</AccordionTrigger><AccordionContent className="space-y-3 text-muted-foreground"><p>หากเปิดจาก LINE/Facebook ให้เปิดในเบราว์เซอร์ก่อน สำหรับ Android ให้ตรวจพื้นที่ว่างและสิทธิ์ติดตั้งไฟล์ ส่วน iPhone/iPad ให้ใช้ Safari และเลื่อนดูรายการในเมนูแชร์</p><p>APK ใช้ได้เฉพาะ Android หากไม่พบเมนูติดตั้งบนคอมพิวเตอร์ สามารถเปิดเว็บไซต์หรือสร้างทางลัดไว้แทนได้ ระบบโรงเรียนต้องใช้อินเทอร์เน็ตเพื่ออ่านและบันทึกข้อมูล</p><Button asChild variant="link" className="px-0"><Link to="/download-app">รายละเอียดไฟล์ Android <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></AccordionContent></AccordionItem>
        <AccordionItem value="scanner"><AccordionTrigger><span className="flex items-center gap-2"><ScanFace className="h-4 w-4" />โปรแกรมเฉพาะสำหรับตู้สแกนโรงเรียน</span></AccordionTrigger><AccordionContent className="space-y-4"><p className="text-sm text-muted-foreground">แยกจากแอปโรงเรียนทั่วไป สำหรับเครื่องสแกนใบหน้าและเช็กชื่อโดยเฉพาะ</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><a href={facegate.url} download={facegate.fileName}><Download className="mr-2 h-4 w-4" />FaceGate {facegate.isExe ? "สำหรับ Windows" : "ชุดติดตั้ง"}</a></Button>{scannerFile ? <Button asChild variant="outline"><a href={scannerFile.url} rel="noreferrer"><Download className="mr-2 h-4 w-4" />BNG Scanner สำหรับ Android</a></Button> : <p className="text-sm text-muted-foreground">{scanner.isFetching ? "กำลังตรวจสอบ BNG Scanner…" : "ยังไม่มีไฟล์ BNG Scanner ที่ตรวจสอบแล้ว"}</p>}<Button asChild variant="ghost"><Link to="/dashboard/admin/kiosk-setup">ตั้งค่าตู้สแกน (ผู้ดูแล) <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></AccordionContent></AccordionItem>
      </Accordion>
    </section>
  </main>;
}
