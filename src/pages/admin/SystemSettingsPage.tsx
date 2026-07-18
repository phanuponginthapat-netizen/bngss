import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Database, Trash2, Activity, RefreshCw, Archive, History, Eraser, HardDrive } from "lucide-react";
import ConfigBackupCard from "@/components/admin/ConfigBackupCard";
import CreditFooter from "@/components/CreditFooter";
import { swal } from "@/lib/swal";

/**
 * Unified system settings: feature flags + cloud usage + data maintenance.
 * Replaces scattered admin toggles. Lives at /admin/system-settings.
 */
const SystemSettingsPage = () => {
  const qc = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [purgePreview, setPurgePreview] = useState<any>(null);
  const [orphanScan, setOrphanScan] = useState<any>(null);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanDeleting, setOrphanDeleting] = useState(false);

  const runOrphanScan = async (dryRun: boolean) => {
    if (dryRun) setOrphanLoading(true); else setOrphanDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-storage", {
        body: { dryRun, minAgeDays: 7 },
      });
      if (error) throw error;
      setOrphanScan(data);
      const totalOrphan = (data?.report || []).reduce((s: number, r: any) => s + (r.orphan_count || 0), 0);
      const totalDeleted = (data?.report || []).reduce((s: number, r: any) => s + (r.deleted || 0), 0);
      if (dryRun) toast.success(`พบไฟล์ที่ไม่ได้ใช้แล้ว ${totalOrphan} ไฟล์ ใน ${data?.report?.length} ที่เก็บ`);
      else toast.success(`ลบไฟล์ที่ไม่ได้ใช้แล้วสำเร็จ ${totalDeleted} ไฟล์`);
    } catch (e: any) {
      toast.error(e.message || "สแกนไม่สำเร็จ");
    } finally {
      setOrphanLoading(false);
      setOrphanDeleting(false);
    }
  };

  // Load feature flags
  const { data: settings } = useQuery({
    queryKey: ["system_settings_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["last_archive_run"]);
      return data || [];
    },
  });

  const lastArchive = (() => {
    const a = settings?.find((s) => s.setting_key === "last_archive_run");
    if (!a?.setting_value) return null;
    try { return JSON.parse(a.setting_value); } catch { return null; }
  })();

  // Cloud usage
  const { data: usage, refetch: refetchUsage, isFetching: usageLoading } = useQuery({
    queryKey: ["cloud_usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_usage_summary" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const runArchive = async () => {
    if (!(await swal.confirm({ title: "ยืนยันลบการแจ้งเตือนและ Inbox ที่อ่านแล้วและเก่ากว่า 6 เดือน?", danger: true }))) return;
    setArchiving(true);
    const { data, error } = await supabase.rpc("archive_old_data" as any);
    setArchiving(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    toast.success(`ลบสำเร็จ: แจ้งเตือน ${r?.notifications_deleted || 0}, Inbox ${r?.inbox_deleted || 0}`);
    refetchUsage();
    qc.invalidateQueries({ queryKey: ["system_settings_all"] });
  };

  const loadPurgePreview = async () => {
    setPreviewing(true);
    const { data, error } = await supabase.rpc("get_purge_preview" as any, { _retention_years: 3 });
    setPreviewing(false);
    if (error) { toast.error(error.message); return; }
    setPurgePreview(data);
  };

  const runPurge3Years = async () => {
    if (!purgePreview) {
      toast.error("กรุณากด 'ดูข้อมูลที่จะลบ' ก่อน");
      return;
    }
    const total = Object.entries(purgePreview)
      .filter(([k]) => k !== "cutoff_year")
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    if (!(await swal.confirm({ title: `⚠️ จะลบข้อมูลก่อนปี พ.ศ. ${(purgePreview.cutoff_year + 543)} จำนวนรวม ${total.toLocaleString()} เรคคอร์ด\n\nการลบนี้ไม่สามารถย้อนกลับได้! ยืนยัน?`, danger: true }))) return;
    setPurging(true);
    const { data, error } = await supabase.rpc("archive_and_purge_old_data" as any, { _retention_years: 3 });
    setPurging(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    toast.success(`ลบข้อมูลก่อน ค.ศ. ${r?.cutoff_year} สำเร็จ`);
    setPurgePreview(null);
    refetchUsage();
    qc.invalidateQueries({ queryKey: ["archive_logs"] });
  };

  // ประวัติการ archive
  const { data: archiveLogs = [] } = useQuery({
    queryKey: ["archive_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("archive_logs" as any)
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(5);
      return (data || []) as any[];
    },
  });

  // Calculate usage % vs free quota (rough estimates)
  const FREE_DB_ROWS = 500_000; // approx safe threshold for 8GB
  const totalRows = (usage?.notifications_total || 0) + (usage?.inbox_total || 0) + (usage?.attendance_total || 0);
  const usagePctRaw = Math.min(100, (totalRows / FREE_DB_ROWS) * 100);
  const usagePct = usagePctRaw >= 1 ? Math.round(usagePctRaw) : Math.round(usagePctRaw * 100) / 100;
  const usagePctLabel = totalRows === 0 ? "0%" : usagePctRaw >= 1 ? `${usagePct}%` : `${usagePct.toFixed(2)}%`;
  const usageColor = usagePct < 60 ? "bg-emerald-500" : usagePct < 80 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          ตั้งค่าระบบและการใช้งาน Cloud
        </h1>
        <p className="text-muted-foreground mt-1">
          จัดการฟีเจอร์, ตรวจสอบโควต้า และดูแลรักษาข้อมูล
        </p>
      </div>

      {/* Cloud Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                การใช้งาน Cloud
              </CardTitle>
              <CardDescription>โควต้าฟรี $25/เดือน — เช็ครายเดือน</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchUsage()} disabled={usageLoading}>
              {usageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>ปริมาณข้อมูลรวม (~{totalRows.toLocaleString()} แถว)</span>
              <Badge variant={usagePct < 60 ? "secondary" : usagePct < 80 ? "default" : "destructive"}>
                {usagePctLabel}
              </Badge>
            </div>
            <Progress value={usagePct} className={usagePct >= 80 ? "[&>div]:bg-red-500" : ""} />
            {usagePct >= 80 && (
              <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" /> ใช้งานเกิน 80% — แนะนำให้ลบข้อมูลเก่า
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs">นักเรียน</div>
              <div className="text-xl font-bold">{usage?.students_active || 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs">บุคลากร</div>
              <div className="text-xl font-bold">{usage?.personnel_active || 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs">การแจ้งเตือน</div>
              <div className="text-xl font-bold">{usage?.notifications_total || 0}</div>
              <div className="text-xs text-amber-600">ลบได้ {usage?.notifications_archivable || 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs">Inbox</div>
              <div className="text-xl font-bold">{usage?.inbox_total || 0}</div>
              <div className="text-xs text-amber-600">ลบได้ {usage?.inbox_archivable || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup / Restore */}
      <ConfigBackupCard scope="all" title="สำรอง / กู้คืน การตั้งค่าระบบและ CMS" />

      {/* Browser Cache */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5" />
            ล้าง Cache เบราว์เซอร์
          </CardTitle>
          <CardDescription>
            ล้างข้อมูลที่เก็บไว้ในเบราว์เซอร์ (React Query cache, localStorage, Service Worker) เพื่อโหลดข้อมูลใหม่จากเซิร์ฟเวอร์
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                qc.clear();
                Object.keys(localStorage).forEach(k => {
                  if (!k.startsWith("sb-") && k !== "lang") localStorage.removeItem(k);
                });
                sessionStorage.clear();
                if ("caches" in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }
                if ("serviceWorker" in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.update()));
                }
                toast.success("ล้าง cache สำเร็จ กำลังโหลดหน้าใหม่...");
                setTimeout(() => window.location.reload(), 800);
              } catch (e: any) {
                toast.error("ล้าง cache ไม่สำเร็จ: " + e.message);
              }
            }}
          >
            <Eraser className="h-4 w-4 mr-2" />
            ล้าง Cache ทั้งหมด
          </Button>
        </CardContent>
      </Card>

      {/* Orphan Storage Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            ไฟล์ที่ไม่ได้ใช้แล้ว (ขยะใน Storage)
          </CardTitle>
          <CardDescription>
            สแกนหารูป/ไฟล์ที่อัปโหลดไว้แต่ไม่มีข้อมูลในระบบอ้างถึงแล้ว (เก่ากว่า 7 วัน) — ลบทิ้งเพื่อประหยัดพื้นที่ ปลอดภัยกับไฟล์ที่เพิ่งอัปโหลด
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runOrphanScan(true)} disabled={orphanLoading} variant="outline">
              {orphanLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              สแกน (ดูตัวอย่าง)
            </Button>
            {orphanScan && (orphanScan.report || []).some((r: any) => r.orphan_count > 0) && (
              <Button
                onClick={async () => {
                  const total = (orphanScan.report || []).reduce((s: number, r: any) => s + (r.orphan_count || 0), 0);
                  if (!(await swal.confirm({ title: `⚠️ จะลบไฟล์ที่ไม่ได้ใช้แล้ว ${total} ไฟล์ ไม่สามารถย้อนกลับได้! ยืนยัน?`, danger: true }))) return;
                  runOrphanScan(false);
                }}
                disabled={orphanDeleting}
                variant="destructive"
              >
                {orphanDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                ลบไฟล์ที่ไม่ได้ใช้แล้ว
              </Button>
            )}
          </div>

          {orphanScan?.report && (
            <div className="space-y-1 text-sm">
              {orphanScan.report.map((r: any) => (
                <div key={r.bucket} className="flex justify-between p-2 rounded bg-muted/50">
                  <span className="font-mono">{r.bucket}</span>
                  <span className="text-muted-foreground">
                    ทั้งหมด {r.total_files ?? 0} • ไม่ได้ใช้แล้ว{" "}
                    <span className={r.orphan_count > 0 ? "text-amber-600 font-semibold" : ""}>{r.orphan_count ?? 0}</span>
                    {r.deleted > 0 && <span className="text-emerald-600"> • ลบแล้ว {r.deleted}</span>}
                    {r.skipped && <span className="text-muted-foreground"> • {r.skipped}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            การดูแลรักษาข้อมูล
          </CardTitle>
          <CardDescription>
            ลบเฉพาะการแจ้งเตือน/Inbox ที่อ่านแล้วและเก่ากว่า 6 เดือน
            <br />⏰ ลบได้เฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) และจะไม่ลบข้อมูลของปีการศึกษาปัจจุบัน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lastArchive && (
            <div className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
              ครั้งล่าสุด: {new Date(lastArchive.ran_at).toLocaleString("th-TH")} —
              ลบ {lastArchive.notifications_deleted} แจ้งเตือน, {lastArchive.inbox_deleted} Inbox
            </div>
          )}
          <Button onClick={runArchive} disabled={archiving} variant="destructive">
            {archiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            ลบข้อมูลเก่าตอนนี้
          </Button>
        </CardContent>
      </Card>

      {/* 3-Year Retention */}
      <Card className="border-amber-300 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Archive className="h-5 w-5" />
            นโยบายเก็บข้อมูลย้อนหลัง 3 ปี
          </CardTitle>
          <CardDescription>
            ระบบเก็บข้อมูลย้อนหลังได้สูงสุด 3 ปีการศึกษา ข้อมูลที่เก่ากว่านั้นจะถูกลบ
            <br />⏰ ลบได้เฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) และจะกัน cutoff ให้อยู่ก่อนปีการศึกษาปัจจุบันเสมอ
            <br />ครอบคลุม: เอกสารธุรการ, E-Form, PA, การเช็คชื่อ, พฤติกรรม, สุขภาพ, การลา, แจ้งเตือน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadPurgePreview} disabled={previewing} variant="outline">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <History className="h-4 w-4 mr-2" />}
              ดูข้อมูลที่จะลบ (เก่ากว่า 3 ปี)
            </Button>
            {purgePreview && (
              <Button onClick={runPurge3Years} disabled={purging} variant="destructive">
                {purging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                ลบข้อมูลก่อน พ.ศ. {purgePreview.cutoff_year + 543}
              </Button>
            )}
          </div>

          {purgePreview && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              {Object.entries(purgePreview).filter(([k]) => k !== "cutoff_year").map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}:</span>
                  <span className="font-semibold">{(v as any)?.toLocaleString?.() || 0}</span>
                </div>
              ))}
            </div>
          )}

          {archiveLogs.length > 0 && (
            <div className="space-y-1">
              <Label className="text-sm font-semibold">ประวัติ 5 ครั้งล่าสุด</Label>
              <div className="space-y-1 text-xs">
                {archiveLogs.map((log: any) => {
                  const total = Object.values(log.summary || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
                  return (
                    <div key={log.id} className="flex justify-between p-2 rounded bg-muted/50">
                      <span>{new Date(log.ran_at).toLocaleString("th-TH")}</span>
                      <span className="font-mono">ตัดที่ ค.ศ. {log.cutoff_year} • ลบ {total.toLocaleString()} เรคคอร์ด</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">เครดิตผู้พัฒนาระบบ</CardTitle>
          <CardDescription>ข้อมูลผู้พัฒนา (แสดงในส่วนท้ายของระบบ)</CardDescription>
        </CardHeader>
        <CardContent>
          <CreditFooter />
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;