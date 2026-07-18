import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

export default function ExamPaperPrintPage() {
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
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_questions").select("*").eq("exam_id", id).order("question_no")).data || [],
  });
  const { data: sheet } = useQuery({
    queryKey: ["exam-sheet", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_sheets").select("*").eq("exam_id", id).maybeSingle()).data,
  });
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

  useEffect(() => {
    if (sp.get("autoprint") === "1" && exam && (questions as any[]).length) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [exam, questions, sp]);

  if (!exam) return <p className="p-6">กำลังโหลด...</p>;

  const fmt = (sheet?.layout_config as any)?.choice_format || "abcd";
  const labels = CHOICE_FORMATS[fmt] || CHOICE_FORMATS.abcd;
  const academicYear = exam.academic_year
    ? `${exam.academic_year + 543}`
    : `${new Date().getFullYear() + 543}`;
  const qs = questions as any[];

  return (
    <div className="bg-neutral-soft min-h-screen p-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> พิมพ์ข้อสอบ
        </Button>
      </div>

      <div id="exam-paper" className="bg-white mx-auto print:shadow-none shadow-lg" style={{ width: "210mm" }}>
        {/* Header */}
        <div className="page-section">
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center justify-center gap-3 mb-1">
              {schoolLogo && <img src={schoolLogo} alt="logo" className="h-14 w-14 object-contain" />}
              <div>
                <h1 className="text-lg font-bold">{schoolName || appName}</h1>
                <p className="text-base">ข้อสอบ — {exam.title}</p>
              </div>
            </div>
            <p className="text-sm">
              วิชา: {exam.subjects?.name_th || "-"} · ชั้น: {exam.classrooms?.name || "-"} · {exam.question_count} ข้อ
            </p>
            <p className="text-sm">
              ปีการศึกษา {academicYear} · ครูผู้ออกข้อสอบ: {teacher || "-"}
            </p>
            <div className="text-sm text-left mt-3 grid grid-cols-2 gap-2">
              <p>ชื่อ-นามสกุล: <span className="border-b border-dotted inline-block w-60">&nbsp;</span></p>
              <p>เลขที่: <span className="border-b border-dotted inline-block w-12">&nbsp;</span> ห้อง: <span className="border-b border-dotted inline-block w-16">&nbsp;</span></p>
            </div>
            <p className="text-xs text-neutral mt-2 text-left">คำชี้แจง: ข้อสอบเป็นแบบปรนัย {labels.length} ตัวเลือก จงเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วฝนคำตอบลงในกระดาษคำตอบ</p>
          </div>
        </div>

        {/* Questions */}
        <div>
          {qs.map((q) => (
            <div key={q.id} className="mb-3 break-inside-avoid text-sm leading-relaxed">
              <p className="font-medium">
                <span className="font-bold mr-1">{q.question_no}.</span>
                {q.question_text}
              </p>
              <div className="ml-6 grid grid-cols-2 gap-x-4">
                {(q.choices || []).map((c: string, i: number) => (
                  <div key={i}>
                    <span className="font-semibold mr-1">{labels[i] || String.fromCharCode(65 + i)}.</span>{c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Answer key — last page */}
        <div className="break-before-page">

          <h2 className="text-lg font-bold text-center border-b-2 border-black pb-2 mb-4">
            เฉลย — {exam.title}
          </h2>
          <p className="text-xs text-neutral mb-3">เอกสารสำหรับครูผู้ตรวจเท่านั้น (ปีการศึกษา {academicYear})</p>
          <div className="grid grid-cols-5 gap-2 text-sm">
            {qs.map((q) => {
              const idx = ["A","B","C","D"].indexOf((q.correct_answer || "A").toUpperCase());
              return (
                <div key={q.id} className="border rounded px-2 py-1 flex justify-between">
                  <span className="font-semibold">{q.question_no}.</span>
                  <span className="font-bold text-success">{labels[idx >= 0 ? idx : 0]}</span>
                </div>
              );
            })}
          </div>

          {qs.some((q) => q.explanation) && (
            <>
              <h3 className="font-semibold mt-6 mb-2">คำอธิบายเฉลย</h3>
              <div className="space-y-2 text-xs">
                {qs.filter((q) => q.explanation).map((q) => (
                  <div key={q.id} className="break-inside-avoid">
                    <p><span className="font-bold">{q.question_no}.</span> ({labels[["A","B","C","D"].indexOf((q.correct_answer||"A").toUpperCase())]}) {q.explanation}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {qs.some((q) => (q as any).indicator_code || (q as any).indicator_description) && (
            <>
              <h3 className="font-semibold mt-6 mb-2 border-t pt-3">
                ตารางตัวชี้วัด — อ้างอิงหลักสูตรแกนกลาง สพฐ. (พ.ศ. 2551 ฉบับปรับปรุง 2560) และหลักสูตรของโรงเรียน
              </h3>
              <p className="text-[11px] text-neutral mb-2">
                สรุปว่าข้อสอบแต่ละข้อวัดตัวชี้วัด/มาตรฐานการเรียนรู้ใด เพื่อใช้ในการวิเคราะห์ผลและรายงานต่อฝ่ายวิชาการ
              </p>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-neutral-soft">
                    <th className="border px-2 py-1 w-12 text-center">ข้อที่</th>
                    <th className="border px-2 py-1 w-40 text-left">รหัสตัวชี้วัด</th>
                    <th className="border px-2 py-1 text-left">คำอธิบายตัวชี้วัด</th>
                    <th className="border px-2 py-1 w-20 text-center">ระดับ Bloom</th>
                  </tr>
                </thead>
                <tbody>
                  {qs.map((q: any) => (
                    <tr key={`ind-${q.id}`} className="break-inside-avoid align-top">
                      <td className="border px-2 py-1 text-center font-semibold">{q.question_no}</td>
                      <td className="border px-2 py-1 font-mono">{q.indicator_code || "-"}</td>
                      <td className="border px-2 py-1">{q.indicator_description || "-"}</td>
                      <td className="border px-2 py-1 text-center text-neutral">{q.bloom_level || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(() => {
                const groups = new Map<string, { desc: string; nos: number[] }>();
                qs.forEach((q: any) => {
                  const code = q.indicator_code || "(ไม่ระบุ)";
                  const g = groups.get(code) || { desc: q.indicator_description || "", nos: [] };
                  g.nos.push(q.question_no);
                  if (!g.desc && q.indicator_description) g.desc = q.indicator_description;
                  groups.set(code, g);
                });
                return (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-1 text-sm">สรุปจำนวนข้อแยกตามตัวชี้วัด</h4>
                    <ul className="text-[11px] list-disc ml-5 space-y-1">
                      {Array.from(groups.entries()).map(([code, g]) => (
                        <li key={code}>
                          <span className="font-mono font-semibold">{code}</span>
                          {g.desc ? ` — ${g.desc}` : ""}
                          {" "}
                          <span className="text-neutral">({g.nos.length} ข้อ: ข้อ {g.nos.join(", ")})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      <style>{`
        #exam-paper { padding: 15mm; }
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #exam-paper, #exam-paper * { visibility: visible !important; }
          #exam-paper { position: absolute !important; left: 0; top: 0; width: 210mm !important; padding: 0 !important; box-shadow: none !important; }
          .break-before-page { break-before: page; page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
