import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toCE } from "@/lib/utils";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { academicReadState } from "@/lib/academicReadState";
import { probationResults } from "@/lib/probationResults";
import { requireWrittenRows } from "@/lib/confirmedWrite";
import { saveErrorMessage } from "@/lib/saveError";
import { toast } from "sonner";

interface Student { id: string; student_code: string; first_name: string; last_name: string; prefix: string | null; }
interface ProbationRecord { id: string; student_id: string; academic_year: number; semester: number; gpax: number | null; status: string; notes: string | null; }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  at_risk: { label: "เสี่ยง", color: "bg-amber-100 text-amber-800" },
  warning: { label: "เตือน", color: "bg-orange-100 text-orange-800" },
  probation: { label: " probation", color: "bg-red-100 text-red-800" },
  cleared: { label: "พ้นแล้ว", color: "bg-emerald-100 text-emerald-800" },
};

export default function AcademicProbationPage() {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState(2.0);
  const [search, setSearch] = useState("");
  const term = useAcademicYear();
  const [yearChoice, setAy] = useState<number | null>(null);
  const [semesterChoice, setSem] = useState<number | null>(null);
  const ay = yearChoice ?? term.currentAcademicYear;
  const sem = semesterChoice ?? term.currentSemester;
  const [editRec, setEditRec] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "", notes: "" });

  const studentsQuery = useQuery({
    queryKey: ["students_prob"],
    queryFn: () => fetchAllRows(() => supabase.from("students")
      .select("id,student_code,first_name,last_name,prefix").eq("status", "active").order("student_code").order("id")),
  });
  const scoresQuery = useQuery({
    queryKey: ["scores_prob", ay, sem], enabled: term.isReady,
    queryFn: () => fetchAllRows(() => supabase.from("student_scores")
      .select("student_code,subject_id,grade_point").eq("academic_year", toCE(ay)).eq("semester", sem).order("id")),
  });
  const subjectsQuery = useQuery({
    queryKey: ["probation-subject-credits"],
    queryFn: () => fetchAllRows(() => supabase.from("subjects").select("id,credits").order("id")),
  });
  const recordsQuery = useQuery({
    queryKey: ["academic_probation", ay, sem], enabled: term.isReady,
    queryFn: () => fetchAllRows(() => supabase.from("academic_probation").select("*")
      .eq("academic_year", toCE(ay)).eq("semester", sem).order("id")),
  });
  const students = (studentsQuery.data || []) as Student[];
  const probRecs = (recordsQuery.data || []) as ProbationRecord[];
  const calculation = useMemo(() => {
    try { return { scores: probationResults(scoresQuery.data || [], students, subjectsQuery.data || []), error: null }; }
    catch (error) { return { scores: [], error }; }
  }, [scoresQuery.data, studentsQuery.data, subjectsQuery.data]);
  const scores = calculation.scores;
  const readState = academicReadState([studentsQuery, scoresQuery, subjectsQuery, recordsQuery,
    { error: term.error || calculation.error, isLoading: !term.isReady && !term.error }]);
  const retry = () => {
    void studentsQuery.refetch(); void scoresQuery.refetch(); void subjectsQuery.refetch(); void recordsQuery.refetch();
    void qc.invalidateQueries({ queryKey: ["academic-periods"] });
    void qc.invalidateQueries({ queryKey: ["semester-config"] });
  };

  const upsert = useMutation({
    mutationFn: async (rec: any) => {
      const existing = probRecs.find((r) => r.student_id === rec.student_id);
      if (existing) {
        const result = await supabase.from("academic_probation").update({ status: rec.status, notes: rec.notes, gpax: rec.gpax, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id");
        requireWrittenRows(result);
      } else {
        const result = await supabase.from("academic_probation").insert(rec).select("id");
        requireWrittenRows(result);
      }
    },
    onSuccess: () => { setEditRec(null); toast.success("บันทึกสถานะแล้ว"); void qc.invalidateQueries({ queryKey: ["academic_probation"] }); },
    onError: error => toast.error(saveErrorMessage(error)),
  });

  const flagged = useMemo(() => {
    const rMap = new Map(probRecs.map((r) => [r.student_id, r]));
    return scores.filter((s) => s.gpax !== null && s.gpax < threshold).map((s) => {
      const st = students.find((x) => x.id === s.student_id);
      const ex = rMap.get(s.student_id);
      return { ...s, student: st, status: ex?.status || "at_risk", notes: ex?.notes || null, probationId: ex?.id || null };
    }).sort((a, b) => (a.gpax ?? 0) - (b.gpax ?? 0));
  }, [scores, students, probRecs, threshold]);

  const filtered = useMemo(() => {
    if (!search) return flagged;
    const q = search.toLowerCase();
    return flagged.filter((r) => r.student_code.toLowerCase().includes(q) || (r.student && `${r.student.first_name} ${r.student.last_name}`.toLowerCase().includes(q)));
  }, [flagged, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { at_risk: 0, warning: 0, probation: 0, cleared: 0 };
    flagged.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [flagged]);

  const openEdit = (r: any) => {
    setEditRec(r);
    setEditForm({ status: r.status, notes: r.notes || "" });
  };

  const saveEdit = () => {
    if (!editRec || !readState.isReady) return;
    upsert.mutate({ student_id: editRec.student_id, academic_year: toCE(ay), semester: sem, gpax: editRec.gpax ?? 0, status: editForm.status, notes: editForm.notes });
  };

  if (!readState.isReady) return (
    <div className="space-y-3 p-4" role="alert">
      <h1 className="text-xl font-bold">ติดตามผลการเรียน</h1>
      <p>{readState.isError ? "อ่านข้อมูลผลการเรียนไม่สำเร็จ" : "กำลังโหลดข้อมูลผลการเรียน"}</p>
      {readState.isError && <Button variant="outline" onClick={retry}>ลองใหม่</Button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ติดตามนักเรียนขาดผลการเรียน (Academic Probation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">GPA &lt;</span>
              <Input type="number" step="0.1" min="0" max="4" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value) || 2.0)} className="w-20" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">ปีการศึกษา:</span>
              <Input type="number" value={ay} onChange={(e) => setAy(parseInt(e.target.value) || term.currentAcademicYear)} className="w-24" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">เทอม:</span>
              <Select value={String(sem)} onValueChange={(v) => setSem(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="ค้นหานักเรียน..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(counts).map(([k, v]) => (
              <Card key={k} className="border"><CardContent className="p-3 text-center">
                <Badge className={STATUS_MAP[k]?.color}>{STATUS_MAP[k]?.label}</Badge>
                <p className="text-xl font-bold mt-1">{v}</p>
              </CardContent></Card>
            ))}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[100px]">รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead className="text-right">GPA</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-[80px]">จัดการ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {readState.isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่มีนักเรียนในเกณฑ์นี้</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={`${r.student_id}-${r.academic_year}-${r.semester}`}>
                    <TableCell className="text-xs font-mono">{r.student_code}</TableCell>
                    <TableCell className="text-sm">{r.student ? `${r.student.prefix || ""} ${r.student.first_name} ${r.student.last_name}` : r.student_id}</TableCell>
                    <TableCell className="text-right font-bold"><span className={r.gpax !== null && r.gpax < threshold ? "text-red-600" : ""}>{r.gpax?.toFixed(2) ?? "-"}</span></TableCell>
                    <TableCell><Badge className={STATUS_MAP[r.status]?.color}>{STATUS_MAP[r.status]?.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notes || "-"}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(r)}>แก้ไข</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">แสดง {filtered.length} นักเรียนที่มี GPA ต่ำกว่า {threshold.toFixed(1)}</p>
        </CardContent>
      </Card>

      <Dialog open={!!editRec} onOpenChange={() => setEditRec(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>จัดการสถานะ - {editRec?.student_code}</DialogTitle></DialogHeader>
          {editRec && (
            <div className="space-y-3">
              <div className="text-sm">
                <p>GPA: <strong>{editRec.gpax?.toFixed(2)}</strong></p>
                <p>นักเรียน: {editRec.student ? `${editRec.student.first_name} ${editRec.student.last_name}` : editRec.student_id}</p>
              </div>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_risk">เสี่ยง</SelectItem>
                  <SelectItem value="warning">เตือน</SelectItem>
                  <SelectItem value="probation"> probation</SelectItem>
                  <SelectItem value="cleared">พ้นแล้ว</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="หมายเหตุจากครู..." value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRec(null)}>ยกเลิก</Button>
            <Button onClick={saveEdit} disabled={!editForm.status || upsert.isPending}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
