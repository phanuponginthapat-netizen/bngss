import { useEffect, useState } from "react";
import { AiFileAttachment } from "./AiFileAttachment";
import type { AiAttachment } from "@/lib/aiAttachments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { schoolToolLabels, type SchoolTool } from "@/lib/schoolTools";
export function SchoolToolDialog({ tool, draft, busy, attachment, reading, onPick, onRemove, onClose, onGenerate }: { tool: SchoolTool | null; draft: string; busy: boolean; attachment: AiAttachment | null; reading: boolean; onPick: (file: File, ocr?: boolean) => void; onRemove: () => void; onClose: () => void; onGenerate: (topic: string, grade: string, count: number) => void }) {
  const [topic, setTopic] = useState(""); const [grade, setGrade] = useState(""); const [count, setCount] = useState(5);
  useEffect(() => { if (tool) setTopic(draft); }, [tool, draft]);
  return <Dialog open={Boolean(tool)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="z-[150] flex flex-col gap-5 max-h-[100dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{tool ? schoolToolLabels[tool] : "เครื่องมือ AI"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (topic.trim() && !busy && !reading) onGenerate(topic.trim(), grade.trim(), count); }}>
        <AiFileAttachment file={attachment} reading={reading} disabled={busy} onPick={onPick} onRemove={onRemove} />
        <div className="space-y-2"><Label htmlFor="school-ai-topic">{tool === "grades" ? "คะแนน/เกรด พร้อมปีการศึกษาและภาคเรียน" : "วิชา หัวข้อ และรายละเอียดที่ต้องการ"}</Label><Textarea id="school-ai-topic" value={topic} onChange={e => setTopic(e.target.value)} maxLength={2000} rows={5} required placeholder={tool === "grades" ? "วางข้อมูลคะแนนที่ต้องการสรุป โดยไม่ใส่ข้อมูลส่วนตัวที่ไม่จำเป็น" : "เช่น คณิตศาสตร์ เรื่องร้อยละ ฝึกประยุกต์ในชีวิตประจำวัน"} /></div>
        {tool !== "grades" && <div className="space-y-2"><Label htmlFor="school-ai-grade">ระดับชั้น</Label><Input id="school-ai-grade" value={grade} onChange={e => setGrade(e.target.value)} placeholder="เช่น ป.5" maxLength={80} required /></div>}
        {(tool === "worksheet" || tool === "quiz") && <div className="space-y-2"><Label htmlFor="school-ai-count">จำนวนข้อ</Label><Input id="school-ai-count" type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))} required /></div>}
        <p className="text-xs text-muted-foreground">ใช้เครดิต Lovable AI · ผลลัพธ์เป็นร่าง ยังไม่บันทึกลงงานโรงเรียน</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>กลับ</Button><Button type="submit" disabled={busy || reading || !topic.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}สร้าง</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}