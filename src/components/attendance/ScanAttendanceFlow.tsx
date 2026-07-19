import { useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScanLine, CheckCircle2, XCircle, Clock, Send, RotateCcw, FlagOff, ListChecks, Users2 } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { cn } from "@/lib/utils";

export type AttendanceStatus = "present" | "absent" | "late" | "sick" | "leave";

interface Student {
  id: string;
  student_code?: string | null;
  prefix?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface Props {
  /** Eligible students for this session (already filtered by class/period) */
  students: Student[];
  /** Title shown on the scan dialog */
  scanTitle: string;
  /** Auto-open scanner once students are available */
  autoOpen?: boolean;
  /** Called when teacher confirms submission */
  onSubmit: (statusMap: Record<string, AttendanceStatus>) => Promise<void> | void;
  /** Optional context label (e.g. "ป.5/1 — คาบ 2 วิชาคณิตศาสตร์") */
  contextLabel?: string;
}

const STATUS_META: Record<AttendanceStatus, { th: string; en: string; cls: string }> = {
  present: { th: "มา", en: "Present", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  absent: { th: "ขาด", en: "Absent", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  late: { th: "สาย", en: "Late", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  sick: { th: "ป่วย", en: "Sick", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  leave: { th: "ลา", en: "Leave", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
};

export function ScanAttendanceFlow({ students, scanTitle, autoOpen = false, onSubmit, contextLabel }: Props) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [scanOpen, setScanOpen] = useState(autoOpen && students.length > 0);
  const [scanned, setScanned] = useState<Record<string, AttendanceStatus>>({}); // present/late
  const [scanLog, setScanLog] = useState<{ id: string; name: string; at: number }[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [unscannedStatus, setUnscannedStatus] = useState<Record<string, AttendanceStatus>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Manual mode: default all to present, teacher ticks off exceptions
  const [manualStatus, setManualStatus] = useState<Record<string, AttendanceStatus>>({});
  const getManual = (id: string): AttendanceStatus => manualStatus[id] || "present";
  const setOneManual = (id: string, v: AttendanceStatus) =>
    setManualStatus(p => ({ ...p, [id]: v }));
  const bulkSetManual = (v: AttendanceStatus) => {
    const m: Record<string, AttendanceStatus> = {};
    students.forEach(s => { m[s.id] = v; });
    setManualStatus(m);
  };
  const manualSummary = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };
    students.forEach(s => { c[getManual(s.id)]++; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, manualStatus]);

  const handleManualSubmit = async () => {
    setSubmitting(true);
    try {
      const map: Record<string, AttendanceStatus> = {};
      students.forEach(s => { map[s.id] = getManual(s.id); });
      await onSubmit(map);
      setManualStatus({});
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };


  const studentByCode = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach(s => { if (s.student_code) m[s.student_code.trim()] = s; });
    return m;
  }, [students]);

  const handleScan = useCallback(async (raw: string) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return;

    // 1) รหัสตรงๆ (case ปกติ: บาร์โค้ด CODE_128 ที่พิมพ์ student_code)
    let s: Student | undefined = studentByCode[trimmed];

    // 2) QR ที่เป็น URL หรือมี query — ต้อง extract/resolve เข้ากับ roster
    if (!s) {
      const { extractScannedCode, resolveScannedStudent } = await import("@/lib/resolveScannedStudent");
      const extracted = extractScannedCode(trimmed);
      if (extracted && studentByCode[extracted]) {
        s = studentByCode[extracted];
      } else {
        // สุดท้าย: lookup DB ด้วย auth_user_id / id — แล้ว match กลับเข้า roster
        const resolved = await resolveScannedStudent(trimmed);
        if (resolved) s = students.find((x) => x.id === resolved.id);
      }
    }

    if (!s) {
      toast.error(lang === "th" ? `ไม่พบนักเรียนจาก QR ในรายชื่อนี้` : `Not in roster`);
      return;
    }
    if (scanned[s.id]) {
      toast.info(lang === "th" ? `${s.first_name} ${s.last_name} แสกนแล้ว` : `${s.first_name} already scanned`);
      return;
    }
    setScanned(prev => ({ ...prev, [s!.id]: "present" }));
    setScanLog(prev => [{ id: s!.id, name: `${s!.prefix || ""}${s!.first_name} ${s!.last_name}`, at: Date.now() }, ...prev]);
    toast.success(`✅ ${s.first_name} ${s.last_name}`);
  }, [studentByCode, scanned, lang, students]);


  const unscanned = useMemo(() => students.filter(s => !scanned[s.id]), [students, scanned]);

  const handleFinishScan = () => {
    setScanOpen(false);
    // default unscanned → absent
    const defaults: Record<string, AttendanceStatus> = {};
    unscanned.forEach(s => { defaults[s.id] = unscannedStatus[s.id] || "absent"; });
    setUnscannedStatus(defaults);
    setReviewOpen(true);
  };

  const finalMap = useMemo(() => {
    const m: Record<string, AttendanceStatus> = { ...scanned };
    unscanned.forEach(s => { m[s.id] = unscannedStatus[s.id] || "absent"; });
    return m;
  }, [scanned, unscanned, unscannedStatus]);

  const summary = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };
    Object.values(finalMap).forEach(v => { c[v]++; });
    return c;
  }, [finalMap]);

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(finalMap);
      // reset
      setScanned({});
      setScanLog([]);
      setUnscannedStatus({});
      setReviewOpen(false);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setScanned({});
    setScanLog([]);
    setUnscannedStatus({});
    setReviewOpen(false);
    setScanOpen(true);
  };

  return (
    <div className="space-y-4">
      {contextLabel && (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium">{contextLabel}</div>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as "scan" | "manual")}>
        <TabsList>
          <TabsTrigger value="scan">
            <ScanLine className="w-4 h-4 mr-1" />
            {lang === "th" ? "แสกน QR" : "Scan"}
          </TabsTrigger>
          <TabsTrigger value="manual">
            <ListChecks className="w-4 h-4 mr-1" />
            {lang === "th" ? "ติ๊กด้วยตนเอง" : "Manual Tick"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Users2 className="w-3 h-3" />
                  {lang === "th" ? "รวม" : "Total"} {students.length}
                </Badge>
                {(Object.keys(STATUS_META) as AttendanceStatus[]).map(k => (
                  <Badge key={k} variant="outline" className={STATUS_META[k].cls}>
                    {STATUS_META[k][lang === "th" ? "th" : "en"]}: {manualSummary[k]}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkSetManual("present")}>
                  {lang === "th" ? "ทำเครื่องหมายมาทั้งหมด" : "Mark all present"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkSetManual("absent")}>
                  {lang === "th" ? "ทำเครื่องหมายขาดทั้งหมด" : "Mark all absent"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setManualStatus({})}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  {lang === "th" ? "ล้าง" : "Reset"}
                </Button>
                <div className="flex-1" />
                <Button onClick={() => setConfirmOpen(true)} disabled={students.length === 0}>
                  <Send className="w-4 h-4 mr-1" />
                  {lang === "th" ? "บันทึกเช็คชื่อ" : "Submit"}
                </Button>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-24">{lang === "th" ? "รหัส" : "Code"}</TableHead>
                      <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                      <TableHead className="w-[280px]">{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, i) => {
                      const cur = getManual(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                          <TableCell>{s.prefix || ""}{s.first_name} {s.last_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(Object.keys(STATUS_META) as AttendanceStatus[]).map(k => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setOneManual(s.id, k)}
                                  className={cn(
                                    "px-2 py-1 rounded-md text-xs font-medium border transition-all",
                                    cur === k
                                      ? STATUS_META[k].cls + " border-transparent ring-2 ring-primary/40"
                                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  {STATUS_META[k][lang === "th" ? "th" : "en"]}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="space-y-3">

      {/* Status card */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* context shown above */}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <ScanLine className="w-3 h-3" />
              {lang === "th" ? "รวม" : "Total"} {students.length}
            </Badge>
            <Badge variant="outline" className={STATUS_META.present.cls}>
              {lang === "th" ? "แสกนแล้ว" : "Scanned"} {Object.keys(scanned).length}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FlagOff className="w-3 h-3" />
              {lang === "th" ? "ยังไม่แสกน" : "Unscanned"} {unscanned.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setScanOpen(true)} disabled={students.length === 0}>
              <ScanLine className="w-4 h-4 mr-1" />
              {lang === "th" ? (Object.keys(scanned).length > 0 ? "แสกนต่อ" : "เริ่มแสกน") : "Scan"}
            </Button>
            <Button variant="outline" onClick={handleFinishScan} disabled={students.length === 0}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {lang === "th" ? "เสร็จสิ้นการแสกน" : "Finish Scanning"}
            </Button>
            {Object.keys(scanned).length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1" />
                {lang === "th" ? "เริ่มใหม่" : "Reset"}
              </Button>
            )}
          </div>

          {scanLog.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {lang === "th" ? "รายชื่อที่แสกนสำเร็จล่าสุด" : "Recently scanned"}
              </p>
              <ScrollArea className="max-h-32">
                <ul className="space-y-0.5">
                  {scanLog.slice(0, 20).map(e => (
                    <li key={e.id + e.at} className="text-sm text-green-700 dark:text-green-400">
                      ✓ {e.name}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner dialog (continuous) with live result panel */}
      <BarcodeScanner
        open={scanOpen}
        continuous
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        title={scanTitle}
      >
        <div className="rounded-md border p-2 max-h-40 overflow-y-auto bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {lang === "th" ? `แสกนแล้ว ${Object.keys(scanned).length}/${students.length} คน` : `Scanned ${Object.keys(scanned).length}/${students.length}`}
          </p>
          <ul className="space-y-0.5">
            {scanLog.slice(0, 10).map(e => (
              <li key={e.id + e.at} className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ {e.name}
              </li>
            ))}
          </ul>
        </div>
        <Button onClick={handleFinishScan} className="w-full mt-2">
          <CheckCircle2 className="w-4 h-4 mr-1" />
          {lang === "th" ? "เสร็จสิ้นการแสกน" : "Finish"}
        </Button>
      </BarcodeScanner>

      {/* Review dialog: unscanned → absent/leave/sick */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{lang === "th" ? "ผลการแสกน" : "Scan Results"}</DialogTitle>
            <DialogDescription>
              {lang === "th"
                ? "ระบุสถานะของนักเรียนที่ยังไม่ได้แสกน (ค่าเริ่มต้น: ขาด)"
                : "Set status for students who weren't scanned (default: absent)"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_META) as AttendanceStatus[]).map(k => (
              <Badge key={k} variant="outline" className={STATUS_META[k].cls}>
                {STATUS_META[k][lang === "th" ? "th" : "en"]}: {summary[k]}
              </Badge>
            ))}
          </div>

          {unscanned.length > 0 ? (
            <ScrollArea className="flex-1 min-h-0 max-h-[55vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-24">{lang === "th" ? "รหัส" : "Code"}</TableHead>
                    <TableHead>{lang === "th" ? "ชื่อ-สกุล" : "Name"}</TableHead>
                    <TableHead className="w-32">{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unscanned.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                      <TableCell>{s.prefix || ""}{s.first_name} {s.last_name}</TableCell>
                      <TableCell>
                        <Select
                          value={unscannedStatus[s.id] || "absent"}
                          onValueChange={(v) => setUnscannedStatus(p => ({ ...p, [s.id]: v as AttendanceStatus }))}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absent">{lang === "th" ? "ขาด" : "Absent"}</SelectItem>
                            <SelectItem value="leave">{lang === "th" ? "ลา" : "Leave"}</SelectItem>
                            <SelectItem value="sick">{lang === "th" ? "ป่วย" : "Sick"}</SelectItem>
                            <SelectItem value="late">{lang === "th" ? "สาย" : "Late"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-sm text-center text-green-600 py-4">
              ✅ {lang === "th" ? "แสกนครบทุกคนแล้ว" : "All scanned"}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviewOpen(false); setScanOpen(true); }}>
              <ScanLine className="w-4 h-4 mr-1" />
              {lang === "th" ? "กลับไปแสกนต่อ" : "Back to scan"}
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>
              <Send className="w-4 h-4 mr-1" />
              {lang === "th" ? "ยืนยันส่งข้อมูล" : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>


      {/* Confirm dialog (mode-aware) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "th" ? "ยืนยันการส่งข้อมูลเช็คชื่อ" : "Confirm submission"}</DialogTitle>
            <DialogDescription>
              {contextLabel || (lang === "th" ? "ตรวจสอบสรุปก่อนส่ง" : "Review summary")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(Object.keys(STATUS_META) as AttendanceStatus[]).map(k => (
              <div key={k} className="flex justify-between items-center text-sm">
                <Badge variant="outline" className={STATUS_META[k].cls}>
                  {STATUS_META[k][lang === "th" ? "th" : "en"]}
                </Badge>
                <span className="font-mono">{(mode === "manual" ? manualSummary : summary)[k]} {lang === "th" ? "คน" : ""}</span>
              </div>
            ))}
            <div className="flex justify-between items-center text-sm pt-2 border-t font-semibold">
              <span>{lang === "th" ? "รวมทั้งหมด" : "Total"}</span>
              <span>{students.length}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {lang === "th" ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button onClick={mode === "manual" ? handleManualSubmit : handleConfirmSubmit} disabled={submitting}>
              <Send className="w-4 h-4 mr-1" />
              {submitting ? (lang === "th" ? "กำลังส่ง..." : "Sending...") : (lang === "th" ? "ส่งข้อมูล" : "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

