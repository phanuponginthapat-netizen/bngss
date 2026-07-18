import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Pencil, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { signedHomeworkUrl, isImageMime, isPdfMime, isEditableMime, type Attachment } from "@/lib/homeworkStorage";
import HomeworkEditor from "./HomeworkEditor";
import { toast } from "sonner";

interface Props {
  attachments: Attachment[];
  canEdit?: boolean; // show "open editor" button (for students replying)
  onEditedSave?: (blob: Blob, filename: string, source: Attachment) => Promise<void> | void;
  dense?: boolean;
}

export default function AttachmentList({ attachments, canEdit, onEditedSave, dense }: Props) {
  const [editing, setEditing] = useState<Attachment | null>(null);

  if (!attachments?.length) return null;

  const open = async (a: Attachment) => {
    try {
      const url = await signedHomeworkUrl(a.path);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "เปิดไฟล์ไม่สำเร็จ");
    }
  };

  return (
    <div className={`space-y-1.5 ${dense ? "" : "mt-1"}`}>
      {attachments.map((a) => {
        const Icon = isImageMime(a.mime) ? ImageIcon : isPdfMime(a.mime) ? FileText : FileIcon;
        return (
          <div key={a.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 bg-muted/30">
            <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1" title={a.name}>{a.name}</span>
            <span className="text-muted-foreground shrink-0">{Math.round(a.size / 1024)} KB</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => open(a)} title="เปิด/ดาวน์โหลด">
              <Download className="w-3.5 h-3.5" />
            </Button>
            {canEdit && isEditableMime(a.mime, a.name) && (
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditing(a)} title="แก้ไขในเว็บ">
                <Pencil className="w-3.5 h-3.5 mr-1" /> แก้ไข
              </Button>
            )}
          </div>
        );
      })}
      <HomeworkEditor
        open={!!editing}
        attachment={editing}
        onClose={() => setEditing(null)}
        onSave={async (blob, filename) => {
          if (editing && onEditedSave) await onEditedSave(blob, filename, editing);
        }}
      />
    </div>
  );
}
