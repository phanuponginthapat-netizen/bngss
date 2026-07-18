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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScanLine, User, Cpu, Camera, CheckCircle2, Undo2, RefreshCw, GraduationCap, Briefcase, Activity, Package, Clock } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";

type Student = { id: string; student_code: string; prefix: string; first_name: string; last_name: string; classrooms?: { name: string } | null };
type Personnel = { id: string; employee_code: string | null; prefix: string | null; first_name: string; last_name: string; department: string | null };
type Device = { id: string; asset_code: string; name: string; serial_number: string | null; status: string; brand?: string | null; model?: string | null };
type Subject = { id: string; code: string; name_th: string };
type Classroom = { id: string; name: string };
type Loan = {
  id: string; status: string; borrowed_at: string; returned_at: string | null;
  expected_return_at: string | null;
  period_number: number | null; teaching_topic: string | null; batch_id: string | null;
  subjects?: { code: string; name_th: string } | null;
  classrooms?: { name: string } | null;
  ict_devices: Device | null; students: Student | null; personnel: Personnel | null;
};

export default function IctLoanStationPage() {
  const [mode, setMode] = useState<"borrow" | "return" | "bulk">("borrow");
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
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Loan[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [deviceStats, setDeviceStats] = useState({ available: 0, borrowed: 0, maintenance: 0, lost: 0, total: 0 });

  // Bulk teacher borrow
  const [bulkModel, setBulkModel] = useState<string>("");
  const [bulkQty, setBulkQty] = useState<number>(1);
  const [bulkPeriod, setBulkPeriod] = useState<number>(1);
  const [bulkSubjectId, setBulkSubjectId] = useState<string>("");
  const [bulkClassroomId, setBulkClassroomId] = useState<string>("");
  const [bulkTopic, setBulkTopic] = useState<string>("");
  const [bulkDurationMin, setBulkDurationMin] = useState<number>(50);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [bulkDate, setBulkDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [teacherSchedules, setTeacherSchedules] = useState<any[]>([]);
  const [bulkScheduleId, setBulkScheduleId] = useState<string>("");
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [borrowerQuery, setBorrowerQuery] = useState("");
  const [borrowerFocused, setBorrowerFocused] = useState(false);


  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const loadLists = async () => {
    const sel = "id,status,borrowed_at,returned_at,expected_return_at,period_number,teaching_topic,batch_id,subjects(code,name_th),classrooms!ict_loans_classroom_id_fkey(name),ict_devices(id,asset_code,name,serial_number,status),students(id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(id,employee_code,prefix,first_name,last_name,department)";
    const { data: act } = await supabase.from("ict_loans")
      .select(sel)
      .eq("status", "active").order("borrowed_at", { ascending: false }).limit(50);
    setActiveLoans((act as any) || []);
    const { data: rec } = await supabase.from("ict_loans")
      .select(sel)
      .order("created_at", { ascending: false }).limit(20);
    setRecent((rec as any) || []);
    const { data: devs } = await supabase.from("ict_devices").select("id,asset_code,name,serial_number,status,brand,model");
    const stats = { available: 0, borrowed: 0, maintenance: 0, lost: 0, total: 0 };
    (devs || []).forEach((d: any) => {
      stats.total++;
      if (d.status in stats) (stats as any)[d.status]++;
    });
    setDeviceStats(stats);
    setAvailableDevices(((devs || []) as any).filter((d: any) => d.status === "available"));
  };

  const loadRefs = async () => {
    const [{ data: subs }, { data: cls }, { data: pers }] = await Promise.all([
      supabase.from("subjects").select("id,code,name_th").order("code"),
      supabase.from("classrooms").select("id,name").order("name"),
      supabase.from("personnel").select("id,employee_code,prefix,first_name,last_name,department").eq("status", "active").order("first_name"),
    ]);
    setSubjects((subs as any) || []);
    setClassrooms((cls as any) || []);
    setPersonnelList((pers as any) || []);
  };


  useEffect(() => {
    loadLists();
    loadRefs();
    const ch = supabase
      .channel("ict-station-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_devices" }, () => loadLists())
      .on("postgres_changes", { event: "*", schema: "public", table: "ict_loans" }, () => loadLists())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Load teacher schedules for selected date when personnel changes (bulk mode)
  useEffect(() => {
    const run = async () => {
      if (!personnel || mode !== "bulk") { setTeacherSchedules([]); return; }
      const dow = new Date(bulkDate + "T00:00:00").getDay(); // 0=Sun..6=Sat
      const fullName = `${personnel.first_name} ${personnel.last_name}`.trim();
      const { data } = await supabase
        .from("schedules")
        .select("id, period, start_time, end_time, classroom_id, subject_id, classrooms(name), subjects(code, name_th)")
        .eq("day_of_week", dow)
        .or(`teacher_id.eq.${personnel.id},teacher_name.eq.${fullName}`)
        .order("period", { ascending: true });
      setTeacherSchedules(data || []);
      setBulkScheduleId("");
    };
    run();
  }, [personnel?.id, bulkDate, mode]);

  const applySchedule = (id: string) => {
    setBulkScheduleId(id);
    const s = teacherSchedules.find((x) => x.id === id);
    if (!s) return;
    setBulkPeriod(s.period);
    if (s.subject_id) setBulkSubjectId(s.subject_id);
    if (s.classroom_id) setBulkClassroomId(s.classroom_id);
    if (s.start_time && s.end_time) {
      const [h1, m1] = s.start_time.split(":").map(Number);
      const [h2, m2] = s.end_time.split(":").map(Number);
      const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (mins > 0) setBulkDurationMin(mins);
    }
  };

  const reset = () => {
    setStudent(null); setPersonnel(null); setDevice(null); setActiveLoan(null); setPhoto(null); setNotes("");
    setBulkTopic(""); setBulkQty(1);
    stopCamera();
  };

  // Group models for bulk picker (name + brand + model)
  const modelGroups = (() => {
    const map = new Map<string, { key: string; label: string; available: Device[] }>();
    for (const d of availableDevices) {
      const key = `${d.name}||${d.brand || ""}||${d.model || ""}`;
      const label = `${d.name}${d.model ? ` (${d.model})` : ""}`;
      const g = map.get(key) || { key, label, available: [] };
      g.available.push(d);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();

  const submitBulk = async () => {
    if (borrowerType !== "personnel" || !personnel) return toast.error("ระบุครู/บุคลากรผู้ยืม");
    if (!bulkModel) return toast.error("เลือกรุ่นอุปกรณ์");
    if (!bulkScheduleId) return toast.error("เลือกคาบจากตารางสอน");
    if (!bulkSubjectId) return toast.error("ไม่พบรายวิชาในคาบที่เลือก");
    if (!bulkClassroomId) return toast.error("ไม่พบห้องเรียนในคาบที่เลือก");
    if (!bulkTopic.trim()) return toast.error("ระบุหัวข้อการสอน");
    if (bulkQty < 1) return toast.error("จำนวนต้องมากกว่า 0");
    const group = modelGroups.find((g) => g.key === bulkModel);
    if (!group) return toast.error("ไม่พบรุ่นที่เลือก");
    if (group.available.length < bulkQty) return toast.error(`ว่างเพียง ${group.available.length} เครื่อง`);
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const batchId = (crypto as any).randomUUID();
      const sch = teacherSchedules.find((x) => x.id === bulkScheduleId);
      const dueIso = sch?.end_time
        ? new Date(`${bulkDate}T${sch.end_time}`).toISOString()
        : new Date(Date.now() + bulkDurationMin * 60000).toISOString();
      const picked = group.available.slice(0, bulkQty);
      // Re-validate availability
      const { data: fresh } = await supabase.from("ict_devices")
        .select("id,status").in("id", picked.map((d) => d.id));
      const stillFree = (fresh || []).filter((d: any) => d.status === "available").map((d: any) => d.id);
      if (stillFree.length < bulkQty) throw new Error("อุปกรณ์บางเครื่องถูกยืมไปแล้ว กรุณารีเฟรช");
      const rows = stillFree.slice(0, bulkQty).map((id) => ({
        device_id: id,
        personnel_id: personnel.id,
        student_id: null,
        borrow_notes: bulkTopic,
        borrowed_by: user?.id || null,
        expected_return_at: dueIso,
        status: "active" as const,
        batch_id: batchId,
        quantity: bulkQty,
        period_number: bulkPeriod,
        subject_id: bulkSubjectId,
        classroom_id: bulkClassroomId,
        teaching_topic: bulkTopic,
      }));
      const { error } = await supabase.from("ict_loans").insert(rows);
      if (error) throw error;
      toast.success(`ยืม ${bulkQty} เครื่องเรียบร้อย`);
      reset();
      loadLists();
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const returnBatch = async (batchId: string) => {
    if (!confirm("ยืนยันการคืนอุปกรณ์ทั้งกลุ่ม?")) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ict_loans").update({
        status: "returned",
        returned_at: new Date().toISOString(),
        returned_by: user?.id || null,
      }).eq("batch_id", batchId).eq("status", "active");
      if (error) throw error;
      toast.success("คืนอุปกรณ์ทั้งกลุ่มเรียบร้อย");
      loadLists();
    } catch (e: any) {
      toast.error(e.message || "คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const returnSingle = async (loanId: string) => {
    if (!confirm("ยืนยันการคืนอุปกรณ์นี้?")) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ict_loans").update({
        status: "returned",
        returned_at: new Date().toISOString(),
        returned_by: user?.id || null,
      }).eq("id", loanId).eq("status", "active");
      if (error) throw error;
      toast.success("คืนเรียบร้อย");
      loadLists();
    } catch (e: any) {
      toast.error(e.message || "คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
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
      // Try employee_code first, then fall back to name search (first/last)
      let data: any = null;
      const r1 = await supabase.from("personnel")
        .select("id,employee_code,prefix,first_name,last_name,department")
        .eq("employee_code", cleaned).maybeSingle();
      data = r1.data;
      if (!data) {
        const q = cleaned.replace(/[%,]/g, " ");
        const r2 = await supabase.from("personnel")
          .select("id,employee_code,prefix,first_name,last_name,department")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .eq("status", "active")
          .limit(2);
        if (r2.data && r2.data.length === 1) data = r2.data[0];
        else if (r2.data && r2.data.length > 1) { toast.error("พบหลายคน กรุณาเลือกจากรายการ"); return; }
      }
      if (!data) { toast.error("ไม่พบบุคลากร: " + cleaned); return; }
      setPersonnel(data as any); setStudent(null);
      setBorrowerQuery("");
      toast.success("พบบุคลากร: " + data.first_name + " " + data.last_name);
      if (mode === "return") await autoFindLoan({ personnel_id: (data as any).id });
    }

  };

  const autoFindLoan = async (filter: { student_id?: string; personnel_id?: string }) => {
    const sel = "id,status,borrowed_at,returned_at,expected_return_at,ict_devices(id,asset_code,name,serial_number,status),students(id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(id,employee_code,prefix,first_name,last_name,department)";
    let q = supabase.from("ict_loans").select(sel).eq("status", "active");
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
      const sel = "id,status,borrowed_at,returned_at,expected_return_at,ict_devices(id,asset_code,name,serial_number,status),students(id,student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(id,employee_code,prefix,first_name,last_name,department)";
      const { data: loan } = await supabase.from("ict_loans")
        .select(sel)
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      try { const { applyCameraFocus } = await import("@/lib/cameraFocus"); await applyCameraFocus(stream, "close"); } catch {}
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
    if (!photo) return toast.error("กรุณาถ่ายภาพ");
    setBusy(true);
    try {
      const photoUrl = await uploadPhoto(photo, mode === "borrow" ? "borrow" : "return");
      const { data: { user } } = await supabase.auth.getUser();
      if (mode === "borrow") {
        // Idempotent re-validation against latest DB state
        const { data: freshDev } = await supabase.from("ict_devices")
          .select("id,status").eq("id", device.id).maybeSingle();
        if (!freshDev) throw new Error("ไม่พบอุปกรณ์ในระบบ");
        if (freshDev.status !== "available") {
          throw new Error(`อุปกรณ์ไม่พร้อมยืม (สถานะปัจจุบัน: ${freshDev.status})`);
        }
        // Guard double-borrow on the same device (race condition)
        const { count: dupDev } = await supabase.from("ict_loans")
          .select("id", { count: "exact", head: true })
          .eq("device_id", device.id).eq("status", "active");
        if ((dupDev || 0) > 0) throw new Error("อุปกรณ์นี้มีรายการยืมค้างอยู่แล้ว");
        // Optional: limit one active loan per borrower
        const borrowerCol = borrowerType === "student" ? "student_id" : "personnel_id";
        const borrowerId = borrowerType === "student" ? student!.id : personnel!.id;
        const { count: dupBor } = await supabase.from("ict_loans")
          .select("id", { count: "exact", head: true })
          .eq(borrowerCol, borrowerId).eq("status", "active");
        if ((dupBor || 0) > 0) throw new Error("ผู้ยืมมีรายการค้างคืนอยู่ กรุณาคืนก่อนยืมใหม่");
        const due = dueDate ? new Date(dueDate + "T23:59:59").toISOString() : null;
        if (due && new Date(due) < new Date()) throw new Error("กำหนดคืนต้องเป็นวันที่ในอนาคต");
        const { error } = await supabase.from("ict_loans").insert({
          device_id: device.id,
          student_id: borrowerType === "student" ? student!.id : null,
          personnel_id: borrowerType === "personnel" ? personnel!.id : null,
          borrow_photo_url: photoUrl,
          borrow_notes: notes || null,
          borrowed_by: user?.id || null,
          expected_return_at: due,
          status: "active",
        });
        if (error) throw error;
        toast.success("บันทึกการยืมเรียบร้อย");
      } else {
        if (!activeLoan) throw new Error("ไม่พบรายการยืมที่ค้างอยู่");
        // Idempotent: verify the active loan still matches scanned borrower & device
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
          status: "returned",
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

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("th-TH") : "-";
  const isOverdue = (l: Loan) => l.status === "active" && l.expected_return_at && new Date(l.expected_return_at) < new Date();

  const personnelMatches = (() => {
    const q = borrowerQuery.trim().toLowerCase();
    if (!q) return [] as Personnel[];
    return personnelList.filter(p => {
      const full = `${p.prefix || ""}${p.first_name} ${p.last_name}`.toLowerCase();
      return full.includes(q) || (p.employee_code || "").toLowerCase().includes(q);
    }).slice(0, 8);
  })();

  const renderPersonnelSearch = (placeholder: string) => (
    <div className="relative flex-1">
      <Input
        placeholder={placeholder}
        value={borrowerQuery}
        onChange={(e) => setBorrowerQuery(e.target.value)}
        onFocus={() => setBorrowerFocused(true)}
        onBlur={() => setTimeout(() => setBorrowerFocused(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter") resolveBorrower(borrowerQuery); }}
      />
      {borrowerFocused && personnelMatches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {personnelMatches.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setPersonnel(p); setStudent(null); setBorrowerQuery("");
                if (mode === "return") autoFindLoan({ personnel_id: p.id });
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
            >
              <div className="font-medium">{p.prefix || ""}{p.first_name} {p.last_name}</div>
              <div className="text-xs text-muted-foreground">{p.employee_code || "-"} · {p.department || "-"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );



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
            <div className="rounded-lg border p-3 text-center bg-green-500/10">
              <div className="text-xs text-muted-foreground">ว่าง</div>
              <div className="text-2xl font-bold text-green-600">{deviceStats.available}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-blue-500/10">
              <div className="text-xs text-muted-foreground">ถูกยืม</div>
              <div className="text-2xl font-bold text-blue-600">{deviceStats.borrowed}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-yellow-500/10">
              <div className="text-xs text-muted-foreground">ซ่อม/เสีย</div>
              <div className="text-2xl font-bold text-yellow-600">{deviceStats.maintenance}</div>
            </div>
            <div className="rounded-lg border p-3 text-center bg-destructive/10">
              <div className="text-xs text-muted-foreground">สูญหาย</div>
              <div className="text-2xl font-bold text-destructive">{deviceStats.lost}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={mode} onValueChange={(v) => { setMode(v as any); reset(); if (v === "bulk") setBorrowerType("personnel"); }}>
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="borrow"><CheckCircle2 className="w-4 h-4 mr-1" /> ยืม (รายเครื่อง)</TabsTrigger>
          <TabsTrigger value="bulk"><Package className="w-4 h-4 mr-1" /> ยืมกลุ่ม (ครู)</TabsTrigger>
          <TabsTrigger value="return"><Undo2 className="w-4 h-4 mr-1" /> คืน</TabsTrigger>
        </TabsList>

        {mode === "bulk" ? (
          <TabsContent value="bulk" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Teacher */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4" /> 1. ครูผู้ยืม</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    {renderPersonnelSearch("ค้นหารหัสหรือชื่อบุคลากร")}

                    <Button variant="outline" onClick={() => setScanOpen("borrower")}><ScanLine className="w-4 h-4" /></Button>
                  </div>

                  {personnel && (
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <div className="font-medium">{personnel.prefix || ""}{personnel.first_name} {personnel.last_name}</div>
                      <div className="text-xs text-muted-foreground">{personnel.employee_code || "-"} · {personnel.department || "-"}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Device model + qty */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Cpu className="w-4 h-4" /> 2. อุปกรณ์ + จำนวน</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>รุ่นอุปกรณ์ (เลือกจากที่ว่าง)</Label>
                    <Select value={bulkModel} onValueChange={setBulkModel}>
                      <SelectTrigger><SelectValue placeholder="เลือกรุ่น" /></SelectTrigger>
                      <SelectContent>
                        {modelGroups.length === 0 ? (
                          <SelectItem value="__none" disabled>ไม่มีอุปกรณ์ว่าง</SelectItem>
                        ) : modelGroups.map((g) => (
                          <SelectItem key={g.key} value={g.key}>{g.label} · ว่าง {g.available.length}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>จำนวน</Label>
                      <Input type="number" min={1} value={bulkQty} onChange={(e) => setBulkQty(Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                    <div>
                      <Label>ระยะเวลา (นาที)</Label>
                      <Input type="number" min={5} value={bulkDurationMin} onChange={(e) => setBulkDurationMin(Math.max(5, parseInt(e.target.value) || 50))} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Teaching context */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" /> 3. คาบสอน (จากตารางสอน) / หัวข้อ</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>วันที่สอน</Label>
                    <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>คาบในตารางสอน</Label>
                    {!personnel ? (
                      <div className="text-xs text-muted-foreground p-2">กรุณาเลือกครูก่อน</div>
                    ) : teacherSchedules.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2">ไม่พบคาบสอนของครูในวันนี้</div>
                    ) : (
                      <Select value={bulkScheduleId} onValueChange={applySchedule}>
                        <SelectTrigger><SelectValue placeholder="เลือกคาบสอน" /></SelectTrigger>
                        <SelectContent>
                          {teacherSchedules.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              คาบ {s.period} · {s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)} · {s.subjects?.code || ""} {s.subjects?.name_th || ""} · {s.classrooms?.name || ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {bulkScheduleId && (
                    <div className="md:col-span-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      ใช้คาบ {bulkPeriod} · ระยะเวลา {bulkDurationMin} นาที · ห้อง {classrooms.find(c=>c.id===bulkClassroomId)?.name || "-"} · {subjects.find(s=>s.id===bulkSubjectId)?.name_th || "-"}
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <Label>หัวข้อการสอน</Label>
                    <Textarea value={bulkTopic} onChange={(e) => setBulkTopic(e.target.value)} placeholder="เช่น การพิมพ์ตารางงานด้วย Excel" />
                  </div>
                </CardContent>
              </Card>



              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={busy}>ล้าง</Button>
                <Button onClick={submitBulk} disabled={busy}>{busy ? "กำลังบันทึก..." : `ยืม ${bulkQty} เครื่อง`}</Button>
              </div>
            </div>
          </TabsContent>
        ) : (
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
                  {borrowerType === "personnel" ? (
                    renderPersonnelSearch("ค้นหารหัสหรือชื่อบุคลากร")

                  ) : (
                    <Input
                      placeholder="รหัสนักเรียน"
                      onKeyDown={(e) => { if (e.key === "Enter") resolveBorrower((e.target as HTMLInputElement).value); }}
                    />
                  )}
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
                      <div>
                        <Label>กำหนดคืน</Label>
                        <BEDatePicker value={dueDate} onChange={(v) => setDueDate(v)} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>ล้าง</Button>
              <Button onClick={submit} disabled={busy || !(student || personnel) || !device || !photo}>
                {busy ? "กำลังบันทึก..." : mode === "borrow" ? "บันทึกการยืม" : "บันทึกการคืน"}
              </Button>
            </div>
          </div>
        </TabsContent>
        )}
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
            <TableHeader><TableRow><TableHead>ผู้ยืม</TableHead><TableHead>ประเภท</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>S/N</TableHead><TableHead>คาบ / วิชา / หัวข้อ</TableHead><TableHead>ยืมเมื่อ</TableHead><TableHead>กำหนดคืน</TableHead><TableHead className="text-right">การคืน</TableHead></TableRow></TableHeader>
            <TableBody>
              {activeLoans.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">ไม่มีรายการค้างคืน</TableCell></TableRow>
              ) : (() => {
                // Group loans by batch_id; non-batched stay as single rows
                const seen = new Set<string>();
                const rows: { rep: Loan; group: Loan[] }[] = [];
                for (const l of activeLoans) {
                  if (l.batch_id) {
                    if (seen.has(l.batch_id)) continue;
                    seen.add(l.batch_id);
                    rows.push({ rep: l, group: activeLoans.filter((x) => x.batch_id === l.batch_id) });
                  } else {
                    rows.push({ rep: l, group: [l] });
                  }
                }
                return rows.map(({ rep: l, group }) => {
                  const remainMin = l.expected_return_at ? Math.round((new Date(l.expected_return_at).getTime() - Date.now()) / 60000) : null;
                  const isBatch = !!l.batch_id && group.length > 1;
                  return (
                  <TableRow key={l.batch_id || l.id} className={isOverdue(l) ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {l.students ? (<>
                        <div>{l.students.prefix}{l.students.first_name} {l.students.last_name}</div>
                        <div className="text-xs text-muted-foreground">{l.students.student_code}</div>
                      </>) : l.personnel ? (<>
                        <div>{l.personnel.prefix || ""}{l.personnel.first_name} {l.personnel.last_name}</div>
                        <div className="text-xs text-muted-foreground">{l.personnel.employee_code || "-"}</div>
                      </>) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{l.students ? "นักเรียน" : "บุคลากร"}</Badge>
                      {isBatch && <Badge variant="secondary" className="text-xs ml-1">กลุ่ม × {group.length}</Badge>}
                    </TableCell>
                    <TableCell>
                      {l.ict_devices?.name || "-"}
                      {isBatch && <div className="text-xs text-muted-foreground">{group.length} เครื่อง</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {isBatch ? group.map((g) => g.ict_devices?.serial_number || g.ict_devices?.asset_code || "-").join(", ") : (l.ict_devices?.serial_number || "-")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.period_number && <div>คาบ {l.period_number}{l.classrooms?.name ? ` · ${l.classrooms.name}` : ""}</div>}
                      {l.subjects && <div className="text-muted-foreground">{l.subjects.code} {l.subjects.name_th}</div>}
                      {l.teaching_topic && <div className="text-muted-foreground italic">{l.teaching_topic}</div>}
                      {!l.period_number && !l.subjects && !l.teaching_topic && "-"}
                    </TableCell>
                    <TableCell className="text-sm">{fmt(l.borrowed_at)}</TableCell>
                    <TableCell className="text-sm">
                      {l.expected_return_at ? (
                        <div className={isOverdue(l) ? "text-destructive font-medium" : ""}>
                          <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(l.expected_return_at)}</div>
                          {remainMin !== null && (
                            <div className="text-xs">{remainMin >= 0 ? `เหลือ ${remainMin} นาที` : `เกินมา ${-remainMin} นาที ⚠️`}</div>
                          )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isBatch ? (
                        <Button size="sm" disabled={busy} onClick={() => returnBatch(l.batch_id!)}>
                          คืนทั้งกลุ่ม ({group.length})
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => returnSingle(l.id)}>
                          ยืนยันคืน
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );});
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ประวัติล่าสุด</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>ผู้ยืม</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>ยืม</TableHead><TableHead>คืน</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
            <TableBody>
              {recent.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.students ? `${l.students.first_name} ${l.students.last_name}` : l.personnel ? `${l.personnel.first_name} ${l.personnel.last_name}` : "-"}</TableCell>
                  <TableCell>{l.ict_devices?.name || "-"}</TableCell>
                  <TableCell className="text-xs">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-xs">{fmt(l.returned_at)}</TableCell>
                  <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
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