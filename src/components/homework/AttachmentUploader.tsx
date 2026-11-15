import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Mic, Video } from "lucide-react";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";
import MediaCaptureButtons from "./MediaCaptureButtons";

interface Props {
  folder: string;
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
}

export default function AttachmentUploader({ folder, value, onChange, maxFiles = 5, maxSizeMB = 25, accept, label = "แนบไฟล์" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const [busy, setBusy] = useState(false);
  const add = async (file: File) => {
    if (latest.current.length >= maxFiles) throw new Error(`แนบได้สูงสุด ${maxFiles} ไฟล์`);
    if (file.size > maxSizeMB * 1024 * 1024) throw new Error(`${file.name} ใหญ่เกิน ${maxSizeMB}MB`);
    const att = await uploadHomeworkFile(file, folder);
    const next = [...latest.current, att];
    latest.current = next;
    onChange(next);
  };
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (latest.current.length + files.length > maxFiles) { toast.error(`แนบได้สูงสุด ${maxFiles} ไฟล์`); return; }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        try { await add(file); }
        catch (e) { toast.error(e instanceof Error ? e.message : `อัปโหลด ${file.name} ไม่สำเร็จ`); }
      }
    } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" multiple accept={accept} className="hidden" onChange={e => handleFiles(e.target.files)} />
      <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy || value.length >= maxFiles}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}{label}
      </Button>
      <MediaCaptureButtons disabled={busy || value.length >= maxFiles} maxSizeMB={maxSizeMB} onCaptured={async file => { setBusy(true); try { await add(file); } finally { setBusy(false); } }} />
    </div>
    <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>ไม่เกิน {maxSizeMB} MB ต่อไฟล์</span><span>{value.length} / {maxFiles} ไฟล์</span></div>
    {value.length > 0 && <ul className="divide-y border-y">
      {value.map(a => <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
        {a.mime?.startsWith("audio/") ? <Mic className="h-4 w-4 shrink-0 text-primary" /> : a.mime?.startsWith("video/") ? <Video className="h-4 w-4 shrink-0 text-primary" /> : <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1"><p className="break-all">{a.name}</p><p className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} KB</p></div>
        <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => onChange(value.filter(v => v.id !== a.id))} aria-label={`ลบไฟล์ ${a.name}`} title="ลบไฟล์"><X className="h-4 w-4" /></Button>
      </li>)}
    </ul>}
  </div>;
}
