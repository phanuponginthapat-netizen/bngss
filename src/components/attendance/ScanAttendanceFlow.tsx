import { useState, useMemo, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScanLine, CheckCircle2, XCircle, Clock, Send, RotateCcw, FlagOff, Keyboard } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";

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
  present: { th: "มา", en: "Present", cls: "bg-success-soft text-success-soft-foreground" },
  absent: { th: "ขาด", en: "Absent", cls: "bg-danger-soft text-danger-soft-foreground" },
  late: { th: "สาย", en: "Late", cls: "bg-warning-soft text-warning-soft-foreground" },
  sick: { th: "ป่วย", en: "Sick", cls: "bg-info-soft text-info-soft-foreground" },
  leave: { th: "ลา", en: "Leave", cls: "bg-info-soft text-info-soft-foreground" },
};

export function ScanAttendanceFlow({ students, scanTitle, autoOpen = false, onSubmit, contextLabel }: Props) {
  const { lang } = useLanguage();
  const [scanOpen, setScanOpen] = useState(autoOpen && students.length > 0);
  const [scanned, setScanned] = useState<Record<string, AttendanceStatus>>({}); // present/late
  const [scanLog, setScanLog] = useState<{ id: string; name: string; at: number }[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [unscannedStatus, setUnscannedStatus] = useState<Record<string, AttendanceStatus>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);

  const studentByCode = useMemo(() => {
    const m: Record<string, Student> = {};
    students.forEach(s => { if (s.student_code) m[s.student_code.trim()] = s; });
    return m;
  }, [students]);

  const handleScan = useCallback((raw: string) => {
    const code = (raw || "").trim();
    if (!code) return;
    const s = studentByCode[code];
    if (!s) {
      toast.error(lang === "th" ? `ไม่พบนักเรียนรหัส ${code} ในรายชื่อนี้` : `Not in roster: ${code}`);
      return;
    }
    if (scanned[s.id]) {
      toast.info(lang === "th" ? `${s.first_name} ${s.last_name} แสกนแล้ว` : `${s.first_name} already scanned`);
      return;
    }
    setScanned(prev => ({ ...prev, [s.id]: "present" }));
    setScanLog(prev => [{ id: s.id, name: `${s.prefix || ""}${s.first_name} ${s.last_name}`, at: Date.now() }, ...prev]);
    toast.success(`✅ ${s.first_name} ${s.last_name}`);
  }, [studentByCode, scanned, lang]);

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
      {/* Status card */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          {contextLabel && (
            <p className="text-sm font-medium text-foreground">{contextLabel}</p>
          )}
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

          {/* Shortcut: ข้ามการแสกน — เปิด review พร้อมเติมสถานะให้ทุกคนในคลิกเดียว */}
          {Object.keys(scanned).length === 0 && students.length > 0 && (
            <div className="rounded-md border border-dashed bg-success-soft/30 p-2.5">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {lang === "th"
                  ? `กรอกเร็ว — ตั้งสถานะทั้งห้อง (${students.length} คน) แล้วปรับเฉพาะรายคนทีหลัง:`
                  : `Quick fill — set status for the whole class (${students.length}) then adjust:`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(["present","absent","leave","sick","late"] as AttendanceStatus[]).map(st => (
                  <Button
                    key={st}
                    size="sm"
                    variant="outline"
                    className={`h-7 text-xs ${STATUS_META[st].cls}`}
                    onClick={() => {
                      const next: Record<string, AttendanceStatus> = {};
                      students.forEach(s => { next[s.id] = st; });
                      setUnscannedStatus(next);
                      setReviewOpen(true);
                    }}
                  >
                    {lang === "th" ? `${STATUS_META[st].th}ทั้งห้อง` : `All ${STATUS_META[st].en}`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Manual student-code entry (fallback / no camera) */}
          <div className="rounded-md border border-dashed bg-muted/20 p-3">
            <Label className="text-xs flex items-center gap-1.5 mb-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              {lang === "th" ? "ป้อนรหัสประจำตัวนักเรียน (สำรองตอนกล้องไม่พร้อม)" : "Enter student code (camera fallback)"}
            </Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const code = manualCode.trim();
                if (!code) return;
                handleScan(code);
                setManualCode("");
                manualInputRef.current?.focus();
              }}
            >
              <Input
                ref={manualInputRef}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={lang === "th" ? "เช่น 12345" : "e.g. 12345"}
                autoComplete="off"
                inputMode="numeric"
                className="font-mono"
                disabled={students.length === 0}
              />
              <Button type="submit" variant="secondary" disabled={!manualCode.trim() || students.length === 0}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {lang === "th" ? "บันทึก" : "Add"}
              </Button>
            </form>
          </div>

          {scanLog.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {lang === "th" ? "รายชื่อที่แสกนสำเร็จล่าสุด" : "Recently scanned"}
              </p>
              <ScrollArea className="max-h-32">
                <ul className="space-y-0.5">
                  {scanLog.slice(0, 20).map(e => (
                    <li key={e.id + e.at} className="text-sm text-success dark:text-success">
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
              <li key={e.id + e.at} className="text-sm text-success dark:text-success font-medium">
                ✓ {e.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Manual entry inside scanner dialog (works even when camera not available) */}
        <div className="rounded-md border border-dashed bg-muted/20 p-2 mt-2">
          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            {lang === "th" ? "ป้อนรหัสนักเรียน" : "Enter student code"}
          </Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = manualCode.trim();
              if (!code) return;
              handleScan(code);
              setManualCode("");
              manualInputRef.current?.focus();
            }}
          >
            <Input
              ref={manualInputRef}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={lang === "th" ? "เช่น 12345" : "e.g. 12345"}
              autoComplete="off"
              inputMode="numeric"
              className="font-mono h-9"
              autoFocus
            />
            <Button type="submit" variant="secondary" size="sm" disabled={!manualCode.trim()}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {lang === "th" ? "เพิ่ม" : "Add"}
            </Button>
          </form>
        </div>

        <Button onClick={handleFinishScan} className="w-full mt-2">
          <CheckCircle2 className="w-4 h-4 mr-1" />
          {lang === "th" ? "เสร็จสิ้นการแสกน" : "Finish"}
        </Button>
      </BarcodeScanner>

      {/* Review dialog: unscanned → absent/leave/sick */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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

          {/* Quick bulk-fill: ตั้งสถานะทุกคนที่ยังไม่แสกนพร้อมกัน */}
          {unscanned.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {lang === "th"
                  ? `เติมสถานะให้คนที่ยังไม่แสกน (${unscanned.length} คน) เร็วๆ:`
                  : `Bulk-fill unscanned (${unscanned.length}):`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(["present","absent","leave","sick","late"] as AttendanceStatus[]).map(st => (
                  <Button
                    key={st}
                    size="sm"
                    variant="outline"
                    className={`h-7 text-xs ${STATUS_META[st].cls}`}
                    onClick={() => {
                      const next: Record<string, AttendanceStatus> = {};
                      unscanned.forEach(s => { next[s.id] = st; });
                      setUnscannedStatus(next);
                      toast.success(
                        lang === "th"
                          ? `ตั้ง "${STATUS_META[st].th}" ให้ ${unscanned.length} คน`
                          : `Set ${STATUS_META[st].en} for ${unscanned.length}`
                      );
                    }}
                  >
                    {lang === "th" ? `${STATUS_META[st].th}ทุกคน` : `All ${STATUS_META[st].en}`}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
            <p className="text-sm text-center text-success py-4">
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

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
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
                <span className="font-mono">{summary[k]} {lang === "th" ? "คน" : ""}</span>
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
            <Button onClick={handleConfirmSubmit} disabled={submitting}>
              <Send className="w-4 h-4 mr-1" />
              {submitting ? (lang === "th" ? "กำลังส่ง..." : "Sending...") : (lang === "th" ? "ส่งข้อมูล" : "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
