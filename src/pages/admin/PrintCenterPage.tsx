import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Printer, ArrowLeft, Search, Upload, Loader2 } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useIdCardSettings } from "@/hooks/useIdCardSettings";
import { IdCardFront, IdCardBack } from "@/components/IdCardRenderer";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { compressImage } from "@/lib/imageCompress";
import { gradeRank } from "@/lib/gradeOrder";

type ClassroomForCard = {
  id: string;
  name: string | null;
  grade_level: string | null;
};

type StudentForCard = {
  id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  classroom_id?: string | null;
  classrooms?: Pick<ClassroomForCard, "name" | "grade_level"> | null;
  avatar_url?: string | null;
  photo_url?: string | null;
  date_of_birth?: string | null;
  blood_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  phone?: string | null;
};

type FontReadyDocument = Document & { fonts?: { ready?: Promise<unknown> } };

const studentToPerson = (s: StudentForCard) => ({
  name: `${s.prefix || ""}${s.first_name || ""} ${s.last_name || ""}`.trim(),
  code: s.student_code || "",
  className: s.classrooms?.name || "",
  avatarUrl: s.avatar_url || undefined,
  dateOfBirth: s.date_of_birth || undefined,
  bloodType: s.blood_type || undefined,
  emergencyContact: s.emergency_contact_name || s.guardian_name || undefined,
  emergencyPhone: s.emergency_contact_phone || s.guardian_phone || undefined,
  phone: s.phone || undefined,
  qrValue: s.student_code || "",
});

type Scope = "class" | "person";
type Layout = "single" | "a4";
const CARD_WIDTH_MM = 54;
const CARD_HEIGHT_MM = 86;
const CARD_RENDER_WIDTH_PX = 204; // 54mm @ 96dpi
// A4 layout - 3x3 = 9 ใบ/แผ่น (บัตรมาตรฐาน ISO ID-1 ขนาด 54x86mm)
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_COLS = 3;
const A4_ROWS = 3;
const A4_PER_PAGE = A4_COLS * A4_ROWS; // 9
const CARD_GAP_X_MM = 2; // ระยะตัดแคบที่สุด
const CARD_GAP_Y_MM = 2;
const A4_GRID_W_MM = A4_COLS * CARD_WIDTH_MM + (A4_COLS - 1) * CARD_GAP_X_MM;
const A4_GRID_H_MM = A4_ROWS * CARD_HEIGHT_MM + (A4_ROWS - 1) * CARD_GAP_Y_MM;
const A4_MARGIN_X_MM = (A4_WIDTH_MM - A4_GRID_W_MM) / 2;
const A4_MARGIN_Y_MM = (A4_HEIGHT_MM - A4_GRID_H_MM) / 2;
const CROP_MARK_LEN_MM = 3;
const CROP_MARK_OFFSET_MM = 0.8;

function drawCropMarks(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);
  const corners = [
    { cx: x, cy: y, dx: -1, dy: -1 },
    { cx: x + w, cy: y, dx: 1, dy: -1 },
    { cx: x, cy: y + h, dx: -1, dy: 1 },
    { cx: x + w, cy: y + h, dx: 1, dy: 1 },
  ];
  for (const c of corners) {
    pdf.line(c.cx + c.dx * CROP_MARK_OFFSET_MM, c.cy, c.cx + c.dx * (CROP_MARK_OFFSET_MM + CROP_MARK_LEN_MM), c.cy);
    pdf.line(c.cx, c.cy + c.dy * CROP_MARK_OFFSET_MM, c.cx, c.cy + c.dy * (CROP_MARK_OFFSET_MM + CROP_MARK_LEN_MM));
  }
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  }));
}

export default function PrintCenterPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          พิมพ์บัตรนักเรียน (พร้อม QR ในตัว) — เลือกพิมพ์รายคนหรือรายห้อง
        </p>
        <CardTab />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="w-6 h-6 text-primary" />พิมพ์บัตรประจำตัว
          </h1>
          <p className="text-sm text-muted-foreground">พิมพ์บัตรนักเรียน (พร้อม QR ในตัว) — เลือกพิมพ์รายคนหรือรายห้อง</p>
        </div>
      </div>
      <CardTab />
    </div>
  );
}

// ============================================================
// CARD TAB — ID Card printing (per class or per student) → PDF
// ============================================================
function CardTab() {
  const [scope, setScope] = useState<Scope>("class");
  const [layout, setLayout] = useState<Layout>("a4");
  const [classroomId, setClassroomId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { settings: cs, isLoading: settingsLoading } = useIdCardSettings();
  const qc = useQueryClient();

  const handlePhotoUpload = async (student: StudentForCard, file: File) => {
    if (!file) return;
    setUploadingId(student.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("ไม่พบผู้ใช้งานที่ล็อกอินอยู่");

      const compressed = await compressImage(file, { maxWidth: 1024, maxSizeKB: 150 });
      const safeName = compressed.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const fileName = `${user.id}/student-${student.id}/avatar_${Date.now()}_${safeName}`;
      const result = await uploadPublicFileWithFallback("profile-images", fileName, compressed, { upsert: true });
      const url = result.publicUrl;
      if (!url) throw new Error("upload failed");

      // 1) save to students.photo_url (so card renders)
      await supabase.from("students").update({ photo_url: url }).eq("id", student.id);

      // 2) sync to profiles.avatar_url (matched by student_code)
      if (student.student_code) {
        await supabase.from("profiles").update({ avatar_url: url }).eq("student_code", student.student_code);
      }

      toast.success(`อัปโหลดรูปสำเร็จ — ตั้งเป็นรูปโปรไฟล์ของ ${student.first_name} แล้ว`);
      qc.invalidateQueries({ queryKey: ["students_for_cards"] });
      qc.invalidateQueries({ queryKey: ["search_students_for_cards"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingId(null);
    }
  };

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_cards"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("name");
      return ((data || []) as ClassroomForCard[]).sort((a, b) => gradeRank(a.grade_level) - gradeRank(b.grade_level) || String(a.name).localeCompare(String(b.name)));
    },
  });

  const { data: classStudents = [] } = useQuery({
    queryKey: ["students_for_cards", classroomId],
    enabled: scope === "class" && !!classroomId,
    queryFn: async () => loadStudents({ classroomId }),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["search_students_for_cards", search],
    enabled: scope === "person" && search.trim().length >= 2,
    queryFn: async () => loadStudents({ search: search.trim() }),
  });

  const students = useMemo(() => {
    if (scope === "class") return classStudents;
    if (selectedStudentId) return searchResults.filter((s) => s.id === selectedStudentId);
    return [];
  }, [scope, classStudents, searchResults, selectedStudentId]);

  const classroom = classrooms.find((c) => c.id === classroomId);

  const handleGeneratePDF = async () => {
    if (!printRef.current || students.length === 0) return;
    if (settingsLoading) {
      toast.warning("กำลังโหลดเทมเพลตบัตร กรุณารอสักครู่");
      return;
    }
    setGenerating(true);
    toast.info("กำลังสร้าง PDF...");
    try {
      await (document as FontReadyDocument).fonts?.ready;
      await waitForImages(printRef.current);
      const fronts = Array.from(printRef.current.querySelectorAll(".print-card-front")) as HTMLElement[];
      const backs = Array.from(printRef.current.querySelectorAll(".print-card-back")) as HTMLElement[];

      // Render all front/back images first
      const frontImgs: string[] = [];
      const backImgs: string[] = [];
      for (let i = 0; i < fronts.length; i++) {
        const fc = await html2canvas(fronts[i], { scale: 3, useCORS: true, backgroundColor: "#fff", logging: false, imageTimeout: 15000 });
        frontImgs.push(fc.toDataURL("image/png"));
        if (backs[i]) {
          const bc = await html2canvas(backs[i], { scale: 3, useCORS: true, backgroundColor: "#fff", logging: false, imageTimeout: 15000 });
          backImgs.push(bc.toDataURL("image/png"));
        }
      }

      let pdf: jsPDF;
      let totalPages: number;

      if (layout === "single") {
        pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [CARD_WIDTH_MM, CARD_HEIGHT_MM] });
        let firstPage = true;
        for (let i = 0; i < frontImgs.length; i++) {
          if (!firstPage) pdf.addPage([CARD_WIDTH_MM, CARD_HEIGHT_MM], "portrait");
          firstPage = false;
          pdf.addImage(frontImgs[i], "PNG", 0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM);
          if (backImgs[i]) {
            pdf.addPage([CARD_WIDTH_MM, CARD_HEIGHT_MM], "portrait");
            pdf.addImage(backImgs[i], "PNG", 0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM);
          }
        }
        totalPages = frontImgs.length + backImgs.length;
      } else {
        // A4 layout: 3x3 grid per sheet. Sheets alternate front/back for duplex printing.
        // Back sheet mirrors column order so duplex long-edge flip aligns to each front card.
        pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const sheets = Math.ceil(frontImgs.length / A4_PER_PAGE);
        let firstPage = true;
        for (let sheet = 0; sheet < sheets; sheet++) {
          const start = sheet * A4_PER_PAGE;
          const end = Math.min(start + A4_PER_PAGE, frontImgs.length);
          // Front sheet
          if (!firstPage) pdf.addPage("a4", "portrait");
          firstPage = false;
          for (let i = start; i < end; i++) {
            const idx = i - start;
            const row = Math.floor(idx / A4_COLS);
            const col = idx % A4_COLS;
            const x = A4_MARGIN_X_MM + col * (CARD_WIDTH_MM + CARD_GAP_X_MM);
            const y = A4_MARGIN_Y_MM + row * (CARD_HEIGHT_MM + CARD_GAP_Y_MM);
            pdf.addImage(frontImgs[i], "PNG", x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
            drawCropMarks(pdf, x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
          }
          // Back sheet (mirrored columns for duplex long-edge flip)
          const hasBacks = backImgs.slice(start, end).some(Boolean);
          if (hasBacks) {
            pdf.addPage("a4", "portrait");
            for (let i = start; i < end; i++) {
              if (!backImgs[i]) continue;
              const idx = i - start;
              const row = Math.floor(idx / A4_COLS);
              const col = idx % A4_COLS;
              const mirroredCol = A4_COLS - 1 - col;
              const x = A4_MARGIN_X_MM + mirroredCol * (CARD_WIDTH_MM + CARD_GAP_X_MM);
              const y = A4_MARGIN_Y_MM + row * (CARD_HEIGHT_MM + CARD_GAP_Y_MM);
              pdf.addImage(backImgs[i], "PNG", x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
              drawCropMarks(pdf, x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
            }
          }
        }
        totalPages = sheets * 2;
      }

      const fname = scope === "class" ? (classroom?.name || "classroom") : `student-${students[0]?.student_code || "card"}`;
      pdf.save(`id-cards-${fname}.pdf`);
      toast.success(`สร้าง PDF สำเร็จ (${students.length} ใบ · ${totalPages} หน้า · ${layout === "a4" ? `A4 ${A4_PER_PAGE} ใบ/แผ่น · ${CARD_WIDTH_MM}×${CARD_HEIGHT_MM}mm` : `${CARD_WIDTH_MM}×${CARD_HEIGHT_MM}mm`})`);
    } catch (e) {
      console.error(e); toast.error("เกิดข้อผิดพลาด");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs mb-2 block">โหมดการพิมพ์</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="class" className="shrink-0 size-4" /> รายห้อง</label>
              <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="person" className="shrink-0 size-4" /> รายคน</label>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs mb-2 block">รูปแบบกระดาษ</Label>
            <RadioGroup value={layout} onValueChange={(v) => setLayout(v as Layout)} className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="a4" className="shrink-0 size-4" /> A4 (9 ใบ/แผ่น · หน้า-หลังสลับแผ่น สำหรับพิมพ์สองหน้า)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="single" className="shrink-0 size-4" /> 1 ใบ/หน้า (54×86mm · ISO ID-1)
              </label>
            </RadioGroup>
          </div>

          {scope === "class" ? (
            <div>
              <Label className="text-xs">เลือกห้องเรียน</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder="เลือกห้อง..." /></SelectTrigger>
                <SelectContent>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">ค้นหานักเรียน (รหัส/ชื่อ)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedStudentId(""); }} placeholder="พิมพ์รหัสหรือชื่อนักเรียน..." className="pl-9" />
                </div>
                <ScanSearchButton onScan={(code) => { setSearch(code); setSelectedStudentId(""); }} />
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-auto">
                  {searchResults.map((s) => (
                    <button key={s.id} onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${selectedStudentId === s.id ? "bg-accent" : ""}`}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{s.student_code}</span>
                      {s.prefix}{s.first_name} {s.last_name}
                      <span className="text-xs text-muted-foreground ml-2">{s.classrooms?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {students.length > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <Badge variant="secondary">{students.length} ใบ</Badge>
              <Button onClick={handleGeneratePDF} disabled={generating || settingsLoading} className="gap-2">
                <Printer className="w-4 h-4" />
                {generating ? "กำลังสร้าง..." : settingsLoading ? "กำลังโหลดเทมเพลต..." : layout === "a4" ? `สร้าง PDF A4 (${Math.ceil(students.length / A4_PER_PAGE) * 2} แผ่น · ${A4_PER_PAGE} ใบ/แผ่น · ${CARD_WIDTH_MM}×${CARD_HEIGHT_MM}mm · หน้า+หลัง)` : `สร้าง PDF (${students.length * 2} หน้า · ${CARD_WIDTH_MM}×${CARD_HEIGHT_MM}mm · หน้า+หลัง)`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {students.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">ตัวอย่าง — กดปุ่ม "อัปโหลดรูป" เพื่อใส่รูปลงบัตรและตั้งเป็นรูปโปรไฟล์ของนักเรียนทันที</p>
          <div className="flex flex-wrap gap-4">
            {students.map((s) => {
              const hasPhoto = !!(s.avatar_url || s.photo_url);
              const isUploading = uploadingId === s.id;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <IdCardFront cs={cs} person={studentToPerson(s)} width={220} />
                  <span className="text-[10px] text-muted-foreground">{s.prefix}{s.first_name} {s.last_name}</span>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoUpload(s, f);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition">
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {isUploading ? "กำลังอัปโหลด..." : hasPhoto ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          <div ref={printRef} className="fixed left-[-9999px] top-0" aria-hidden="true">
            {students.map((s) => {
              const person = studentToPerson(s);
              return (
                <div key={`print-${s.id}`}>
                  <IdCardFront cs={cs} person={person} width={CARD_RENDER_WIDTH_PX} className="print-card-front shadow-none" />
                  <IdCardBack cs={cs} person={person} width={CARD_RENDER_WIDTH_PX} className="print-card-back shadow-none" />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

async function loadStudents({ classroomId, search }: { classroomId?: string; search?: string }) {
  let q = supabase.from("students").select("*, classrooms!students_classroom_id_fkey(name, grade_level)").eq("status", "active").order("student_code").limit(50);
  if (classroomId) q = q.eq("classroom_id", classroomId);
  if (search) q = q.or(`student_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  const { data } = await q;
  if (!data) return [];
  const students = data as StudentForCard[];
  const codes = students.map((s) => s.student_code).filter((code): code is string => Boolean(code));
  const avatarMap: Record<string, string> = {};
  if (codes.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("student_code, avatar_url").in("student_code", codes);
    (profiles || []).forEach((p) => { if (p.student_code && p.avatar_url) avatarMap[p.student_code] = p.avatar_url; });
  }
  return students.map((s) => ({ ...s, avatar_url: s.photo_url || (s.student_code ? avatarMap[s.student_code] : null) || null }));
}
