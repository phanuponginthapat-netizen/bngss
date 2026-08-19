import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Printer, Settings2 } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { BE_OFFSET } from "@/lib/dateBE";

const DIGITS = ["0","1","2","3","4","5","6","7","8","9"];
const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

// กี่ข้อต่อ 1 half-sheet (2 คอลัมน์ × 32 แถว ที่ rowH ขั้นต่ำ 2.8mm)
const MAX_PER_HALF = 64;
// 1 หน้า A4 = 2 half-sheets
const MAX_PER_PAGE = MAX_PER_HALF * 2;

export default function ExamAnswerSheetPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { schoolName, schoolLogo, appName } = useSystemSettings();

  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => (await supabase
      .from("exams")
      .select("*, subjects(name_th), classrooms(name)")
      .eq("id", id).maybeSingle()).data,
  });
  const { data: sheet } = useQuery({
    queryKey: ["exam-sheet", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_sheets").select("*").eq("exam_id", id).maybeSingle()).data,
  });
  // ครูเจ้าของข้อสอบ
  const { data: teacher } = useQuery({
    queryKey: ["exam-teacher", exam?.teacher_id],
    enabled: !!exam?.teacher_id,
    queryFn: async () => {
      const { data: p } = await supabase.from("personnel")
        .select("prefix, first_name, last_name").eq("user_id", exam!.teacher_id).maybeSingle();
      if (p) return `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      const { data: rows } = await (supabase.rpc as any)("get_profiles_public", { _ids: [exam!.teacher_id] });
      const pr = (rows as any[])?.[0];
      return pr ? `${pr.first_name || ""} ${pr.last_name || ""}`.trim() || "-" : "-";
    },
  });

  if (!exam) return <p className="p-6">กำลังโหลด...</p>;
  const count = Math.min(Math.max(exam.question_count || 20, 1), MAX_PER_PAGE * 8);
  const layout = (sheet?.layout_config as any) || {};
  const choiceFormat = (["abcd", "1234", "thai"] as const).includes(layout.choice_format)
    ? layout.choice_format as "abcd" | "1234" | "thai"
    : "abcd";
  const LETTERS = CHOICE_FORMATS[choiceFormat];
  const digits = layout.student_code_digits ?? sheet?.student_code_digits ?? 5;
  const showLogo = layout.show_logo !== false;
  const showHeader = layout.show_header !== false;
  const academicYear = exam.academic_year
    ? `${exam.academic_year + BE_OFFSET}`
    : `${new Date().getFullYear() + BE_OFFSET}`;

  // ArUco-like fiducial: solid black with inner white square, plus surrounding quiet zone
  const Fiducial = ({ pos, orientation }: { pos: string; orientation?: boolean }) => (
    <div className={`absolute ${pos} bg-white`} style={{ width: "10mm", height: "10mm", padding: "1mm", boxSizing: "border-box" }}>
      <div className="w-full h-full bg-black flex items-center justify-center" style={{ padding: "1.5mm", boxSizing: "border-box" }}>
        <div className="w-full h-full bg-white" />
      </div>
      {orientation && (
        <div className="absolute -top-[1mm] -left-[1mm] w-[3mm] h-[3mm] bg-black" />
      )}
    </div>
  );

  // ครึ่งแผ่นแสดงข้อ qFrom..qFrom+qCount-1 (1-based)
  const HalfSheet = ({ qFrom, qCount, pageNo }: { qFrom: number; qCount: number; pageNo: number }) => (
    <div className="relative" style={{ width: "140.5mm", height: "194mm", padding: "8mm", boxSizing: "border-box", border: "0.3mm solid black" }}>
      {/* 4 corner fiducials (top-left has extra dot = orientation reference) */}
      <Fiducial pos="left-[3mm] top-[3mm]" orientation />
      <Fiducial pos="right-[3mm] top-[3mm]" />
      <Fiducial pos="left-[3mm] bottom-[3mm]" />
      <Fiducial pos="right-[3mm] bottom-[3mm]" />


      {/* Header */}
      {showHeader && (
        <div className="text-center mb-2 border-b-2 border-black pb-2">
          <div className="flex items-center justify-center gap-2 mb-0.5">
            {showLogo && schoolLogo && <img src={schoolLogo} alt="logo" className="h-9 w-9 object-contain" />}
            <div>
              <h1 className="text-base font-bold leading-tight">{schoolName || appName}</h1>
              <p className="text-[11px] leading-tight">กระดาษคำตอบ — {exam.title}</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 leading-tight">
            วิชา: {exam.subjects?.name_th || "-"} · ห้อง: {exam.classrooms?.name || "-"} · {count} ข้อ
          </p>
          <p className="text-[10px] text-gray-700 leading-tight">
            ปีการศึกษา {academicYear} · ครูผู้ออกข้อสอบ: {teacher || "-"}
          </p>
        </div>
      )}

      {/* Student info + code bubbles (เฉพาะหน้าแรกเท่านั้น) */}
      {pageNo === 1 && (
        <div className="grid grid-cols-2 gap-2 mb-2 border-b pb-2">
          <div className="text-[10px]">
            <p className="mb-1">ชื่อ-นามสกุล: <span className="border-b border-dotted inline-block w-full">&nbsp;</span></p>
            <p>วันที่: <span className="border-b border-dotted inline-block w-24">&nbsp;</span></p>
          </div>
          <div>
            <p className="text-[9px] font-semibold mb-0.5">รหัสนักเรียน:</p>
            <table className="border border-black text-[8px]">
              <tbody>
                <tr>
                  <td className="border border-black px-0.5 font-bold">หลัก</td>
                  {Array.from({ length: digits }).map((_, i) => (
                    <td key={i} className="border border-black px-0.5 text-center">{i + 1}</td>
                  ))}
                </tr>
                {DIGITS.map((d) => (
                  <tr key={d}>
                    <td className="border border-black px-0.5 text-center font-bold">{d}</td>
                    {Array.from({ length: digits }).map((_, i) => (
                      <td key={i} className="border border-black px-0.5 text-center">
                        <div className="w-2.5 h-2.5 rounded-full border border-black mx-auto" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Answer bubbles — 2 columns; auto-shrink to fit half page */}
      {(() => {
        const halfCol = Math.ceil(qCount / 2);
        // Available vertical space for answer grid ≈ 90mm (after header+student info)
        const rowH = Math.min(5, Math.max(2.8, 90 / Math.max(halfCol, 1)));
        const bubble = Math.max(2.2, rowH - 1.2);
        const fontPx = Math.max(7, Math.min(10, rowH * 1.7));
        return (
          <div className="grid grid-cols-2 gap-2 mt-1" style={{ overflow: "hidden" }}>
            {[0, 1].map((col) => {
              const len = col === 0 ? halfCol : qCount - halfCol;
              return (
                <table key={col} style={{ width: "auto", borderCollapse: "collapse", fontSize: `${fontPx}px`, lineHeight: 1 }}>
                  <thead>
                    <tr style={{ height: `${rowH}mm` }}>
                      <th className="text-left pr-1" style={{ width: "8mm" }}>ข้อ</th>
                      {LETTERS.map(l => <th key={l} className="text-center" style={{ width: `${bubble + 2}mm` }}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: len }).map((_, i) => {
                      const qno = col === 0 ? qFrom + i : qFrom + halfCol + i;
                      return (
                        <tr key={qno} style={{ height: `${rowH}mm` }}>
                          <td className="pr-1 font-semibold" style={{ width: "8mm" }}>{qno}.</td>
                          {LETTERS.map(l => (
                            <td key={l} className="text-center" style={{ width: `${bubble + 2}mm` }}>
                              <div className="rounded-full border border-black mx-auto" style={{ width: `${bubble}mm`, height: `${bubble}mm` }} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })}
          </div>
        );
      })()}

    </div>
  );

  // สร้างชุดหน้าต่างๆ: แต่ละหน้า 2 half-sheet, แต่ละ half อย่างมาก MAX_PER_HALF ข้อ
  const pages: { halves: { qFrom: number; qCount: number }[] }[] = [];
  {
    let q = 1;
    while (q <= count) {
      const pageHalves: { qFrom: number; qCount: number }[] = [];
      for (let h = 0; h < 2 && q <= count; h++) {
        const qCount = Math.min(MAX_PER_HALF, count - q + 1);
        pageHalves.push({ qFrom: q, qCount });
        q += qCount;
      }
      pages.push({ halves: pageHalves });
    }
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:bg-white print:p-0 print:m-0">
      <div className="max-w-5xl mx-auto mb-4 flex justify-end gap-2 print:hidden">
        <SheetDesigner
          layout={layout}
          digits={digits}
          sheetId={sheet?.id}
          examId={exam.id}
          onSaved={() => {}}
        />
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> พิมพ์กระดาษคำตอบ
        </Button>
      </div>


      <AutoPrint enabled={sp.get("autoprint") === "1" && !!exam} />

      {pages.map((page, pi) => (
        <div
          key={pi}
          className="answer-page bg-white shadow-lg mx-auto relative print:shadow-none flex mb-4 print:mb-0"
          style={{ width: "281mm", height: "194mm", boxSizing: "border-box", pageBreakAfter: "always" }}
        >
          <HalfSheet qFrom={page.halves[0]?.qFrom ?? 1} qCount={page.halves[0]?.qCount ?? 0} pageNo={pi + 1} />
          {/* เส้นปะกลาง สำหรับพับ/ตัด */}
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center justify-between"
            aria-hidden
          >
            <span className="text-[8px] text-gray-500 rotate-90 mt-2">✂ พับ/ตัดตรงนี้</span>
            <div className="w-px h-full border-l border-dashed border-gray-500" />
            <span className="text-[8px] text-gray-500 rotate-90 mb-2">✂ พับ/ตัดตรงนี้</span>
          </div>
          {page.halves[1] && <HalfSheet qFrom={page.halves[1].qFrom} qCount={page.halves[1].qCount} pageNo={pi + 1} />}
          {pages.length > 1 && (
            <div className="absolute bottom-1 right-2 text-[9px] text-gray-500">หน้า {pi + 1}/{pages.length}</div>
          )}
        </div>
      ))}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .answer-page, .answer-page * { visibility: visible !important; }
          .answer-page {
            position: static !important;
            left: auto !important; top: auto !important;
            width: 281mm !important; height: 194mm !important;
            margin: 0 !important; box-shadow: none !important;
            page-break-after: always !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        .answer-page, .answer-page * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
    </div>
  );
}

function SheetDesigner({ layout, digits, sheetId, examId, onSaved }: {
  layout: any;
  digits: number;
  sheetId?: string;
  examId: string;
  onSaved: () => void;
}) {
  const [fmt, setFmt] = useState<"abcd" | "1234" | "thai">(
    (["abcd", "1234", "thai"] as const).includes(layout.choice_format) ? layout.choice_format : "abcd"
  );
  const [logo, setLogo] = useState(layout.show_logo !== false);
  const [header, setHeader] = useState(layout.show_header !== false);
  const [codeDigits, setCodeDigits] = useState(digits);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function save() {
    if (!sheetId) return toast.error("ยังไม่มีกระดาษคำตอบ");
    setSaving(true);
    try {
      const { error } = await supabase.from("exam_sheets").update({
        layout_config: { ...layout, choice_format: fmt, show_logo: logo, show_header: header },
        student_code_digits: Math.max(1, Math.min(10, Number(codeDigits) || 5)),
      }).eq("id", sheetId);
      if (error) throw error;
      toast.success("บันทึกรูปแบบกระดาษคำตอบแล้ว");
      onSaved();
      setOpen(false);
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 className="w-4 h-4 mr-1" /> ออกแบบกระดาษ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ออกแบบกระดาษคำตอบ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>รูปแบบตัวเลือก</Label>
            <RadioGroup
              value={fmt}
              onValueChange={(v) => setFmt(v as any)}
              className="flex gap-4 mt-2"
            >
              {[
                { v: "abcd", l: "A B C D" },
                { v: "1234", l: "1 2 3 4" },
                { v: "thai", l: "ก ข ค ง" },
              ].map((o) => (
                <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value={o.v} />
                  <span>{o.l}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label>จำนวนหลักรหัสนักเรียน</Label>
            <Input type="number" min={1} max={10} value={codeDigits}
              onChange={(e) => setCodeDigits(Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>แสดงโลโก้โรงเรียน</Label>
            <Switch checked={logo} onCheckedChange={setLogo} />
          </div>
          <div className="flex items-center justify-between">
            <Label>แสดงหัวกระดาษ (ชื่อโรงเรียน/วิชา)</Label>
            <Switch checked={header} onCheckedChange={setHeader} />
          </div>
          <p className="text-xs text-muted-foreground">
            การตรวจด้วยกล้องจะอ่านตัวอักษรบนหัวคอลัมน์เองโดยอัตโนมัติ — เปลี่ยนรูปแบบได้ไม่กระทบการตรวจ
          </p>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "กำลังบันทึก..." : "บันทึกรูปแบบ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}