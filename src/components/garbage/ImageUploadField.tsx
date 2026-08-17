import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: "items" | "rewards";
}

export function ImageUploadField({ value, onChange, folder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 5 * 1024 * 1024) return toast.error("ไฟล์ต้องไม่เกิน 5MB");
    setUploading(true);
    try {
      const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "png").toLowerCase();
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const result = await uploadPublicFileWithFallback("garbage-images", path, file, { upsert: false, contentType: file.type });
      onChange(result.publicUrl);
      toast.success(result.usedFallback ? "อัปโหลดรูปสำเร็จแบบสำรองชั่วคราว" : "อัปโหลดรูปแล้ว");
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดล้มเหลว");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {value ? (
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="space-y-2 flex-1">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full">
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {value ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="w-full text-destructive">
              <X className="w-4 h-4 mr-1" />ลบรูป
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">รองรับ PNG, JPG, WebP ขนาดไม่เกิน 5MB</p>
    </div>
  );
}