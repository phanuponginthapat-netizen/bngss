import { useRef } from "react";
import { Paperclip, X, Loader2, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_FILE_ACCEPT, type AiAttachment } from "@/lib/aiAttachments";
import { IAPP_FILE_ACCEPT } from "@/lib/iappOcr";
export function AiFileAttachment({ file, reading, disabled, onPick, onRemove }: { file: AiAttachment | null; reading: boolean; disabled: boolean; onPick: (file: File, ocr?: boolean) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);
  return <div className="flex items-center gap-2 min-w-0">
    <input ref={ocrRef} type="file" accept={IAPP_FILE_ACCEPT} className="hidden" aria-label="เอกสารสแกน iApp" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) onPick(selected, true); }} />
    <Button type="button" variant="ghost" size="icon" aria-label="อ่านเอกสารสแกนด้วย iApp" title="อ่าน PDF สแกนหรือรูปเอกสารด้วย iApp" disabled={disabled || reading} onClick={() => ocrRef.current?.click()}><ScanText className="w-4 h-4" /></Button>
    <input ref={ref} type="file" accept={AI_FILE_ACCEPT} className="hidden" aria-label="ไฟล์ประกอบ AI" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) onPick(selected); }} />
    <Button type="button" variant="ghost" size="icon" aria-label="แนบไฟล์เอกสาร" title="แนบ PDF, Word, Excel หรือข้อความ" disabled={disabled || reading} onClick={() => ref.current?.click()}>{reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}</Button>
    {file && <><span className="text-xs truncate" title={file.name}>{file.name}</span><Button type="button" variant="ghost" size="icon" aria-label="นำไฟล์แนบออก" disabled={disabled || reading} onClick={onRemove}><X className="w-3 h-3" /></Button></>}
  </div>;
}