import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { SubmissionAttachmentPreview } from "./SubmissionAttachmentPreview";
import PdfWorksheetPlayer from "./PdfWorksheetPlayer";
import { type WorksheetField } from "@/lib/pdfWorksheet";
import { EFORM_PAGE_STYLE } from "@/lib/eformLayout";
import DOMPurify from "dompurify";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignmentId: string | null;
}

export function HomeworkSubmissionsDialog({ open, onOpenChange, assignmentId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [assignmentPdfUrl, setAssignmentPdfUrl] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  

  const load = async () => {
    if (!assignmentId) return;
    setLoading(true);
    const { data: a } = await supabase.from("homework_assignments").select("*").eq("id", assignmentId).maybeSingle();
    setAssignment(a);
    setAssignmentPdfUrl("");
    if (a?.pdf_path) {
      const { data: signed } = await supabase.storage.from("homework-files").createSignedUrl(a.pdf_path, 3600);
      setAssignmentPdfUrl(signed?.signedUrl || "");
    }
    const { data: subs } = await supabase
      .from("homework_submissions" as any)
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: false });
    // resolve student names
    const ids = Array.from(new Set((subs || []).map((s: any) => s.student_id)));
    const map: Record<string, string> = {};
    const authMap: Record<string, string> = {};
    if (ids.length) {
      const { data: students } = await supabase.from("students").select("id,prefix,first_name,last_name,student_code,auth_user_id").in("id", ids);
      (students || []).forEach((p: any) => {
        map[p.id] = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim() + (p.student_code ? ` (${p.student_code})` : "");
        if (p.auth_user_id) authMap[p.id] = p.auth_user_id;
      });
      const missingIds = ids.filter((id: any) => !map[id]);
      if (missingIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,student_code").in("id", missingIds);
        (profs || []).forEach((p: any) => {
          map[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() + (p.student_code ? ` (${p.student_code})` : "");
          authMap[p.id] = p.id;
        });
      }
    }
    const enriched = (subs || []).map((s: any) => ({ ...s, _name: map[s.student_id] || s.student_id.slice(0, 8), _authUserId: authMap[s.student_id] || null }));
    setRows(enriched);
    const d: Record<string, { score: string; feedback: string }> = {};
    enriched.forEach((s: any) => { d[s.id] = { score: s.score?.toString() || "", feedback: s.feedback || "" }; });
    setDrafts(d);
    setLoading(false);
  };

  useEffect(() => { if (open && assignmentId) load(); }, [open, assignmentId]);


  const grade = async (s: any) => {
    const d = drafts[s.id];
    const score = d.score === "" ? null : Number(d.score);
    if (score !== null && Number.isNaN(score)) { toast.error("คะแนนต้องเป็นตัวเลข"); return; }
    const { error } = await supabase.from("homework_submissions" as any).update({
      score, feedback: d.feedback, status: "graded", graded_at: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกคะแนนแล้ว");
    notify({
      user_ids: s._authUserId ? [s._authUserId] : [],
      title: "ครูตรวจการบ้านแล้ว",
      body: `${assignment?.title || "ใบงาน"}: ${score !== null ? `คะแนน ${score}` : "ดูฟีดแบ็ก"}`,
      url: "/dashboard/homework",
    }).catch(() => {});
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[100dvw] h-[100dvh] max-w-none rounded-none sm:w-auto sm:h-auto sm:max-w-4xl sm:max-h-[92vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>การส่งงาน — {assignment?.title || ""}</DialogTitle>
        </DialogHeader>


        {assignment?.pdf_path && (
          <div className="border rounded-md bg-muted/20 p-2 space-y-1">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> ใบงานของครู
            </div>
            <SubmissionAttachmentPreview
              bucket="homework-files"
              path={assignment.pdf_path}
              name={(assignment.pdf_path.split("/").pop()) || "assignment.pdf"}
            />
          </div>
        )}

        {!assignment?.pdf_path && assignment?.content_html && (
          <div className="border rounded-md bg-muted/20 p-2 space-y-1">
            <div className="text-xs font-medium flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> ใบงานของครู</div>
            <div className="overflow-auto rounded bg-slate-100 p-2 max-h-72">
              <div className="eform-preview-page mx-auto bg-white shadow border max-w-none" style={EFORM_PAGE_STYLE} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(assignment.content_html || "") }} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">ยังไม่มีนักเรียนส่งงาน</p>
        ) : (
          <div className="flex-1 overflow-auto space-y-3">
            {rows.map((s) => (
              <div key={s.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{s._name}</div>
                    <div className="text-xs text-muted-foreground">
                      ส่งเมื่อ {s.submitted_at ? new Date(s.submitted_at).toLocaleString("th-TH") : "—"}
                    </div>
                  </div>
                  <Badge variant={s.status === "graded" ? "default" : "secondary"}>{s.status}</Badge>
                </div>

                {!assignment?.pdf_path && Object.keys(s.answers || {}).length > 0 && (
                  <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
                    {Object.entries(s.answers).map(([k, v]) => (
                      <div key={k}><b>{k}:</b> {String(v)}</div>
                    ))}
                  </div>
                )}

                {assignment?.pdf_path && assignmentPdfUrl && (
                  <div className="rounded-md border bg-muted/20 p-2">
                    <PdfWorksheetPlayer
                      pdfUrl={assignmentPdfUrl}
                      fields={((assignment.worksheet_fields || []) as WorksheetField[])}
                      answers={s.answers || {}}
                      onAnswersChange={() => {}}
                      readOnly
                      showResults={s.status === "submitted" || s.status === "graded"}
                      compact
                    />
                  </div>
                )}

                {(s.attachments || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {s.attachments.map((a: any, i: number) => (
                      <SubmissionAttachmentPreview
                        key={i}
                        bucket={a.id ? "homework-files" : "homework"}
                        path={a.path}
                        name={a.name}
                        size={a.size}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground">คะแนน</label>
                    <Input
                      type="number" className="h-8"
                      value={drafts[s.id]?.score || ""}
                      onChange={(e) => setDrafts(d => ({ ...d, [s.id]: { ...d[s.id], score: e.target.value } }))}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">ฟีดแบ็ก</label>
                    <Textarea
                      rows={1} className="text-sm min-h-[2rem]"
                      value={drafts[s.id]?.feedback || ""}
                      onChange={(e) => setDrafts(d => ({ ...d, [s.id]: { ...d[s.id], feedback: e.target.value } }))}
                    />
                  </div>
                  <Button size="sm" onClick={() => grade(s)}>บันทึก</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default HomeworkSubmissionsDialog;
