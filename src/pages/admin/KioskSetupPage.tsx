import { useState, useMemo, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, RotateCcw, Loader2 } from "lucide-react";
import {
  Download,
  Copy,
  Monitor,
  Wifi,
  Mic,
  ShieldCheck,
  Timer,
  QrCode,
  Terminal,
  DoorOpen,
  Users,
} from "lucide-react";
import {
  generateKioskSetupScript,
  getUninstallScript,
  downloadTextFile,
  type KioskMode,
} from "@/lib/generateKioskScript";
import { useCmsValue } from "@/hooks/useCmsSettings";

export default function KioskSetupPage() {
  const schoolName = useCmsValue("school_name") || "โรงเรียน";

  // ใช้ published URL เสมอ (ไม่ใช้ preview link ที่ต้อง login Lovable)
  const PUBLIC_ORIGIN = useMemo(() => {
    const o = window.location.origin;
    // ถ้าอยู่บน preview/lovable editor → fallback เป็น published domain
    if (o.includes("id-preview--") || o.includes("lovable.dev") || o.includes("localhost")) {
      return "https://bngss.lovable.app";
    }
    return o;
  }, []);

  const [mode, setMode] = useState<KioskMode>("door");
  const [kioskUrl, setKioskUrl] = useState(() => `${PUBLIC_ORIGIN}/kiosk`);
  const [kioskUser, setKioskUser] = useState("kiosk");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [enableDailyReboot, setEnableDailyReboot] = useState(true);
  const [rebootTime, setRebootTime] = useState("03:00");
  const [idleLogoutMin, setIdleLogoutMin] = useState(30);
  const [idleShutdownMin, setIdleShutdownMin] = useState(120);
  const [powerOn, setPowerOn] = useState("06:30");
  const [powerOff, setPowerOff] = useState("");
  const [exitPin, setExitPin] = useState("");
  const [savedUpdatedAt, setSavedUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const SETTING_KEY = "kiosk_config";

  // โหลดค่าที่บันทึกไว้ (ครั้งแรก)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("school_settings")
          .select("setting_value")
          .eq("setting_key", SETTING_KEY)
          .maybeSingle();
        let cfg: any = data?.setting_value ?? null;
        if (typeof cfg === "string") { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
        if (cfg && typeof cfg === "object") {
          if (cfg.mode) setMode(cfg.mode);
          if (cfg.kioskUrl) {
            // แทนที่ preview/lovableproject URL เก่าด้วย published domain เสมอ
            let u = String(cfg.kioskUrl);
            try {
              const parsed = new URL(u);
              if (
                parsed.hostname.includes("lovableproject.com") ||
                parsed.hostname.includes("lovable.dev") ||
                parsed.hostname.includes("id-preview--") ||
                parsed.hostname === "localhost"
              ) {
                u = `${PUBLIC_ORIGIN}${parsed.pathname === "/" ? "/kiosk" : parsed.pathname}`;
              }
            } catch { /* keep original */ }
            setKioskUrl(u);
          }
          if (cfg.kioskUser) setKioskUser(cfg.kioskUser);
          if (typeof cfg.wifiSsid === "string") setWifiSsid(cfg.wifiSsid);
          if (typeof cfg.wifiPass === "string") setWifiPass(cfg.wifiPass);
          if (typeof cfg.enableDailyReboot === "boolean") setEnableDailyReboot(cfg.enableDailyReboot);
          if (typeof cfg.rebootTime === "string") setRebootTime(cfg.rebootTime);
          if (typeof cfg.idleLogoutMin === "number") setIdleLogoutMin(cfg.idleLogoutMin);
          if (typeof cfg.idleShutdownMin === "number") setIdleShutdownMin(cfg.idleShutdownMin);
          if (typeof cfg.powerOn === "string") setPowerOn(cfg.powerOn);
          if (typeof cfg.powerOff === "string") setPowerOff(cfg.powerOff);
          if (typeof cfg.exitPin === "string") setExitPin(cfg.exitPin);
          if (typeof cfg.updated_at === "string") setSavedUpdatedAt(cfg.updated_at);
        }
      } catch (e) {
        console.error("load kiosk_config error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // normalize URL — บังคับใช้ published domain เสมอ (ไม่ให้ preview link หลุดไป save)
  const normalizeKioskUrl = (raw: string): string => {
    const fallback = `${PUBLIC_ORIGIN}${mode === "student" ? "/" : "/kiosk"}`;
    if (!raw || !raw.trim()) return fallback;
    try {
      const p = new URL(raw.trim());
      if (
        p.hostname.includes("lovableproject.com") ||
        p.hostname.includes("lovable.dev") ||
        p.hostname.includes("id-preview--") ||
        p.hostname === "localhost" ||
        p.hostname.startsWith("127.")
      ) {
        return `${PUBLIC_ORIGIN}${p.pathname === "/" || !p.pathname ? (mode === "student" ? "/" : "/kiosk") : p.pathname}${p.search}`;
      }
      return p.toString();
    } catch {
      return fallback;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const cleanUrl = normalizeKioskUrl(kioskUrl);
      if (cleanUrl !== kioskUrl) setKioskUrl(cleanUrl); // sync UI
      const value = {
        mode, kioskUrl: cleanUrl, kioskUser, wifiSsid, wifiPass,
        enableDailyReboot, rebootTime, idleLogoutMin, idleShutdownMin,
        powerOn, powerOff, exitPin,
        updated_at: nowIso,
      };
      const { error } = await supabase
        .from("school_settings")
        .upsert([{ setting_key: SETTING_KEY, setting_value: JSON.stringify(value) }], { onConflict: "setting_key" });
      if (error) throw error;
      setSavedUpdatedAt(nowIso);
      toast({ title: "บันทึกสำเร็จ", description: "การตั้งค่า Kiosk ถูกบันทึกแล้ว — เครื่องที่ออนไลน์จะรับค่าใหม่ภายในไม่กี่วินาที" });
    } catch (e: any) {
      toast({ title: "บันทึกไม่สำเร็จ", description: e?.message || "โปรดลองใหม่", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const handleReset = () => {
    if (!confirm("รีเซ็ตค่าทั้งหมดกลับเป็นค่าเริ่มต้น?")) return;
    handleModeChange(mode);
    toast({ title: "รีเซ็ตแล้ว", description: "ค่าถูกตั้งกลับเป็นค่าเริ่มต้นของโหมด (ยังไม่ได้บันทึก)" });
  };

  const handleModeChange = (m: KioskMode) => {
    setMode(m);
    if (m === "student") {
      setKioskUrl(`${PUBLIC_ORIGIN}/`);
      setRebootTime("");
      setEnableDailyReboot(false);
      setKioskUser("student");
      setPowerOn("07:30");
      setPowerOff("17:30");
      setIdleShutdownMin(120);
    } else {
      setKioskUrl(`${PUBLIC_ORIGIN}/kiosk`);
      setRebootTime("03:00");
      setEnableDailyReboot(true);
      setKioskUser("kiosk");
      setPowerOn("06:30");
      setPowerOff("");
      setIdleShutdownMin(0);
    }
  };

  const script = useMemo(
    () =>
      generateKioskSetupScript({
        mode,
        kioskUrl,
        kioskUser,
        wifiSsid,
        wifiPass,
        dailyReboot: enableDailyReboot ? rebootTime : "",
        idleLogoutMin,
        idleShutdownMin: mode === "student" ? idleShutdownMin : 0,
        powerOn,
        powerOff,
        monitorAgentUrl:
          mode === "student" ? `${PUBLIC_ORIGIN}/dashboard/monitor/agent` : undefined,
        schoolName,
      }),
    [mode, kioskUrl, kioskUser, wifiSsid, wifiPass, enableDailyReboot, rebootTime, idleLogoutMin, idleShutdownMin, powerOn, powerOff, schoolName, PUBLIC_ORIGIN],
  );

  const oneLiner = `curl -fsSL ${PUBLIC_ORIGIN}/kiosk-setup.sh | sudo KIOSK_MODE=${mode} bash`;


  const handleDownload = () => {
    const safeName = schoolName.replace(/[^ก-๙A-Za-z0-9]+/g, "-").toLowerCase();
    downloadTextFile(`setup-kiosk-${mode}-${safeName || "school"}.sh`, script);
    toast({ title: "ดาวน์โหลดสคริปต์แล้ว", description: "นำไฟล์ไปรันบนเครื่อง MX Linux" });
  };

  const handleDownloadUninstall = () => {
    downloadTextFile("uninstall-mxlinux-kiosk.sh", getUninstallScript());
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `คัดลอก${label}แล้ว` });
    } catch {
      toast({ title: "คัดลอกไม่สำเร็จ", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Monitor className="h-6 w-6 text-primary" />
          ตั้งค่าตู้ Kiosk (MX Linux)
        </h1>
        <p className="text-sm text-muted-foreground">
          สร้างสคริปต์ setup อัตโนมัติสำหรับเครื่อง HP Pavilion x2 / โน้ตบุ๊กที่ลง MX Linux —
          ปลุกจอด้วยกล้อง, Wake Word "hello ai", ปิด service เกินจำเป็น, boot &lt; 20 วิ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. เลือกโหมด Kiosk</CardTitle>
          <CardDescription>โหมด 2 แบบสำหรับใช้งานคนละกรณี</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handleModeChange("door")}
              className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                mode === "door" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <DoorOpen className={`h-6 w-6 shrink-0 ${mode === "door" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="font-semibold">Door — ตู้สแกนหน้าประตู</div>
                <div className="text-xs text-muted-foreground">
                  HP Pavilion x2 หน้าประตูโรงเรียน · Full lock · Wake daemon ปลุกจอด้วยกล้อง · รีบูตตี 3
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("student")}
              className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                mode === "student" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Users className={`h-6 w-6 shrink-0 ${mode === "student" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="font-semibold">Student — คอมพิวเตอร์นักเรียน</div>
                <div className="text-xs text-muted-foreground">
                  ห้องคอมพิวเตอร์นักเรียน · เปิด Monitor Agent ให้ครูดูจอ · Idle logout · รีบูต 22:30
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>






      <Card>
        <CardHeader>
          <CardTitle>2. ตั้งค่าเครื่อง Kiosk</CardTitle>
          <CardDescription>ค่าพวกนี้จะฝังลงในสคริปต์ที่ดาวน์โหลด</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="url">URL ที่จะเปิดเต็มจอ</Label>
              <Input
                id="url"
                value={kioskUrl}
                onChange={(e) => setKioskUrl(e.target.value)}
                placeholder="https://school.example.com/kiosk"
              />
              <p className="text-xs text-muted-foreground">
                Mic/Camera จะถูก auto-grant ให้ origin นี้ (Wake Word ทำงานทันที)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">ชื่อผู้ใช้ Linux (auto-login)</Label>
              <Input
                id="user"
                value={kioskUser}
                onChange={(e) => setKioskUser(e.target.value)}
                placeholder="kiosk"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssid" className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" /> Wi-Fi SSID (ไม่ระบุก็ได้)
              </Label>
              <Input
                id="ssid"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="MySchoolWiFi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pass">รหัส Wi-Fi</Label>
              <Input
                id="pass"
                type="password"
                value={wifiPass}
                onChange={(e) => setWifiPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="exitPin" className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> รหัสออกจาก Kiosk mode
              </Label>
              <Input
                id="exitPin"
                type="text"
                maxLength={32}
                value={exitPin}
                onChange={(e) => setExitPin(e.target.value)}
                placeholder="เว้นว่าง = ใช้รหัสเริ่มต้น bng521987"
              />
              <p className="text-xs text-muted-foreground">
                รหัสนี้ใช้ปลดล็อก Alt+Tab / Alt+F4 / Win key / F11 / ปิดแท็บ — ป้องกันเด็กออกจากโหมด Kiosk
                <br />ถ้าเว้นว่างระบบจะใช้รหัสเริ่มต้น <code className="rounded bg-muted px-1">bng521987</code>
              </p>
            </div>
          </div>


          <Separator />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Timer className="h-4 w-4" /> รีบูตอัตโนมัติทุกวัน
              </Label>
              <p className="text-xs text-muted-foreground">
                เคลียร์ memory leak ทำให้ตู้ Kiosk อยู่ได้ 24/7
              </p>
            </div>
            <div className="flex items-center gap-3">
              {enableDailyReboot && (
                <Input
                  type="time"
                  value={rebootTime}
                  onChange={(e) => setRebootTime(e.target.value)}
                  className="w-28"
                />
              )}
              <Switch
                checked={enableDailyReboot}
                onCheckedChange={setEnableDailyReboot}
              />
            </div>
          </div>

          {mode === "student" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Timer className="h-4 w-4" /> Idle logout (นาที)
                </Label>
                <p className="text-xs text-muted-foreground">
                  ถ้าไม่มีการใช้งานเกินเวลานี้ → logout อัตโนมัติ (0 = ปิด)
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={240}
                value={idleLogoutMin}
                onChange={(e) => setIdleLogoutMin(Number(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          )}

          {mode === "student" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Timer className="h-4 w-4" /> Idle shutdown (นาที)
                </Label>
                <p className="text-xs text-muted-foreground">
                  ไม่มีการใช้งานเกินเวลานี้ → ปิดเครื่องอัตโนมัติ (default 120 = 2 ชม.)
                </p>
              </div>
              <Input
                type="number" min={0} max={480}
                value={idleShutdownMin}
                onChange={(e) => setIdleShutdownMin(Number(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <Label className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4" /> เปิดเครื่องอัตโนมัติ (BIOS RTC wake)
              </Label>
              <Input
                type="time" value={powerOn}
                onChange={(e) => setPowerOn(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                เว้นว่าง = ปิด · ใช้ BIOS wakealarm ตั้งก่อน shutdown
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <Label className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4" /> ปิดเครื่องอัตโนมัติ
              </Label>
              <Input
                type="time" value={powerOff}
                onChange={(e) => setPowerOff(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                เว้นว่าง = ปิด · เหมาะกับเครื่องนักเรียนหลังเลิกเรียน
              </p>
            </div>
          </div>


          <div className="grid gap-2 md:grid-cols-3">
            <FeatureBadge icon={Mic} title="Wake Word" desc='"hello ai" พร้อมใช้ทันที' />
            <FeatureBadge icon={ShieldCheck} title="Hardened" desc="ปิด service เกินจำเป็น" />
            <FeatureBadge icon={Timer} title="Self-heal" desc="Watchdog + health check" />
          </div>

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              {loading ? "กำลังโหลดค่าที่บันทึกไว้..." : "บันทึกการตั้งค่านี้เพื่อใช้เป็นค่าเริ่มต้นเมื่อสร้างสคริปต์ครั้งถัดไป"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} disabled={saving || loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                รีเซ็ต
              </Button>
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>3. ติดตั้งบนเครื่อง MX Linux</CardTitle>
          <CardDescription>เลือกวิธีที่สะดวก — วิธี A เร็วสุด</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="download">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="download">
                <Download className="mr-1 h-4 w-4" /> A. ดาวน์โหลดไฟล์
              </TabsTrigger>
              <TabsTrigger value="curl">
                <Terminal className="mr-1 h-4 w-4" /> B. คำสั่ง one-liner
              </TabsTrigger>
              <TabsTrigger value="qr">
                <QrCode className="mr-1 h-4 w-4" /> C. QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="download" className="space-y-3 pt-4">
              <ol className="ml-5 list-decimal space-y-1 text-sm">
                <li>กดปุ่มด้านล่างเพื่อดาวน์โหลด <code>setup-kiosk-*.sh</code></li>
                <li>คัดลอกไปเครื่อง MX Linux (USB / SCP)</li>
                <li>
                  เปิด Terminal แล้วรัน:{" "}
                  <code className="rounded bg-muted px-1">sudo bash setup-kiosk-*.sh</code>
                </li>
                <li>รอเสร็จ (~5 นาที) แล้ว <code>sudo reboot</code></li>
              </ol>
              <div className="flex gap-2">
                <Button onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  ดาวน์โหลดสคริปต์ setup
                </Button>
                <Button variant="outline" onClick={handleDownloadUninstall}>
                  ดาวน์โหลดตัวถอนติดตั้ง
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="curl" className="space-y-3 pt-4">
              <Alert>
                <AlertTitle>รันบรรทัดเดียวจบ</AlertTitle>
                <AlertDescription>
                  ต้องอัปโหลดไฟล์ script ไว้ที่ <code>{PUBLIC_ORIGIN}/kiosk-setup.sh</code> ก่อน
                  (คัดลอกจากปุ่มดาวน์โหลดแล้ววางใน <code>public/</code>)
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted p-3 text-xs">
                  {oneLiner}
                </code>
                <Button variant="outline" size="icon" onClick={() => copy(oneLiner, "คำสั่ง")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="qr" className="pt-4">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-lg bg-white p-4">
                  <QRCodeSVG value={oneLiner} size={220} />
                </div>
                <p className="text-sm text-muted-foreground">
                  สแกนบนมือถือ → ส่งข้อความให้ตัวเอง → คัดลอกไปพิมพ์บน Terminal ของเครื่อง Kiosk
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. สิ่งที่สคริปต์ทำให้อัตโนมัติ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {[
              ["Auto-login", "LightDM เข้า desktop ทันที ไม่ต้องพิมพ์รหัส"],
              ["Chromium kiosk", "เปิดเต็มจอ ปิด infobar/session-crashed/translate"],
              ["Wake daemon", "port 9999 — ปลุกจอด้วย wakeKioskScreen()"],
              ["Mic/Camera policy", `auto-grant ให้ origin ${new URL(kioskUrl || "https://x").origin}`],
              ["PulseAudio", "auto-start + unmute Master/Capture ทุกครั้งบูต"],
              ["Watchdog", "Chromium ปิดเอง → เปิดใหม่ใน 15 วิ"],
              ["Health-check", "ping URL ทุก 60 วิ ล้ม 3 ครั้ง → reload"],
              ["ปิด service เกินจำเป็น", "bluetooth, cups, snapd, apt-daily, avahi ฯลฯ"],
              ["Xfce tuning", "ปิด compositor + power blank + notification"],
              ["Boot เร็ว", "GRUB timeout 1s, journald in-RAM 50M, noatime"],
              ["Intel GPU fix", "intel_idle.max_cstate=1 + i915.enable_psr=0 กันจอกระพริบ"],
              ["Daily reboot", enableDailyReboot ? `ทุกวันเวลา ${rebootTime}` : "ปิด"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 rounded-md border p-2">
                <span className="font-medium">{k}:</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ดูตัวอย่างสคริปต์</CardTitle>
          <CardDescription>ตรวจสอบก่อนดาวน์โหลดได้</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
            {script.slice(0, 4000)}
            {script.length > 4000 && "\n\n... (ตัดแสดงเฉพาะบางส่วน — ดาวน์โหลดเพื่อดูทั้งหมด)"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureBadge({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-3">
      <Icon className="mt-0.5 h-5 w-5 text-primary" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
