import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar, CheckCircle2, AlertCircle, Heart, FileText, Home, Star,
} from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Props {
  studentId: string;
  limit?: number;
}

type TimelineItem = {
  id: string;
  date: string;
  type: "attendance" | "behavior" | "leave" | "score" | "homevisit" | "homeroom";
  title: string;
  description?: string;
  meta?: string;
};

const typeConfig: Record<TimelineItem["type"], { icon: any; color: string; label: string }> = {
  attendance: { icon: CheckCircle2, color: "text-info bg-info-soft", label: "เช็คชื่อ" },
  behavior: { icon: Star, color: "text-warning bg-warning-soft", label: "พฤติกรรม" },
  leave: { icon: AlertCircle, color: "text-warning bg-warning-soft", label: "ลา" },
  score: { icon: FileText, color: "text-success bg-success-soft", label: "คะแนน" },
  homevisit: { icon: Home, color: "text-info bg-info-soft", label: "เยี่ยมบ้าน" },
  homeroom: { icon: Heart, color: "text-danger bg-danger-soft", label: "โฮมรูม" },
};

export default function StudentActivityTimeline({ studentId, limit = 30 }: Props) {
  const { data: items = [], isLoading } = useQuery<TimelineItem[]>({
    queryKey: ["student-timeline", studentId, limit],
    enabled: !!studentId,
    queryFn: async () => {
      // Get student_code first (student_scores uses student_code)
      const { data: stu } = await supabase.from("students").select("student_code").eq("id", studentId).maybeSingle();
      const code = stu?.student_code;

      const [att, beh, lv, sc, hv, hr] = await Promise.all([
        supabase.from("attendance").select("id,attendance_date,status,notes")
          .eq("student_id", studentId).order("attendance_date", { ascending: false }).limit(limit),
        supabase.from("behavior_records").select("id,record_date,description,behavior_type,points")
          .eq("student_id", studentId).order("record_date", { ascending: false }).limit(limit),
        supabase.from("student_leaves").select("id,start_date,end_date,leave_type,reason,status")
          .eq("student_id", studentId).order("start_date", { ascending: false }).limit(limit),
        code
          ? supabase.from("student_scores").select("id,created_at,total_score,subject_id")
              .eq("student_code", code).order("created_at", { ascending: false }).limit(limit)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("home_visits").select("id,visit_date,recommendations")
          .eq("student_id", studentId).order("visit_date", { ascending: false }).limit(limit),
        supabase.from("homeroom_records").select("id,homeroom_date,topic,advisor_notes")
          .eq("student_id", studentId).order("homeroom_date", { ascending: false }).limit(limit),
      ]);

      const all: TimelineItem[] = [];
      (att.data || []).forEach((r: any) => all.push({
        id: `att-${r.id}`, date: r.attendance_date, type: "attendance",
        title: r.status === "present" ? "มาเรียน" : r.status === "absent" ? "ขาดเรียน" : r.status === "late" ? "มาสาย" : "ลา",
        description: r.notes || undefined,
      }));
      (beh.data || []).forEach((r: any) => all.push({
        id: `beh-${r.id}`, date: r.record_date, type: "behavior",
        title: r.behavior_type === "positive" ? "พฤติกรรมดี" : "พฤติกรรมที่ต้องปรับปรุง",
        description: r.description, meta: `${r.points || 0} คะแนน`,
      }));
      (lv.data || []).forEach((r: any) => all.push({
        id: `lv-${r.id}`, date: r.start_date, type: "leave",
        title: `ลา${r.leave_type} (${r.start_date} - ${r.end_date})`,
        description: r.reason, meta: r.status,
      }));
      (sc.data || []).forEach((r: any) => all.push({
        id: `sc-${r.id}`, date: r.created_at?.slice(0, 10), type: "score",
        title: "บันทึกคะแนน", meta: `รวม ${r.total_score || 0}`,
      }));
      (hv.data || []).forEach((r: any) => all.push({
        id: `hv-${r.id}`, date: r.visit_date, type: "homevisit",
        title: "เยี่ยมบ้าน", description: r.recommendations || undefined,
      }));
      (hr.data || []).forEach((r: any) => all.push({
        id: `hr-${r.id}`, date: r.homeroom_date, type: "homeroom",
        title: `โฮมรูม: ${r.topic || "ทั่วไป"}`, description: r.advisor_notes || undefined,
      }));

      return all
        .filter(x => x.date)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, limit);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5" /> ไทม์ไลน์กิจกรรมนักเรียน
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีข้อมูลกิจกรรม</div>
        ) : (
          <ScrollArea className="h-[480px] pr-3">
            <div className="space-y-3">
              {items.map(item => {
                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="flex gap-3 pb-3 border-b last:border-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">{item.title}</p>
                        <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.date), "d MMM yyyy", { locale: th })}
                        </span>
                        {item.meta && <span className="text-xs font-medium">• {item.meta}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
