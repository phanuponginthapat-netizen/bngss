import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Plus } from "lucide-react";

export default function WpaPage(){
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [score, setScore] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["wpa-assessments"],
    queryFn: async () => {
      const { data } = await supabase.from("wpa_assessments").select("*, personnel(first_name, last_name, position)").order("created_at",{ascending:false});
      return (data as any[])||[];
    },
  });

  const create = async () => {
    if(!period.trim()) return toast.error("กรอกภาคเรียน");
    const { data: { user } } = await supabase.auth.getUser();
    // Find personnel id for current user if exists
    const { data: per } = await supabase.from("personnel").select("id").eq("user_id", user?.id).maybeSingle();
    const personnel_id = (per as any)?.id || null;
    const { error } = await supabase.from("wpa_assessments").insert({ personnel_id, period: period.trim(), score: score ? Number(score) : null, status: "draft" } as any);
    if(error) toast.error(error.message);
    else { toast.success("สร้าง วPA แล้ว"); setOpen(false); qc.invalidateQueries({queryKey:["wpa-assessments"]}); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-primary" /> ประเมิน วPA</h1>
        <Button onClick={()=>setOpen(true)}><Plus className="w-4 h-4 mr-1" /> สร้าง วPA</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ทั้งหมด</p><p className="text-3xl font-bold">{items.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ร่าง</p><p className="text-3xl font-bold">{items.filter((i:any)=>i.status==="draft").length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ส่งแล้ว</p><p className="text-3xl font-bold text-emerald-600">{items.filter((i:any)=>i.status!=="draft").length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">รายการ วPA</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ภาคเรียน</TableHead><TableHead>บุคลากร</TableHead><TableHead>คะแนน</TableHead><TableHead>สถานะ</TableHead><TableHead>สร้างเมื่อ</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((r:any)=> (
                <TableRow key={r.id}><TableCell>{r.period}</TableCell><TableCell>{r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : "-"}</TableCell><TableCell>{r.score ?? "-"}</TableCell><TableCell><Badge variant={r.status==="draft"?"secondary":"default"}>{r.status}</Badge></TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell></TableRow>
              ))}
              {items.length===0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ยังไม่มี วPA</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>สร้าง วPA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ภาคเรียน/ปี *</Label><Input value={period} onChange={e=>setPeriod(e.target.value)} placeholder="เช่น 1/2568" /></div>
            <div><Label>คะแนน (ถ้ามี)</Label><Input type="number" value={score} onChange={e=>setScore(e.target.value)} placeholder="0-100" /></div>
          </div>
          <DialogFooter><Button onClick={create}>บันทึก</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
