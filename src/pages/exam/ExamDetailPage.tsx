import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ScanLine, BarChart3, FileText } from "lucide-react";

export default function ExamDetailPage() {
  const { id } = useParams();
  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exams").select("*, subjects(name_th), classrooms(name)").eq("id", id).maybeSingle()).data,
  });
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-questions", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_questions").select("*").eq("exam_id", id).order("question_no")).data || [],
  });

  if (!exam) return <p className="p-6 text-muted-foreground">กำลังโหลด...</p>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            {exam.subjects?.name_th || "-"} · {exam.classrooms?.name || "-"} · {exam.question_count} ข้อ · ระดับ {exam.level}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to={`/dashboard/exam/${id}/paper`} state={{ backTo: `/dashboard/exam/${id}` }}><FileText className="w-4 h-4 mr-1"/>พิมพ์ข้อสอบ (PDF)</Link></Button>
          <Button variant="outline" asChild><Link to={`/dashboard/exam/${id}/answer-sheet`} state={{ backTo: `/dashboard/exam/${id}` }}><Printer className="w-4 h-4 mr-1"/>พิมพ์กระดาษคำตอบ</Link></Button>
          <Button variant="outline" asChild><Link to={`/dashboard/exam/${id}/results`}><BarChart3 className="w-4 h-4 mr-1"/>ดูผลคะแนน</Link></Button>
          <Button asChild><Link to={`/dashboard/exam/${id}/scan`}><ScanLine className="w-4 h-4 mr-1"/>ตรวจกระดาษคำตอบ</Link></Button>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">เนื้อหาข้อสอบ ({(questions as any[]).length} ข้อ)</h2>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {(questions as any[]).map((q) => (
            <div key={q.id} className="p-3 border rounded-lg bg-muted/20">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <p className="font-medium mb-1 flex-1"><span className="font-bold">{q.question_no}.</span> {q.question_text}</p>
                {q.indicator_code && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                    {q.indicator_code}
                  </span>
                )}
              </div>
              <ul className="ml-6 text-sm space-y-0.5">
                {(q.choices || []).map((c: string, i: number) => (
                  <li key={i} className={String.fromCharCode(65 + i) === q.correct_answer ? "text-success font-semibold" : ""}>
                    {String.fromCharCode(65 + i)}. {c}
                  </li>
                ))}
              </ul>
              {q.indicator_description && (
                <p className="text-xs mt-2 ml-6 bg-primary/5 border border-primary/10 rounded p-2">
                  <strong>ตัวชี้วัด:</strong> {q.indicator_description}
                </p>
              )}
              {q.explanation && <p className="text-xs text-muted-foreground mt-2 ml-6 italic">เฉลย: {q.explanation}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
