import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardDrive, CloudUpload, FolderTree, Loader2, ExternalLink, Database, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { BE_OFFSET } from "@/lib/dateBE";

interface Policy {
  code: string;
  label: string;
  tables: string[];
  retention_years: number | null;
  legal_basis: string | null;
  sort_order: number;
}

interface ArchiveRow {
  id: string;
  academic_year_be: number;
  module_code: string;
  module_label: string | null;
  table_name: string;
  file_name: string;
  web_link: string | null;
  folder_path: string | null;
  row_count: number;
  byte_size: number;
  created_at: string;
}

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

export default function DataArchivePage() {
  const qc = useQueryClient();
  const currentBE = new Date().getFullYear() + BE_OFFSET;
  const [yearBE, setYearBE] = useState(String(currentBE - 1));
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: ["retention_policies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("data_retention_policies").select("*").order("sort_order");
      if (error) throw error;
      return (data || []) as Policy[];
    },
  });

  const { data: archives = [] } = useQuery({
    queryKey: ["drive_archives"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("drive_archives")
        .select("*")
        .order("academic_year_be", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ArchiveRow[];
    },
  });

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentBE; y >= currentBE - 10; y--) list.push(y);
    return list;
  }, [currentBE]);

  const archivedThisYear = useMemo(() => {
    const set = new Set(archives.filter((a) => a.academic_year_be === Number(yearBE)).map((a) => a.module_code));
    return set;
  }, [archives, yearBE]);

  const totalBytes = archives.reduce((a, r) => a + (r.byte_size || 0), 0);
  const totalRows = archives.reduce((a, r) => a + (r.row_count || 0), 0);

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const runArchive = async () => {
    const modules = selected.length ? selected : policies.map((p) => p.code);
    const ok = await swal.confirm({
      title: `สำรองข้อมูลปีการศึกษา ${yearBE} ขึ้น Google Drive?`,
      text: `จะสำรอง ${modules.length} งาน โดยจัดโฟลเดอร์เป็น ปีการศึกษา ${yearBE} › ชื่องาน`,
    });
    if (!ok) return;

    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("drive-archive", {
        body: { action: "archive", year_be: Number(yearBE), modules },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = (data as any)?.results || [];
      const failed = res.filter((r: any) => r.error);
      toast.success(`สำรองสำเร็จ ${(data as any).total_rows?.toLocaleString?.() || 0} รายการ (${fmtBytes((data as any).total_bytes || 0)})`);
      if (failed.length) toast.warning(`มี ${failed.length} ตารางที่สำรองไม่สำเร็จ — ดูรายละเอียดในแท็บไฟล์สำรอง`);
      qc.invalidateQueries({ queryKey: ["drive_archives"] });
    } catch (e: any) {
      toast.error(`สำรองไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  const restore = async (row: ArchiveRow, mode: "preview" | "insert") => {
    if (mode === "insert") {
      const ok = await swal.confirm({
        title: "นำข้อมูลกลับเข้าระบบ?",
        text: `ตาราง ${row.table_name} — ระบบจะเพิ่มเฉพาะรายการที่ยังไม่มีอยู่ (ไม่ทับข้อมูลปัจจุบัน)`,
      });
      if (!ok) return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("drive-archive", {
        body: { action: "restore", archive_id: row.id, mode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (mode === "insert") toast.success(`นำกลับเข้าระบบแล้ว ${(data as any).restored} รายการ`);
      else toast.success(`อ่านไฟล์ได้ ${(data as any).row_count} รายการ (พร้อมนำกลับ)`);
    } catch (e: any) {
      toast.error(`ดึงข้อมูลไม่สำเร็จ: ${e?.message || e}`);
    }
  };

  const [offloading, setOffloading] = useState(false);

  // Storage usage metrics from storage-tier Edge Function
  const { data: storageUsage, isLoading: loadingStorageUsage, refetch: refetchStorageUsage } = useQuery({
    queryKey: ["storage_tier_usage"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("storage-tier", {
        body: { action: "usage" },
      });
      if (error) throw error;
      return data as {
        supabase_total_bytes: number;
        supabase_total_files: number;
        drive_total_bytes: number;
        drive_total_files: number;
        target_under_1gb: boolean;
        buckets: Array<{
          name: string;
          public: boolean;
          supabase_files: number;
          supabase_bytes: number;
          drive_files: number;
          drive_bytes: number;
        }>;
      };
    },
  });

  // Offloaded cold storage registry items
  const { data: coldStorageFiles = [], refetch: refetchColdFiles } = useQuery({
    queryKey: ["cold_storage_registry"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cold_storage_registry")
        .select("*")
        .order("offloaded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const runOffloadStorage = async () => {
    const ok = await swal.confirm({
      title: "ย้ายไฟล์ลง Google Drive (Offload Storage)?",
      text: "ระบบจะดาวน์โหลดไฟล์จาก Supabase Storage แล้วนำขึ้นโฟลเดอร์ BNGSS Storage บน Drive ก่อนลบออกจาก Supabase เพื่อคืนพื้นที่",
    });
    if (!ok) return;

    setOffloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("storage-tier", {
        body: { action: "offload", max_files: 100 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const freed = (data as any)?.freed_bytes || 0;
      const count = (data as any)?.offloaded_files_count || 0;
      toast.success(`ย้ายไฟล์สำเร็จ ${count} รายการ (ประหยัดพื้นที่ ${fmtBytes(freed)})`);
      refetchStorageUsage();
      refetchColdFiles();
    } catch (e: any) {
      toast.error(`การย้ายไฟล์ไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setOffloading(false);
    }
  };

  const restoreColdFile = async (row: any) => {
    const ok = await swal.confirm({
      title: "ดึงไฟล์กลับมา Supabase Storage?",
      text: `ไฟล์ ${row.file_path} (Bucket: ${row.bucket_name})`,
    });
    if (!ok) return;

    try {
      const { data, error } = await supabase.functions.invoke("storage-tier", {
        body: { action: "restore", id: row.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("ดึงไฟล์กลับมา Supabase Storage เรียบร้อยแล้ว");
      refetchStorageUsage();
      refetchColdFiles();
    } catch (e: any) {
      toast.error(`การดึงไฟล์กลับไม่สำเร็จ: ${e?.message || e}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-primary" />
          จัดเก็บและสำรองข้อมูล (Data Archive & Storage Tier)
        </h1>
        <p className="text-sm text-muted-foreground">
          เก็บข้อมูลย้อนหลังตามระเบียบกระทรวง และจัดการพื้นที่จัดเก็บไฟล์ด้วย Google Drive เป็นหลัก
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ไฟล์สำรอง DB รวม</div><div className="text-2xl font-bold">{archives.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">รายการ DB ใน Drive</div><div className="text-2xl font-bold">{totalRows.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ขนาดไฟล์ DB บน Drive</div><div className="text-2xl font-bold">{fmtBytes(totalBytes)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="storage-tier">
        <TabsList>
          <TabsTrigger value="storage-tier"><HardDrive className="w-4 h-4 mr-1" />พื้นที่จัดเก็บ (Drive เป็นหลัก)</TabsTrigger>
          <TabsTrigger value="archive"><CloudUpload className="w-4 h-4 mr-1" />สำรองขึ้น Drive</TabsTrigger>
          <TabsTrigger value="policy"><ShieldCheck className="w-4 h-4 mr-1" />นโยบายเก็บข้อมูล</TabsTrigger>
          <TabsTrigger value="files"><FolderTree className="w-4 h-4 mr-1" />ไฟล์ DB สำรอง</TabsTrigger>
        </TabsList>

        {/* ── พื้นที่จัดเก็บ (Drive เป็นหลัก) ── */}
        <TabsContent value="storage-tier" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">พื้นที่ Supabase Storage</div>
                  <Badge variant={storageUsage?.target_under_1gb ? "outline" : "destructive"}>
                    {storageUsage?.target_under_1gb ? "เป้าหมาย < 1 GB (ปกติ)" : "เกินเป้าหมาย 1 GB"}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mt-1">
                  {loadingStorageUsage ? "กำลังโหลด..." : fmtBytes(storageUsage?.supabase_total_bytes || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {storageUsage?.supabase_total_files || 0} ไฟล์ในระบบหลัก
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">พื้นที่ย้ายไป Google Drive</div>
                <div className="text-2xl font-bold mt-1">
                  {loadingStorageUsage ? "กำลังโหลด..." : fmtBytes(storageUsage?.drive_total_bytes || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {storageUsage?.drive_total_files || 0} ไฟล์ใน Cold Storage
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">ตั้งเวลาทำงานอัตโนมัติ</div>
                <div className="text-sm font-semibold mt-1 flex items-center gap-1.5 text-emerald-600">
                  <ShieldCheck className="w-4 h-4" /> ทุกวันอาทิตย์ 02:00 น.
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ผ่าน pg_cron → offload
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CloudUpload className="w-4 h-4 text-primary" />
                  จัดการพื้นที่จัดเก็บไฟล์ (Storage Tiering)
                </CardTitle>
                <CardDescription>
                  ดาวน์โหลดไฟล์จาก Supabase Storage ไปเก็บโฟลเดอร์ <code>BNGSS Storage / &lt;bucket&gt;</code> บน Drive และลบออกจาก Supabase เพื่อควบคุมพื้นที่ให้ต่ำกว่า 1 GB
                </CardDescription>
              </div>
              <Button onClick={runOffloadStorage} disabled={offloading}>
                {offloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                {offloading ? "กำลังย้ายไฟล์..." : "ย้ายไฟล์ลง Drive ทันที (Offload)"}
              </Button>
            </CardHeader>
            <CardContent>
              <h3 className="text-sm font-medium mb-3">รายการไฟล์ที่ย้ายไปอยู่บน Drive (Cold Storage Registry)</h3>
              {coldStorageFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg bg-muted/20">
                  ยังไม่มีไฟล์ที่ถูก Offload ไปยัง Drive (ระบบพร้อมใช้งาน)
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead>ตำแหน่งไฟล์</TableHead>
                      <TableHead className="text-right">ขนาด</TableHead>
                      <TableHead className="w-44 text-right">เวลาที่ย้าย</TableHead>
                      <TableHead className="w-36 text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coldStorageFiles.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell><Badge variant="outline">{row.bucket_name}</Badge></TableCell>
                        <TableCell className="text-xs font-mono truncate max-w-[280px]" title={row.file_path}>
                          {row.file_path}
                        </TableCell>
                        <TableCell className="text-right">{fmtBytes(row.size_bytes)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(row.offloaded_at).toLocaleString("th-TH")}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {row.drive_web_link && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={row.drive_web_link} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => restoreColdFile(row)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />ดึงกลับ
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── สำรองขึ้น Drive ── */}
        <TabsContent value="archive" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">เลือกปีการศึกษาและงานที่ต้องการสำรอง</CardTitle>
              <CardDescription>โครงโฟลเดอร์บน Drive: <code>BNGSS Archive / ปีการศึกษา {yearBE} / ชื่องาน / ไฟล์.json</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <div className="text-xs text-muted-foreground mb-1">ปีการศึกษา</div>
                  <Select value={yearBE} onValueChange={setYearBE}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={runArchive} disabled={running || loadingPolicies}>
                  {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
                  {running ? "กำลังสำรอง..." : selected.length ? `สำรอง ${selected.length} งาน` : "สำรองทุกงาน"}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {policies.map((p) => (
                  <label key={p.code} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={selected.includes(p.code)} onCheckedChange={() => toggle(p.code)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.label}</span>
                        {archivedThisYear.has(p.code) && <Badge variant="outline" className="text-emerald-600 border-emerald-300">สำรองแล้ว</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{p.tables.join(", ")}</div>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── นโยบาย ── */}
        <TabsContent value="policy" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ระยะเวลาเก็บรักษาข้อมูลตามระเบียบ</CardTitle>
              <CardDescription>ข้อมูลที่ครบกำหนดต้องสำรองขึ้น Drive ก่อนจึงจะลบออกจากฐานข้อมูลได้</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน / เอกสาร</TableHead>
                    <TableHead className="w-32 text-center">เก็บรักษา</TableHead>
                    <TableHead>ตารางข้อมูล</TableHead>
                    <TableHead>อ้างอิงระเบียบ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={p.code}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell className="text-center">
                        {p.retention_years === null
                          ? <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">ถาวร</Badge>
                          : <Badge variant="outline">{p.retention_years} ปี</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.tables.join(", ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.legal_basis}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ไฟล์สำรอง ── */}
        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />ไฟล์ที่สำรองไว้บน Google Drive</CardTitle>
              <CardDescription>เปิดดูบน Drive หรือดึงกลับเข้าระบบได้ทันที</CardDescription>
            </CardHeader>
            <CardContent>
              {archives.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีไฟล์สำรอง</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">ปีการศึกษา</TableHead>
                      <TableHead>งาน</TableHead>
                      <TableHead>ไฟล์</TableHead>
                      <TableHead className="text-right w-24">รายการ</TableHead>
                      <TableHead className="text-right w-24">ขนาด</TableHead>
                      <TableHead className="w-44 text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archives.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-center">{a.academic_year_be}</TableCell>
                        <TableCell className="text-sm">{a.module_label || a.module_code}</TableCell>
                        <TableCell className="text-xs font-mono truncate max-w-[240px]" title={a.folder_path || ""}>{a.file_name}</TableCell>
                        <TableCell className="text-right">{a.row_count.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{fmtBytes(a.byte_size)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {a.web_link && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={a.web_link} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => restore(a, "preview")}>ตรวจไฟล์</Button>
                          <Button size="sm" variant="outline" onClick={() => restore(a, "insert")}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />ดึงกลับ
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
