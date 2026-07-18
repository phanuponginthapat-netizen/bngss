import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Pencil, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { signedHomeworkUrl, isImageMime, isPdfMime, isEditableMime, type Attachment } from "@/lib/homeworkStorage";
import HomeworkEditor from "./HomeworkEditor";
import { toast } from "sonner";
import { renderPdfToImages, type WorksheetPageImage } from "@/lib/pdfWorksheet";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Props {
  attachments: Attachment[];
  canEdit?: boolean;
  onEditedSave?: (blob: Blob, filename: string, source: Attachment) => Promise<void> | void;
  dense?: boolean;
}

const attachmentKey = (a: Attachment, index?: number) => a.id || a.path || `${a.name}-${index ?? 0}`;

/** โหลด signed URL ให้ทุกไฟล์ (ใช้แสดง preview รูป/PDF โดยไม่ต้องกดเปิด) */
function useSignedUrls(attachments: Attachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        attachments
          .filter((a) => isImageMime(a.mime, a.name) || isPdfMime(a.mime, a.name))
          .map(async (a) => {
            try {
              next[attachmentKey(a)] = await signedHomeworkUrl(a.path);
            } catch {
              /* ignore */
            }
          })
      );
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.map((a, i) => attachmentKey(a, i)).join("|")]);
  return urls;
}

export default function AttachmentList({ attachments, canEdit, onEditedSave, dense }: Props) {
  const [editing, setEditing] = useState<Attachment | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  useBodyScrollLock(!!lightbox);
  const imageUrls = useSignedUrls(attachments || []);

  if (!attachments?.length) return null;

  const open = async (a: Attachment) => {
    try {
      const url = imageUrls[attachmentKey(a)] || (await signedHomeworkUrl(a.path));
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "เปิดไฟล์ไม่สำเร็จ");
    }
  };

  const images = attachments.filter((a) => isImageMime(a.mime, a.name));
  const others = attachments.filter((a) => !isImageMime(a.mime, a.name));

  return (
    <div className={`space-y-2 ${dense ? "" : "mt-1"}`}>
      {/* Inline image previews — ไม่ต้องกดเปิด */}
      {images.length > 0 && (
        <div className={`grid gap-2 ${dense ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
          {images.map((a, index) => {
            const url = imageUrls[attachmentKey(a, index)];
            return (
              <button
                type="button"
                key={attachmentKey(a, index)}
                onClick={() => url && setLightbox(url)}
                className={`group relative rounded-lg overflow-hidden border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary ${dense ? "aspect-square" : "min-h-[260px] max-h-[520px]"}`}
                title={a.name}
              >
                {url ? (
                  <img
                    src={url}
                    alt={a.name}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full transition-transform group-hover:scale-[1.02] ${dense ? "object-cover" : "object-contain"}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6 animate-pulse" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                  <div className="text-[10px] text-white truncate">{a.name}</div>
                </div>
                {canEdit && isEditableMime(a.mime, a.name) && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(a);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditing(a);
                      }
                    }}
                    className="absolute top-1 right-1 bg-white/90 hover:bg-white text-foreground rounded-md p-1 shadow cursor-pointer"
                    title="แก้ไข"
                  >
                    <Pencil className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Non-image files: PDF gets inline preview, others keep row layout */}
      {others.map((a, index) => {
        const isPdf = isPdfMime(a.mime, a.name);
        const Icon = isPdf ? FileText : FileIcon;
        const pdfUrl = isPdf ? imageUrls[attachmentKey(a, index)] : null;
        return (
          <div key={attachmentKey(a, index)} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 bg-muted/30">
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1" title={a.name}>{a.name}</span>
              {typeof a.size === "number" && <span className="text-muted-foreground shrink-0">{Math.round(a.size / 1024)} KB</span>}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => open(a)} title="เปิด/ดาวน์โหลด">
                <Download className="w-3.5 h-3.5" />
              </Button>
              {canEdit && isEditableMime(a.mime, a.name) && (
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditing(a)} title="แก้ไขในเว็บ">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> แก้ไข
                </Button>
              )}
            </div>
            {pdfUrl && (
              <PdfPreview url={pdfUrl} title={a.name} />
            )}
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="preview" className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}

      <HomeworkEditor
        open={!!editing}
        attachment={editing}
        onClose={() => setEditing(null)}
        onSave={async (blob, filename) => {
          if (editing && onEditedSave) await onEditedSave(blob, filename, editing);
        }}
      />
    </div>
  );
}

function PdfPreview({ url, title }: { url: string; title: string }) {
  const [pages, setPages] = useState<WorksheetPageImage[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setFailed(false);
    renderPdfToImages(url, 720)
      .then((imgs) => { if (!cancelled) setPages(imgs.slice(0, 2)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  if (failed) {
    return (
      <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
        ดูตัวอย่าง PDF ไม่สำเร็จ — กดปุ่มเปิด/ดาวน์โหลดด้านบน
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className="rounded-lg border bg-muted/10 h-40 flex items-center justify-center text-muted-foreground">
        <FileText className="w-6 h-6 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border bg-muted/10 space-y-2 p-2">
      {pages.map((p) => (
        <img
          key={p.page}
          src={p.dataUrl}
          alt={`${title} หน้า ${p.page}`}
          loading="lazy"
          className="w-full rounded bg-background object-contain"
        />
      ))}
    </div>
  );
}
