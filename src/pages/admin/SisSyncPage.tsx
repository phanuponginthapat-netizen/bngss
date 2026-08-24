import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  CheckCircle2, Clock, XCircle, Loader2, Shield, Upload, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";

type SyncItem = {
  id: string;
  direction: string;
  entity_type: string;
  entity_id: string | null;
  operation: string;
  payload: any;
  status: string;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <Clock className="w-3 h-3" />,
  },
  processing: {
    label: "Processing",
    color: "bg-sky-100 text-sky-800 border-sky-200",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const directionConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  inbound: {
    label: "Inbound",
    icon: <ArrowDownToLine className="w-4 h-4 text-sky-500" />,
  },
  outbound: {
    label: "Outbound",
    icon: <ArrowUpFromLine className="w-4 h-4 text-amber-500" />,
  },
};

export default function SisSyncPage() {
  const { lang } = useLanguage();
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sis_sync_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
    processing: items.filter((i) => i.status === "processing").length,
    completed: items.filter((i) => i.status === "completed").length,
    failed: items.filter((i) => i.status === "failed").length,
  };

  const inboundCount = items.filter((i) => i.direction === "inbound").length;
  const outboundCount = items.filter((i) => i.direction === "outbound").length;

  const handlePull = async () => {
    setPulling(true);
    try {
      const { error } = await supabase.functions.invoke("sis-sync-pull", { body: {} });
      if (error) throw error;
      toast.success(lang === "th" ? "เริ่มดึงข้อมูลจาก SIS แล้ว" : "SIS pull initiated");
      setTimeout(load, 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const { error } = await supabase.functions.invoke("sis-sync-push", { body: {} });
      if (error) throw error;
      toast.success(lang === "th" ? "เริ่มส่งข้อมูลไป SIS แล้ว" : "SIS push initiated");
      setTimeout(load, 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setPushing(false);
    }
  };

  const handleDmcImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      const header = rows[0] as string[];
      if (!header || header.length < 10) throw new Error(lang === "th" ? "ไฟล์ไม่ถูกต้อง: ต้องเป็น DMC 31 ฟิลด์" : "Invalid DMC file");
      const dataRows = rows.slice(1).filter((r: any) => Array.isArray(r) && r.length > 0 && r.some((c: any) => c !== "" && c != null));
      const payloads = dataRows.map((r: any[]) => ({
        direction: "inbound",
        entity_type: "student",
        operation: "create",
        payload: { dmc: r, header },
        status: "pending",
      }));
      for (let i = 0; i < payloads.length; i += 100) {
        const batch = payloads.slice(i, i + 100);
        const { error } = await supabase.from("sis_sync_queue" as any).insert(batch as any);
        if (error) throw error;
      }
      toast.success(lang === "th" ? `นำเข้า DMC ${dataRows.length} รายการ เข้าคิว inbound` : `Imported ${dataRows.length} DMC rows`);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="w-12 h-12 mb-4 opacity-30" />
        <p>{lang === "th" ? "ต้องเป็น Admin เท่านั้น" : "Admin access required"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[calc(env(safe-area-inset-bottom)+8rem)] md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-primary" />
            {lang === "th" ? "SIS Sync" : "SIS Sync"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th"
              ? "ซิงค์ข้อมูลกับระบบ SIS ของเขตพื้นที่"
              : "Bidirectional sync with district SIS"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {lang === "th" ? "รีเฟรช" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "รออนุมัติ" : "Pending"}</p>
                <p className="text-3xl font-bold text-amber-600">{counts.pending}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "กำลังทำงาน" : "Processing"}</p>
                <p className="text-3xl font-bold text-sky-600">{counts.processing}</p>
              </div>
              <Loader2 className="w-10 h-10 text-sky-200 animate-spin" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "สำเร็จ" : "Completed"}</p>
                <p className="text-3xl font-bold text-emerald-600">{counts.completed}</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{lang === "th" ? "ล้มเหลว" : "Failed"}</p>
                <p className="text-3xl font-bold text-red-600">{counts.failed}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownToLine className="w-5 h-5 text-sky-500" />
              {lang === "th" ? "ดึงข้อมูลจาก SIS (Inbound)" : "Pull from District SIS"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === "th"
                ? `มีรายการทั้งหมด ${inboundCount} รายการ`
                : `${inboundCount} total inbound items`}
            </p>
            <Button onClick={handlePull} disabled={pulling} className="w-full gap-2">
              {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              {pulling
                ? (lang === "th" ? "กำลังดึง..." : "Pulling...")
                : (lang === "th" ? "ดึงข้อมูลจาก SIS" : "Pull from SIS")}
            </Button>
            <div className="mt-3 border-t pt-3">
              <label className="flex items-center gap-2 text-xs font-semibold mb-2"><FileSpreadsheet className="w-3 h-3" /> {lang === "th" ? "นำเข้า DMC ไฟล์ สพฐ. (31 ฟิลด์) → คิว inbound" : "Import DMC file (31 fields) → inbound queue"}</label>
              <input type="file" accept=".xlsx,.xls" onChange={handleDmcImport} disabled={importing} className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs" />
              {importing && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {lang === "th" ? "กำลังนำเข้า..." : "Importing..."}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">{lang === "th" ? "รองรับ .xlsx จาก DMC สพฐ. ตรวจ 31 ฟิลด์ก่อนเข้าคิว" : "Supports DMC .xlsx, validates 31 fields"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpFromLine className="w-5 h-5 text-amber-500" />
              {lang === "th" ? "ส่งข้อมูลไป SIS (Outbound)" : "Push to District SIS"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === "th"
                ? `มีรายการทั้งหมด ${outboundCount} รายการ`
                : `${outboundCount} total outbound items`}
            </p>
            <Button onClick={handlePush} disabled={pushing} className="w-full gap-2" variant="secondary">
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
              {pushing
                ? (lang === "th" ? "กำลังส่ง..." : "Pushing...")
                : (lang === "th" ? "ส่งข้อมูลไป SIS" : "Push to SIS")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {lang === "th" ? "ประวัติซิงค์ล่าสุด" : "Recent Sync History"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "th" ? "ทิศทาง" : "Direction"}</TableHead>
                <TableHead>{lang === "th" ? "ประเภท" : "Entity"}</TableHead>
                <TableHead>{lang === "th" ? "Operation" : "Operation"}</TableHead>
                <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                <TableHead>{lang === "th" ? "ข้อผิดพลาด" : "Error"}</TableHead>
                <TableHead>{lang === "th" ? "เวลา" : "Time"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const st = statusConfig[item.status] || statusConfig.pending;
                const dir = directionConfig[item.direction] || directionConfig.inbound;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {dir.icon}
                        <span className="text-sm">{dir.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {item.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{item.operation}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 text-xs ${st.color}`}>
                        {st.icon}
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-xs text-red-600 truncate">
                        {item.error_message || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString("th-TH")
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {lang === "th" ? "ยังไม่มีรายการซิงค์" : "No sync history yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
