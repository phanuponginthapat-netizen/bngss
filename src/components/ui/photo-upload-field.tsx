import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Camera, X, ImageIcon, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { compressImage } from "@/lib/imageCompress";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  /** Public bucket. Default "cms-images" */
  bucket?: string;
  /** Folder prefix inside bucket */
  folder?: string;
  /** Allow pasting an external URL as fallback */
  allowUrl?: boolean;
  /** Max size in MB (default 5) */
  maxMB?: number;
}

/** Upload/camera-based image picker. Stores the public URL string. */
export function PhotoUploadField({
  value,
  onChange,
  bucket = "cms-images",
  folder = "uploads",
  allowUrl = true,
  maxMB = 5,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`ไฟล์ต้องไม่เกิน ${maxMB}MB`);
      return;
    }
    setUploading(true);
    try {
      let payload: File | Blob = file;
      try {
        payload = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 });
      } catch {
        /* compression optional */
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${folder}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const result = await uploadPublicFileWithFallback(bucket, path, payload, {
        upsert: false,
        contentType: file.type,
      });
      onChange(result.publicUrl);
      toast.success(result.usedFallback ? "อัปโหลด (แบบสำรอง)" : "อัปโหลดรูปแล้ว");
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
        <div className="space-y-2 flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1" />
              )}
              {value ? "เปลี่ยน" : "อัปโหลด"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => camRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="w-4 h-4 mr-1" />
              ถ่ายภาพ
            </Button>
          </div>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="w-full text-destructive h-7"
            >
              <X className="w-4 h-4 mr-1" />
              ลบรูป
            </Button>
          )}
        </div>
      </div>
      {allowUrl && (
        <div>
          {!showUrl ? (
            <button
              type="button"
              onClick={() => {
                setUrlDraft(value || "");
                setShowUrl(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Link2 className="w-3 h-3" />
              หรือใส่ลิงก์ URL
            </button>
          ) : (
            <div className="flex gap-1">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(urlDraft.trim() || null);
                  setShowUrl(false);
                }}
              >
                ใช้
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowUrl(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        รองรับ PNG, JPG, WebP ไม่เกิน {maxMB}MB
      </p>
    </div>
  );
}
