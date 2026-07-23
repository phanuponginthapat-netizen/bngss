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
  FolderArchive, ShieldCheck, ArrowRight, ExternalLink, Rocket
} from "lucide-react";
import { todayBangkok } from "@/lib/dateBE";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function BackupMigrationCenterPage() {
  const [downloading, setDownloading] = useState<null | "tables" | "full" | string>(null);
  const [restoring, setRestoring] = useState(false);
  const [buckets, setBuckets] = useState<{ name: string }[]>([]);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [truncate, setTruncate] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetRef, setTargetRef] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const qs = mode === "storage" ? `mode=storage&bucket=${encodeURIComponent(bucket!)}` : `mode=${mode}`;
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/system-restore?${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: ANON },
        body: form,
      });
      const j = await res.json();
      setRestoreResult(j);
      if (j.success) toast.success(`สำเร็จ: ${j.tables_processed} ตาราง, ${j.rows_inserted} แถว`);
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
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-primary" /> Full Backup (แนะนำ)
              </CardTitle>
              <CardDescription>
                ZIP เดียวรวม: ข้อมูลทุกตาราง (JSON) + รายการไฟล์ storage + สคริปต์ restore + คู่มือภาษาไทย
              </CardDescription>
            </CardHeader>
            <CardContent>
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
              <CardDescription>รองรับไฟล์จาก Full Backup หรือ Tables ZIP</CardDescription>
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
                    {restoreResult.dry_run && <Badge>Dry Run</Badge>}
                  </div>
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
