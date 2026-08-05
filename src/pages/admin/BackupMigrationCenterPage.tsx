import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import {
  Download, Upload, Copy, PackageOpen, ServerCog, Database, Cloud,
  FolderArchive, ShieldCheck, ArrowRight, ExternalLink, Rocket, Sparkles
} from "lucide-react";
import JSZip from "jszip";
import { todayBangkok } from "@/lib/dateBE";

import { getBackendConfig } from "@/lib/runtimeConfig";

const SUPABASE_URL = getBackendConfig().url;
const ANON = getBackendConfig().anonKey;

/** แนบ migrations + edge functions (RLS/schema/โค้ดฝั่งเซิร์ฟเวอร์) ลงใน ZIP */
async function attachDeployKit(zip: JSZip): Promise<{ functions: number; migrations: number } | null> {
  try {
    const res = await fetch("/deploy-kit.json", { cache: "no-store" });
    if (!res.ok) return null;
    const kit = await res.json();
    Object.entries(kit.migrations ?? {}).forEach(([name, sql]) =>
      zip.file(`migrations/${name}`, String(sql)),
    );
    Object.entries(kit.functions ?? {}).forEach(([name, code]) =>
      zip.file(`edge-functions/${name}`, String(code)),
    );
    if (kit.config_toml) zip.file("supabase-config.toml", String(kit.config_toml));
    return kit.counts ?? null;
  } catch {
    return null;
  }
}

export default function BackupMigrationCenterPage() {
  const [downloading, setDownloading] = useState<null | "tables" | "full" | "oneclick" | string>(null);
  const [oneClickProgress, setOneClickProgress] = useState<{ pct: number; label: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [buckets, setBuckets] = useState<{ name: string }[]>([]);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [truncate, setTruncate] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [withSchema, setWithSchema] = useState(true);
  const [withUsers, setWithUsers] = useState(true);
  const [withSecrets, setWithSecrets] = useState(true);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetRef, setTargetRef] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);


  const callFn = async (qs: string): Promise<Response> => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(`${SUPABASE_URL}/functions/v1/system-backup?${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: ANON },
    });
  };

  const oneClickBackup = async () => {
    setDownloading("oneclick");
    setOneClickProgress({ pct: 2, label: "เริ่มต้น..." });
    try {
      // 1) Full tables + restore kit + storage manifest
      setOneClickProgress({ pct: 5, label: "กำลังดึงข้อมูลทุกตาราง..." });
      const fullRes = await callFn(`mode=full${withSecrets ? "&secrets=1" : ""}`);
      if (!fullRes.ok) throw new Error(`tables: ${await fullRes.text()}`);
      const fullZipBytes = new Uint8Array(await fullRes.arrayBuffer());
      const inner = await JSZip.loadAsync(fullZipBytes);

      // Start mega ZIP by copying full ZIP contents
      const mega = new JSZip();
      for (const name of Object.keys(inner.files)) {
        const f = inner.files[name];
        if (f.dir) continue;
        mega.file(name, await f.async("uint8array"));
      }

      // 2) List buckets
      setOneClickProgress({ pct: 15, label: "โหลดรายการ Storage..." });
      const bRes = await callFn("mode=buckets");
      const bJson = bRes.ok ? await bRes.json() : { buckets: [] };
      const bucketList: { name: string }[] = bJson.buckets ?? [];

      // 3) Fetch each bucket, unpack into storage/<bucket>/<path>
      const storageSummary: Record<string, number> = {};
      for (let i = 0; i < bucketList.length; i++) {
        const b = bucketList[i];
        const pct = 15 + Math.round(((i + 1) / (bucketList.length + 1)) * 75);
        setOneClickProgress({ pct, label: `Storage: ${b.name} (${i + 1}/${bucketList.length})` });
        try {
          const sRes = await callFn(`mode=storage&bucket=${encodeURIComponent(b.name)}`);
          if (!sRes.ok) { storageSummary[b.name] = -1; continue; }
          const sBytes = new Uint8Array(await sRes.arrayBuffer());
          const sZip = await JSZip.loadAsync(sBytes);
          let count = 0;
          for (const name of Object.keys(sZip.files)) {
            const f = sZip.files[name];
            if (f.dir) continue;
            if (name === "manifest.json") continue;
            // File paths inside bucket ZIP are `<bucket>/<path>` — remap to storage/<bucket>/<path>
            const bytes = await f.async("uint8array");
            mega.file(`storage/${name}`, bytes);
            count++;
          }
          storageSummary[b.name] = count;
        } catch (e: any) {
          storageSummary[b.name] = -1;
        }
      }

      // 4) แนบ migrations + edge functions
      setOneClickProgress({ pct: 92, label: "แนบ migrations + edge functions..." });
      const kit = await attachDeployKit(mega);

      // 5) Write combined summary
      mega.file("one-click-summary.json", JSON.stringify({
        generated_at: new Date().toISOString(),
        buckets: storageSummary,
        deploy_kit: kit ?? "unavailable",
        note: "One-click bundle. Restore via /system-restore (multipart file=...). Includes tables/*.json AND storage/<bucket>/<path>.",
      }, null, 2));

      setOneClickProgress({ pct: 95, label: "กำลังบีบอัดเป็นไฟล์เดียว..." });
      const megaBlob = await mega.generateAsync({ type: "blob", compression: "DEFLATE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(megaBlob);
      a.download = `smart-school-oneclick-${todayBangkok()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setOneClickProgress({ pct: 100, label: "เสร็จสิ้น!" });
      toast.success("สำรองข้อมูลทั้งระบบสำเร็จ ✅");
    } catch (e: any) {
      toast.error(`สำรองล้มเหลว: ${e.message ?? e}`);
    } finally {
      setDownloading(null);
      setTimeout(() => setOneClickProgress(null), 2000);
    }
  };


  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/system-backup?mode=buckets`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: ANON },
        });
        if (res.ok) {
          const j = await res.json();
          setBuckets(j.buckets ?? []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const download = async (mode: "tables" | "full" | "storage", bucket?: string) => {
    const key = mode === "storage" ? bucket! : mode;
    setDownloading(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const qs =
        mode === "storage"
          ? `mode=storage&bucket=${encodeURIComponent(bucket!)}`
          : `mode=${mode}${mode === "full" && withSecrets ? "&secrets=1" : ""}`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/system-backup?${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: ANON },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const tag = mode === "storage" ? `storage-${bucket}` : mode;
      a.download = `smart-school-${tag}-${todayBangkok()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("ดาวน์โหลดสำเร็จ");
    } catch (e: any) {
      toast.error(`ดาวน์โหลดล้มเหลว: ${e.message ?? e}`);
    } finally {
      setDownloading(null);
    }
  };

  const uploadRestore = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { toast.error("เลือกไฟล์ ZIP ก่อน"); return; }
    if (truncate && !dryRun) {
      const ok = await swal.confirm({
        title: "ยืนยันการกู้คืนแบบเขียนทับ",
        text: `จะลบข้อมูลเดิมทุกตารางแล้วใส่ข้อมูลจากไฟล์ ${f.name} — การกระทำนี้ย้อนไม่ได้!`,
        confirmText: "ยืนยันเขียนทับ",
        cancelText: "ยกเลิก",
      });
      if (!ok) return;
    }
    setRestoring(true);
    setRestoreResult(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const { data: { session } } = await supabase.auth.getSession();
      const qs = new URLSearchParams();
      if (truncate) qs.set("truncate", "1");
      if (dryRun) qs.set("dry", "1");
      if (!withSchema) qs.set("schema", "0");
      if (!withUsers) qs.set("users", "0");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/system-restore?${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: ANON },
        body: form,
      });
      const raw = await res.text();
      let j: any;
      try {
        j = JSON.parse(raw);
      } catch {
        throw new Error(
          `เซิร์ฟเวอร์ตอบกลับผิดพลาด (HTTP ${res.status}) — ${raw.slice(0, 300) || "ไม่มีข้อความตอบกลับ (ไฟล์อาจใหญ่เกินไป/หมดเวลา)"}`,
        );
      }
      setRestoreResult(j);
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      if (j.success) toast.success(dryRun ? "ทดสอบผ่านทุกขั้นตอน" : `สำเร็จ: ${j.tables_processed} ตาราง, ${j.rows_inserted} แถว`);
      else toast.warning(`เสร็จพร้อม error ${j.errors?.length ?? 0} รายการ — ดูรายละเอียดด้านล่าง`);

    } catch (e: any) {
      toast.error(`กู้คืนล้มเหลว: ${e.message ?? e}`);
    } finally {
      setRestoring(false);
    }
  };

  const setupScript = `#!/usr/bin/env bash
# ============================================================
# One-shot migration script — ย้ายระบบไป Supabase project ใหม่
# ============================================================
# แก้ 4 บรรทัดข้างล่างก่อนรัน:
export PROJECT_REF="${targetRef || "<new-project-ref>"}"
export DB_PASSWORD="<database-password>"
export SUPABASE_URL="${targetUrl || "https://<ref>.supabase.co"}"
export SERVICE_ROLE_KEY="<service-role-key>"

# ต้องติดตั้ง Supabase CLI ก่อน:
#   brew install supabase/tap/supabase   # macOS
#   npm i -g supabase                     # อื่นๆ

# 1) รัน migrations 500+ ตัว → สร้าง schema, FK, RLS ทั้งหมด
bash scripts/deploy-external-supabase.sh

# 2) อัพโหลดไฟล์ backup ZIP กลับเข้าไป (ต้องมี ADMIN_JWT จาก login)
export ADMIN_JWT="<paste-admin-jwt-here>"
export ZIP_FILE="./smart-school-full-${todayBangkok()}.zip"
curl -X POST "$SUPABASE_URL/functions/v1/system-restore?truncate=1" \\
  -H "Authorization: Bearer $ADMIN_JWT" \\
  -F "file=@$ZIP_FILE"

# 3) แก้ .env ในโค้ด frontend:
#    VITE_SUPABASE_URL=$SUPABASE_URL
#    VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
#    VITE_SUPABASE_PROJECT_ID=$PROJECT_REF
`;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <PackageOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Backup &amp; Migration Center</h1>
          <p className="text-sm text-muted-foreground">
            ศูนย์รวมสำรอง-กู้คืน-ย้ายระบบทั้งหมดในที่เดียว — พร้อมย้ายไป Supabase อื่นได้แบบไม่กี่คลิก
          </p>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>สรุปสั้น ๆ</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <div>• <b>สำรอง</b> = กด "ดาวน์โหลด Full Backup" ทุกสัปดาห์ เก็บไฟล์ ZIP ไว้ที่ปลอดภัย</div>
          <div>• <b>กู้คืน</b> = อัพโหลดไฟล์ ZIP นั้นกลับผ่านแท็บ "กู้คืน" — 1 คลิก</div>
          <div>• <b>ย้ายระบบ</b> = สร้าง Supabase ใหม่ → รัน migration script → กู้คืน ZIP — 3 คำสั่ง</div>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-2xl">
          <TabsTrigger value="backup"><Download className="h-4 w-4 mr-1" />สำรอง</TabsTrigger>
          <TabsTrigger value="restore"><Upload className="h-4 w-4 mr-1" />กู้คืน</TabsTrigger>
          <TabsTrigger value="migrate"><Rocket className="h-4 w-4 mr-1" />ย้ายระบบ</TabsTrigger>
          <TabsTrigger value="storage"><FolderArchive className="h-4 w-4 mr-1" />Storage</TabsTrigger>
        </TabsList>

        {/* ---- BACKUP ---- */}
        <TabsContent value="backup" className="space-y-4">
          <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-6 w-6 text-primary" /> One-Click Backup (สำรองทั้งระบบไฟล์เดียว)
              </CardTitle>
              <CardDescription>
                กดปุ่มเดียวจบ — รวม <b>ทุกตาราง</b> + <b>ทุก Storage bucket</b> + สคริปต์กู้คืน + คู่มือ ลงในไฟล์ ZIP เดียว
                เหมือน backup ของ Windows ที่นำไป restore กับเครื่องไหนก็ได้
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="lg"
                onClick={oneClickBackup}
                disabled={downloading === "oneclick"}
                className="w-full sm:w-auto"
              >
                <Sparkles className={`h-4 w-4 mr-2 ${downloading === "oneclick" ? "animate-pulse" : ""}`} />
                {downloading === "oneclick" ? "กำลังสำรองข้อมูล..." : "สำรองทั้งระบบ (One-Click)"}
              </Button>
              {oneClickProgress && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{oneClickProgress.label}</div>
                  <Progress value={oneClickProgress.pct} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                💡 ไฟล์ที่ได้นำไป restore ได้ที่แท็บ "กู้คืน" ของระบบใหม่ — ระบบจะกู้คืนทั้งข้อมูลและไฟล์ใน Storage อัตโนมัติ
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-primary" /> Full Backup (แนะนำ)
              </CardTitle>
              <CardDescription>
                ZIP เดียวรวม: schema.sql (ตาราง/FK/RLS/policy/ฟังก์ชัน/ทริกเกอร์/สิทธิ์) + storage-policies.sql
                + buckets.json + auth-users.json (ผู้ใช้ + รหัสผ่านเดิม) + edge-functions.json
                + cron-jobs.json (Jobs ตามเวลา) + secrets.json + set-secrets.sh
                + ข้อมูลทุกตาราง (JSON) + รายการไฟล์ storage + สคริปต์ restore + คู่มือภาษาไทย
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={withSecrets} onCheckedChange={(v) => setWithSecrets(!!v)} />
                <span>
                  รวม<strong>ค่า</strong> Secrets ลงในไฟล์สำรอง (API keys, tokens)
                  <span className="block text-xs text-muted-foreground">
                    ⚠️ ไฟล์จะมีข้อมูลลับ เก็บในที่ปลอดภัย — ถ้าไม่ติ๊กจะเก็บเฉพาะรายชื่อ secret
                  </span>
                </span>
              </label>
              <Button size="lg" onClick={() => download("full")} disabled={downloading === "full"}>
                <Download className={`h-4 w-4 mr-2 ${downloading === "full" ? "animate-pulse" : ""}`} />
                {downloading === "full" ? "กำลังสร้างไฟล์..." : "ดาวน์โหลด Full Backup"}
              </Button>
            </CardContent>

          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tables Only (เร็ว, ข้อมูลอย่างเดียว)</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => download("tables")} disabled={downloading === "tables"}>
                <Database className="h-4 w-4 mr-2" />
                {downloading === "tables" ? "กำลังสร้าง..." : "ดาวน์โหลด Tables ZIP"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- RESTORE ---- */}
        <TabsContent value="restore" className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>คำเตือน</AlertTitle>
            <AlertDescription>
              การกู้คืนจะเขียนทับข้อมูลปัจจุบัน ควรทดสอบด้วยโหมด "Dry Run" ก่อนเสมอ
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>อัพโหลดไฟล์ ZIP เพื่อกู้คืน</CardTitle>
              <CardDescription>
                รองรับไฟล์จาก Full Backup — กู้คืนตามลำดับ: โครงสร้าง DB (ตาราง/FK/RLS/ฟังก์ชัน/ทริกเกอร์/สิทธิ์)
                → Storage buckets + policy → ผู้ใช้ + รหัสผ่านเดิม → ข้อมูลทุกตาราง → ไฟล์ใน Storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input ref={fileRef} type="file" accept=".zip" />
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} />
                  Dry Run (ทดสอบเท่านั้น ไม่แก้ข้อมูล)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={truncate} onCheckedChange={(v) => setTruncate(!!v)} />
                  <span className="text-destructive">ล้างข้อมูลเดิมก่อน (Truncate)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={withSchema} onCheckedChange={(v) => setWithSchema(!!v)} />
                  สร้างโครงสร้าง DB (ตาราง/FK/RLS/ฟังก์ชัน/ทริกเกอร์)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={withUsers} onCheckedChange={(v) => setWithUsers(!!v)} />
                  กู้คืนผู้ใช้ + รหัสผ่านเดิม
                </label>
              </div>
              <Button onClick={uploadRestore} disabled={restoring} size="lg">
                <Upload className={`h-4 w-4 mr-2 ${restoring ? "animate-pulse" : ""}`} />
                {restoring ? "กำลังกู้คืน..." : dryRun ? "ทดสอบกู้คืน (Dry Run)" : "เริ่มกู้คืน"}
              </Button>

              {restoreResult && (
                <div className="border rounded p-3 text-sm space-y-2 max-h-96 overflow-y-auto">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={restoreResult.success ? "default" : "destructive"}>
                      {restoreResult.success ? "สำเร็จ" : "มี Error"}
                    </Badge>
                    <Badge variant="outline">{restoreResult.tables_processed} ตาราง</Badge>
                    <Badge variant="outline">{restoreResult.rows_inserted ?? 0} แถว</Badge>
                    {typeof restoreResult.storage_files_uploaded === "number" && (
                      <Badge variant="outline">{restoreResult.storage_files_uploaded} ไฟล์ Storage</Badge>
                    )}
                    {restoreResult.dry_run && <Badge>Dry Run</Badge>}
                  </div>
                  {(restoreResult.steps ?? []).length > 0 && (
                    <div className="space-y-1">
                      {restoreResult.steps.map((st: any, i: number) => (
                        <div key={i} className="font-mono text-xs flex items-center gap-2">
                          <Badge variant={st.ok ? "default" : st.skipped ? "secondary" : "destructive"}>
                            {st.ok ? "OK" : st.skipped ? "ข้าม" : st.dry ? "Dry" : "ผิดพลาด"}
                          </Badge>
                          <span>{st.step}</span>
                          {typeof st.users === "number" && <span>— users: {st.users}</span>}
                          {typeof st.count === "number" && <span>— {st.count} buckets</span>}
                          {st.error && <span className="text-destructive">{st.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {(restoreResult.errors ?? []).length > 0 && (
                    <div className="text-destructive space-y-1">
                      {restoreResult.errors.map((e: any, i: number) => (
                        <div key={i} className="font-mono text-xs">
                          {e.table}: {e.error || e.warn}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- MIGRATE ---- */}
        <TabsContent value="migrate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" /> ย้ายไป Supabase ใหม่ / Self-host
              </CardTitle>
              <CardDescription>
                ระบุค่าของ project ปลายทาง แล้วคัดลอกสคริปต์ไปรันบนเครื่อง — สร้าง schema + import ข้อมูลในครั้งเดียว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Project Ref ปลายทาง</Label>
                  <Input placeholder="uhbabufmdozwiivsjhpr" value={targetRef}
                    onChange={(e) => setTargetRef(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Supabase URL ปลายทาง</Label>
                  <Input placeholder="https://xxxx.supabase.co" value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)} />
                </div>
              </div>
              <div className="relative">
                <pre className="bg-muted rounded p-3 text-xs overflow-x-auto max-h-96">{setupScript}</pre>
                <Button size="sm" variant="secondary" className="absolute top-2 right-2"
                  onClick={() => { navigator.clipboard.writeText(setupScript); toast.success("คัดลอกแล้ว"); }}>
                  <Copy className="h-3 w-3 mr-1" /> คัดลอก
                </Button>
              </div>
              <Alert>
                <ArrowRight className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  ขั้นตอน: (1) ดาวน์โหลด Full Backup → (2) คัดลอกสคริปต์นี้รันบนเครื่อง (มี Supabase CLI) → (3) แก้ .env ในโปรเจกต์ frontend
                </AlertDescription>
              </Alert>
              <div className="flex gap-2 flex-wrap">
                <a href="/dashboard/admin/backup-external" className="inline-block">
                  <Button variant="outline"><Cloud className="h-4 w-4 mr-2" />Backup ต่อเนื่อง (Cron)</Button>
                </a>
                <a href="https://supabase.com/docs/guides/self-hosting/docker" target="_blank" rel="noopener" className="inline-block">
                  <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" />คู่มือ Self-host</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- STORAGE ---- */}
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderArchive className="h-5 w-5" /> ดาวน์โหลดไฟล์ใน Storage
              </CardTitle>
              <CardDescription>
                Storage bucket แยกดาวน์โหลดทีละตัว (ไฟล์ใหญ่, timeout 150 วินาที)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {buckets.length === 0 && (
                <p className="text-sm text-muted-foreground">กำลังโหลดรายการ...</p>
              )}
              <div className="grid md:grid-cols-2 gap-2">
                {buckets.map((b) => (
                  <div key={b.name} className="flex items-center justify-between border rounded px-3 py-2">
                    <span className="font-mono text-sm">{b.name}</span>
                    <Button size="sm" variant="outline"
                      onClick={() => download("storage", b.name)}
                      disabled={downloading === b.name}>
                      <Download className="h-3 w-3 mr-1" />
                      {downloading === b.name ? "..." : "ZIP"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
