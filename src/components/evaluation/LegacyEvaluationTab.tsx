import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star, FileText } from "lucide-react";

const EVAL_TYPES = [
  { value: "performance", th: "ประเมินผลการปฏิบัติงาน" },
  { value: "360_degree", th: "ประเมิน 360 องศา" },
  { value: "competency", th: "ประเมินสมรรถนะ" },
  { value: "kpi", th: "ตัวชี้วัดผลงาน (KPI)" },
  { value: "self", th: "ประเมินตนเอง" },
];

export default function LegacyEvaluationTab() {
  const qc = useQueryClient();
  const { isAdmin, isDirector, userId } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const [open, setOpen] = useState(false);
  const [personnelId, setPersonnelId] = useState("");
  const [evalType, setEvalType] = useState("performance");
  const [evaluator, setEvaluator] = useState("");
  const [score, setScore] = useState("0");
  const [maxScore, setMaxScore] = useState("100");
  const [comments, setComments] = useState("");

  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-legacy", userId],
    enabled: !!userId && !canManageAll,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("employee_code").eq("id", userId!).maybeSingle();
      if (!profile?.employee_code) return null;
      const { data } = await supabase.from("personnel").select("id").eq("employee_code", profile.employee_code).maybeSingle();
      return data;
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("employee_code");
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: canManageAll ? ["staff_evaluations"] : ["my_staff_evaluations", myPersonnel?.id],
    enabled: canManageAll || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("staff_evaluations").select("*, personnel(prefix, first_name, last_name, employee_code, position)");
      if (!canManageAll && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data } = await q.order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAdd = async () => {
    const targetId = canManageAll ? personnelId : myPersonnel?.id;
    if (!targetId || !evaluator) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const { error } = await supabase.from("staff_evaluations").insert({
      personnel_id: targetId, evaluator_name: evaluator,
      evaluation_type: evalType,
      score: parseFloat(score), max_score: parseFloat(maxScore), comments,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกสำเร็จ");
    qc.invalidateQueries({ queryKey: ["staff_evaluations"] });
    setOpen(false); setEvaluator(""); setScore("0"); setComments("");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("staff_evaluations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["staff_evaluations"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-2" />บันทึกการประเมิน</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>บันทึกการประเมินทั่วไป</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {canManageAll ? (
                <div><Label>ผู้ถูกประเมิน *</Label>
                  <Select value={personnelId} onValueChange={setPersonnelId}>
                    <SelectTrigger><SelectValue placeholder="เลือกบุคลากร" /></SelectTrigger>
                    <SelectContent>{personnel.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.employee_code} - {p.prefix}{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : null}
              <div><Label>ประเภท</Label>
                <Select value={evalType} onValueChange={setEvalType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.th}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>ผู้ประเมิน *</Label><Input value={evaluator} onChange={e => setEvaluator(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>คะแนนที่ได้</Label><Input type="number" value={score} onChange={e => setScore(e.target.value)} /></div>
                <div><Label>คะแนนเต็ม</Label><Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} /></div>
              </div>
              <div><Label>ความคิดเห็น</Label><Textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} /></div>
              <Button onClick={handleAdd} className="w-full">บันทึก</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ผู้ถูกประเมิน</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>ผู้ประเมิน</TableHead>
            <TableHead>คะแนน</TableHead>
            <TableHead>ความคิดเห็น</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => {
              const pct = Number(r.max_score) > 0 ? (Number(r.score) / Number(r.max_score)) * 100 : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.personnel ? `${r.personnel.prefix || ""}${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell>
                  <TableCell><Badge variant="outline">{EVAL_TYPES.find(t => t.value === r.evaluation_type)?.th || r.evaluation_type}</Badge></TableCell>
                  <TableCell>{r.evaluator_name}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Progress value={pct} className="w-16 h-2" /><span className="text-sm">{r.score}/{r.max_score}</span></div></TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.comments || "-"}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
            {records.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
