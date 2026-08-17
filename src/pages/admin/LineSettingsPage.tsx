import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  MessageCircle, Send, Bot, Copy, CheckCircle2, AlertCircle, Loader2,
  Eye, EyeOff, Users, BarChart3, BookOpen, Settings2
} from "lucide-react";
import LineQuotaCard from "@/components/line/LineQuotaCard";
import RichMenuUploader from "@/components/line/RichMenuUploader";
import { getBackendConfig } from "@/lib/runtimeConfig";

const LINE_SETTINGS_KEYS = [
  "line_channel_access_token",
  "line_channel_secret",
  "line_notify_enabled",
  "line_bot_enabled",
  "line_auto_push_enabled",
  "line_oa_basic_id",
  "line_liff_id",
];

const LineSettingsPage = () => {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [richMenuBusy, setRichMenuBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testSeverity, setTestSeverity] = useState("info");
  const [testTarget, setTestTarget] = useState<"linked_all" | "linked_students" | "linked_staff" | "broadcast">("linked_all");
  const [useFlex, setUseFlex] = useState(true);
  const [linkedStats, setLinkedStats] = useState({ students: 0, staff: 0 });

  const webhookUrl = `${getBackendConfig().url}/functions/v1/line-webhook`;

  useEffect(() => {
    fetchSettings();
    fetchLinkedStats();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("school_settings")
      .select("setting_key, setting_value")
      .in("setting_key", LINE_SETTINGS_KEYS);

    if (!error && data) {
      const map: Record<string, string> = {};
      data.forEach((d) => { map[d.setting_key] = d.setting_value || ""; });
      setSettings(map);
    }
    setLoading(false);
  };

  const fetchLinkedStats = async () => {
    const [{ count: students }, { count: staff }] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).not("line_user_id", "is", null),
      supabase.from("profiles").select("id", { count: "exact", head: true }).not("line_user_id", "is", null),
    ]);
    setLinkedStats({ students: students || 0, staff: staff || 0 });
  };

  const saveSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase
      .from("school_settings")
      .select("id")
      .eq("setting_key", key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("school_settings").update({ setting_value: value }).eq("setting_key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("school_settings").insert({ setting_key: key, setting_value: value });
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        for (const key of LINE_SETTINGS_KEYS) {
          if (settings[key] !== undefined) {
            await saveSetting(key, settings[key]);
          }
        }
        queryClient.setQueryData(["line_oa_basic_id"], (settings.line_oa_basic_id || "").trim());
        queryClient.invalidateQueries({ queryKey: ["line_oa_basic_id"] });
        queryClient.invalidateQueries({ queryKey: ["school_settings_bulk"] });
      }, {
        loading: lang === "th" ? "กำลังบันทึกการตั้งค่า LINE..." : "Saving LINE settings...",
        success: lang === "th" ? "บันทึกการตั้งค่า LINE สำเร็จ" : "LINE settings saved",
        error: lang === "th" ? "เกิดข้อผิดพลาด" : "Error saving settings",
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) {
      toast.error(lang === "th" ? "กรุณากรอกข้อความทดสอบ" : "Please enter a test message");
      return;
    }
    setTesting(true);
    try {
      const body: any = { message: testMessage };
      if (useFlex && testTitle) {
        body.use_flex = true;
        body.title = testTitle;
        body.severity = testSeverity;
      }

      if (testTarget === "broadcast") {
        body.broadcast = true;
      } else {
        // Collect LINE user IDs from linked students and/or linked staff (profiles)
        const lineIds = new Set<string>();
        if (testTarget === "linked_all" || testTarget === "linked_students") {
          const { data: stu } = await supabase
            .from("students")
            .select("line_user_id, line_user_id_2, line_user_id_3")
            .or("line_user_id.not.is.null,line_user_id_2.not.is.null,line_user_id_3.not.is.null");
          (stu || []).forEach((s: any) => {
            [s.line_user_id, s.line_user_id_2, s.line_user_id_3].forEach((id) => {
              if (id && typeof id === "string" && id.trim()) lineIds.add(id.trim());
            });
          });
        }
        if (testTarget === "linked_all" || testTarget === "linked_staff") {
          const { data: profs } = await supabase
            .from("profiles")
            .select("line_user_id")
            .not("line_user_id", "is", null);
          (profs || []).forEach((p: any) => {
            if (p.line_user_id && p.line_user_id.trim()) lineIds.add(p.line_user_id.trim());
          });
        }
        if (lineIds.size === 0) {
          toast.error(lang === "th" ? "ไม่พบบัญชีที่เชื่อม LINE ตามกลุ่มที่เลือก" : "No linked LINE accounts in selected group");
          setTesting(false);
          return;
        }
        body.line_user_ids = Array.from(lineIds);
      }

      const { data, error } = await supabase.functions.invoke("notify-line", { body });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      const total = (data as any)?.total_recipients ?? sent;
      toast.success(
        lang === "th"
          ? `ส่งข้อความทดสอบสำเร็จ (${sent}${total ? `/${total}` : ""})`
          : `Test message sent (${sent}${total ? `/${total}` : ""})`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send test message");
    }
    setTesting(false);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success(lang === "th" ? "คัดลอก Webhook URL แล้ว" : "Webhook URL copied");
  };

  const isConfigured = settings.line_channel_access_token && settings.line_channel_secret;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          {lang === "th" ? "ตั้งค่า LINE" : "LINE Settings"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {lang === "th"
            ? "เชื่อมต่อ LINE Official Account เพื่อส่งแจ้งเตือนและรับข้อความอัตโนมัติ"
            : "Connect LINE Official Account for notifications and chatbot"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {isConfigured ? <CheckCircle2 className="w-8 h-8 text-primary" /> : <AlertCircle className="w-8 h-8 text-destructive" />}
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "สถานะ" : "Status"}</p>
                <p className="text-lg font-bold">
                  {isConfigured ? (lang === "th" ? "เชื่อมต่อแล้ว" : "Connected") : (lang === "th" ? "ยังไม่ตั้งค่า" : "Not configured")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "นักเรียนเชื่อม LINE" : "Linked Students"}</p>
                <p className="text-lg font-bold">{linkedStats.students} <span className="text-sm font-normal text-muted-foreground">{lang === "th" ? "คน" : ""}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "บุคลากรเชื่อม LINE" : "Linked Staff"}</p>
                <p className="text-lg font-bold">{linkedStats.staff} <span className="text-sm font-normal text-muted-foreground">{lang === "th" ? "คน" : ""}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quota usage */}
      <LineQuotaCard enabled={!!isConfigured} />


      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="settings" className="gap-1">
            <Settings2 className="w-4 h-4" />
            {lang === "th" ? "ตั้งค่า" : "Settings"}
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-1">
            <Send className="w-4 h-4" />
            {lang === "th" ? "ทดสอบ" : "Test"}
          </TabsTrigger>
          <TabsTrigger value="commands" className="gap-1">
            <BookOpen className="w-4 h-4" />
            {lang === "th" ? "คำสั่ง Bot" : "Bot Commands"}
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === "th" ? "ข้อมูลการเชื่อมต่อ" : "Credentials"}</CardTitle>
              <CardDescription>
                {lang === "th"
                  ? "กรอก Channel Access Token และ Channel Secret จาก LINE Developers Console"
                  : "Enter credentials from LINE Developers Console"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Channel Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={settings.line_channel_access_token || ""}
                    onChange={(e) => setSettings({ ...settings, line_channel_access_token: e.target.value })}
                    placeholder="Enter your Channel Access Token..."
                    className="font-mono text-sm"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Channel Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={settings.line_channel_secret || ""}
                    onChange={(e) => setSettings({ ...settings, line_channel_secret: e.target.value })}
                    placeholder="Enter your Channel Secret..."
                    className="font-mono text-sm"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#06C755]" />
                  {lang === "th" ? "LINE OA Basic ID (สำหรับ QR บัตรประจำตัว)" : "LINE OA Basic ID (for ID card QR)"}
                </Label>
                <Input
                  value={settings.line_oa_basic_id || ""}
                  onChange={(e) => setSettings({ ...settings, line_oa_basic_id: e.target.value })}
                  placeholder="@abc1234x"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {lang === "th"
                    ? "ใส่ Basic ID ของ LINE OA โรงเรียน (รวม @ — ดูได้ที่ LINE Official Account Manager) เมื่อสแกน QR บนบัตรประจำตัว ระบบจะเปิดห้องแชท OA พร้อมพิมพ์คำสั่งเชื่อมบัญชีอัตโนมัติ"
                    : "Enter your LINE OA Basic ID (with @). Scanning the QR on ID cards opens the OA chat with a pre-filled link command."}
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    {lang === "th" ? "ส่งแจ้งเตือนผ่าน LINE" : "LINE Notifications"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {lang === "th" ? "ส่งแจ้งเตือนอัตโนมัติ เช่น การลา, ข่าวสาร, เหตุฉุกเฉิน" : "Auto-send notifications"}
                  </p>
                </div>
                <Switch
                  checked={settings.line_notify_enabled === "true"}
                  onCheckedChange={(checked) => setSettings({ ...settings, line_notify_enabled: String(checked) })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-600" />
                    {lang === "th" ? "Auto-Push อัตโนมัติทาง LINE (กินโควต้า)" : "Auto-Push via LINE"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {lang === "th"
                      ? "ส่งแจ้งเตือนสแกนหน้า/ขาด/พฤติกรรม/คะแนนหา ผปค. ทาง LINE — แนะนำ ปิด และใช้ Push Notification ผ่านแอปมือถือแทน (ฟรีไม่จำกัด)"
                      : "Sends auto-pushes to parents via LINE — keep OFF to save quota"}
                  </p>
                </div>
                <Switch
                  checked={settings.line_auto_push_enabled === "true"}
                  onCheckedChange={(checked) => setSettings({ ...settings, line_auto_push_enabled: String(checked) })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    {lang === "th" ? "Chatbot ตอบกลับอัตโนมัติ" : "Auto-reply Chatbot"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {lang === "th" ? "ตอบกลับข้อความ เช่น ตารางสอน, ผลการเรียน, การเข้าเรียน (ฟรีไม่จำกัด)" : "Reply to messages automatically (free unlimited)"}
                  </p>
                </div>
                <Switch
                  checked={settings.line_bot_enabled === "true"}
                  onCheckedChange={(checked) => setSettings({ ...settings, line_bot_enabled: String(checked) })}
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {lang === "th" ? "บันทึกการตั้งค่า" : "Save Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {lang === "th" ? "Webhook URL สำหรับ LINE OA" : "Webhook URL for LINE OA"}
              </CardTitle>
              <CardDescription>
                {lang === "th"
                  ? "คัดลอก URL นี้ไปวางใน LINE Developers Console → Messaging API → Webhook URL"
                  : "Copy this URL to LINE Developers Console → Messaging API → Webhook URL"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rich Menu setup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === "th" ? "Rich Menu (เมนูสวยงาม)" : "Rich Menu"}</CardTitle>
              <CardDescription>
                {lang === "th"
                  ? "สร้าง Rich Menu 6 ปุ่ม (ผลการเรียน / การเข้าเรียน / ตารางสอน / พฤติกรรม / ข่าวสาร / เมนู) และตั้งเป็นค่าเริ่มต้นสำหรับผู้ใช้ทุกคน"
                  : "Generate a 6-button rich menu and set as default for all users."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                disabled={!isConfigured || richMenuBusy}
                onClick={async () => {
                  setRichMenuBusy(true);
                  const toastId = toast.loading(lang === "th" ? "กำลังสร้าง Rich Menu ในพื้นหลัง..." : "Generating rich menu in background...");
                  try {
                    const { error } = await supabase.functions.invoke("setup-line-richmenu", { body: {} });
                    if (error) throw error;

                    // Poll status every 4s, timeout 3 min
                    const start = Date.now();
                    while (Date.now() - start < 180_000) {
                      await new Promise((r) => setTimeout(r, 4000));
                      const { data } = await supabase
                        .from("school_settings")
                        .select("setting_value")
                        .eq("setting_key", "line_richmenu_status")
                        .maybeSingle();
                      const raw = data?.setting_value;
                      if (!raw) continue;
                      let s: any = raw;
                      try { s = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { /* ignore */ }
                      if (s?.status === "completed") {
                        toast.success(lang === "th" ? "ตั้งค่า Rich Menu สำเร็จ" : "Rich menu set up", { id: toastId });
                        return;
                      }
                      if (s?.status === "failed") {
                        throw new Error(s.error || "failed");
                      }
                    }
                    toast.error(lang === "th" ? "หมดเวลารอ (ลองเช็คสถานะภายหลัง)" : "Timed out waiting for completion", { id: toastId });
                  } catch (e: any) {
                    toast.error(e.message || "ล้มเหลว", { id: toastId });
                  } finally {
                    setRichMenuBusy(false);
                  }
                }}
              >
                {richMenuBusy
                  ? (lang === "th" ? "กำลังสร้าง..." : "Generating...")
                  : (lang === "th" ? "สร้าง / อัปเดต Rich Menu" : "Create / Update Rich Menu")}
              </Button>
            </CardContent>

          </Card>

          {/* Rich Menu — custom image upload (Option A) */}
          <RichMenuUploader />

          {/* LIFF Mini-app */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === "th" ? "LIFF Mini-app" : "LIFF Mini-app"}</CardTitle>
              <CardDescription>
                {lang === "th"
                  ? "ตั้งค่า LIFF ID เพื่อเปิดหน้าฟอร์มในแอป LINE (ยื่นใบลา / ดูคะแนน / เช็คชื่อ)"
                  : "Set LIFF ID to open in-LINE pages (/liff/leave, /liff/grades, /liff/attendance)."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>LIFF ID</Label>
                <Input
                  placeholder="1234567890-abcdef"
                  value={settings.line_liff_id || ""}
                  onChange={(e) => setSettings({ ...settings, line_liff_id: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {lang === "th"
                    ? "ใส่ LIFF ID ของ 'ใบลา' (ตัวหลัก) — ระบบใช้ตัวนี้เปิดทุกหน้า /liff/*"
                    : "Enter the LIFF ID of the 'Leave' app (primary). Used for all /liff/* pages."}
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
                variant={settings.line_liff_id ? "default" : "secondary"}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {lang === "th" ? "บันทึก LIFF ID" : "Save LIFF ID"}
              </Button>

              <Separator />

              <div className="space-y-2 text-xs">
                <p className="font-semibold text-sm text-foreground">
                  {lang === "th" ? "📋 ขั้นตอนตั้งค่า LIFF (ทำครั้งเดียว)" : "📋 LIFF setup steps (one-time)"}
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>
                    {lang === "th" ? "ไปที่ " : "Go to "}
                    <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="text-primary underline">developers.line.biz/console</a>
                    {lang === "th" ? " → เลือก Channel (Messaging API) → แท็บ LIFF → กด Add" : " → Channel → LIFF tab → Add"}
                  </li>
                  <li>
                    {lang === "th" ? "สร้าง LIFF app 3 ตัว ใช้ Endpoint URL ตามนี้ (Size: Tall, Scope: profile + openid, Bot link: On)" : "Create 3 LIFF apps with these Endpoint URLs (Size: Tall, Scope: profile + openid, Bot link: On)"}
                    <div className="mt-1.5 ml-4 space-y-1 font-mono text-[11px] bg-muted/50 p-2 rounded">
                      <div>• {window.location.origin}/liff/leave <span className="text-muted-foreground">({lang === "th" ? "ใบลา — ตัวหลัก" : "Leave — primary"})</span></div>
                      <div>• {window.location.origin}/liff/grades <span className="text-muted-foreground">({lang === "th" ? "ดูคะแนน" : "Grades"})</span></div>
                      <div>• {window.location.origin}/liff/attendance <span className="text-muted-foreground">({lang === "th" ? "เช็คชื่อ (ครู)" : "Attendance (teacher)"})</span></div>
                    </div>
                  </li>
                  <li>{lang === "th" ? "คัดลอก LIFF ID ของตัว 'ใบลา' (รูปแบบ 1234567890-abcdef) → วางในช่องด้านบน → กดบันทึก" : "Copy the 'Leave' LIFF ID → paste above → Save"}</li>
                  <li>{lang === "th" ? "กด 'สร้าง / อัปเดต Rich Menu' ในการ์ดด้านบน เพื่อให้ปุ่มเมนูใน LINE OA เปิด LIFF ได้" : "Click 'Create / Update Rich Menu' above so LINE OA menu buttons open LIFF"}</li>
                  <li>{lang === "th" ? "ทดสอบ: เปิด LINE OA → กดปุ่ม 'ลา' ใน Rich Menu → หน้าฟอร์มต้องเปิดใน LINE" : "Test: open LINE OA → tap 'Leave' in Rich Menu → form opens inside LINE"}</li>
                </ol>
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${window.location.origin}/liff/leave`} target="_blank" rel="noreferrer">
                      {lang === "th" ? "เปิด /liff/leave ทดสอบ" : "Open /liff/leave"}
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/liff/leave`); toast.success(lang === "th" ? "คัดลอกแล้ว" : "Copied"); }}>
                    <Copy className="w-3 h-3 mr-1" />
                    {lang === "th" ? "คัดลอก Endpoint URL" : "Copy Endpoint URL"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Setup guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === "th" ? "วิธีตั้งค่า" : "Setup Guide"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ol className="list-decimal list-inside space-y-2">
                <li>{lang === "th" ? "ไปที่ LINE Developers Console (developers.line.biz)" : "Go to LINE Developers Console"}</li>
                <li>{lang === "th" ? "สร้าง Provider และ Messaging API Channel" : "Create Provider and Messaging API Channel"}</li>
                <li>{lang === "th" ? "คัดลอก Channel Access Token (Long-lived) มาวางในช่องด้านบน" : "Copy Channel Access Token"}</li>
                <li>{lang === "th" ? "คัดลอก Channel Secret มาวางในช่องด้านบน" : "Copy Channel Secret"}</li>
                <li>{lang === "th" ? "คัดลอก Webhook URL ด้านบนไปวางใน LINE Developers Console" : "Paste Webhook URL in LINE Console"}</li>
                <li>{lang === "th" ? "เปิดใช้งาน Webhook ใน LINE Developers Console" : "Enable Webhook in LINE Console"}</li>
                <li>{lang === "th" ? "กดบันทึก แล้วทดสอบส่งข้อความ" : "Save and test"}</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-4">
          {!isConfigured ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
                <p>{lang === "th" ? "กรุณาตั้งค่า LINE ก่อนทดสอบ" : "Please configure LINE settings first"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{lang === "th" ? "ทดสอบส่งข้อความ" : "Test Message"}</CardTitle>
                <CardDescription>
                  {lang === "th"
                    ? "เลือกกลุ่มผู้รับ — ค่าเริ่มต้นจะส่งให้บัญชีที่เชื่อมในระบบทุกคน (นักเรียน + บุคลากร)"
                    : "Pick recipients — defaults to all linked accounts (students + staff)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{lang === "th" ? "กลุ่มผู้รับ" : "Recipients"}</Label>
                  <Select value={testTarget} onValueChange={(v: any) => setTestTarget(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linked_all">
                        👥 {lang === "th"
                          ? `บัญชีที่เชื่อมทั้งหมด (นักเรียน ${linkedStats.students} + บุคลากร ${linkedStats.staff})`
                          : `All linked (Students ${linkedStats.students} + Staff ${linkedStats.staff})`}
                      </SelectItem>
                      <SelectItem value="linked_staff">
                        🧑‍🏫 {lang === "th" ? `เฉพาะบุคลากรที่เชื่อม (${linkedStats.staff})` : `Linked staff only (${linkedStats.staff})`}
                      </SelectItem>
                      <SelectItem value="linked_students">
                        🎓 {lang === "th" ? `เฉพาะนักเรียนที่เชื่อม (${linkedStats.students})` : `Linked students only (${linkedStats.students})`}
                      </SelectItem>
                      <SelectItem value="broadcast">
                        📣 {lang === "th" ? "Broadcast (ทุกคนที่เพิ่มเพื่อน LINE OA)" : "Broadcast (all LINE OA followers)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>{lang === "th" ? "ใช้ Flex Message (การ์ดสวยงาม)" : "Use Flex Message (Rich Card)"}</Label>
                  <Switch checked={useFlex} onCheckedChange={setUseFlex} />
                </div>

                {useFlex && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>{lang === "th" ? "หัวข้อ" : "Title"}</Label>
                      <Input
                        value={testTitle}
                        onChange={(e) => setTestTitle(e.target.value)}
                        placeholder={lang === "th" ? "หัวข้อแจ้งเตือน..." : "Notification title..."}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{lang === "th" ? "ระดับความสำคัญ" : "Severity"}</Label>
                      <Select value={testSeverity} onValueChange={setTestSeverity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">ℹ️ {lang === "th" ? "ข้อมูล" : "Info"}</SelectItem>
                          <SelectItem value="success">✅ {lang === "th" ? "สำเร็จ" : "Success"}</SelectItem>
                          <SelectItem value="warning">⚠️ {lang === "th" ? "เตือน" : "Warning"}</SelectItem>
                          <SelectItem value="high">🔶 {lang === "th" ? "สำคัญ" : "High"}</SelectItem>
                          <SelectItem value="critical">🔴 {lang === "th" ? "วิกฤต" : "Critical"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{lang === "th" ? "ข้อความ" : "Message"}</Label>
                  <Textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder={lang === "th" ? "ข้อความทดสอบ..." : "Test message..."}
                    rows={3}
                  />
                </div>

                <Button onClick={handleTest} disabled={testing} className="w-full">
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {lang === "th" ? "ส่งข้อความทดสอบ" : "Send Test Message"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bot Commands Tab */}
        <TabsContent value="commands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-5 h-5" />
                {lang === "th" ? "คำสั่ง Chatbot ที่รองรับ" : "Supported Bot Commands"}
              </CardTitle>
              <CardDescription>
                {lang === "th"
                  ? "รายการคำสั่งที่ผู้ใช้สามารถพิมพ์ใน LINE เพื่อใช้งานระบบ"
                  : "Commands that users can type in LINE to interact with the system"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Account commands */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">🔗 {lang === "th" ? "การเชื่อมบัญชี" : "Account Linking"}</h3>
                  <div className="space-y-1">
                    <CommandRow cmd="เชื่อม [รหัส]" desc={lang === "th" ? "เชื่อมบัญชี LINE กับนักเรียน/ครู" : "Link LINE with student/staff"} />
                    <CommandRow cmd="สถานะ" desc={lang === "th" ? "ดูบัญชีที่เชื่อมอยู่" : "View linked account"} />
                    <CommandRow cmd="ยกเลิก" desc={lang === "th" ? "ยกเลิกการเชื่อมบัญชี" : "Unlink account"} />
                  </div>
                </div>
                <Separator />
                {/* Personal commands */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">📊 {lang === "th" ? "ข้อมูลส่วนตัว (ต้องเชื่อมบัญชี)" : "Personal Data (requires linking)"}</h3>
                  <div className="space-y-1">
                    <CommandRow cmd="ผลการเรียน" desc={lang === "th" ? "ดูเกรดและคะแนนสอบ (นักเรียน)" : "View grades (students)"} />
                    <CommandRow cmd="การเข้าเรียน" desc={lang === "th" ? "ดูสถิติการเข้าเรียนเดือนนี้ (นักเรียน)" : "View attendance stats (students)"} />
                    <CommandRow cmd="ใบลา" desc={lang === "th" ? "ดูประวัติการลา (นักเรียน/ครู)" : "View leave history"} />
                  </div>
                </div>
                <Separator />
                {/* General commands */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">📋 {lang === "th" ? "ข้อมูลทั่วไป" : "General Info"}</h3>
                  <div className="space-y-1">
                    <CommandRow cmd="ตารางสอน" desc={lang === "th" ? "ดูตารางเรียนวันนี้" : "Today's schedule"} />
                    <CommandRow cmd="ข่าว" desc={lang === "th" ? "ดูข่าวสารล่าสุด" : "Latest news"} />
                    <CommandRow cmd="ปฏิทิน" desc={lang === "th" ? "ดูกิจกรรมที่จะมาถึง" : "Upcoming events"} />
                    <CommandRow cmd="สถิติ" desc={lang === "th" ? "ดูสถิติโรงเรียน" : "School statistics"} />
                    <CommandRow cmd="ฉุกเฉิน" desc={lang === "th" ? "ดูประกาศฉุกเฉิน" : "Emergency alerts"} />
                    <CommandRow cmd="เมนู" desc={lang === "th" ? "ดูคำสั่งทั้งหมด" : "Show all commands"} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {lang === "th" ? "ฟีเจอร์ที่รองรับ" : "Supported Features"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <FeatureItem icon="✅" label={lang === "th" ? "Flex Message (การ์ดสวยงาม)" : "Rich Flex Messages"} />
                <FeatureItem icon="✅" label={lang === "th" ? "Quick Reply (ปุ่มลัด)" : "Quick Reply Buttons"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ตรวจสอบ Signature (ความปลอดภัย)" : "Signature Verification"} />
                <FeatureItem icon="✅" label={lang === "th" ? "เชื่อมบัญชีนักเรียน/ครู" : "Student/Staff Account Linking"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ข้อมูลส่วนบุคคล (เกรด/เข้าเรียน)" : "Personal Data (Grades/Attendance)"} />
                <FeatureItem icon="✅" label={lang === "th" ? "Multicast (ส่งกลุ่ม)" : "Multicast Messaging"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ส่งตามห้องเรียน" : "Send by Classroom"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ส่งตามบทบาท (ครู/นักเรียน)" : "Send by Role"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ยกเลิกเชื่อมอัตโนมัติเมื่อ Unfollow" : "Auto-unlink on Unfollow"} />
                <FeatureItem icon="✅" label={lang === "th" ? "ข้อความต้อนรับเมื่อเพิ่มเพื่อน" : "Welcome Message on Follow"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap shrink-0">{cmd}</Badge>
      <span className="text-sm text-muted-foreground">{desc}</span>
    </div>
  );
}

function FeatureItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default LineSettingsPage;
