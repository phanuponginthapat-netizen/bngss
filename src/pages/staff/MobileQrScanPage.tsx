import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, ScanLine, WifiOff, Wifi, CloudUpload, LogIn, LogOut,
  UserCheck, Keyboard, RefreshCw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { supabase } from "@/integrations/supabase/client";
import {
  enqueueScan, flushQueue, countPending, installAutoSync,
} from "@/lib/offlineScanQueue";
import { checkTodayScan, markScanned, methodLabel } from "@/lib/scanDedup";
import {
  syncServerClock, serverNow, serverBangkokHour, isClockUnreliable,
} from "@/lib/serverClock";
import { ensureRosterFresh, findInRoster, rosterInfo, refreshRoster } from "@/lib/scanRoster";


interface RecentEntry {
  key: string;
  name: string;
  code: string;
  classroom: string;
  scan_type: "entry" | "exit";
  time: string;
  queued: boolean;
}

// เดา entry/exit อัตโนมัติจากเวลาไทย (ก่อนเที่ยง = เข้า) — ใช้เวลาเซิร์ฟเวอร์เมื่อซิงค์แล้ว
const guessMode = (): "entry" | "exit" => (serverBangkokHour() < 12 ? "entry" : "exit");

const extractStudentCode = (raw: string) => {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) {
      const url = new URL(s);
      const q = url.searchParams.get("code") || url.searchParams.get("sid") || url.searchParams.get("student");
      if (q) return q.trim();
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length) return parts[parts.length - 1].trim();
    }
    const m = s.match(/(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)/i);
    if (m?.[1]) return m[1].trim();
  } catch {}
  return s;
};


interface PendingConfirm {
  studentId: string;
  name: string;
  studentCode: string;
  classroom: string;
}

export default function MobileQrScanPage() {
  const [mode, setMode] = useState<"entry" | "exit">(guessMode());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [clockWarning, setClockWarning] = useState(false);
  const [roster, setRoster] = useState(() => rosterInfo());
  const [confirmItem, setConfirmItem] = useState<PendingConfirm | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const modeTouched = useRef(false);

  const refreshPending = useCallback(async () => {
    try { setPending(await countPending()); } catch {}
  }, []);

  useEffect(() => {
    installAutoSync(refreshPending);
    refreshPending();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));

    // เทียบนาฬิกาเครื่องกับเซิร์ฟเวอร์ + เตรียมรายชื่อไว้ใช้ตอนเน็ตหลุด
    void syncServerClock(true).then(() => {
      setClockWarning(isClockUnreliable());
      if (!modeTouched.current) setMode(guessMode());
    });
    void ensureRosterFresh().then(() => setRoster(rosterInfo()));

    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refreshPending]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { synced, failed } = await flushQueue();
      await refreshPending();
      await syncServerClock(true);
      setClockWarning(isClockUnreliable());
      await refreshRoster().catch(() => {});
      setRoster(rosterInfo());
      if (synced) toast.success(`ส่งข้อมูลขึ้นระบบ ${synced} รายการ`);
      if (failed) toast.warning(`ยังเหลือ ${failed} รายการรอลองใหม่`);
      if (!synced && !failed) toast.info("ไม่มีรายการค้าง");
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  /** บันทึกจริง — เรียกหลังยืนยันตัวนักเรียนแล้วเท่านั้น */
  const commitScan = useCallback(async (
    target: PendingConfirm,
    method: "qr" | "manual",
  ) => {
    const { studentId, name, studentCode, classroom } = target;

    // เช็คร่วมกับการสแกนใบหน้า — วันนี้บันทึกโหมดนี้ไปแล้วหรือยัง (ทุกวิธีการสแกน)
    if (online) {
      const st = await checkTodayScan(studentId, true);
      if ((mode === "exit" && st.exit) || (mode === "entry" && st.entry)) {
        const via = methodLabel(mode === "exit" ? st.exitMethod : st.entryMethod);
        toast.info("สแกนซ้ำ", { description: `${name} บันทึก${mode === "entry" ? "เข้า" : "ออก"}วันนี้แล้ว (${via})` });
        return;
      }
      if (mode === "exit" && !st.entry) {
        toast.warning("ปฏิเสธการสแกน", { description: `${name} ยังไม่ได้บันทึกเข้าโรงเรียนวันนี้` });
        return;
      }
    }

    const scan = {
      student_id: studentId,
      student_code: studentCode,
      student_name: name,
      scan_type: mode,
      entry_method: method,
      device_label: `mobile-${method}-${mode}`,
      scanned_by: userId,
      // เวลาที่แก้ส่วนต่างนาฬิกาเครื่องแล้ว (ใช้เฉพาะตอนต้องเข้าคิวออฟไลน์)
      scanned_at: serverNow().toISOString(),
    };

    let queued = false;
    try {
      // ⚠️ ออนไลน์: ไม่ส่ง scan_date / scan_time ขึ้นไป
      // ให้ฐานข้อมูลประทับวัน-เวลาไทยของเซิร์ฟเวอร์เอง — ข้อมูลจึงตรงเสมอ
      // แม้นาฬิกาหรือโซนเวลาของมือถือเครื่องที่ใช้สแกนจะตั้งผิด
      const { error } = await supabase.from("face_scan_logs").insert({
        student_id: scan.student_id,
        scan_type: scan.scan_type,
        confidence: 1,
        scanned_by: scan.scanned_by,
        device_label: scan.device_label,
        entry_method: scan.entry_method,
      } as any);
      if (error) {
        if (error.code === "23505") {
          markScanned(studentId, mode, method);
          toast.info("สแกนซ้ำ", { description: `${name} • บันทึกวันนี้แล้ว` });
          return;
        }
        throw error;
      }
      markScanned(studentId, mode, method);
    } catch (e: any) {
      await enqueueScan(scan);
      queued = true;
      await refreshPending();
    }

    if (queued) {
      toast.warning("บันทึกในคิว (ออฟไลน์)", { description: `${name} • จะซิงค์เมื่อออนไลน์` });
    } else {
      toast.success(`✓ ${mode === "entry" ? "เข้า" : "ออก"} • ${name}`, { description: `${studentCode} • ${classroom}` });
    }
    setRecent((r) => [{
      key: `${studentCode}:${mode}:${Date.now()}`,
      name, code: studentCode, classroom, scan_type: mode,
      time: new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(serverNow()),
      queued,
    }, ...r].slice(0, 15));
  }, [mode, online, userId, refreshPending]);

  const processCode = useCallback(async (raw: string, source: "qr" | "manual" = "qr") => {
    const code = extractStudentCode(raw);
    if (!code || code.length < 3) return;
    const key = `${code}:${mode}`;
    const now = Date.now();
    const last = cooldownRef.current.get(key) || 0;
    if (now - last < 4000) return; // กันสแกนซ้ำภายใน 4 วิ
    cooldownRef.current.set(key, now);

    let target: PendingConfirm | null = null;

    if (online) {
      try {
        const { data, error } = await (supabase as any).rpc("resolve_scanned_student", { _input: raw });
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row) {
          target = {
            studentId: row.id,
            studentCode: row.student_code || code,
            name: `${row.prefix || ""}${row.first_name || ""} ${row.last_name || ""}`.trim() || code,
            classroom: row.grade_level ? `${row.grade_level}/${row.classroom_name || ""}` : "-",
          };
        }
      } catch {}
    }

    // เน็ตหลุด / RPC ล้มเหลว → ใช้สำเนารายชื่อในเครื่อง (ตรงรหัสเป๊ะเท่านั้น)
    if (!target) {
      const cached = findInRoster(code);
      if (cached) {
        target = {
          studentId: cached.id,
          studentCode: cached.student_code,
          name: cached.name,
          classroom: cached.classroom,
        };
      }
    }

    if (!target) {
      if (!online) {
        toast.error("ออฟไลน์: ไม่พบรหัสในรายชื่อที่เก็บไว้", {
          description: 'กด "ซิงค์" ตอนออนไลน์เพื่ออัปเดตรายชื่อนักเรียน',
        });
      } else {
        toast.error(`ไม่พบนักเรียนรหัส ${code}`);
      }
      return;
    }

    // พิมพ์รหัสเอง = เสี่ยงพิมพ์ผิดเป็นคนอื่น → ต้องยืนยันชื่อก่อนบันทึกเสมอ
    if (source === "manual") {
      setConfirmItem(target);
      return;
    }

    await commitScan(target, "qr");
  }, [mode, online, commitScan]);

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = manual.trim();
    if (!v) return;
    await processCode(v, "manual");
    setManual("");
  };


  const todayCount = useMemo(() => recent.filter((r) => !r.queued || r.queued).length, [recent]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-2.5">
          <Button asChild size="icon" variant="ghost" className="h-9 w-9">
            <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight truncate">สแกน QR นักเรียน (มือถือ)</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              เวรประตู — เข้า/ออกโรงเรียน
            </div>
          </div>
          <Badge variant={online ? "secondary" : "destructive"} className="gap-1 h-7">
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? "ออนไลน์" : "ออฟไลน์"}
          </Badge>
        </div>

        <div className="max-w-2xl mx-auto px-3 pb-2.5">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full h-11">
              <TabsTrigger value="entry" className="gap-1.5 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <LogIn className="w-4 h-4" /> เข้าโรงเรียน
              </TabsTrigger>
              <TabsTrigger value="exit" className="gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                <LogOut className="w-4 h-4" /> ออกโรงเรียน
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-3 space-y-3">
        {/* Big scan button */}
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 space-y-3">
            <Button
              size="lg"
              onClick={() => setScannerOpen(true)}
              className="w-full h-20 text-lg gradient-primary gap-3 shadow-lg active:scale-[0.99]"
            >
              <ScanLine className="w-7 h-7" />
              เปิดกล้องสแกน QR
            </Button>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/70 dark:bg-white/5 py-2">
                <div className="text-xs text-muted-foreground">สแกนแล้ว</div>
                <div className="text-lg font-bold">{recent.length}</div>
              </div>
              <div className="rounded-lg bg-white/70 dark:bg-white/5 py-2">
                <div className="text-xs text-muted-foreground">รอซิงค์</div>
                <div className={`text-lg font-bold ${pending > 0 ? "text-amber-600" : ""}`}>{pending}</div>
              </div>
              <div className="rounded-lg bg-white/70 dark:bg-white/5 py-2">
                <div className="text-xs text-muted-foreground">โหมด</div>
                <div className="text-lg font-bold">{mode === "entry" ? "เข้า" : "ออก"}</div>
              </div>
            </div>
            {pending > 0 && (
              <Button variant="outline" onClick={doSync} disabled={syncing || !online} className="w-full gap-2 h-10">
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                ซิงค์ {pending} รายการที่ค้าง
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Manual entry */}
        <Card>
          <CardContent className="p-3">
            <form onSubmit={submitManual} className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="พิมพ์รหัสนักเรียน (กรณีสแกนไม่ผ่าน)"
                inputMode="text"
                className="h-10"
              />
              <Button type="submit" size="sm" disabled={!manual.trim()} className="h-10">บันทึก</Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent list */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                รายการล่าสุด
              </div>
              <Badge variant="outline">{recent.length}</Badge>
            </div>
            {recent.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">
                ยังไม่มีการสแกน — กดปุ่มด้านบนเพื่อเปิดกล้อง
              </div>
            ) : (
              <ul className="divide-y">
                {recent.map((r) => (
                  <li key={r.key} className="flex items-center gap-2 py-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      r.queued ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {r.queued ? <CloudUpload className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r.code} • {r.classroom} • {r.time}
                      </div>
                    </div>
                    <Badge variant={r.scan_type === "entry" ? "default" : "secondary"} className="text-[10px]">
                      {r.scan_type === "entry" ? "เข้า" : "ออก"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-[11px] text-muted-foreground pt-1">
          💡 บันทึกหน้านี้เป็น <b>Add to Home Screen</b> เพื่อเปิดใช้เร็วเหมือนแอป — สแกนต่อเนื่องได้แม้เน็ตหลุด
        </div>
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={processCode}
        continuous
        title={`สแกน QR — ${mode === "entry" ? "เข้าโรงเรียน" : "ออกโรงเรียน"}`}
      >
        {recent.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-muted/30">
            <ul className="divide-y text-xs">
              {recent.slice(0, 5).map((r) => (
                <li key={"m-" + r.key} className="flex items-center gap-2 px-2 py-1.5">
                  {r.queued
                    ? <CloudUpload className="w-3 h-3 text-amber-600" />
                    : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-muted-foreground">{r.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </BarcodeScanner>
    </div>
  );
}
