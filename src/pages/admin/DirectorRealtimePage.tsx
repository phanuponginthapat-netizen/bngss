import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { todayBangkok, formatTime24, formatDateBE } from "@/lib/dateBE";
import { toast } from "sonner";
import { Users, UserCheck, Clock, RefreshCw, AlertTriangle, Activity, Wifi, WifiOff } from "lucide-react";

type RecentScan = {
  id: string;
  student_id: string;
  scan_time: string;
  scan_date: string;
  scan_type: string | null;
  confidence: number | null;
  students?: {
    prefix?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    student_code?: string | null;
    photo_url?: string | null;
    classrooms?: { grade_level?: string | null; name?: string | null } | null;
  } | null;
};

const BASE_DELAY = 10_000;
const MAX_DELAY = 60_000;

export default function DirectorRealtimePage() {
  const [studentsPresent, setStudentsPresent] = useState<number>(0);
  const [staffPresent, setStaffPresent] = useState<number>(0);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [delay, setDelay] = useState(BASE_DELAY);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const timeoutRef = useRef<number | null>(null);
  const delayRef = useRef(BASE_DELAY);
  const retryRef = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const today = todayBangkok();

  const fetchRealtime = useCallback(async (isInitial = false) => {
    if (!mountedRef.current) return;
    if (isInitial) setLoading(true);

    // abort previous if still pending
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 3 parallel queries - use null guards, handle errors per query
      const studentPromise = (supabase as any)
        .from("face_scan_logs")
        .select("student_id")
        .eq("scan_date", today);

      const staffPromise = (supabase as any)
        .from("time_clock")
        .select("personnel_id, clock_in")
        .eq("clock_date", today)
        .not("clock_in", "is", null);

      const recentPromise = (supabase as any)
        .from("face_scan_logs")
        .select(
          "id, student_id, scan_time, scan_date, scan_type, confidence, students(prefix, first_name, last_name, student_code, photo_url, classrooms:students_classroom_id_fkey(grade_level, name))"
        )
        .eq("scan_date", today)
        .order("scan_time", { ascending: false })
        .limit(20);

      const [studentRes, staffRes, recentRes] = await Promise.all([
        studentPromise,
        staffPromise,
        recentPromise,
      ]);

      if (controller.signal.aborted) return;
      if (!mountedRef.current) return;

      if (studentRes.error) throw new Error(studentRes.error.message || "โหลดข้อมูลนักเรียนล้มเหลว");
      if (staffRes.error) throw new Error(staffRes.error.message || "โหลดข้อมูลบุคลากรล้มเหลว");
      if (recentRes.error) throw new Error(recentRes.error.message || "โหลดรายการสแกนล้มเหลว");

      // null guards - ensure arrays
      const studentRows: { student_id: string | null }[] = studentRes.data ?? [];
      const staffRows: { personnel_id: string | null }[] = staffRes.data ?? [];
      const recentRows: RecentScan[] = (recentRes.data ?? []) as RecentScan[];

      // distinct count for students present today
      const distinctStudents = new Set(
        studentRows.map((r) => r?.student_id).filter((v): v is string => !!v)
      ).size;

      // distinct staff present today
      const distinctStaff = new Set(
        staffRows.map((r) => r?.personnel_id).filter((v): v is string => !!v)
      ).size;

      // fallback to count if distinct logic empty but data exists
      const studentCount = distinctStudents || studentRows.length || 0;
      const staffCount = distinctStaff || staffRows.length || 0;

      setStudentsPresent(studentCount);
      setStaffPresent(staffCount);
      setRecentScans(recentRows);
      setError(null);

      // reset backoff on success
      retryRef.current = 0;
      delayRef.current = BASE_DELAY;
      setRetryCount(0);
      setDelay(BASE_DELAY);
      setLastUpdate(new Date());
    } catch (e: any) {
      if (controller.signal.aborted) return;
      if (!mountedRef.current) return;
      const msg = e?.message ? String(e.message) : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
      setError(msg);
      toast.error("โหลดข้อมูล Realtime ล้มเหลว", {
        description: `${msg} — จะลองใหม่ใน ${Math.round(delayRef.current / 1000)} วินาที`,
      });

      // exponential backoff: double, capped at 60s
      retryRef.current += 1;
      delayRef.current = Math.min(MAX_DELAY, delayRef.current * 2);
      setRetryCount(retryRef.current);
      setDelay(delayRef.current);
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false);
        // schedule next poll only if still polling and mounted
        if (mountedRef.current && isPolling) {
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(() => {
            void fetchRealtime(false);
          }, delayRef.current) as unknown as number;
        }
      }
    }
  }, [today, isPolling]);

  // initial mount + cleanup
  useEffect(() => {
    mountedRef.current = true;
    void fetchRealtime(true);
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchRealtime]);

  // pause polling when tab hidden to save resources, resume on visible
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && isPolling) {
        // immediate refresh on return
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        void fetchRealtime(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchRealtime, isPolling]);

  const handleManualRetry = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    delayRef.current = BASE_DELAY;
    retryRef.current = 0;
    setDelay(BASE_DELAY);
    setRetryCount(0);
    setError(null);
    setLoading(true);
    void fetchRealtime(true);
  };

  const togglePolling = () => {
    setIsPolling((v) => {
      const next = !v;
      if (!next && timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (next) void fetchRealtime(false);
      return next;
    });
  };

  if (loading && recentScans.length === 0 && studentsPresent === 0 && staffPresent === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">แดชบอร์ด ผอ. Real-time</h1>
          <Badge variant="secondary" className="animate-pulse">กำลังโหลด...</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            แดชบอร์ด ผอ. Real-time
          </h1>
          <p className="text-sm text-muted-foreground">
            วันที่ {formatDateBE(today)} • อัปเดตล่าสุด: {lastUpdate ? formatTime24(lastUpdate) : "-"} • โพลทุก {delay / 1000}s
            {retryCount > 0 && <span className="text-amber-600"> • ลองใหม่ครั้งที่ {retryCount}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isPolling ? "default" : "secondary"} className="gap-1">
            {isPolling ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isPolling ? "กำลังติดตาม" : "หยุดชั่วคราว"}
          </Badge>
          <Button variant="outline" size="sm" onClick={togglePolling}>
            {isPolling ? "หยุด" : "เริ่ม"}โพล
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRetry} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Error state with auto-retry info */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">โหลดข้อมูลไม่สำเร็จ</p>
              <p className="text-sm text-muted-foreground break-words">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                จะลองใหม่อัตโนมัติใน {delay / 1000} วินาที (backoff {BASE_DELAY / 1000}s → {MAX_DELAY / 1000}s) • ครั้งที่ {retryCount}
              </p>
            </div>
            <Button size="sm" onClick={handleManualRetry}>
              ลองใหม่
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Realtime stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              นักเรียนมาเรียนวันนี้
            </CardTitle>
            <CardDescription className="text-xs">face_scan_logs • scan_date = {today}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{studentsPresent ?? 0}</div>
            <p className="text-xs text-muted-foreground">คน (distinct student_id)</p>
            <Badge variant="outline" className="mt-2">
              <Clock className="w-3 h-3 mr-1" />
              อัปเดต {lastUpdate ? formatTime24(lastUpdate) : "-"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              บุคลากรมาปฏิบัติงาน
            </CardTitle>
            <CardDescription className="text-xs">time_clock • clock_date = {today}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{staffPresent ?? 0}</div>
            <p className="text-xs text-muted-foreground">คน (distinct personnel_id)</p>
            <Badge variant="outline" className="mt-2">
              <Clock className="w-3 h-3 mr-1" />
              อัปเดต {lastUpdate ? formatTime24(lastUpdate) : "-"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              สแกนวันนี้ทั้งหมด
            </CardTitle>
            <CardDescription className="text-xs">รายการล่าสุด 20 รายการ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{recentScans?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">รายการ (limit 20)</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">
                เข้า: {(recentScans ?? []).filter((r) => (r.scan_type ?? "entry") !== "exit").length}
              </Badge>
              <Badge variant="outline">
                ออก: {(recentScans ?? []).filter((r) => r.scan_type === "exit").length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent scans table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">สแกนล่าสุด (20 รายการ)</CardTitle>
          <CardDescription>
            ดึงจาก <code>face_scan_logs</code> where scan_date = {today} order by scan_time desc limit 20 • โพลทุก {delay / 1000}s
            {retryCount > 0 ? ` • backoff x${Math.pow(2, retryCount)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เวลา</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ชั้น</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-right">ความมั่นใจ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (recentScans?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : (recentScans ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    ยังไม่มีการสแกนวันนี้ ({today})
                  </TableCell>
                </TableRow>
              ) : (
                (recentScans ?? []).map((r) => {
                  const s = r.students ?? null;
                  const fullName =
                    s != null
                      ? `${s.prefix ?? ""}${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "-"
                      : r.student_id?.slice(0, 8) ?? "-";
                  const classroom =
                    s?.classrooms != null
                      ? `${s.classrooms.grade_level ?? ""}/${s.classrooms.name ?? ""}`.replace(/^\//, "") || "-"
                      : "-";
                  const code = s?.student_code ?? r.student_id?.slice(0, 6) ?? "-";
                  const isExit = r.scan_type === "exit";
                  const confidence = r.confidence != null ? `${(Number(r.confidence) * 100).toFixed(1)}%` : "-";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.scan_time ? formatTime24(r.scan_time) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{code}</TableCell>
                      <TableCell className="text-sm">{fullName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{classroom}</TableCell>
                      <TableCell>
                        <Badge variant={isExit ? "destructive" : "default"}>{isExit ? "ออก" : "เข้า"}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{confidence}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Polling: {isPolling ? "เปิด" : "ปิด"} • Interval: {BASE_DELAY / 1000}s → backoff สูงสุด {MAX_DELAY / 1000}s • รีเซ็ตเมื่อสำเร็จ • ทำความสะอาด timer เมื่อ unmount
      </p>
    </div>
  );
}
