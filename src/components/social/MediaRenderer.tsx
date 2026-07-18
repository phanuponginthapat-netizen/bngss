import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driveEmbed, youtubeEmbed, type MediaType } from "@/lib/media";
import { createStorageSignedUrl } from "@/lib/storageUrl";

interface Props {
  mediaType: MediaType;
  mediaUrl: string;
  displayMode?: "preview" | "download" | "embed";
  fileName?: string | null;
  title?: string;
}

export default function MediaRenderer({
  mediaType,
  mediaUrl: rawUrl,
  displayMode = "preview",
  fileName,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string>(rawUrl?.startsWith("portfolio://") ? "" : rawUrl);

  useEffect(() => {
    if (rawUrl?.startsWith("portfolio://")) {
      const path = rawUrl.replace(/^portfolio:\/\//, "");
      createStorageSignedUrl("portfolio", path, 60 * 60 * 6).then((u) => setMediaUrl(u || ""));
    } else {
      setMediaUrl(rawUrl);
    }
  }, [rawUrl]);

  if (rawUrl?.startsWith("portfolio://") && !mediaUrl) {
    return <div className="text-xs text-muted-foreground p-3">กำลังโหลด...</div>;
  }

  if (displayMode === "download" && (mediaType === "pdf" || mediaType === "image" || mediaType === "video")) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
        <FileText className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || title || "ไฟล์แนบ"}</p>
          <p className="text-xs text-muted-foreground capitalize">{mediaType}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download>
            <Download className="w-4 h-4 mr-1" />ดาวน์โหลด
          </a>
        </Button>
      </div>
    );
  }

  if (mediaType === "youtube") {
    const src = youtubeEmbed(mediaUrl);
    if (!src) return <LinkFallback url={mediaUrl} />;
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={src}
          title={title || "YouTube"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (mediaType === "drive") {
    const src = driveEmbed(mediaUrl);
    if (!src) return <LinkFallback url={mediaUrl} />;
    return (
      <div className="aspect-video rounded-lg overflow-hidden border bg-muted">
        <iframe src={src} title={title || "Drive"} className="w-full h-full" allow="autoplay" />
      </div>
    );
  }

  if (mediaType === "image") {
    return (
      <>
        <img
          src={mediaUrl}
          alt={title || ""}
          loading="lazy"
          className="w-full max-h-[600px] object-contain rounded-lg bg-muted cursor-zoom-in"
          onClick={() => setOpen(true)}
        />
        {open && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setOpen(false)}
          >
            <img src={mediaUrl} alt={title || ""} className="max-w-full max-h-full" />
          </div>
        )}
      </>
    );
  }

  if (mediaType === "video") {
    return (
      <video controls preload="metadata" className="w-full max-h-[600px] rounded-lg bg-black">
        <source src={mediaUrl} />
      </video>
    );
  }

  if (mediaType === "pdf") {
    return (
      <div className="space-y-2">
        <iframe
          src={mediaUrl}
          title={title || "PDF"}
          className="w-full h-[600px] rounded-lg border bg-white"
        />
        <Button asChild size="sm" variant="outline">
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" />เปิดเต็มหน้า
          </a>
        </Button>
      </div>
    );
  }

  return <LinkFallback url={mediaUrl} title={title} />;
}

function LinkFallback({ url, title }: { url: string; title?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted transition"
    >
      <ExternalLink className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium truncate flex-1">{title || url}</span>
      <Play className="w-4 h-4 text-muted-foreground" />
    </a>
  );
}
