import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, Image } from "lucide-react";
import { SCORE_LEVELS } from "@/lib/paIndicators";
import { SignedImage } from "@/components/ui/SignedImage";

interface IndicatorValue {
  score: number;
  evidence: string;
  evaluator_comment: string;
  evidence_images: string[];
}

interface Props {
  scoreId: string;
  indicatorNumber: number;
  indicatorTitle: string;
  description?: string;
  value: IndicatorValue;
  isEditable: boolean;
  canManageAll: boolean;
  paId: string;
  onValueChange: (val: IndicatorValue) => void;
}

export default function PAIndicatorCard({
  scoreId, indicatorNumber, indicatorTitle, description,
  value, isEditable, canManageAll, paId, onValueChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages = [...value.evidence_images];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} ไม่ใช่ไฟล์รูปภาพ`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} ขนาดเกิน 5MB`);
        continue;
      }

      const ext = file.name.split(".").pop();
      const path = `${paId}/${scoreId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("pa-files").upload(path, file);
      if (error) {
        toast.error("อัปโหลดไม่สำเร็จ: " + error.message);
        continue;
      }
      newImages.push(path);
    }

    onValueChange({ ...value, evidence_images: newImages });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    const newImages = value.evidence_images.filter((_, i) => i !== idx);
    onValueChange({ ...value, evidence_images: newImages });
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-sm">ตัวชี้วัดที่ {indicatorNumber}: {indicatorTitle}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex-shrink-0 w-32">
          {isEditable ? (
            <Select
              value={String(value.score)}
              onValueChange={(v) => onValueChange({ ...value, score: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCORE_LEVELS.map(l => (
                  <SelectItem key={l.value} value={String(l.value)}>{l.value} - {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="text-sm">{value.score} - {SCORE_LEVELS.find(l => l.value === value.score)?.label}</Badge>
          )}
        </div>
      </div>

      {isEditable ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">หลักฐาน/ผลงาน</Label>
              <Textarea
                value={value.evidence}
                onChange={(e) => onValueChange({ ...value, evidence: e.target.value })}
                rows={2}
                className="text-xs"
                placeholder="ระบุหลักฐาน..."
              />
            </div>
            {canManageAll && (
              <div>
                <Label className="text-xs">ความเห็นผู้ประเมิน</Label>
                <Textarea
                  value={value.evaluator_comment}
                  onChange={(e) => onValueChange({ ...value, evaluator_comment: e.target.value })}
                  rows={2}
                  className="text-xs"
                  placeholder="ความเห็น..."
                />
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <Label className="text-xs flex items-center gap-1"><Image className="w-3 h-3" /> รูปภาพประกอบ</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {value.evidence_images.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-md overflow-hidden border">
                  <SignedImage bucket="pa-files" path={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-20 h-20 flex flex-col items-center justify-center gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
                <span className="text-[10px]">{uploading ? "..." : "เพิ่มรูป"}</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {value.evidence && <p>📎 {value.evidence}</p>}
            {value.evaluator_comment && <p>💬 {value.evaluator_comment}</p>}
          </div>
          {value.evidence_images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.evidence_images.map((url, idx) => (
                <SignedImage key={idx} bucket="pa-files" path={url} alt="" className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
