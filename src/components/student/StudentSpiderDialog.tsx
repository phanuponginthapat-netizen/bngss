import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function StudentSpiderDialog({ studentId, open, onOpenChange }: { studentId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: stu } = useQuery({
    queryKey: ["spider_student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*, classrooms!students_classroom_id_fkey(name, grade_level)").eq("id", studentId!).maybeSingle();
      return data as any;
    },
  });
  const { data: loans } = useQuery({
    queryKey: ["spider_loans", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await (supabase.from("library_loans" as any) as any).select("*, library_books(title)").eq("borrower_student_id" as any, studentId!).order("borrowed_at" as any, { ascending: false }).limit(5);
      return (data as any[]) || [];
    },
  });
  const { data: remeds } = useQuery({
    queryKey: ["spider_remed", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("grade_remediation").select("*").eq("student_id", studentId).limit(5);
      return (data as any[]) || [];
    },
  });
  const { data: bus } = useQuery({
    queryKey: ["spider_bus", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("bus_attendance").select("*, bus_routes(name)").eq("student_id", studentId).order("boarded_at", { ascending: false }).limit(5);
      return (data as any[]) || [];
    },
  });
  const { data: attend } = useQuery({
    queryKey: ["spider_attend", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase.from("face_scan_logs").select("scan_date, scan_type").eq("student_id", studentId!).order("scan_date", { ascending: false }).limit(7);
      return (data as any[]) || [];
    },
  });

  if (!studentId) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ใยแมงมุม — {stu ? `${stu.prefix || ""}${stu.first_name} ${stu.last_name} (${stu.student_code})` : studentId.slice(0, 8)} {stu?.classrooms ? <Badge variant="secondary" className="ml-2">{stu.classrooms.grade_level}/{stu.classrooms.name}</Badge> : null}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">มาเรียน 7 วัน</CardTitle></CardHeader><CardContent className="text-xs">{attend?.length ? attend.map((a: any, i: number) => <div key={i} className="flex justify-between"><span>{a.scan_date}</span><Badge variant="outline">{a.scan_type}</Badge></div>) : <span className="text-muted-foreground">ไม่มีสแกน</span>}<Button variant="link" size="sm" asChild className="h-6 px-0"><Link to={`/dashboard/student/attendance?student_id=${studentId}`}>ดูทั้งหมด →</Link></Button></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">0 ร มส</CardTitle></CardHeader><CardContent className="text-xs">{remeds?.length ? remeds.map((r: any) => <div key={r.id} className="flex justify-between"><span>{r.subject_code} {r.original_grade}</span><Badge>{r.status}</Badge></div>) : <span className="text-muted-foreground">ไม่มีติด</span>}<Button variant="link" size="sm" asChild className="h-6 px-0"><Link to={`/dashboard/academic/grade-remediation?student_id=${studentId}`}>แก้ 0 ร มส →</Link></Button></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ห้องสมุด</CardTitle></CardHeader><CardContent className="text-xs">{loans?.length ? loans.map((l: any) => <div key={l.id} className="flex justify-between"><span>{l.library_books?.title || l.book_id.slice(0, 8)}</span><Badge variant={l.status === "borrowed" ? "secondary" : "outline"}>{l.status}</Badge></div>) : <span className="text-muted-foreground">ไม่มีประวัติ</span>}<Button variant="link" size="sm" asChild className="h-6 px-0"><Link to={`/dashboard/admin/library?student_id=${studentId}`}>ห้องสมุด →</Link></Button></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">รถรับส่ง</CardTitle></CardHeader><CardContent className="text-xs">{bus?.length ? bus.map((b: any) => <div key={b.id} className="flex justify-between"><span>{b.bus_routes?.name || b.route_id.slice(0, 8)}</span><span>{new Date(b.boarded_at).toLocaleDateString("th-TH")}</span></div>) : <span className="text-muted-foreground">ไม่มีเช็คชื่อ</span>}<Button variant="link" size="sm" asChild className="h-6 px-0"><Link to={`/dashboard/admin/bus?student_id=${studentId}`}>รถรับส่ง →</Link></Button></CardContent></Card>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" asChild><Link to={`/dashboard/students?student_id=${studentId}`}>โปรไฟล์เต็ม</Link></Button>
          <Button variant="outline" asChild><Link to={`/dashboard/academic/grade-lock?student_id=${studentId}`}>เกรด</Link></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
