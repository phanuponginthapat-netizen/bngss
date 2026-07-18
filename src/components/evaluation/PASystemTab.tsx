import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Eye, Trash2, Send, Upload, FileText, ExternalLink } from "lucide-react";
import PAFormDialog from "./PAFormDialog";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { confirmDelete } from "@/lib/confirmAction";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "ร่าง", variant: "secondary" },
  submitted: { label: "รอประเมิน", variant: "default" },
  evaluated: { label: "ประเมินแล้ว", variant: "outline" },
  approved: { label: "อนุมัติ", variant: "default" },
};

const MAX_TOTAL = 100;

export default function PASystemTab() {
  const qc = useQueryClient();
  const { isAdmin, isDirector, userId } = useUserRole();
  const canManageAll = isAdmin || isDirector;

  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Find my personnel id (for teachers)
  const { data: myPersonnel } = useQuery({
    queryKey: ["my-personnel-pa", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("employee_code").eq("id", userId!).maybeSingle();
      if (!profile?.employee_code) return null;
      const { data } = await supabase.from("personnel").select("id, position").eq("employee_code", profile.employee_code).maybeSingle();
      return data;
    },
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["pa_agreements_list", canManageAll, myPersonnel?.id],
    enabled: canManageAll || !!myPersonnel?.id,
    queryFn: async () => {
      let q = supabase.from("pa_agreements")
        .select("*, personnel(prefix, first_name, last_name, employee_code, position)");
      if (!canManageAll && myPersonnel?.id) q = q.eq("personnel_id", myPersonnel.id);
      const { data } = await q.order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) { toast.error("กรุณากรอกหัวข้อ PA"); return; }
    if (!myPersonnel?.id) { toast.error("ไม่พบข้อมูลบุคลากรของคุณ"); return; }
    setCreating(true);
    try {
      let pdf_path: string | null = null;
      let pdf_name: string | null = null;
      if (pdfFile) {
        if (pdfFile.size > 20 * 1024 * 1024) { toast.error("ไฟล์ขนาดเกิน 20MB"); return; }
        const path = sanitizeStorageKey(`${userId}/pa/${Date.now()}_${pdfFile.name}`);
        const { error: upErr } = await supabase.storage.from("pa-files").upload(path, pdfFile, { contentType: pdfFile.type });
        if (upErr) { toast.error("อัปโหลดล้มเหลว: " + upErr.message); return; }
        pdf_path = path;
        pdf_name = pdfFile.name;
      }
      const { error } = await supabase.from("pa_agreements").insert({
        personnel_id: myPersonnel.id,
        title: newTitle.trim(),
        position_type: "teacher",
        created_by: userId,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        pdf_file_url: pdf_path,
        pdf_file_name: pdf_name,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("ส่ง PA สำเร็จ");
      qc.invalidateQueries({ queryKey: ["pa_agreements_list"] });
      setCreateOpen(false);
      setNewTitle("");
      setPdfFile(null);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete("ยืนยันลบ PA นี้?"))) return;
    await supabase.from("pa_agreements").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["pa_agreements_list"] });
    toast.success("ลบสำเร็จ");
  };

  const openPdf = async (path: string) => {
    const { data } = await supabase.storage.from("pa-files").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">ทั้งหมด</p>
          <p className="text-2xl font-bold text-primary">{agreements.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">รอประเมิน</p>
          <p className="text-2xl font-bold text-warning">{agreements.filter((a: any) => a.status === "submitted").length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">ประเมินแล้ว</p>
          <p className="text-2xl font-bold text-success">{agreements.filter((a: any) => ["evaluated","approved"].includes(a.status)).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">คะแนนเฉลี่ย</p>
          <p className="text-2xl font-bold text-foreground">
            {(() => {
              const evaluated = agreements.filter((a: any) => ["evaluated","approved"].includes(a.status));
              if (!evaluated.length) return "-";
              const avg = evaluated.reduce((s: number, a: any) => s + Number(a.total_score || 0), 0) / evaluated.length;
              return `${avg.toFixed(1)}/${MAX_TOTAL}`;
            })()}
          </p>
        </CardContent></Card>
      </div>

      {/* Create button — only for teachers (canManageAll = admin/director do not submit; they only score) */}
      {!canManageAll && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />ส่ง PA ใหม่</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>ส่งข้อตกลง PA</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>หัวข้อ PA *</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="เช่น ข้อตกลงในการพัฒนางาน ปีงบประมาณ 2569" />
                </div>
                <div>
                  <Label>ไฟล์แนบ (PDF)</Label>
                  <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                  {pdfFile && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {pdfFile.name}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>ยกเลิก</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "กำลังส่ง..." : <><Send className="w-4 h-4 mr-1" />ส่ง</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* PA List */}
      <div className="grid gap-3">
        {agreements.map((a: any) => {
          const pName = a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "-";
          const st = STATUS_MAP[a.status] || STATUS_MAP.draft;
          const isScored = ["evaluated","approved"].includes(a.status) || Number(a.total_score) > 0;
          return (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{a.title || "(ไม่มีหัวข้อ)"}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {isScored && (
                        <Badge variant="outline" className="bg-success-soft text-success border-success/30">
                          {Number(a.total_score || 0).toFixed(1)}/{MAX_TOTAL} คะแนน
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      โดย: {pName} {a.personnel?.position ? `(${a.personnel.position})` : ""} · ส่งเมื่อ {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("th-TH") : "-"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    {a.pdf_file_url && (
                      <Button variant="ghost" size="sm" onClick={() => openPdf(a.pdf_file_url)}>
                        <ExternalLink className="w-4 h-4 mr-1" />เปิดไฟล์
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setViewId(a.id)}>
                      <Eye className="w-4 h-4 mr-1" />
                      {canManageAll ? "บันทึกคะแนน" : "ดูคะแนน"}
                    </Button>
                    {(canManageAll || a.created_by === userId) && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
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
            {canManageAll
              ? "ยังไม่มี PA ที่ครูส่งมา"
              : "ยังไม่มี PA ของคุณ — กดปุ่ม \"ส่ง PA ใหม่\" เพื่อเริ่มต้น"}
          </CardContent></Card>
        )}
      </div>

      {viewId && (
        <PAFormDialog
          paId={viewId}
          open={!!viewId}
          onClose={() => { setViewId(null); qc.invalidateQueries({ queryKey: ["pa_agreements_list"] }); }}
          canManageAll={canManageAll}
        />
      )}
    </div>
  );
}
