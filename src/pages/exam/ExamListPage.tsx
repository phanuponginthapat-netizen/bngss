import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileCheck2, ScanLine, Printer, FileDown, History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthSession } from "@/hooks/useAuthSession";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ExamListPage() {
  const { user } = useAuthSession();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", "mine", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("exams")
        .select("id,title,topic,level,question_count,status,created_at,subject_id,classroom_id, subjects(name_th), classrooms(name)")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // ลบลูก ๆ ก่อน เผื่อ FK ไม่ได้ตั้ง cascade
      await supabase.from("exam_questions").delete().eq("exam_id", deleteId);
      await supabase.from("exam_submissions").delete().eq("exam_id", deleteId);
      await supabase.from("exam_sheets").delete().eq("exam_id", deleteId);
      const { error } = await supabase.from("exams").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("ลบข้อสอบเรียบร้อย");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["exams", "mine", user?.id] });
    } catch (e: any) {
      toast.error("ลบไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ระบบข้อสอบ</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <History className="w-3.5 h-3.5" />
            ประวัติการสร้างข้อสอบของคุณ · สร้างด้วย AI · พิมพ์กระดาษคำตอบ · ตรวจอัตโนมัติ
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/exam/new"><Plus className="w-4 h-4 mr-1" /> สร้างข้อสอบใหม่</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">กำลังโหลด...</p>
      ) : exams.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <FileCheck2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          คุณยังไม่มีข้อสอบ — เริ่มสร้างข้อสอบใหม่ด้วย AI
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((e: any) => (
            <Card key={e.id} className="p-4 hover:shadow-lg transition">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold line-clamp-2">{e.title}</h3>
                <Badge variant={e.status === "published" ? "default" : "secondary"}>{e.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 mb-3">
                <p>วิชา: {e.subjects?.name_th || "-"} · ห้อง: {e.classrooms?.name || "-"}</p>
                <p>{e.question_count} ข้อ · ระดับ {e.level} · {e.topic || ""}</p>
                <p className="text-[11px] opacity-80">
                  สร้างเมื่อ {format(new Date(e.created_at), "d MMM yyyy HH:mm", { locale: th })}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" asChild><Link to={`/dashboard/exam/${e.id}`}>แก้ไข</Link></Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/dashboard/exam/${e.id}/answer-sheet`}>
                    <Printer className="w-3 h-3 mr-1"/>กระดาษคำตอบ
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild title="เปิดหน้าพิมพ์ แล้วเลือก 'บันทึกเป็น PDF'">
                  <Link to={`/dashboard/exam/${e.id}/paper?autoprint=1`} state={{ backTo: `/dashboard/exam/${e.id}` }}>
                    <FileDown className="w-3 h-3 mr-1"/>PDF
                  </Link>
                </Button>
                <Button size="sm" asChild><Link to={`/dashboard/exam/${e.id}/scan`}><ScanLine className="w-3 h-3 mr-1"/>ตรวจ</Link></Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteId(e.id)}>
                  <Trash2 className="w-3 h-3 mr-1"/>ลบ
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบข้อสอบ</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะลบข้อคำถาม กระดาษคำตอบ และผลการตรวจของข้อสอบนี้ทั้งหมด ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "กำลังลบ..." : "ลบข้อสอบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
