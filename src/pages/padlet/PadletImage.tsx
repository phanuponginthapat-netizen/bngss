import { useEffect, useState } from "react";
import { ImageOff, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PadletImage({ src, name, pending, retry }: {
  src?: string;
  name: string;
  pending: boolean;
  retry: () => Promise<void>;
}) {
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (src && !failed) return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={name} onError={() => setFailed(true)} className="w-full rounded mb-2 border border-border" loading="lazy" />
    </a>
  );
  return (
    <div className="mb-2 min-h-36 flex flex-col items-center justify-center gap-2 rounded border border-border bg-background/70 p-3 text-center" role="status">
      {pending || retrying ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <ImageOff className="h-6 w-6 text-muted-foreground" />}
      <p className="text-xs text-muted-foreground">{pending || retrying ? "กำลังโหลดรูป…" : "ไม่สามารถอ่านไฟล์รูปได้"}</p>
      <p className="w-full break-all text-xs text-muted-foreground">{name}</p>
      {!pending && <Button variant="outline" size="sm" disabled={retrying} className="gap-1" onClick={async () => {
        setRetrying(true);
        setFailed(false);
        try { await retry(); } finally { setRetrying(false); }
      }}><RotateCw className="h-3 w-3" />ลองใหม่</Button>}
    </div>
  );
}