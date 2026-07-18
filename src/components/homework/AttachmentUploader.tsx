import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Camera } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import { isNative, pickNativePhoto } from "@/lib/native";
import { uploadHomeworkFile, type Attachment } from "@/lib/homeworkStorage";
import { toast } from "sonner";

interface Props {
  folder: string;
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
  /** แสดงปุ่ม "ถ่ายรูป" (เปิดกล้องบนมือถือ) */
  enableCamera?: boolean;
  /** แสดงปุ่ม "อัดเสียง" — แนบเป็นไฟล์เสียง */
  enableVoice?: boolean;
}

export default function AttachmentUploader({
  folder, value, onChange, maxFiles = 5, maxSizeMB = 25, accept, label = "แนบไฟล์",
  enableCamera = true, enableVoice = false,
}: Props) {
  const camRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (value.length + files.length > maxFiles) {
      toast.error(`แนบได้สูงสุด ${maxFiles} ไฟล์`);
      return;
    }
    setBusy(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} ใหญ่เกิน ${maxSizeMB}MB`);
        continue;
      }
      try {
        const att = await uploadHomeworkFile(file, folder);
        next.push(att);
      } catch (e: any) {
        toast.error(`อัปโหลด ${file.name} ล้มเหลว: ${e?.message || e}`);
      }
    }
    onChange(next);
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };

  const remove = (id: string) => onChange(value.filter((v) => v.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Paperclip className="w-4 h-4 mr-1" />}
          {label}
        </Button>
        {enableCamera && (
          <>
            <input
              ref={camRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button" size="sm" variant="outline" disabled={busy}
              onClick={async () => {
                if (isNative()) {
                  try {
                    const file = await pickNativePhoto({ source: "camera" });
                    if (file) await handleFiles({ 0: file, length: 1, item: () => file } as any);
                  } catch (e: any) {
                    if (!/cancel/i.test(e?.message || "")) toast.error(e?.message || "เปิดกล้องไม่ได้");
                  }
                } else {
                  camRef.current?.click();
                }
              }}
            >
              <Camera className="w-4 h-4 mr-1" /> ถ่ายรูป
            </Button>
          </>
        )}
        {enableVoice && (
          <VoiceRecorder
            label="อัดเสียง"
            onRecorded={async (file) => {
              if (value.length >= maxFiles) { toast.error(`แนบได้สูงสุด ${maxFiles} ไฟล์`); return; }
              try {
                const att = await uploadHomeworkFile(file, folder);
                onChange([...value, att]);
              } catch (e: any) {
                toast.error(`อัปโหลดเสียงล้มเหลว: ${e?.message || e}`);
              }
            }}
          />
        )}
        <span className="text-xs text-muted-foreground">PDF/รูป/ไฟล์ ไม่เกิน {maxSizeMB}MB · สูงสุด {maxFiles} ไฟล์</span>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1 bg-muted/30">
              <span className="truncate">{a.name} <span className="text-muted-foreground">({Math.round(a.size / 1024)} KB)</span></span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(a.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
