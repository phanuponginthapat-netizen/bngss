import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText, Loader2 } from "lucide-react";
import { renderPdfToImages, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Props {
  bucket: string;
  path: string;
  name: string;
  size?: number;
}

const isImage = (n: string) => /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)$/i.test(n);
const isPdf = (n: string) => /\.pdf$/i.test(n);
const isVideo = (n: string) => /\.(mp4|webm|mov|m4v)$/i.test(n);
const isAudio = (n: string) => /\.(mp3|wav|ogg|m4a|aac)$/i.test(n);

export function SubmissionAttachmentPreview({ bucket, path, name, size }: Props) {
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(false);
  useBodyScrollLock(zoom);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) {
        setUrl(data?.signedUrl || "");
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setUrl("");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  const header = (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{name}</span>
        {size ? <span className="text-muted-foreground shrink-0">· {Math.round(size / 1024)} KB</span> : null}
      </div>
      {url && (
        <div className="flex items-center gap-1 shrink-0">
          <Button asChild size="sm" variant="ghost" className="h-6 px-2">
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-6 px-2">
            <a href={url} download={name}><Download className="w-3 h-3" /></a>
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="border rounded-md p-2 bg-muted/20">
        {header}
        <div className="h-24 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (!url) {
    return <div className="border rounded-md p-2 bg-destructive/5 text-xs text-destructive">โหลดไม่สำเร็จ: {name}</div>;
  }

  return (
    <div className="border rounded-md p-2 bg-muted/20 space-y-2">
      {header}
      {isImage(name) ? (
        <>
          <img
            src={url}
            alt={name}
            loading="lazy"
            className="w-full max-h-80 object-contain rounded bg-black/5 cursor-zoom-in"
            onClick={() => setZoom(true)}
          />
          {zoom && (
            <div
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setZoom(false)}
            >
              <img src={url} alt={name} className="max-w-full max-h-full" />
            </div>
          )}
        </>
      ) : isPdf(name) ? (
        <PdfPreviewImages url={url} name={name} />
      ) : isVideo(name) ? (
        <video controls preload="metadata" className="w-full max-h-80 rounded bg-black">
          <source src={url} />
        </video>
      ) : isAudio(name) ? (
        <audio controls src={url} className="w-full" />
      ) : (
        <div className="text-xs text-muted-foreground">ไม่รองรับการดูตัวอย่าง — กดเปิด/ดาวน์โหลดด้านบน</div>
      )}
    </div>
  );
}

function PdfPreviewImages({ url, name }: { url: string; name: string }) {
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setFailed(false);
    renderPdfToImages(url, 760)
      .then((imgs) => { if (!cancelled) setPages(imgs.slice(0, 2)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  if (failed) return <div className="text-xs text-muted-foreground">ดูตัวอย่าง PDF ไม่สำเร็จ — กดเปิด/ดาวน์โหลดด้านบน</div>;
  if (!pages.length) return <div className="h-28 flex items-center justify-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  return (
    <div className="space-y-2">
      {pages.map((p) => (
        <img key={p.page} src={p.dataUrl} alt={`${name} หน้า ${p.page}`} loading="lazy" className="w-full rounded border bg-white object-contain" />
      ))}
    </div>
  );
}

export default SubmissionAttachmentPreview;
