import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, Paperclip } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptic } from "@/lib/haptics";

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** Show camera-capture button (mobile only useful) */
  showCamera?: boolean;
  /** Show gallery picker */
  showGallery?: boolean;
  /** Show generic file attach */
  showFile?: boolean;
  disabled?: boolean;
}

/**
 * Facebook composer-style attachment row: snap photo, pick from gallery, or attach a file.
 */
export function QuickCameraUpload({
  onFiles,
  accept = "image/*",
  multiple = true,
  showCamera = true,
  showGallery = true,
  showFile = true,
  disabled,
}: Props) {
  const { lang } = useLanguage();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) { haptic("light"); onFiles(files); }
    e.target.value = "";
  };

  return (
    <div className="flex flex-wrap gap-2">
      {showCamera && (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => cameraRef.current?.click()} className="gap-1.5">
            <Camera className="w-4 h-4 text-success" />
            <span>{L("ถ่ายภาพ", "Camera")}</span>
          </Button>
        </>
      )}
      {showGallery && (
        <>
          <input ref={galleryRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handle} />
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => galleryRef.current?.click()} className="gap-1.5">
            <ImageIcon className="w-4 h-4 text-info" />
            <span>{L("รูปภาพ", "Gallery")}</span>
          </Button>
        </>
      )}
      {showFile && (
        <>
          <input ref={fileRef} type="file" multiple={multiple} className="hidden" onChange={handle} />
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Paperclip className="w-4 h-4 text-info" />
            <span>{L("ไฟล์แนบ", "File")}</span>
          </Button>
        </>
      )}
    </div>
  );
}
