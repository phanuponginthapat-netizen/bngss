import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft, Rocket,
  Database, User, Palette, Cloud, Copy, ExternalLink, Sparkles, ShieldCheck, Wrench,
} from "lucide-react";

type StepStatus = "idle" | "checking" | "ok" | "fail";
interface StepResult { status: StepStatus; message?: string; detail?: string; }

const STEPS = [
  { key: "env", label: "ตรวจ Environment", icon: Cloud },
  { key: "db", label: "เชื่อมต่อฐานข้อมูล", icon: Database },
  { key: "schema", label: "ตรวจ Schema & Buckets", icon: ShieldCheck },
  { key: "admin", label: "ตรวจบัญชี Admin", icon: User },
  { key: "cms", label: "ตั้งค่าโรงเรียน (CMS)", icon: Palette },
  { key: "deploy", label: "Deploy", icon: Rocket },
] as const;


export default function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Record<string, StepResult>>({});

  const setR = (k: string, r: StepResult) => setResults((p) => ({ ...p, [k]: r }));

  // ---- Step 1: env
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const envPid = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

  const checkEnv = () => {
    setR("env", { status: "checking" });
    const missing = [
      !envUrl && "VITE_SUPABASE_URL",
      !envKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
      !envPid && "VITE_SUPABASE_PROJECT_ID",
    ].filter(Boolean) as string[];
    if (missing.length) {
      setR("env", { status: "fail", message: `ขาด env: ${missing.join(", ")}`, detail: "ตั้งค่าใน Vercel → Settings → Environment Variables" });
    } else {
      setR("env", { status: "ok", message: "Environment variables ครบถ้วน", detail: `URL: ${envUrl}` });
    }
  };

  // ---- Step 2: db
  const checkDb = async () => {
    setR("db", { status: "checking" });
    try {
      const { error } = await supabase.from("cms_settings").select("id").limit(1);
      if (error) throw error;
      setR("db", { status: "ok", message: "เชื่อมต่อฐานข้อมูลสำเร็จ" });
    } catch (e: any) {
      setR("db", { status: "fail", message: "เชื่อมต่อไม่ได้", detail: e.message });
    }
  };

  // ---- Step 3: admin
  const checkAdmin = async () => {
    setR("admin", { status: "checking" });
    try {
      const { data, error } = await supabase.rpc("count_admins" as any).single();
      // fallback: query user_roles
      let count = (data as any)?.count;
      if (error || count === undefined) {
        const { count: c } = await supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        count = c ?? 0;
      }
      if (count > 0) {
        setR("admin", { status: "ok", message: `พบผู้ดูแลระบบ ${count} บัญชี` });
      } else {
        setR("admin", { status: "fail", message: "ยังไม่มีบัญชี admin", detail: "สมัครที่ /signup แล้วให้ระบบตั้ง admin คนแรกอัตโนมัติ" });
      }
    } catch (e: any) {
      setR("admin", { status: "fail", message: "ตรวจไม่ได้ (อาจยังไม่ login)", detail: e.message });
    }
  };

  // ---- Step 4: cms
  const [schoolName, setSchoolName] = useState("");
  const checkCms = async () => {
    setR("cms", { status: "checking" });
    try {
      const { data } = await supabase.from("cms_settings").select("school_name, logo_url").maybeSingle();
      const name = (data as any)?.school_name ?? "";
      setSchoolName(name);
      if (name && name !== "โรงเรียนตัวอย่าง") {
        setR("cms", { status: "ok", message: `ตั้งค่าแล้ว: ${name}` });
      } else {
        setR("cms", { status: "fail", message: "ยังไม่ได้ตั้งชื่อโรงเรียน", detail: "ไปที่ /dashboard/admin/cms-settings" });
      }
    } catch (e: any) {
      setR("cms", { status: "fail", message: "อ่านค่า CMS ไม่ได้", detail: e.message });
    }
  };

  // ---- Step: schema & buckets health check
  const [health, setHealth] = useState<any>(null);
  const [creatingBuckets, setCreatingBuckets] = useState(false);
  const checkSchema = async () => {
    setR("schema", { status: "checking" });
    try {
      const { data, error } = await supabase.functions.invoke("setup-health-check");
      if (error) throw error;
      setHealth(data);
      const missing = (data?.missingTables?.length ?? 0) + (data?.missingBuckets?.length ?? 0);
      if (data?.ok) {
        setR("schema", { status: "ok", message: `ครบทุกตาราง (${data.summary.tables.total}) และ bucket (${data.summary.buckets.total})` });
      } else {
        setR("schema", {
          status: "fail",
          message: `ขาด ${missing} รายการ`,
          detail: `ตาราง: ${data?.missingTables?.length ?? 0}, buckets: ${data?.missingBuckets?.length ?? 0}`,
        });
      }
    } catch (e: any) {
      setR("schema", { status: "fail", message: "เรียก setup-health-check ไม่ได้", detail: e.message });
    }
  };

  const createMissingBuckets = async () => {
    setCreatingBuckets(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-create-buckets");
      if (error) throw error;
      toast.success(`สร้าง buckets สำเร็จ: ${data?.created?.length ?? 0} รายการ`);
      if (data?.failed?.length) toast.error(`สร้างไม่สำเร็จ ${data.failed.length} — อาจต้องเป็น admin`);
      await checkSchema();
    } catch (e: any) {
      toast.error(`สร้างไม่สำเร็จ: ${e.message}`);
    } finally {
      setCreatingBuckets(false);
    }
  };

  useEffect(() => {
    if (step === 0) checkEnv();
    if (step === 1) checkDb();
    if (step === 2) checkSchema();
    if (step === 3) checkAdmin();
    if (step === 4) checkCms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);


  const okCount = Object.values(results).filter((r) => r.status === "ok").length;
  const progress = useMemo(() => (okCount / STEPS.length) * 100, [okCount]);

  const envSnippet = `VITE_SUPABASE_URL=${envUrl ?? "https://<ref>.supabase.co"}
VITE_SUPABASE_PUBLISHABLE_KEY=${envKey ?? "<anon-key>"}
VITE_SUPABASE_PROJECT_ID=${envPid ?? "<project-ref>"}`;

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("คัดลอกแล้ว"); };

  const renderStatus = (k: string) => {
    const r = results[k];
    if (!r || r.status === "idle") return null;
    if (r.status === "checking") return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> กำลังตรวจ</Badge>;
    if (r.status === "ok") return <Badge className="bg-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" /> ผ่าน</Badge>;
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> ต้องแก้</Badge>;
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const r = results[current.key];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
            <Sparkles className="h-4 w-4" /> Setup Wizard
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">ยินดีต้อนรับสู่ Smart School</h1>
          <p className="text-muted-foreground">ทำตาม {STEPS.length} ขั้นตอน เพื่อเริ่มใช้งานระบบ</p>
        </div>

        {/* stepper */}
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="grid grid-cols-6 gap-1 text-xs">
            {STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setStep(i)}
                className={`p-2 rounded-lg text-center transition ${
                  i === step ? "bg-primary text-primary-foreground" :
                  results[s.key]?.status === "ok" ? "bg-emerald-100 text-emerald-700" :
                  results[s.key]?.status === "fail" ? "bg-red-100 text-red-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                <s.icon className="h-4 w-4 mx-auto mb-1" />
                <div className="hidden md:block truncate">{s.label}</div>
              </button>
            ))}
          </div>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Icon className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <CardTitle>ขั้นที่ {step + 1}: {current.label}</CardTitle>
                <CardDescription>{r?.message ?? "กำลังเตรียม..."}</CardDescription>
              </div>
              {renderStatus(current.key)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step-specific content */}
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm">ระบบต้องการ env 3 ตัวจาก Lovable Cloud หรือ Supabase project ปลายทาง:</p>
                <div className="relative">
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{envSnippet}</pre>
                  <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => copy(envSnippet)}>
                    <Copy className="h-3 w-3 mr-1" /> คัดลอก
                  </Button>
                </div>
                {r?.detail && <Alert><AlertDescription className="text-sm">{r.detail}</AlertDescription></Alert>}
                <Button onClick={checkEnv} variant="outline" size="sm">ตรวจอีกครั้ง</Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm">ทดสอบว่า frontend เชื่อมต่อ Supabase / Lovable Cloud ได้จริง</p>
                {r?.status === "fail" && (
                  <Alert variant="destructive">
                    <AlertTitle>เชื่อมต่อไม่ได้</AlertTitle>
                    <AlertDescription className="text-xs font-mono">{r.detail}</AlertDescription>
                  </Alert>
                )}
                {r?.status === "ok" && (
                  <Alert>
                    <AlertDescription>✅ ระบบพร้อมอ่าน/เขียนข้อมูล — ถ้ายังไม่มีตาราง ให้รัน migrations ก่อน (ดูคู่มือ DEPLOY-VERCEL)</AlertDescription>
                  </Alert>
                )}
                <Button onClick={checkDb} variant="outline" size="sm">ทดสอบอีกครั้ง</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm">ระบบต้องมีบัญชี admin อย่างน้อย 1 คน — คนแรกที่สมัครจะถูกตั้งเป็น admin อัตโนมัติ</p>
                <div className="flex gap-2 flex-wrap">
                  <Link to="/signup"><Button variant="outline"><User className="h-4 w-4 mr-2" />สมัคร admin คนแรก</Button></Link>
                  <Link to="/login"><Button variant="outline">ไปหน้า Login</Button></Link>
                </div>
                {r?.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                <Button onClick={checkAdmin} variant="outline" size="sm">ตรวจอีกครั้ง</Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm">ตั้งชื่อโรงเรียน โลโก้ สี — ระบบจะดึงไปแสดงทุกที่อัตโนมัติ</p>
                {schoolName && <div className="text-sm">โรงเรียนปัจจุบัน: <b>{schoolName}</b></div>}
                <Link to="/dashboard/admin/cms-settings">
                  <Button variant="outline"><Palette className="h-4 w-4 mr-2" />เปิดหน้า CMS Settings</Button>
                </Link>
                <div>
                  <Button onClick={checkCms} variant="outline" size="sm">ตรวจอีกครั้ง</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm">เลือกวิธี deploy ระบบขึ้น production:</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <Card className="border-primary/40">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Lovable (ง่ายสุด)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p>กดปุ่ม Publish มุมขวาบน — เสร็จใน 1 นาที</p>
                      <p className="text-muted-foreground text-xs">ได้ URL <code>*.lovable.app</code> ฟรี</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Cloud className="h-4 w-4" /> Vercel
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <p>Push repo ไป GitHub → Import ที่ Vercel → ตั้ง env 3 ตัว</p>
                      <a href="/docs/DEPLOY-VERCEL.md" target="_blank" rel="noopener">
                        <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" />คู่มือละเอียด</Button>
                      </a>
                    </CardContent>
                  </Card>
                </div>
                <Alert>
                  <AlertTitle>🎉 พร้อมใช้งาน!</AlertTitle>
                  <AlertDescription className="text-sm">
                    ผ่าน {okCount}/{STEPS.length - 1} ขั้น — ถ้าครบทุกขั้น ก็เริ่มใช้งานได้เลย<br />
                    งาน admin ประจำวัน ดูที่ <a href="/docs/ADMIN-PLAYBOOK.md" className="underline">ADMIN-PLAYBOOK</a>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" /> ย้อนกลับ
          </Button>
          <Button onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>
            ถัดไป <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← กลับหน้าหลัก</Link>
          {" · "}
          <a href="/docs/README.md" target="_blank" rel="noopener" className="hover:underline">คู่มือทั้งหมด</a>
        </div>
      </div>
    </div>
  );
}
