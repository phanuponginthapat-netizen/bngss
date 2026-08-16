import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react";
import { TaskAttachmentViewer } from "@/components/tasks/TaskAttachmentViewer";

interface TeacherTasksPanelProps {
  userId?: string | null;
  personnelId?: string;
}

export const TeacherTasksPanel = ({ userId, personnelId }: TeacherTasksPanelProps) => {
  const qc = useQueryClient();

  // Tasks assigned TO me by director/admin only
  const { data: myTasks = [] } = useQuery({
    queryKey: ["my_tasks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_assignments")
        .select("*")
        .eq("assigned_to_user_id", userId!)
        .in("task_type", ["duty", "assignment"])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("task_assignments").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("อัพเดทสถานะสำเร็จ");
    qc.invalidateQueries({ queryKey: ["my_tasks"] });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />เสร็จสิ้น</Badge>;
      case "in_progress": return <Badge className="bg-primary/10 text-primary border-0 text-[10px]"><Clock className="w-3 h-3 mr-1" />กำลังดำเนินการ</Badge>;
      case "overdue": return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />เลยกำหนด</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><Clock className="w-3 h-3 mr-1" />รอดำเนินการ</Badge>;
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case "duty": return <Badge variant="secondary" className="text-[10px]">เวร</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">งานมอบหมาย</Badge>;
    }
  };

  return (
    <Card className="border border-border/50 shadow-elevated rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-warning flex items-center justify-center">
            <ListTodo className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          งานจากผู้อำนวยการ
          {myTasks.filter(t => t.status === "pending").length > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-0 text-xs ml-auto">
              {myTasks.filter(t => t.status === "pending").length} รายการ
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {myTasks.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">ยังไม่มีภาระงานจากผู้อำนวยการ</p>
        ) : (
          <div className="space-y-2">
            {myTasks.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {typeBadge(task.task_type)}
                    {statusBadge(task.status)}
                  </div>
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>สั่งเมื่อ: {new Date(task.assigned_date).toLocaleDateString("th-TH")}</span>
                    {task.due_date && <span>กำหนดส่ง: {new Date(task.due_date).toLocaleDateString("th-TH")}</span>}
                  </div>
                  <TaskAttachmentViewer attachments={(task as any).attachments} />
                </div>
                {task.status !== "completed" && (
                  <div className="flex gap-1 shrink-0">
                    {task.status === "pending" && (
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus(task.id, "in_progress")}>
                        เริ่มทำ
                      </Button>
                    )}
                    <Button size="sm" className="text-xs h-7" onClick={() => updateStatus(task.id, "completed")}>
                      เสร็จแล้ว
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
