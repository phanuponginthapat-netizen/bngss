import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft, QrCode, IdCard, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { gradeRank } from "@/lib/gradeOrder";
import BackButton from "@/components/BackButton";

type Mode = "students" | "personnel";
type Size = "small" | "medium" | "large";

const SIZE_MAP: Record<Size, { qr: number; card: string; font: string }> = {
  small: { qr: 70, card: "w-[5cm] h-[3.5cm]", font: "text-[10px]" },
  medium: { qr: 100, card: "w-[6cm] h-[4.5cm]", font: "text-xs" },
  large: { qr: 140, card: "w-[8cm] h-[6cm]", font: "text-sm" },
};

export default function BulkQrPrintPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("students");
  const [classroomId, setClassroomId] = useState<string>("");
  const [department, setDepartment] = useState<string>("all");
  const [size, setSize] = useState<Size>("medium");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms_for_qr"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("id, name, grade_level").order("name");
      return (data || []).sort((a: any, b: any) => gradeRank(a.grade_level) - gradeRank(b.grade_level) || String(a.name).localeCompare(String(b.name)));
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students_for_qr", classroomId],
    enabled: mode === "students" && !!classroomId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)")
        .eq("classroom_id", classroomId)
        .eq("status", "active")
        .order("student_code");
      return data || [];
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel_for_qr", department],
    enabled: mode === "personnel",
    queryFn: async () => {
      let q = supabase
        .from("personnel")
        .select("id, employee_code, prefix, first_name, last_name, department, position")
        .eq("status", "active")
        .order("employee_code");
      if (department !== "all") q = q.eq("department", department);
      const { data } = await q;
      return data || [];
    },
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    (personnel as any[]).forEach((p) => p.department && set.add(p.department));
    return Array.from(set);
  }, [personnel]);

  const items = useMemo(() => {
    if (mode === "students") {
      return (students as any[]).map((s) => ({
        code: s.student_code,
        name: `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim(),
        sub: s.classrooms?.name || "",
      }));
    }
    return (personnel as any[]).map((p) => ({
      code: p.employee_code,
      name: `${p.prefix || ""}${p.first_name} ${p.last_name}`.trim(),
      sub: p.position || p.department || "",
    }));
  }, [mode, students, personnel]);

  const handlePrint = () => {
    if (items.length === 0) { toast.error("ไม่มีรายการให้พิมพ์"); return; }
    window.print();
  };

  const sz = SIZE_MAP[size];

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <BackButton size="icon" fallback="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><QrCode className="w-6 h-6 text-primary" />พิมพ์ QR Code รวม</h1>
            <p className="text-sm text-muted-foreground">QR ขนาดเล็ก สำหรับติดสมุด/ของใช้ — ใช้สแกนเร็วที่เคาน์เตอร์ขยะ/เช็คชื่อ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/admin/id-card/bulk-print")} className="gap-2">
            <IdCard className="w-4 h-4" /> พิมพ์บัตรนักเรียน
          </Button>
          <Button onClick={handlePrint} disabled={items.length === 0} className="gap-2">
            <Printer className="w-4 h-4" /> พิมพ์ ({items.length})
          </Button>
        </div>
      </div>

      <div className="no-print rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-blue-900 dark:text-blue-200">
          <strong>ต่างกับบัตรนักเรียนยังไง?</strong> หน้านี้พิมพ์เฉพาะ QR เล็กๆ (สติกเกอร์) สำหรับติดสมุด/ของใช้ ไว้สแกนเร็วที่เคาน์เตอร์ขยะหรือเช็คชื่อ
          ส่วน <button className="underline font-medium" onClick={() => navigate("/dashboard/admin/id-card/bulk-print")}>“บัตรนักเรียน”</button> เป็นบัตรประจำตัวเต็มรูปแบบ (5.4×8.6cm · ISO ID-1) มีรูปถ่าย/โลโก้/ข้อมูลครบ ใช้แสดงตัวตน
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">ประเภท</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="students">นักเรียน (เลือกห้อง)</SelectItem>
                <SelectItem value="personnel">บุคลากร (เลือกแผนก)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "students" ? (
            <div>
              <Label className="text-xs">ห้องเรียน</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder="เลือกห้อง..." /></SelectTrigger>
                <SelectContent>
                  {(classrooms as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">แผนก/ฝ่าย</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">ขนาด QR</Label>
            <Select value={size} onValueChange={(v) => setSize(v as Size)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">เล็ก (5×3.5cm)</SelectItem>
                <SelectItem value="medium">กลาง (6×4.5cm)</SelectItem>
                <SelectItem value="large">ใหญ่ (8×6cm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Badge variant="outline" className="text-sm">รวม {items.length} รายการ</Badge>
          </div>
        </CardContent>
      </Card>

      <div id="qr-print-area" ref={printRef} className="flex flex-wrap gap-2 p-2 bg-white">
        {items.length === 0 ? (
          <div className="w-full text-center text-muted-foreground py-12 no-print">
            {mode === "students" && !classroomId ? "เลือกห้องเพื่อแสดง QR" : "ไม่พบรายการ"}
          </div>
        ) : (
          items.map((it) => (
            <div key={it.code} className={`${sz.card} border-2 border-dashed border-gray-300 rounded-lg p-2 flex items-center gap-2 bg-white`}>
              <div className="flex-shrink-0 bg-white p-1 rounded">
                <QRCodeSVG value={it.code || "-"} size={sz.qr} level="M" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold ${sz.font} truncate text-black`}>{it.name}</div>
                <div className={`${sz.font} text-gray-700 truncate`}>{it.code}</div>
                {it.sub && <div className={`${sz.font} text-gray-500 truncate`}>{it.sub}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
