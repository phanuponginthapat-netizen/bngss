import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileText, ExternalLink, X } from "lucide-react";

interface Props {
  paId: string;
  isEditable: boolean;
  pdfFileUrl: string;
  pdfFileName: string;
  onPdfChange: (url: string, name: string) => void;
}

export default function PAPdfUpload({ paId, isEditable, pdfFileUrl, pdfFileName, onPdfChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>("");

  useEffect(() => {
    if (pdfFileUrl) resolveStorageUrl("pa-files", pdfFileUrl).then(setSignedUrl);
    else setSignedUrl("");
  }, [pdfFileUrl]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("กรุณาเลือกไฟล์ PDF เท่านั้น");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("ไฟล์ขนาดเกิน 20MB");
      return;
    }

    setUploading(true);
    const path = sanitizeStorageKey(`${paId}/pdf/${Date.now()}_${file.name}`);
    const { error } = await supabase.storage.from("pa-files").upload(path, file);
    if (error) {
      toast.error("อัปโหลดไม่สำเร็จ: " + error.message);
      setUploading(false);
      return;
    }
    onPdfChange(path, file.name);
    toast.success("อัปโหลดไฟล์ PDF สำเร็จ");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePdf = () => {
    onPdfChange("", "");
  };

  if (!isEditable && !pdfFileUrl) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          ไฟล์รูปเล่ม PA (PDF)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pdfFileUrl ? (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <FileText className="w-8 h-8 text-danger flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pdfFileName || "PA Document.pdf"}</p>
              <a href={signedUrl || pdfFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> เปิดดูไฟล์
              </a>
            </div>
            {isEditable && (
              <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={removePdf}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : isEditable ? (
          <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">อัปโหลดไฟล์ PDF รูปเล่ม PA (สูงสุด 20MB)</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4 mr-1" />{uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์ PDF"}
            </Button>
          </div>
        ) : null}
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
      </CardContent>
    </Card>
  );
}
