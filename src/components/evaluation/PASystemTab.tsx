import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Eye, Trash2, Send, CheckCircle } from "lucide-react";
import { getIndicators, getResultLevel, SCORE_LEVELS, type PAIndicator } from "@/lib/paIndicators";
import PAFormDialog from "./PAFormDialog";
import { BE_OFFSET } from "@/lib/dateBE";
import { saveErrorMessage } from "@/lib/saveError";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "ร่าง", variant: "secondary" },
  submitted: { label: "ส่งแล้ว", variant: "default" },
  evaluated: { label: "ประเมินแล้ว", variant: "outline" },
  approved: { label: "อนุมัติ", variant: "default" },
};

export default function PASystemTab() {
  const qc = useQueryClient();
  const { isAdmin, isDirector, userId } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [newPersonnelId, setNewPersonnelId] = useState("");
  const [creating, setCreating] = useState(false);

  const inferPositionType = (position?: string | null): "teacher" | "director" | "vice_director" => {
    const p = (position || "").toString();
    if (p.includes("รอง") && p.includes("ผู้อำนวยการ")) return "vice_director";
    if (p.includes("ผู้อำนวยการ")) return "director";
    return "teacher";
  };

  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-pa", userId],
    enabled: !!userId && !canManageAll,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("employee_code").eq("id", userId!).maybeSingle();
      if (!profile?.employee_code) return null;
      const { data } = await supabase.from("personnel").select("id, position, position_level").eq("employee_code", profile.employee_code).maybeSingle();
      return data;
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-active"],
    enabled: canManageAll,
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("employee_code");
      return data || [];
    },
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["pa_agreements"],
    queryFn: async () => {
      let q = supabase.from("pa_agreements").select("*, personnel(prefix, first_name, last_name, employee_code, position, position_level)");
      if (!canManageAll && myPersonnel?.id) {
        q = q.eq("personnel_id", myPersonnel.id);
      }
      const { data } = await q.order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: canManageAll || !!myPersonnel?.id,
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      let targetId: string | undefined;
      let position: string | undefined;
      if (canManageAll) {
        targetId = newPersonnelId;
        const p = personnel.find((x: any) => x.id === newPersonnelId);
        position = p?.position;
      } else {
        targetId = myPersonnel?.id;
        position = (myPersonnel as any)?.position;
      }
      if (!targetId) { toast.error("กรุณาเลือกบุคลากร"); return; }
      const positionType = inferPositionType(position);
      const indicators = getIndicators(positionType);
      const { data: pa, error } = await supabase.from("pa_agreements").insert({
        personnel_id: targetId,
        position_type: positionType,
        created_by: userId,
      } as any).select().single();
      if (error) { toast.error(saveErrorMessage(error)); return; }
      const indicatorRows = indicators.map((ind) => ({
        pa_agreement_id: pa.id,
        domain: ind.domain,
        indicator_number: ind.number,
        indicator_title: ind.title,
        score: 0,
        max_score: 4,
      }));
      await supabase.from("pa_indicator_scores").insert(indicatorRows as any);
      toast.success("สร้างข้อตกลง PA สำเร็จ — กรอกรายละเอียดต่อได้เลย");
      qc.invalidateQueries({ queryKey: ["pa_agreements"] });
      setCreateOpen(false);
      setNewPersonnelId("");
      // เปิดฟอร์มกรอกรายละเอียดทันที
      setViewId(pa.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("pa_agreements").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pa_agreements"] });
    toast.success("ลบสำเร็จ");
  };

  const handleSubmit = async (id: string) => {
    await supabase.from("pa_agreements").update({ status: "submitted", submitted_at: new Date().toISOString() } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pa_agreements"] });
    toast.success("ส่งข้อตกลง PA สำเร็จ");
  };

  const handleApprove = async (id: string, totalScore: number) => {
    const level = getResultLevel(totalScore);
    await supabase.from("pa_agreements").update({
      status: "approved",
      total_score: totalScore,
      result_level: level.label,
      evaluated_at: new Date().toISOString(),
    } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["pa_agreements"] });
    toast.success("อนุมัติข้อตกลง PA สำเร็จ");
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">ทั้งหมด</p>
          <p className="text-2xl font-bold text-primary">{agreements.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">รอประเมิน</p>
          <p className="text-2xl font-bold text-orange-500">{agreements.filter((a: any) => a.status === "submitted").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">อนุมัติแล้ว</p>
          <p className="text-2xl font-bold text-emerald-600">{agreements.filter((a: any) => a.status === "approved").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">คะแนนเฉลี่ย</p>
          <p className="text-2xl font-bold text-foreground">
            {agreements.filter((a: any) => a.status === "approved").length > 0
              ? (agreements.filter((a: any) => a.status === "approved").reduce((s: number, a: any) => s + Number(a.total_score || 0), 0) / agreements.filter((a: any) => a.status === "approved").length).toFixed(2)
              : "-"}
          </p>
        </CardContent></Card>
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />สร้างข้อตกลง PA</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>สร้างข้อตกลง PA ใหม่</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {canManageAll && (
                <div>
                  <Label>บุคลากร *</Label>
                  <Select value={newPersonnelId} onValueChange={setNewPersonnelId}>
                    <SelectTrigger><SelectValue placeholder="เลือกบุคลากร" /></SelectTrigger>
                    <SelectContent>{personnel.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.employee_code} - {p.prefix}{p.first_name} {p.last_name}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ระบบจะดึง "ประเภทตำแหน่ง" จากข้อมูลบุคลากรอัตโนมัติ และเปิดฟอร์มกรอกรายละเอียดทันทีหลังสร้าง
              </p>
              <Button onClick={handleCreate} className="w-full" disabled={creating || (canManageAll && !newPersonnelId)}>
                {creating ? "กำลังสร้าง..." : "สร้างและเริ่มกรอก"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* PA List */}
      <div className="grid gap-3">
        {agreements.map((a: any) => {
          const pName = a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "-";
          const posLabel = a.position_type === "director" ? "ผอ." : a.position_type === "vice_director" ? "รอง ผอ." : "ครู";
          const st = STATUS_MAP[a.status] || STATUS_MAP.draft;
          const level = a.result_level ? getResultLevel(Number(a.total_score)) : null;
          return (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{pName}</span>
                      <Badge variant="outline">{posLabel}</Badge>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {a.result_level && (
                        <Badge className={`${level?.color} border`} variant="outline">{a.result_level}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ปีการศึกษา {(a.academic_year || 0) + BE_OFFSET} | ตำแหน่ง: {a.personnel?.position || "-"} {a.personnel?.position_level || ""}
                    </p>
                    {a.total_score > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={(Number(a.total_score) / 4) * 100} className="w-24 h-2" />
                        <span className="text-sm font-medium">{Number(a.total_score).toFixed(2)}/4.00</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setViewId(a.id)}>
                      <Eye className="w-4 h-4 mr-1" />ดู/แก้ไข
                    </Button>
                    {a.status === "draft" && (
                      <Button variant="default" size="sm" onClick={() => handleSubmit(a.id)}>
                        <Send className="w-4 h-4 mr-1" />ส่ง
                      </Button>
                    )}
                    {a.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`ยืนยันลบข้อตกลง PA ของ ${pName}?`)) handleDelete(a.id);
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {agreements.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            ยังไม่มีข้อตกลง PA — กดปุ่ม "สร้างข้อตกลง PA" เพื่อเริ่มต้น
          </CardContent></Card>
        )}
      </div>

      {/* View/Edit Dialog */}
      {viewId && (
        <PAFormDialog
          paId={viewId}
          open={!!viewId}
          onClose={() => { setViewId(null); qc.invalidateQueries({ queryKey: ["pa_agreements"] }); }}
          canManageAll={canManageAll}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}
