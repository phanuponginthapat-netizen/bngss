import { useEffect, useRef, useState } from "react";
import { attachStreamToVideo } from "@/lib/cameraIos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanLine, User, Cpu, Camera, CheckCircle2, Undo2, RefreshCw, GraduationCap, Briefcase, Activity, Clock, BookOpen, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { confirmAction } from "@/lib/confirmAction";

type Student = { id: string; student_code: string; prefix: string; first_name: string; last_name: string; classrooms?: { name: string } | null };
type Personnel = { id: string; employee_code: string | null; prefix: string | null; first_name: string; last_name: string; department: string | null };
type Device = { id: string; asset_code: string; name: string; serial_number: string | null; status: string; brand?: string | null; model?: string | null; category?: string | null };
type Loan = {
  id: string; status: string; borrowed_at: string; returned_at: string | null;
  expected_return_at: string | null;
  borrow_photo_url?: string | null; return_photo_url?: string | null;
  quantity?: number | null; period_no?: number | null; subject_name?: string | null; teaching_topic?: string | null; session_date?: string | null; batch_id?: string | null;
  ict_devices: Device | null; students: Student | null; personnel: Personnel | null;
};

function LoanPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = url.match(/\/ict-loan-photos\/(.+?)(\?|$)/) || url.match(/\/asset-photos\/(.+?)(\?|$)/);
      if (match) {
        const bucket = url.includes("/ict-loan-photos/") ? "ict-loan-photos" : "asset-photos";
        const { data } = await supabase.storage.from(bucket).createSignedUrl(match[1], 3600);
        if (!cancelled) setSrc(data?.signedUrl || url);
      } else if (!cancelled) setSrc(url);
    })();
    return () => { cancelled = true; };
  }, [url]);
  if (!src) return <div className="w-10 h-10 rounded border bg-muted" />;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} className="w-10 h-10 object-cover rounded border" /></a>;
}

export default function IctLoanStationPage() {
  const [mode, setMode] = useState<"borrow" | "return">("borrow");
  const [borrowerType, setBorrowerType] = useState<"student" | "personnel">("student");
  const [scanOpen, setScanOpen] = useState<null | "borrower" | "device">(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  // ===== ฟิลด์ใหม่: จำนวน / คาบ / วิชา / หัวข้อ / วันใช้งาน =====
  const [quantity, setQuantity] = useState<number>(1);
  const [periodNo, setPeriodNo] = useState<string>("");
  const [subjectName, setSubjectName] = useState<string>("");
  const [teachingTopic, setTeachingTopic] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Loan[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [deviceStats, setDeviceStats] = useState({ available: 0, borrowed: 0, maintenance: 0, lost: 0, total: 0 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const SEL_LOAN = "id,status,borrowed_at,returned_at,expected_return_at,borrow_photo_url,return_photo_url,quantity,period_no,subject_name,teaching_topic,session_date,batch_id,ict_devices(id,asset_code,name,serial_number,status,category),students(id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(id,employee_code,prefix,first_name,last_name,department)";

  const loadLists = async () => {
    const { data: act } = await supabase.from("ict_loans")
      .select(SEL_LOAN)
      .eq("status", "active").order("borrowed_at", { ascending: false }).limit(50);
    setActiveLoans((act as any) || []);
    const { data: rec } = await supabase.from("ict_loans")
      .select(SEL_LOAN)
      .order("created_at", { ascending: false }).limit(20);
    setRecent((rec as any) || []);
    const { data: devs } = await supabase.from("ict_devices").select("status");
    const stats = { available: 0, borrowed: 0, maintenance: 0, lost: 0, total: 0 };
    (devs || []).forEach((d: any) => {
      stats.total++;
      if (d.status in stats) (stats as any)[d.status]++;
    });
    setDeviceStats(stats);
  };

  useEffect(() => {
    loadLists();
    const ch = supabase
      .channel("ict-station-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_devices" }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_loans" }, () => loadLists())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const reset = () => {
    setStudent(null); setPersonnel(null); setDevice(null); setActiveLoan(null); setPhoto(null); setNotes("");
    stopCamera();
  };

  // Resolve borrower by QR / code (student or personnel based on borrowerType)
  const resolveBorrower = async (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;
    if (borrowerType === "student") {
      const { data } = await supabase.from("students")
        .select("id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)")
        .eq("student_code", cleaned).maybeSingle();
      if (!data) { toast.error("ไม่พบนักเรียนรหัส " + cleaned); return; }
      setStudent(data as any); setPersonnel(null);
      toast.success("พบนักเรียน: " + data.first_name + " " + data.last_name);
      if (mode === "return") await autoFindLoan({ student_id: (data as any).id });
    } else {
      const { data } = await supabase.from("personnel")
        .select("id,employee_code,prefix,first_name,last_name,department")
        .eq("employee_code", cleaned).maybeSingle();
      if (!data) { toast.error("ไม่พบบุคลากรรหัส " + cleaned); return; }
      setPersonnel(data as any); setStudent(null);
      toast.success("พบบุคลากร: " + data.first_name + " " + data.last_name);
      if (mode === "return") await autoFindLoan({ personnel_id: (data as any).id });
    }
  };

  const autoFindLoan = async (filter: { student_id?: string; personnel_id?: string }) => {
    let q = supabase.from("ict_loans").select(SEL_LOAN).eq("status", "active");
    if (filter.student_id) q = q.eq("student_id", filter.student_id);
    if (filter.personnel_id) q = q.eq("personnel_id", filter.personnel_id);
    const { data: loans } = await q.order("borrowed_at", { ascending: false }).limit(1);
    const loan = loans && loans[0];
    if (loan) {
      setActiveLoan(loan as any);
      setDevice((loan as any).ict_devices);
      toast.info("พบรายการยืม: " + (loan as any).ict_devices?.name);
    }
  };

  // Resolve device by S/N or asset_code
  const resolveDevice = async (code: string) => {
    const cleaned = code.trim();
    if (!cleaned) return;
    // Escape PostgREST OR-filter special chars by wrapping in quotes; reject obvious break chars
    if (/["()]/.test(cleaned)) {
      toast.error("รหัส/SN มีอักขระไม่ถูกต้อง");
      return;
    }
    const safe = cleaned.replace(/,/g, "");
    const { data } = await supabase.from("ict_devices")
      .select("id,asset_code,name,serial_number,status,brand,model")
      .or(`serial_number.eq.${safe},asset_code.eq.${safe}`)
      .maybeSingle();
    if (!data) {
      toast.error("ไม่พบอุปกรณ์รหัส/SN: " + cleaned);
      return;
    }
    if (mode === "borrow" && data.status !== "available") {
      toast.error(`อุปกรณ์ "${data.name}" ไม่พร้อมยืม (สถานะ: ${data.status})`);
    }
    setDevice(data as any);
    toast.success("พบอุปกรณ์: " + data.name);

    // Return mode: find loan by device
    if (mode === "return" && !activeLoan) {
      const { data: loan } = await supabase.from("ict_loans")
        .select(SEL_LOAN)
        .eq("device_id", (data as any).id).eq("status", "active").maybeSingle();
      if (loan) {
        setActiveLoan(loan as any);
        if ((loan as any).students) { setStudent((loan as any).students); setBorrowerType("student"); }
        else if ((loan as any).personnel) { setPersonnel((loan as any).personnel); setBorrowerType("personnel"); }
      }
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(async () => {
        if (videoRef.current) {
          await attachStreamToVideo(videoRef.current, stream);
        }
      }, 50);
    } catch (e: any) {
      toast.error("เปิดกล้องไม่สำเร็จ: " + e.message);
    }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };
  const capture = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    setPhoto(canvas.toDataURL("image/jpeg", 0.78));
    stopCamera();
  };

  const uploadPhoto = async (dataUrl: string, prefix: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const targets = [
      { bucket: "ict-loan-photos", path: `${prefix}/${filename}` },
      { bucket: "asset-photos", path: `ict-loans/${prefix}/${filename}` },
    ] as const;

    let lastError: Error | null = null;

    for (const target of targets) {
      try {
        const result = await uploadPublicFileWithFallback(target.bucket, target.path, blob, {
          contentType: "image/jpeg",
        });
        if (result.usedFallback) {
          toast.warning("ระบบจัดเก็บรูปมีปัญหาชั่วคราว จึงบันทึกรูปแบบสำรองไว้ก่อน");
        }
        return result.publicUrl;
      } catch (error: any) {
        lastError = error;
        break;
      }
    }

    throw lastError ?? new Error("อัปโหลดรูปไม่สำเร็จ");
  };

  const submit = async () => {
    const borrower = borrowerType === "student" ? student : personnel;
    if (!borrower) return toast.error(borrowerType === "student" ? "กรุณาสแกนบัตรนักเรียน" : "กรุณาเลือก/สแกนรหัสบุคลากร");
    if (!device) return toast.error("กรุณาสแกน S/N อุปกรณ์");
    if (mode === "borrow" && quantity < 1) return toast.error("จำนวนต้องอย่างน้อย 1");
    if (!photo && mode === "return") return toast.error("กรุณาถ่ายภาพตอนคืน");
    setBusy(true);
    try {
      const photoUrl = photo ? await uploadPhoto(photo, mode === "borrow" ? "borrow" : "return") : null;
      const { data: { user } } = await supabase.auth.getUser();
      if (mode === "borrow") {
        const due = dueDate ? new Date(dueDate + "T23:59:59").toISOString() : null;
        if (due && new Date(due) < new Date()) throw new Error("กำหนดคืนต้องเป็นวันที่ในอนาคต");

        // === หาอุปกรณ์ available ทั้งหมดที่ "ชื่อเดียวกัน" (รวมตัวที่สแกน) ===
        const { data: pool } = await supabase.from("ict_devices")
          .select("id,status,name,asset_code")
          .eq("status", "available")
          .eq("name", device.name);
        const poolIds = (pool || []).map((p: any) => p.id);
        // ดันตัวที่สแกนขึ้นมาก่อน
        const ordered = [device.id, ...poolIds.filter((id) => id !== device.id)];
        if (ordered.length < quantity) {
          throw new Error(`มีอุปกรณ์ "${device.name}" พร้อมยืมเพียง ${ordered.length} เครื่อง (ขอ ${quantity})`);
        }
        const pickIds = ordered.slice(0, quantity);

        // กันยืมซ้ำในแต่ละเครื่อง
        const { count: dupDev } = await supabase.from("ict_loans")
          .select("id", { count: "exact", head: true })
          .in("device_id", pickIds).eq("status", "active");
        if ((dupDev || 0) > 0) throw new Error("มีบางเครื่องในล็อตนี้ถูกยืมไปแล้ว กรุณารีเฟรช");

        const batchId = (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random()}`;
        const rows = pickIds.map((did) => ({
          device_id: did,
          student_id: borrowerType === "student" ? student!.id : null,
          personnel_id: borrowerType === "personnel" ? personnel!.id : null,
          borrow_photo_url: photoUrl,
          borrow_notes: notes || null,
          borrowed_by: user?.id || null,
          expected_return_at: due,
          status: "active" as const,
          quantity: quantity,
          period_no: periodNo ? Number(periodNo) : null,
          subject_name: subjectName || null,
          teaching_topic: teachingTopic || null,
          session_date: sessionDate || null,
          batch_id: batchId,
        }));
        const { error } = await supabase.from("ict_loans").insert(rows);
        if (error) throw error;
        toast.success(`บันทึกการยืมเรียบร้อย (${quantity} เครื่อง)`);
      } else {
        if (!activeLoan) throw new Error("ไม่พบรายการยืมที่ค้างอยู่");
        const { data: freshLoan } = await supabase.from("ict_loans")
          .select("id,status,device_id,student_id,personnel_id")
          .eq("id", activeLoan.id).maybeSingle();
        if (!freshLoan) throw new Error("ไม่พบรายการยืมในระบบ");
        if (freshLoan.status !== "active") throw new Error("รายการนี้ถูกคืนไปแล้ว");
        if (freshLoan.device_id !== device.id) {
          throw new Error("S/N อุปกรณ์ไม่ตรงกับรายการยืม (กันคืนผิดล็อต)");
        }
        const expectedBorrowerId = borrowerType === "student" ? student?.id : personnel?.id;
        const actualBorrowerId = borrowerType === "student" ? freshLoan.student_id : freshLoan.personnel_id;
        if (expectedBorrowerId && actualBorrowerId && expectedBorrowerId !== actualBorrowerId) {
          throw new Error("ผู้คืนไม่ตรงกับผู้ที่ยืม");
        }
        const { error, data: updated } = await supabase.from("ict_loans").update({
          status: "returned" as const,
          returned_at: new Date().toISOString(),
          returned_by: user?.id || null,
          return_photo_url: photoUrl,
          return_notes: notes || null,
          condition_on_return: notes || null,
        }).eq("id", activeLoan.id).eq("status", "active").select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) throw new Error("รายการถูกอัปเดตไปแล้ว (อาจถูกคืนซ้ำ)");
        toast.success("บันทึกการคืนเรียบร้อย");
      }
      reset();
      loadLists();
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // ===== ยืนยันคืนเร็ว (จากตารางรายการยืม) =====
  const quickReturn = async (loan: Loan, batch = false) => {
    const target = batch && loan.batch_id ? `ทั้งล็อต (batch)` : `1 เครื่อง`;
    const ok = await confirmAction({
      title: "ยืนยันการคืนอุปกรณ์",
      text: `คืน ${loan.ict_devices?.name || "อุปกรณ์"} (${target}) กลับเข้าคลัง?`,
      confirmText: "ยืนยันคืน",
    });
    if (!ok) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        status: "returned" as const,
        returned_at: new Date().toISOString(),
        returned_by: user?.id || null,
        return_notes: "ยืนยันคืนจากแถบรายการ",
        condition_on_return: "ปกติ",
      };
      let q = supabase.from("ict_loans").update(payload).eq("status", "active");
      if (batch && loan.batch_id) q = q.eq("batch_id", loan.batch_id);
      else q = q.eq("id", loan.id);
      const { error, data } = await q.select("id");
      if (error) throw error;
      toast.success(`คืนสำเร็จ ${data?.length || 0} เครื่อง`);
      loadLists();
    } catch (e: any) {
      toast.error(e.message || "คืนไม่สำเร็จ");
    }
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("th-TH") : "-";
  const isOverdue = (l: Loan) => l.status === "active" && l.expected_return_at && new Date(l.expected_return_at) < new Date();

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">ยืม-คืนอุปกรณ์ ICT</h1>
          <p className="text-sm text-muted-foreground">สแกน QR นักเรียน → สแกน S/N อุปกรณ์ → ถ่ายภาพ</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadLists(); }}><RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช</Button>
      </div>

      {/* Real-time device status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary animate-pulse" /> สถานะอุปกรณ์ (เรียลไทม์)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground">ทั้งหมด</div>
              <div className="text-2xl font-bold">{deviceStats.total}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-success/10">
              <div className="text-xs text-muted-foreground">ว่าง</div>
              <div className="text-2xl font-bold text-success">{deviceStats.available}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-info/10">
              <div className="text-xs text-muted-foreground">ถูกยืม</div>
              <div className="text-2xl font-bold text-info">{deviceStats.borrowed}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-warning/10">
              <div className="text-xs text-muted-foreground">ซ่อม/เสีย</div>
              <div className="text-2xl font-bold text-warning">{deviceStats.maintenance}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-destructive/10">
              <div className="text-xs text-muted-foreground">สูญหาย</div>
              <div className="text-2xl font-bold text-destructive">{deviceStats.lost}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); reset(); }}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="borrow"><CheckCircle2 className="w-4 h-4 mr-1" /> ยืม</TabsTrigger>
          <TabsTrigger value="return"><Undo2 className="w-4 h-4 mr-1" /> คืน</TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Step 1: Student */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> 1. ผู้ยืม</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button size="sm" variant={borrowerType === "student" ? "default" : "outline"}
                    onClick={() => { setBorrowerType("student"); setStudent(null); setPersonnel(null); }}>
                    <GraduationCap className="w-4 h-4 mr-1" /> นักเรียน
                  </Button>
                  <Button size="sm" variant={borrowerType === "personnel" ? "default" : "outline"}
                    onClick={() => { setBorrowerType("personnel"); setStudent(null); setPersonnel(null); }}>
                    <Briefcase className="w-4 h-4 mr-1" /> ครู/บุคลากร
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={borrowerType === "student" ? "รหัสนักเรียน" : "รหัสบุคลากร"}
                    onKeyDown={(e) => { if (e.key === "Enter") resolveBorrower((e.target as HTMLInputElement).value); }}
                  />
                  <Button variant="outline" onClick={() => setScanOpen("borrower")}><ScanLine className="w-4 h-4" /></Button>
                </div>
                {student && (
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="font-medium">{student.prefix}{student.first_name} {student.last_name}</div>
                    <div className="text-xs text-muted-foreground">{student.student_code} · {student.classrooms?.name || "-"}</div>
                  </div>
                )}
                {personnel && (
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="font-medium">{personnel.prefix || ""}{personnel.first_name} {personnel.last_name}</div>
                    <div className="text-xs text-muted-foreground">{personnel.employee_code || "-"} · {personnel.department || "-"}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Device */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Cpu className="w-4 h-4" /> 2. อุปกรณ์ (S/N)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="S/N หรือรหัสครุภัณฑ์" onKeyDown={(e) => { if (e.key === "Enter") resolveDevice((e.target as HTMLInputElement).value); }} />
                  <Button variant="outline" onClick={() => setScanOpen("device")}><ScanLine className="w-4 h-4" /></Button>
                </div>
                {device && (
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{device.asset_code} · S/N: {device.serial_number || "-"}</div>
                    <Badge variant="outline" className="mt-1">{device.status}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Photo */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Camera className="w-4 h-4" /> 3. ถ่ายภาพ{mode === "borrow" ? "ตอนยืม" : "ตอนคืน"}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-lg overflow-hidden bg-black/80 aspect-square flex items-center justify-center">
                    {cameraOpen ? (
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    ) : photo ? (
                      <img src={photo} alt="captured" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-muted-foreground text-sm">ยังไม่มีภาพ</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {!cameraOpen ? (
                        <Button onClick={startCamera} variant="outline"><Camera className="w-4 h-4 mr-1" /> เปิดกล้อง</Button>
                      ) : (
                        <>
                          <Button onClick={capture}><Camera className="w-4 h-4 mr-1" /> ถ่าย</Button>
                          <Button onClick={stopCamera} variant="outline">ยกเลิก</Button>
                        </>
                      )}
                      {photo && !cameraOpen && <Button variant="outline" onClick={() => { setPhoto(null); startCamera(); }}>ถ่ายใหม่</Button>}
                    </div>
                    <div>
                      <Label>หมายเหตุ / สภาพอุปกรณ์</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === "borrow" ? "สภาพก่อนยืม" : "สภาพเมื่อคืน"} />
                    </div>
                    {mode === "borrow" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>จำนวน (เครื่อง)</Label>
                            <Input type="number" min={1} max={50} value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
                          </div>
                          <div>
                            <Label>คาบที่</Label>
                            <Input type="number" min={1} max={12} value={periodNo}
                              placeholder="เช่น 3"
                              onChange={(e) => setPeriodNo(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <Label>วันที่ใช้สอน</Label>
                          <BEDatePicker value={sessionDate} onChange={(v) => setSessionDate(v)} />
                        </div>
                        <div>
                          <Label>วิชาที่สอน</Label>
                          <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="เช่น คอมพิวเตอร์, วิทย์ฯ" />
                        </div>
                        <div>
                          <Label>หัวข้อการสอน</Label>
                          <Input value={teachingTopic} onChange={(e) => setTeachingTopic(e.target.value)} placeholder="เช่น เขียนโปรแกรม Scratch" />
                        </div>
                        <div>
                          <Label>กำหนดคืน</Label>
                          <BEDatePicker value={dueDate} onChange={(v) => setDueDate(v)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>ล้าง</Button>
              <Button onClick={submit} disabled={busy || !(student || personnel) || !device || (mode === "return" && !photo)}>
                {busy ? "กำลังบันทึก..." : mode === "borrow" ? `บันทึกการยืม (${quantity} เครื่อง)` : "บันทึกการคืน"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Active loans list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            รายการยืมที่ยังไม่คืน ({activeLoans.length})
            {activeLoans.filter(isOverdue).length > 0 && (
              <Badge variant="destructive">เกินกำหนด {activeLoans.filter(isOverdue).length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ผู้ยืม</TableHead>
              <TableHead>อุปกรณ์</TableHead>
              <TableHead>คาบ/วิชา/หัวข้อ</TableHead>
              <TableHead>ยืมเมื่อ</TableHead>
              <TableHead>กำหนดคืน</TableHead>
              <TableHead className="text-right">การจัดการ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {activeLoans.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ไม่มีรายการค้างคืน</TableCell></TableRow>
              ) : activeLoans.map((l) => (
                <TableRow key={l.id} className={isOverdue(l) ? "bg-destructive/5" : ""}>
                  <TableCell>
                    {l.students ? (<>
                      <div>{l.students.prefix}{l.students.first_name} {l.students.last_name}</div>
                      <div className="text-xs text-muted-foreground">{l.students.student_code}</div>
                    </>) : l.personnel ? (<>
                      <div>{l.personnel.prefix || ""}{l.personnel.first_name} {l.personnel.last_name}</div>
                      <div className="text-xs text-muted-foreground">{l.personnel.employee_code || "-"} · {l.personnel.department || ""}</div>
                    </>) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{l.ict_devices?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.ict_devices?.serial_number || l.ict_devices?.asset_code || "-"}</div>
                    {l.batch_id && (l.quantity || 1) > 1 && (
                      <Badge variant="secondary" className="text-xs mt-1">ล็อต {l.quantity} เครื่อง</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.period_no ? <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> คาบ {l.period_no}</div> : null}
                    {l.subject_name ? <div className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {l.subject_name}</div> : null}
                    {l.teaching_topic ? <div className="text-muted-foreground truncate max-w-[180px]">{l.teaching_topic}</div> : null}
                    {!l.period_no && !l.subject_name && !l.teaching_topic && <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-sm">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-sm">
                    {l.expected_return_at ? (
                      <span className={isOverdue(l) ? "text-destructive font-medium" : ""}>
                        {fmt(l.expected_return_at)} {isOverdue(l) && "⚠️"}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => quickReturn(l, false)}>
                        <PackageCheck className="w-3 h-3 mr-1" /> คืน
                      </Button>
                      {l.batch_id && (l.quantity || 1) > 1 && (
                        <Button size="sm" variant="secondary" onClick={() => quickReturn(l, true)}>
                          คืนทั้งล็อต
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ประวัติล่าสุด</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>ผู้ยืม</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>ยืม</TableHead><TableHead>คืน</TableHead><TableHead>สถานะ</TableHead><TableHead>ภาพ ยืม / คืน</TableHead></TableRow></TableHeader>
            <TableBody>
              {recent.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.students ? `${l.students.first_name} ${l.students.last_name}` : l.personnel ? `${l.personnel.first_name} ${l.personnel.last_name}` : "-"}</TableCell>
                  <TableCell>{l.ict_devices?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-xs">{fmt(l.returned_at)}</TableCell>
                  <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {l.borrow_photo_url ? <LoanPhoto url={l.borrow_photo_url} alt="ตอนยืม" /> : <div className="w-10 h-10 rounded border bg-muted/30 text-[9px] text-muted-foreground flex items-center justify-center">ยืม</div>}
                      {l.return_photo_url ? <LoanPhoto url={l.return_photo_url} alt="ตอนคืน" /> : <div className="w-10 h-10 rounded border bg-muted/30 text-[9px] text-muted-foreground flex items-center justify-center">คืน</div>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scanOpen !== null}
        onClose={() => setScanOpen(null)}
        onScan={(code) => {
          if (scanOpen === "borrower") resolveBorrower(code);
          else if (scanOpen === "device") resolveDevice(code);
          setScanOpen(null);
        }}
        title={scanOpen === "borrower" ? (borrowerType === "student" ? "สแกน QR บัตรนักเรียน" : "สแกน QR บัตรบุคลากร") : "สแกน S/N อุปกรณ์"}
      />
    </div>
  );
}