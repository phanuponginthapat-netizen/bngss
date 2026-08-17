import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import AttachmentUploader from "./AttachmentUploader";
import AttachmentList from "./AttachmentList";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { saveErrorMessage } from "@/lib/saveError";

export type Reply = {
  id: string;
  by_user_id?: string | null;
  by_role: "teacher" | "student" | "parent" | "admin" | "director";
  by_name: string;
  text: string;
  at: string;
  attachments?: Attachment[];
};

interface Props {
  taskId: string;
  replies: Reply[];
  teacherAttachments?: Attachment[];
  currentUserId: string | null | undefined;
  currentRole: Reply["by_role"];
  currentName: string;
  invalidateKeys?: any[][];
  compact?: boolean;
}

const roleLabel: Record<Reply["by_role"], string> = {
  teacher: "ครู", student: "นักเรียน", parent: "ผู้ปกครอง", admin: "ผู้ดูแล", director: "ผอ.",
};
const roleColor: Record<Reply["by_role"], string> = {
  teacher: "bg-primary/10 text-primary",
  student: "bg-emerald-100 text-emerald-700",
  parent: "bg-amber-100 text-amber-700",
  admin: "bg-rose-100 text-rose-700",
  director: "bg-purple-100 text-purple-700",
};

export default function HomeworkReplies({
  taskId, replies, teacherAttachments = [], currentUserId, currentRole, currentName, invalidateKeys = [], compact,
}: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);

  const sendReply = async (extraAttachments: Attachment[] = []) => {
    const merged = [...pending, ...extraAttachments];
    const t = text.trim();
    if (!t && merged.length === 0) {
      toast.error("พิมพ์ข้อความหรือแนบไฟล์อย่างน้อย 1 อย่าง");
      return;
    }
    setBusy(true);
    const newReply: Reply = {
      id: crypto.randomUUID(),
      by_user_id: currentUserId || null,
      by_role: currentRole,
      by_name: currentName || roleLabel[currentRole],
      text: t,
      at: new Date().toISOString(),
      attachments: merged,
    };
    const next = [...(replies || []), newReply];
    const { error } = await supabase.from("task_assignments").update({ replies: next as any }).eq("id", taskId);
    setBusy(false);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    setText("");
    setPending([]);
    toast.success("ส่งแล้ว");
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  // When a student edits a teacher's attachment and saves
  const handleEditedSave = async (blob: Blob, filename: string, source: Attachment) => {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      const att = await uploadHomeworkFile(file, `replies/${taskId}`);
      toast.success("กำลังแนบไฟล์ที่แก้ไข...");
      await sendReply([{ ...att, name: filename }]);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {teacherAttachments.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">ไฟล์การบ้าน</div>
          <AttachmentList
            attachments={teacherAttachments}
            canEdit={currentRole === "student" || currentRole === "parent"}
            onEditedSave={handleEditedSave}
            dense
          />
        </div>
      )}

      {(replies?.length || 0) > 0 && (
        <div className={`space-y-2 max-h-72 overflow-y-auto rounded-md ${compact ? "" : "border border-border p-2 bg-muted/20"}`}>
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 h-fit ${roleColor[r.by_role] || "bg-muted"}`}>
                {roleLabel[r.by_role] || r.by_role}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.by_name}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {r.text && <p className="text-foreground whitespace-pre-wrap break-words">{r.text}</p>}
                {r.attachments && r.attachments.length > 0 && (
                  <div className="mt-1">
                    <AttachmentList attachments={r.attachments} dense />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t pt-2">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ตอบกลับ / ส่งคำตอบ..."
          className="text-sm"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <AttachmentUploader
            folder={`replies/${taskId}`}
            value={pending}
            onChange={setPending}
            maxFiles={5}
            label="แนบไฟล์คำตอบ"
          />
          <Button size="sm" onClick={() => sendReply()} disabled={busy || (!text.trim() && pending.length === 0)}>
            <Send className="w-3.5 h-3.5 mr-1" /> ส่ง
          </Button>
        </div>
      </div>
    </div>
  );
}
