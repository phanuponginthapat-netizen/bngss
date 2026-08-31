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
import { BE_OFFSET } from "@/lib/dateBE";

interface Student { id: string; student_code: string; first_name: string; last_name: string; prefix: string | null; }
interface ProbationRecord { id: string; student_id: string; academic_year: number; semester: number; gpax: number | null; status: string; notes: string | null; }
interface StudentScore { student_id: string; student_code: string; academic_year: number; semester: number; gpax: number | null; }

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  at_risk: { label: "เสี่ยง", color: "bg-amber-100 text-amber-800" },
  warning: { label: "เตือน", color: "bg-orange-100 text-orange-800" },
  probation: { label: " probation", color: "bg-red-100 text-red-800" },
  cleared: { label: "พ้นแล้ว", color: "bg-emerald-100 text-emerald-800" },
};

const now = new Date();
const DEFAULT_YEAR = (now.getMonth() < 4 ? now.getFullYear() - 1 : now.getFullYear()) + BE_OFFSET; // พ.ศ.
const DEFAULT_SEMESTER = now.getMonth() < 4 ? 2 : 1;

export default function AcademicProbationPage() {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState(2.0);
  const [search, setSearch] = useState("");
  const [ay, setAy] = useState(DEFAULT_YEAR);
  const [sem, setSem] = useState(DEFAULT_SEMESTER);
  const [editRec, setEditRec] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: "", notes: "" });

  const { data: students = [] } = useQuery({
    queryKey: ["students_prob"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, student_code, first_name, last_name, prefix").eq("status", "active").order("student_code");
      return (data ?? []) as Student[];
    },
  });

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["scores_prob", ay, sem],
    queryFn: async () => {
      const { data } = await (supabase.from("student_scores" as any) as any).select("student_code, student_name, academic_year, semester, grade_point").eq("academic_year", toCE(ay)).eq("semester", sem).not("grade_point" as any, "is", null);
      // Map grade_point to gpax and synthesize student_id from student_code for compatibility
      const mapped = ((data as any[]) || []).map((r: any) => ({ student_id: r.student_code, student_code: r.student_code, academic_year: r.academic_year, semester: r.semester, gpax: r.grade_point }));
      return mapped as StudentScore[];
    },
  });

  const { data: probRecs = [] } = useQuery({
    queryKey: ["academic_probation", ay, sem],
    queryFn: async () => {
      const { data } = await (supabase as any).from("academic_probation").select("*").eq("academic_year", toCE(ay)).eq("semester", sem);
      return (data ?? []) as ProbationRecord[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (rec: any) => {
      const existing = probRecs.find((r) => r.student_id === rec.student_id);
      if (existing) {
        const { error } = await (supabase as any).from("academic_probation").update({ status: rec.status, notes: rec.notes, gpax: rec.gpax, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("academic_probation").insert(rec);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic_probation"] }),
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
    if (!editRec) return;
    upsert.mutate({ student_id: editRec.student_id, academic_year: toCE(ay), semester: sem, gpax: editRec.gpax ?? 0, status: editForm.status, notes: editForm.notes });
    setEditRec(null);
  };

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
              <span className="text-sm">GPAX &lt;</span>
              <Input type="number" step="0.1" min="0" max="4" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value) || 2.0)} className="w-20" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">ปีการศึกษา:</span>
              <Input type="number" value={ay} onChange={(e) => setAy(parseInt(e.target.value) || DEFAULT_YEAR)} className="w-24" />
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
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["scores_prob", "academic_probation"] })}>
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
                <TableHead className="text-right">GPAX</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-[80px]">จัดการ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
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
          <p className="text-xs text-muted-foreground">แสดง {filtered.length} นักเรียนที่มี GPAX ต่ำกว่า {threshold.toFixed(1)}</p>
        </CardContent>
      </Card>

      <Dialog open={!!editRec} onOpenChange={() => setEditRec(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>จัดการสถานะ - {editRec?.student_code}</DialogTitle></DialogHeader>
          {editRec && (
            <div className="space-y-3">
              <div className="text-sm">
                <p>GPAX: <strong>{editRec.gpax?.toFixed(2)}</strong></p>
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
            <Button onClick={saveEdit} disabled={!editForm.status}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
