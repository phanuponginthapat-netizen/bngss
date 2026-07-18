import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Save, CheckCircle, FileText, ExternalLink } from "lucide-react";

interface Props {
  paId: string;
  open: boolean;
  onClose: () => void;
  canManageAll: boolean;
}

// คะแนนเต็มแต่ละช่อง รวม 100
const MAX = { d1: 20, d2: 20, d3: 20, p2: 40 };
const TOTAL_MAX = MAX.d1 + MAX.d2 + MAX.d3 + MAX.p2;

const DOMAINS = [
  { key: "d1" as const, label: "1. ด้านการจัดการเรียนการสอน", max: MAX.d1 },
  { key: "d2" as const, label: "2. ด้านส่งเสริมสนับสนุนการเรียนรู้", max: MAX.d2 },
  { key: "d3" as const, label: "3. ด้านการพัฒนาตนเองและพัฒนาวิชาชีพ", max: MAX.d3 },
];

export default function PAFormDialog({ paId, open, onClose, canManageAll }: Props) {
  const { data: agreement, refetch } = useQuery({
    queryKey: ["pa_agreement_detail", paId],
    queryFn: async () => {
      const { data } = await supabase.from("pa_agreements")
        .select("*, personnel(prefix, first_name, last_name, employee_code, position)")
        .eq("id", paId).single();
      return data as any;
    },
  });

  const [scores, setScores] = useState({ d1: 0, d2: 0, d3: 0, p2: 0 });
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorComments, setEvaluatorComments] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agreement) {
      setScores({
        d1: Number(agreement.part1_d1_score || 0),
        d2: Number(agreement.part1_d2_score || 0),
        d3: Number(agreement.part1_d3_score || 0),
        p2: Number(agreement.part2_score || 0),
      });
      setEvaluatorName(agreement.evaluator_name || "");
      setEvaluatorComments(agreement.evaluator_comments || "");
    }
  }, [agreement]);

  if (!agreement) return null;

  const pName = agreement.personnel
    ? `${agreement.personnel.prefix || ""}${agreement.personnel.first_name} ${agreement.personnel.last_name}`
    : "-";
  const totalScore = scores.d1 + scores.d2 + scores.d3 + scores.p2;
  const pct = (totalScore / TOTAL_MAX) * 100;
  const isApproved = agreement.status === "approved";

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));

  const openPdf = async () => {
    if (!agreement.pdf_file_url) return;
    const { data } = await supabase.storage.from("pa-files").createSignedUrl(agreement.pdf_file_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleSave = async (markApproved = false) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("pa_agreements").update({
        part1_d1_score: scores.d1,
        part1_d2_score: scores.d2,
        part1_d3_score: scores.d3,
        part2_score: scores.p2,
        total_score: totalScore,
        evaluator_name: evaluatorName,
        evaluator_comments: evaluatorComments,
        ...(markApproved
          ? { status: "approved", evaluated_at: new Date().toISOString() }
          : { status: agreement.status === "submitted" ? "evaluated" : agreement.status }),
      } as any).eq("id", paId);
      if (error) { toast.error(error.message); return; }
      toast.success(markApproved ? "อนุมัติ PA แล้ว" : "บันทึกคะแนนสำเร็จ");
      refetch();
      if (markApproved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {agreement.title || "(ไม่มีหัวข้อ)"}
            <Badge variant="secondary">โดย {pName}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Score summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">คะแนนรวม</span>
                <span className="text-2xl font-bold text-primary">
                  {totalScore.toFixed(1)} / {TOTAL_MAX}
                </span>
              </div>
              <Progress value={pct} className="h-3" />
            </CardContent>
          </Card>

          {/* PDF File */}
          {agreement.pdf_file_url && (
            <Card>
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm">{agreement.pdf_file_name || "ไฟล์แนบ"}</span>
                </div>
                <Button variant="outline" size="sm" onClick={openPdf}>
                  <ExternalLink className="w-4 h-4 mr-1" />เปิดไฟล์
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Part 1: 3 domains */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ส่วนที่ 1: ผลการปฏิบัติงาน ({MAX.d1 + MAX.d2 + MAX.d3} คะแนน)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DOMAINS.map((dom) => (
                <div key={dom.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                  <Label className="text-sm">{dom.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={dom.max}
                      step="0.5"
                      disabled={!canManageAll || isApproved}
                      value={scores[dom.key]}
                      onChange={(e) => setScores((s) => ({ ...s, [dom.key]: clamp(parseFloat(e.target.value), dom.max) }))}
                      className="w-24 text-right"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">/ {dom.max}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Part 2 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">ส่วนที่ 2: ข้อตกลงในการพัฒนางาน — ประเด็นท้าทาย ({MAX.p2} คะแนน)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                <Label className="text-sm">คะแนนประเด็นท้าทาย</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={MAX.p2}
                    step="0.5"
                    disabled={!canManageAll || isApproved}
                    value={scores.p2}
                    onChange={(e) => setScores((s) => ({ ...s, p2: clamp(parseFloat(e.target.value), MAX.p2) }))}
                    className="w-24 text-right"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/ {MAX.p2}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evaluator */}
          {canManageAll && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">ผู้ประเมิน</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">ชื่อผู้ประเมิน</Label>
                  <Input value={evaluatorName} disabled={isApproved} onChange={(e) => setEvaluatorName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">ความคิดเห็น</Label>
                  <Textarea value={evaluatorComments} disabled={isApproved} onChange={(e) => setEvaluatorComments(e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>
          )}

          {!canManageAll && agreement.evaluator_comments && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">ความคิดเห็นผู้ประเมิน</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{agreement.evaluator_comments}</p>
                {agreement.evaluator_name && (
                  <p className="text-xs text-muted-foreground mt-2">— {agreement.evaluator_name}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          {canManageAll && !isApproved && (
            <>
              <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />บันทึกคะแนน
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="bg-success hover:bg-success">
                <CheckCircle className="w-4 h-4 mr-1" />บันทึก + อนุมัติ
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
