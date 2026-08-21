import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useIdCardSettings } from "@/hooks/useIdCardSettings";
import { IdCardFront, IdCardBack } from "@/components/IdCardRenderer";
import { gradeRank } from "@/lib/gradeOrder";

const BulkIdCardPrintPage = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [classroomId, setClassroomId] = useState("");
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_cards"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("name");
      return (data || []).sort((a: any, b: any) => gradeRank(a.grade_level) - gradeRank(b.grade_level) || String(a.name).localeCompare(String(b.name)));
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students_for_cards", classroomId],
    enabled: !!classroomId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, classrooms!students_classroom_id_fkey(name, grade_level)")
        .eq("classroom_id", classroomId)
        .eq("status", "active")
        .order("student_code");
      if (!data) return [];

      // Use photo_url from students table directly, fallback to profiles avatar
      const studentCodes = data.map((s: any) => s.student_code).filter(Boolean);
      const avatarMap: Record<string, string> = {};
      if (studentCodes.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("student_code, avatar_url")
          .in("student_code", studentCodes);
        (profiles || []).forEach((p: any) => {
          if (p.student_code && p.avatar_url) avatarMap[p.student_code] = p.avatar_url;
        });
      }

      return data.map((s: any) => ({
        ...s,
        avatar_url: s.photo_url || avatarMap[s.student_code] || null,
      }));
    },
  });

  const { settings: cs } = useIdCardSettings();

  const baseUrl = window.location.origin;
  const classroom = classrooms.find((c: any) => c.id === classroomId);

  const handleGeneratePDF = async () => {
    if (!printRef.current || students.length === 0) return;
    setGenerating(true);
    toast.info("กำลังสร้าง PDF... อาจใช้เวลาสักครู่");

    try {
      // Card dimensions in mm (5.4 x 8.6 cm portrait — ISO ID-1)
      const cardW = 54;
      const cardH = 86;
      const gapX = 2; // ระยะตัดแคบที่สุด
      const gapY = 2;
      const cols = 3;
      const rows = 3;
      const cardsPerPage = cols * rows; // 9 ใบ/หน้า
      const markLen = 3;
      const markOffset = 0.8;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Center the grid on the page
      const gridW = cols * cardW + (cols - 1) * gapX;
      const gridH = rows * cardH + (rows - 1) * gapY;
      const startX = (pageW - gridW) / 2;
      const startY = (pageH - gridH) / 2;

      const drawCropMarks = (x: number, y: number) => {
        pdf.setDrawColor(120);
        pdf.setLineWidth(0.15);
        const corners = [
          { cx: x, cy: y, dx: -1, dy: -1 },
          { cx: x + cardW, cy: y, dx: 1, dy: -1 },
          { cx: x, cy: y + cardH, dx: -1, dy: 1 },
          { cx: x + cardW, cy: y + cardH, dx: 1, dy: 1 },
        ];
        for (const c of corners) {
          // horizontal mark
          pdf.line(c.cx + c.dx * markOffset, c.cy, c.cx + c.dx * (markOffset + markLen), c.cy);
          // vertical mark
          pdf.line(c.cx, c.cy + c.dy * markOffset, c.cx, c.cy + c.dy * (markOffset + markLen));
        }
      };

      const fronts = Array.from(printRef.current.querySelectorAll(".id-card-item")) as HTMLElement[];
      const backs = Array.from(printRef.current.querySelectorAll(".id-card-back-item")) as HTMLElement[];
      const all = [...fronts, ...backs];

      for (let i = 0; i < all.length; i++) {
        if (i > 0 && i % cardsPerPage === 0) {
          pdf.addPage();
        }
        // เริ่มหน้าใหม่เมื่อสลับจากบัตรหน้า → บัตรหลัง (เพื่อความเป็นระเบียบและพิมพ์สองหน้าได้)
        if (i === fronts.length && i % cardsPerPage !== 0) {
          pdf.addPage();
        }

        const idx = (i >= fronts.length ? i - fronts.length : i) % cardsPerPage;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        const canvas = await html2canvas(all[i], {
          scale: 4,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 15000,
        });
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", x, y, cardW, cardH);
        drawCropMarks(x, y);
      }

      const classroomName = classroom?.name || "classroom";
      const fileName = `id-cards-${classroomName}.pdf`;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`สร้าง PDF บัตร ${students.length} ใบสำเร็จ`);
    } catch (err) {
      console.error(err);
      toast.error("เกิดข้อผิดพลาดในการสร้าง PDF");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/admin/id-card")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              {lang === "th" ? "พิมพ์บัตรประจำตัวทั้งห้อง" : "Bulk Print ID Cards"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === "th" ? "เลือกห้องเรียนเพื่อพิมพ์บัตรนักเรียนทั้งห้องเป็น PDF (9 ใบ/หน้า A4)" : "Select classroom to print all student cards as PDF (9 cards/A4 page)"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={classroomId} onValueChange={setClassroomId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={lang === "th" ? "เลือกห้องเรียน" : "Select classroom"} />
          </SelectTrigger>
          <SelectContent>
            {classrooms.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.grade_level} - {c.name} {c.homeroom_teacher ? `(${c.homeroom_teacher})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {students.length > 0 && (
          <>
            <Badge variant="secondary" className="text-sm">
              {students.length} คน
            </Badge>
            <Button onClick={handleGeneratePDF} disabled={generating}>
              <Printer className="w-4 h-4 mr-2" />
              {generating ? "กำลังสร้าง PDF..." : `สร้าง PDF (${Math.ceil(students.length / 9) * 2} หน้า)`}
            </Button>
          </>
        )}
      </div>

      {/* Preview + Hidden render area */}
      {students.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            ตัวอย่างบัตร ({students.length} ใบ, {Math.ceil(students.length / 9)} หน้า A4 — 9 ใบ/หน้า)
          </p>

          {/* Visible preview grid — uses the template renderer */}
          <div className="flex flex-wrap gap-4">
            {students.slice(0, 8).map((student: any) => (
              <IdCardFront
                key={student.id}
                cs={cs}
                person={studentToPerson(student, baseUrl, cs.qr_type)}
                width={200}
              />
            ))}
            {students.length > 8 && (
              <div className="text-sm text-muted-foreground self-center">
                …และอีก {students.length - 8} ใบ
              </div>
            )}
          </div>

          {/* Hidden render area for PDF generation — full template at print size */}
          <div ref={printRef} className="fixed left-[-9999px] top-0">
            {students.map((student: any) => (
              <div
                key={student.id}
                className="id-card-item"
                style={{ width: 600, background: "#fff" }}
              >
                <IdCardFront
                  cs={cs}
                  person={studentToPerson(student, baseUrl, cs.qr_type)}
                  width={600}
                />
              </div>
            ))}
            {students.map((student: any) => (
              <div
                key={"b-" + student.id}
                className="id-card-back-item"
                style={{ width: 600, background: "#fff" }}
              >
                <IdCardBack
                  cs={cs}
                  person={studentToPerson(student, baseUrl, cs.qr_type)}
                  width={600}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {classroomId && students.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ไม่พบนักเรียนในห้องเรียนนี้
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function studentToPerson(student: any, baseUrl: string, qrType: string) {
  const classroomName = student.classrooms
    ? `${student.classrooms.grade_level || ""}${student.classrooms.name ? "/" + student.classrooms.name : ""}`
    : "";
  const qrValue = qrType === "sdq"
    ? `${baseUrl}/sdq-assess/${student.id}`
    : `${baseUrl}/p/${student.auth_user_id || student.id}`;
  return {
    name: `${student.prefix || ""}${student.first_name || ""} ${student.last_name || ""}`.trim(),
    code: student.student_code || "",
    className: classroomName,
    avatarUrl: student.avatar_url || student.photo_url || undefined,
    dateOfBirth: student.date_of_birth || student.birth_date || undefined,
    bloodType: student.blood_type || undefined,
    emergencyContact: student.guardian_name || undefined,
    emergencyPhone: student.guardian_phone || undefined,
    phone: student.phone || undefined,
    qrValue,
  };
}

export default BulkIdCardPrintPage;
