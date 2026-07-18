import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ExamResultsPage() {
  const { id } = useParams();
  const [view, setView] = useState<any>(null);

  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exams").select("title,question_count").eq("id", id).maybeSingle()).data,
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["exam-subs", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_submissions").select("*").eq("exam_id", id).order("graded_at", { ascending: false })).data || [],
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">ผลคะแนน</h1>
        <p className="text-sm text-muted-foreground">{exam?.title} · {(subs as any[]).length} คน</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">รหัสนักเรียน</th>
                <th className="text-left p-3">ชื่อ</th>
                <th className="text-center p-3">คะแนน</th>
                <th className="text-center p-3">เปอร์เซ็นต์</th>
                <th className="text-center p-3">เวลาตรวจ</th>
                <th className="text-center p-3">ภาพตรวจ</th>
              </tr>
            </thead>
            <tbody>
              {(subs as any[]).map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-mono">{s.student_code_detected || "-"}</td>
                  <td className="p-3">{s.student_name_snapshot || "(ไม่พบในระบบ)"}</td>
                  <td className="p-3 text-center font-semibold">{s.score}/{s.total}</td>
                  <td className="p-3 text-center">
                    <Badge variant={s.percentage >= 50 ? "default" : "destructive"}>{Number(s.percentage).toFixed(1)}%</Badge>
                  </td>
                  <td className="p-3 text-center text-xs text-muted-foreground">{new Date(s.graded_at).toLocaleString("th-TH")}</td>
                  <td className="p-3 text-center">
                    {s.graded_image_url && <Button size="sm" variant="outline" onClick={() => setView(s)}>ดู</Button>}
                  </td>
                </tr>
              ))}
              {(subs as any[]).length === 0 && (
                <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">ยังไม่มีผลการตรวจ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>ภาพการตรวจ — {view?.student_name_snapshot || view?.student_code_detected}</DialogTitle></DialogHeader>
          {view?.graded_image_url && <img src={view.graded_image_url} alt="graded" className="w-full" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
