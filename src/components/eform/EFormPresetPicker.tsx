import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FilePlus2, Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { EFORM_PRESETS, PRESET_CATEGORIES, type EFormPreset } from "@/lib/eformPresets";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPickBlank: () => void;
  onPickPreset: (p: EFormPreset) => void;
  onPickPdf: () => void;
  onPickWordHtml?: (html: string, fileName: string) => void;
}

export function EFormPresetPicker({ open, onOpenChange, onPickBlank, onPickPreset, onPickPdf, onPickWordHtml }: Props) {
  const [cat, setCat] = useState("all");
  const wordInputRef = useRef<HTMLInputElement>(null);
  const list = cat === "all" ? EFORM_PRESETS : EFORM_PRESETS.filter(p => p.category === cat);

  const handleWordFile = async (file: File) => {
    if (!onPickWordHtml) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".doc") && !lower.endsWith(".docx")) {
      toast.error("ไฟล์ .doc รุ่นเก่าไม่รองรับ — กรุณา Save As เป็น .docx ก่อน");
      return;
    }
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const buf = await file.arrayBuffer();
      const result = await (mammoth as any).convertToHtml({ arrayBuffer: buf });
      const html = `<div style="font-family:'Sarabun', sans-serif;font-size:16px;line-height:1.4;">${result.value || ""}</div>`;
      onPickWordHtml(html, file.name.replace(/\.docx?$/i, ""));
      toast.success("นำเข้าไฟล์ Word สำเร็จ — สามารถแก้ไขต่อในตัวออกแบบได้");
    } catch (e: any) {
      toast.error("แปลงไฟล์ไม่สำเร็จ: " + (e?.message || ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เริ่มสร้างต้นแบบ E-Form</DialogTitle>
          <DialogDescription>
            เลือกต้นแบบสำเร็จรูป (ตามระเบียบงานสารบรรณ / สพฐ.) แล้วดัดแปลงในตัวออกแบบได้ทันที
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {PRESET_CATEGORIES.map(c => (
            <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "outline"} onClick={() => setCat(c.id)}>
              {c.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <Card className="border-dashed hover:border-primary cursor-pointer transition-colors" onClick={onPickBlank}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2"><FilePlus2 className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">เริ่มจากเอกสารเปล่า</h3>
                <p className="text-xs text-muted-foreground">ออกแบบเองตั้งแต่ต้น (HTML editor)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed hover:border-primary cursor-pointer transition-colors" onClick={onPickPdf}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 text-primary p-2"><Upload className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">อัพโหลด PDF แล้ววางช่องกรอกทับ</h3>
                <p className="text-xs text-muted-foreground">เหมาะกับฟอร์มราชการที่มีอยู่แล้ว — แค่ลากช่องกรอกบน PDF</p>
              </div>
            </CardContent>
          </Card>

          {onPickWordHtml && (
            <Card className="border-dashed hover:border-primary cursor-pointer transition-colors" onClick={() => wordInputRef.current?.click()}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 text-primary p-2"><FileUp className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">นำเข้าจากไฟล์ Word (.docx)</h3>
                  <p className="text-xs text-muted-foreground">แปลงเนื้อหา Word เป็น HTML แล้วแก้ไขต่อใน rich-text editor (รองรับเฉพาะ .docx)</p>
                </div>
                <input
                  ref={wordInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onClick={e => e.stopPropagation()}
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = "";
                    if (f) await handleWordFile(f);
                  }}
                />
              </CardContent>
            </Card>
          )}

          {list.map(p => (
            <Card key={p.id} className="hover:border-primary cursor-pointer transition-colors" onClick={() => onPickPreset(p)}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 text-primary p-2"><FileText className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">{p.fields.length} ช่อง</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
