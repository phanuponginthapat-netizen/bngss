import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, CheckCircle, Upload, X, Image, FileText, ExternalLink } from "lucide-react";
import { getIndicators, getResultLevel, SCORE_LEVELS, type PAIndicator } from "@/lib/paIndicators";
import PAScoreSummary from "./PAScoreSummary";
import PAIndicatorCard from "./PAIndicatorCard";
import PAEvaluatorSection from "./PAEvaluatorSection";
import PAPdfUpload from "./PAPdfUpload";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props {
  paId: string;
  open: boolean;
  onClose: () => void;
  canManageAll: boolean;
  onApprove: (id: string, totalScore: number) => void;
}

export default function PAFormDialog({ paId, open, onClose, canManageAll, onApprove }: Props) {
  const qc = useQueryClient();

  const { data: agreement } = useQuery({
    queryKey: ["pa_agreement_detail", paId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pa_agreements")
        .select("*, personnel(prefix, first_name, last_name, employee_code, position, position_level)")
        .eq("id", paId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!paId && open,
  });

  const { data: scores = [], refetch: refetchScores } = useQuery({
    queryKey: ["pa_indicator_scores", paId],
    queryFn: async () => {
      const { data } = await supabase.from("pa_indicator_scores")
        .select("*")
        .eq("pa_agreement_id", paId)
        .order("domain")
        .order("indicator_number");
      return (data || []) as any[];
    },
  });

  const [localScores, setLocalScores] = useState<Record<string, { score: number; evidence: string; evaluator_comment: string; evidence_images: string[] }>>({});
  const [evaluatorName, setEvaluatorName] = useState("");
  const [evaluatorComments, setEvaluatorComments] = useState("");
  const [pdfFileUrl, setPdfFileUrl] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");

  useEffect(() => {
    if (scores.length > 0) {
      const map: Record<string, any> = {};
      scores.forEach((s: any) => {
        map[s.id] = {
          score: Number(s.score || 0),
          evidence: s.evidence || "",
          evaluator_comment: s.evaluator_comment || "",
          evidence_images: s.evidence_images || [],
        };
      });
      setLocalScores(map);
    }
  }, [scores]);

  useEffect(() => {
    if (agreement) {
      setEvaluatorName(agreement.evaluator_name || "");
      setEvaluatorComments(agreement.evaluator_comments || "");
      setPdfFileUrl((agreement as any).pdf_file_url || "");
      setPdfFileName((agreement as any).pdf_file_name || "");
    }
  }, [agreement]);

  if (!agreement) return null;

  const posType = agreement.position_type || "teacher";
  const indicators = getIndicators(posType);
  const domains = [...new Set(indicators.map(i => i.domain))];
  const isEditable = agreement.status === "draft" || (canManageAll && agreement.status === "submitted");
  const pName = agreement.personnel ? `${agreement.personnel.prefix || ""}${agreement.personnel.first_name} ${agreement.personnel.last_name}` : "-";

  const allScoreValues = Object.values(localScores).map(s => s.score);
  const totalAvg = allScoreValues.length > 0 ? allScoreValues.reduce((a, b) => a + b, 0) / allScoreValues.length : 0;
  const domainAvgs = domains.map(d => {
    const domainScoreIds = scores.filter((s: any) => s.domain === d).map((s: any) => s.id);
    const domainValues = domainScoreIds.map(id => localScores[id]?.score || 0);
    return {
      domain: d,
      avg: domainValues.length > 0 ? domainValues.reduce((a: number, b: number) => a + b, 0) / domainValues.length : 0,
    };
  });

  const handleSave = async () => {
    for (const [id, val] of Object.entries(localScores)) {
      await supabase.from("pa_indicator_scores").update({
        score: val.score,
        evidence: val.evidence,
        evaluator_comment: val.evaluator_comment,
        evidence_images: val.evidence_images,
      } as any).eq("id", id);
    }
    await supabase.from("pa_agreements").update({
      evaluator_name: evaluatorName,
      evaluator_comments: evaluatorComments,
      total_score: totalAvg,
      pdf_file_url: pdfFileUrl,
      pdf_file_name: pdfFileName,
    } as any).eq("id", paId);
    toast.success("บันทึกสำเร็จ");
    refetchScores();
  };

  const handleApproveClick = async () => {
    await handleSave();
    onApprove(paId, totalAvg);
    onClose();
  };

  const resultLevel = getResultLevel(totalAvg);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            ข้อตกลง PA — {pName}
            <Badge variant="outline">{posType === "director" ? "ผอ." : posType === "vice_director" ? "รอง ผอ." : "ครู"}</Badge>
            <Badge variant="secondary">ปี {(agreement.academic_year || 0) + BE_OFFSET}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <PAScoreSummary totalAvg={totalAvg} resultLevel={resultLevel} domainAvgs={domainAvgs} />

          {/* PDF Upload Section */}
          <PAPdfUpload
            paId={paId}
            isEditable={isEditable}
            pdfFileUrl={pdfFileUrl}
            pdfFileName={pdfFileName}
            onPdfChange={(url, name) => { setPdfFileUrl(url); setPdfFileName(name); }}
          />

          {/* Indicators by Domain */}
          {domains.map(d => {
            const domainIndicators = scores.filter((s: any) => s.domain === d);
            const domainTitle = indicators.find(i => i.domain === d)?.domainTitle || `ด้านที่ ${d}`;
            return (
              <Card key={d}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">ด้านที่ {d}: {domainTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {domainIndicators.map((s: any) => {
                    const ind = indicators.find(i => i.domain === s.domain && i.number === s.indicator_number);
                    const val = localScores[s.id] || { score: 0, evidence: "", evaluator_comment: "", evidence_images: [] };
                    return (
                      <PAIndicatorCard
                        key={s.id}
                        scoreId={s.id}
                        indicatorNumber={s.indicator_number}
                        indicatorTitle={s.indicator_title}
                        description={ind?.description}
                        value={val}
                        isEditable={isEditable}
                        canManageAll={canManageAll}
                        paId={paId}
                        onValueChange={(newVal) => setLocalScores(prev => ({ ...prev, [s.id]: newVal }))}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Evaluator Section */}
          {canManageAll && isEditable && (
            <PAEvaluatorSection
              evaluatorName={evaluatorName}
              evaluatorComments={evaluatorComments}
              onNameChange={setEvaluatorName}
              onCommentsChange={setEvaluatorComments}
            />
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {isEditable && (
              <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" />บันทึก</Button>
            )}
            {canManageAll && agreement.status === "submitted" && (
              <Button variant="default" onClick={handleApproveClick} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="w-4 h-4 mr-1" />อนุมัติ
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
