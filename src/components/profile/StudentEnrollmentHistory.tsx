import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, GraduationCap, FileText } from "lucide-react";

interface Props {
  studentId: string;
  studentCode?: string | null;
}

const statusLabel: Record<string, { th: string; cls: string }> = {
  promoted: { th: "เลื่อนชั้น", cls: "bg-success-soft text-success" },
  pending_transition: { th: "รอจัดชั้นรอยต่อ", cls: "bg-warning-soft text-warning" },
  graduated: { th: "จบการศึกษา", cls: "bg-info-soft text-info" },
  active: { th: "กำลังศึกษา", cls: "bg-muted text-foreground" },
};

const StudentEnrollmentHistory = ({ studentId, studentCode }: Props) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["student-enrollment-history", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_enrollment_history")
        .select("*")
        .eq("student_id", studentId)
        .order("academic_year", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // คะแนนรายปี + ไฟล์ ปพ.5/ปพ.6
  const { data: scoresByYear = {} } = useQuery({
    queryKey: ["student-scores-by-year", studentCode],
    enabled: !!studentCode,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_scores")
        .select("academic_year, semester, subject_id, total_score, grade")
        .eq("student_code", studentCode!);
      const map: Record<number, any[]> = {};
      (data || []).forEach((r: any) => {
        if (r.academic_year != null) (map[r.academic_year] = map[r.academic_year] || []).push(r);
      });
      return map;
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-6">กำลังโหลด...</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-10 text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
          ยังไม่มีประวัติการเรียนย้อนหลัง — ระบบจะบันทึก snapshot อัตโนมัติเมื่อสิ้นปีการศึกษา
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h: any) => {
        const st = statusLabel[h.status] || statusLabel.active;
        const scores = scoresByYear[h.academic_year] || [];
        return (
          <Card key={h.id} className="overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="font-semibold">ปีการศึกษา {h.academic_year + 543}</span>
                <Badge variant="outline">{h.grade_level || "-"}</Badge>
                <span className="text-sm text-muted-foreground">{h.classroom_name || ""}</span>
              </div>
              <Badge className={st.cls}>{st.th}</Badge>
            </div>
            <CardContent className="pt-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                {scores.length > 0
                  ? `บันทึกคะแนน ${scores.length} รายการ`
                  : "ไม่มีบันทึกคะแนนในปีนี้"}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StudentEnrollmentHistory;
