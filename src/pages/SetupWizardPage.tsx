import { useEffect, useMemo, useRef, useState } from "react";
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
  Wand2, Upload, HardDriveDownload,
} from "lucide-react";

type StepStatus = "idle" | "checking" | "ok" | "fail";
interface StepResult { status: StepStatus; message?: string; detail?: string; }

const STEPS = [
  { key: "env", label: "ตรวจ Environment", icon: Cloud },
  { key: "db", label: "เชื่อมต่อฐานข้อมูล", icon: Database },
  { key: "schema", label: "ตรวจ Schema & Buckets", icon: ShieldCheck },
  { key: "admin", label: "ตรวจบัญชี Admin", icon: User },
  { key: "restore", label: "กู้คืนจากไฟล์สำรอง", icon: HardDriveDownload },
  { key: "cms", label: "ตั้งค่าโรงเรียน (CMS)", icon: Palette },
  { key: "deploy", label: "Deploy", icon: Rocket },
] as const;

export default function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const setR = (k: string, r: StepResult) => setResults((p) => ({ ...p, [k]: r }));

  // ---- env
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
      return false;
    }
    setR("env", { status: "ok", message: "Environment variables ครบถ้วน", detail: `URL: ${envUrl}` });
    return true;
  };

  const checkDb = async () => {
    setR("db", { status: "checking" });
    try {
      const { error } = await supabase.from("cms_settings").select("id").limit(1);
      if (error) throw error;
      setR("db", { status: "ok", message: "เชื่อมต่อฐานข้อมูลสำเร็จ" });
      return true;
    } catch (e: any) {
      setR("db", { status: "fail", message: "เชื่อมต่อไม่ได้", detail: e.message });
      return false;
    }
  };

  const checkAdmin = async () => {
    setR("admin", { status: "checking" });
    try {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) {
        setR("admin", { status: "ok", message: `พบผู้ดูแลระบบ ${count} บัญชี` });
        return true;
      }
      setR("admin", { status: "fail", message: "ยังไม่มีบัญชี admin", detail: "สมัครที่ /signup แล้วระบบตั้ง admin คนแรกอัตโนมัติ" });
      return false;
    } catch (e: any) {
      setR("admin", { status: "fail", message: "ตรวจไม่ได้ (อาจยังไม่ login)", detail: e.message });
      return false;
    }
  };

  const [schoolName, setSchoolName] = useState("");
  const checkCms = async () => {
    setR("cms", { status: "checking" });
    try {
      const { data } = await supabase.from("cms_settings").select("school_name, logo_url").maybeSingle();
      const name = (data as any)?.school_name ?? "";
      setSchoolName(name);
      if (name && name !== "โรงเรียนตัวอย่าง") {
        setR("cms", { status: "ok", message: `ตั้งค่าแล้ว: ${name}` });
        return true;
      }
      setR("cms", { status: "fail", message: "ยังไม่ได้ตั้งชื่อโรงเรียน", detail: "ไปที่ /dashboard/admin/cms-settings" });
      return false;
    } catch (e: any) {
      setR("cms", { status: "fail", message: "อ่านค่า CMS ไม่ได้", detail: e.message });
      return false;
    }
  };

  // ---- schema / buckets
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
        return true;
      }
      setR("schema", {
        status: "fail",
        message: `ขาด ${missing} รายการ`,
        detail: `ตาราง: ${data?.missingTables?.length ?? 0}, buckets: ${data?.missingBuckets?.length ?? 0}`,
      });
      return false;
    } catch (e: any) {
      setR("schema", { status: "fail", message: "เรียก setup-health-check ไม่ได้", detail: e.message });
      return false;
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
      return true;
    } catch (e: any) {
      toast.error(`สร้างไม่สำเร็จ: ${e.message}`);
      return false;
    } finally {
      setCreatingBuckets(false);
    }
  };

  // ---- restore
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreTruncate, setRestoreTruncate] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<any>(null);

  const runRestore = async (file?: File) => {
    const f = file ?? restoreFile;
    if (!f) { toast.error("เลือกไฟล์ .zip ก่อน"); return false; }
    setRestoring(true);
    setR("restore", { status: "checking", message: `กำลังกู้คืน ${f.name}...` });
    try {
      const form = new FormData();
      form.append("file", f);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("ต้อง login เป็น admin/director ก่อนกู้คืน");
      const url = `${envUrl}/functions/v1/system-restore${restoreTruncate ? "?truncate=1" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: envKey ?? "" },
        body: form,
      });
      const json = await res.json();
      setRestoreSummary(json);
      if (!res.ok || !json.success) {
        setR("restore", { status: "fail", message: `กู้คืนไม่สมบูรณ์: ${json.error ?? `${json.errors?.length ?? 0} errors`}`, detail: `insert ${json.rows_inserted ?? 0} rows` });
        toast.error("กู้คืนมีข้อผิดพลาด — ดูรายละเอียดด้านล่าง");
        return false;
      }
      setR("restore", { status: "ok", message: `กู้คืนสำเร็จ ${json.tables_processed} ตาราง / ${json.rows_inserted} แถว` });
      toast.success("กู้คืนข้อมูลเรียบร้อย 🎉");
      return true;
    } catch (e: any) {
      setR("restore", { status: "fail", message: "กู้คืนล้มเหลว", detail: e.message });
      toast.error(e.message);
      return false;
    } finally {
      setRestoring(false);
    }
  };

  const skipRestore = () => {
    setR("restore", { status: "ok", message: "ข้ามการกู้คืน (เริ่มต้นระบบเปล่า)" });
    setStep(4);
  };

  // ---- One-click auto provision
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const log = (s: string) => setAutoLog((p) => [...p, s]);

  const autoProvision = async (opts?: { restoreFile?: File | null }) => {
    setAutoRunning(true);
    setAutoLog([]);
    try {
      log("1/5 ตรวจ environment...");
      if (!checkEnv()) { toast.error("env ไม่ครบ ตั้งค่าก่อน"); return; }
      log("✅ env ครบ");

      log("2/5 ทดสอบเชื่อมต่อฐานข้อมูล...");
      if (!(await checkDb())) return;
      log("✅ ฐานข้อมูลพร้อม");

      log("3/5 ตรวจ schema + buckets...");
      await checkSchema();
      // create missing buckets automatically
      const h = await (await supabase.functions.invoke("setup-health-check")).data;
      if (h?.missingBuckets?.length) {
        log(`⚙️  สร้าง buckets ที่ขาด ${h.missingBuckets.length} รายการ...`);
        await createMissingBuckets();
      } else {
        log("✅ buckets ครบ");
      }

      if (opts?.restoreFile) {
        log(`4/5 กู้คืนจากไฟล์ ${opts.restoreFile.name}...`);
        setStep(3);
        const ok = await runRestore(opts.restoreFile);
        if (!ok) { log("⚠️  กู้คืนมีข้อผิดพลาด — ข้ามไปขั้นถัดไป"); }
        else log("✅ กู้คืนสำเร็จ");
      } else {
        log("4/5 ข้ามการกู้คืน (ไม่มีไฟล์)");
        setR("restore", { status: "ok", message: "ข้าม" });
      }

      log("5/5 ตรวจ admin + CMS...");
      await checkAdmin();
      await checkCms();
      log("✅ เสร็จสิ้น — ตรวจผลลัพธ์แต่ละขั้นด้านล่าง");
      toast.success("Auto-provision เสร็จสิ้น");
      setStep(6);
    } finally {
      setAutoRunning(false);
    }
  };

  useEffect(() => {
    if (step === 0) checkEnv();
    if (step === 1) checkDb();
    if (step === 2) checkSchema();
    if (step === 4) checkAdmin();
    if (step === 5) checkCms();
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
          <p className="text-muted-foreground">ทำตาม {STEPS.length} ขั้นตอน — หรือกดปุ่มเดียวให้ระบบทำอัตโนมัติ</p>
        </div>

        {/* ⚡ One-click hero */}
        <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" /> ติดตั้งอัตโนมัติในคลิกเดียว
            </CardTitle>
            <CardDescription>
              เหมือนแฟลชรอมมือถือใหม่ — เลือกไฟล์สำรอง (ถ้ามี) แล้วกดปุ่มเดียว ระบบจะตรวจ env, สร้าง buckets ที่ขาด,
              กู้คืนข้อมูลเก่า, และเช็ค admin/CMS ให้พร้อมใช้งานทันที
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={restoreInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={autoRunning}>
                <Upload className="h-4 w-4 mr-2" />
                {restoreFile ? restoreFile.name : "เลือกไฟล์สำรอง .zip (ถ้ามี)"}
              </Button>
              {restoreFile && (
                <Button size="sm" variant="ghost" onClick={() => setRestoreFile(null)} disabled={autoRunning}>ล้าง</Button>
              )}
              <label className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                <input type="checkbox" checked={restoreTruncate} onChange={(e) => setRestoreTruncate(e.target.checked)} disabled={autoRunning} />
                ล้างข้อมูลเดิมก่อนกู้คืน (destructive)
              </label>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={autoRunning}
              onClick={() => autoProvision({ restoreFile })}
            >
              {autoRunning
                ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> กำลังติดตั้งอัตโนมัติ...</>
                : <><Wand2 className="h-5 w-5 mr-2" /> เริ่มติดตั้งอัตโนมัติทันที {restoreFile ? "+ กู้คืน" : ""}</>}
            </Button>
            {autoLog.length > 0 && (
              <pre className="bg-background/60 backdrop-blur border rounded p-3 text-xs max-h-56 overflow-auto whitespace-pre-wrap">
                {autoLog.join("\n")}
              </pre>
            )}
            <p className="text-xs text-muted-foreground">
              💡 ไม่มีไฟล์สำรองก็กดได้ — ระบบจะเตรียมโครงเปล่าให้พร้อมใช้งาน ส่วนไฟล์สำรองสร้างได้จาก
              {" "}<Link to="/dashboard/admin/backup-center" className="underline">Backup Center</Link>
            </p>
          </CardContent>
        </Card>

        {/* stepper */}
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="grid grid-cols-7 gap-1 text-xs">
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
                <Button onClick={checkDb} variant="outline" size="sm">ทดสอบอีกครั้ง</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm">ตรวจว่า Supabase มีตารางหลัก, RLS policy, และ storage buckets ครบหรือไม่</p>
                {health && (
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="font-semibold mb-1">📋 ตาราง ({health.summary?.tables?.total})</div>
                      {health.missingTables?.length ? (
                        <div className="text-red-600">ขาด: {health.missingTables.join(", ")}</div>
                      ) : (
                        <div className="text-emerald-600">✅ ครบทุกตาราง</div>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="font-semibold mb-1">🗂️ Buckets ({health.summary?.buckets?.total})</div>
                      {health.missingBuckets?.length ? (
                        <div className="text-red-600">ขาด: {health.missingBuckets.join(", ")}</div>
                      ) : (
                        <div className="text-emerald-600">✅ ครบทุก bucket</div>
                      )}
                    </div>
                  </div>
                )}
                {health?.recommendations?.length > 0 && (
                  <Alert>
                    <AlertTitle>คำแนะนำ</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {health.recommendations.map((rec: string, i: number) => <li key={i}>{rec}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={checkSchema} variant="outline" size="sm">ตรวจอีกครั้ง</Button>
                  {health?.missingBuckets?.length > 0 && (
                    <Button onClick={createMissingBuckets} size="sm" disabled={creatingBuckets}>
                      {creatingBuckets ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
                      สร้าง buckets ที่ขาด ({health.missingBuckets.length})
                    </Button>
                  )}
                  {health?.missingTables?.length > 0 && (
                    <a href="/docs/SUPABASE-GUIDE.md" target="_blank" rel="noopener">
                      <Button size="sm" variant="secondary"><ExternalLink className="h-3 w-3 mr-1" />วิธีรัน migrations</Button>
                    </a>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm">
                  หากคุณมีไฟล์สำรอง <code>.zip</code> จาก Backup Center — อัปโหลดที่นี่เพื่อกู้คืนข้อมูลเดิมทั้งหมด
                  (เหมือน restore backup ของมือถือหลังแฟลชรอมใหม่)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                  <label className="text-xs inline-flex items-center gap-1">
                    <input type="checkbox" checked={restoreTruncate} onChange={(e) => setRestoreTruncate(e.target.checked)} />
                    ล้างข้อมูลเดิมก่อน (destructive)
                  </label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => runRestore()} disabled={!restoreFile || restoring}>
                    {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2" />}
                    เริ่มกู้คืนไฟล์นี้
                  </Button>
                  <Button variant="ghost" onClick={skipRestore} disabled={restoring}>ข้ามขั้นนี้ (ไม่กู้คืน)</Button>
                </div>
                {restoreSummary && (
                  <pre className="bg-muted rounded p-3 text-xs max-h-64 overflow-auto">
                    {JSON.stringify(restoreSummary, null, 2)}
                  </pre>
                )}
                <Alert>
                  <AlertDescription className="text-xs">
                    ต้อง login เป็น <b>admin/director</b> ก่อน — ระบบจะ upsert ตาม <code>id</code> ให้อัตโนมัติ (ไฟล์ใหญ่รอสักครู่)
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {step === 4 && (
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

            {step === 5 && (
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

            {step === 6 && (
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
                    ผ่าน {okCount}/{STEPS.length - 1} ขั้น — งาน admin ประจำวัน ดูที่{" "}
                    <a href="/docs/ADMIN-PLAYBOOK.md" className="underline">ADMIN-PLAYBOOK</a>
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
