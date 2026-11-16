import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { Paperclip, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TaskAttachment {
  path: string;
  name?: string;
}

export const parseAttachments = (raw: unknown): TaskAttachment[] => {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((a: any) => (typeof a === "string" ? { path: a } : a))
    .filter((a: any) => a && typeof a.path === "string") as TaskAttachment[];
};

export const TaskAttachmentViewer = ({ attachments }: { attachments: unknown }) => {
  const items = parseAttachments(attachments);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setUrls([]);
    if (items.length === 0) {
      setUrls([]);
      return;
    }
    (async () => {
      const results = await Promise.allSettled(items.map((item) => resolveStorageUrl("task-attachments", item.path)));
      if (!alive) return;
      setUrls(results.map(result => result.status === "fulfilled" ? result.value : null));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), attempt]);

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Paperclip className="w-3 h-3" />
        รูปแนบ {items.length} รูป
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => u ? (
          <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
            <img
              src={u}
              alt={items[i]?.name || `รูปแนบงานที่ ${i + 1}`}
              loading="lazy"
              onError={() => setUrls(current => current.map((value, index) => index === i ? null : value))}
              className="w-20 h-20 object-cover rounded-lg border border-border/60 hover:opacity-90 transition"
            />
          </a>
        ) : (
          <div key={i} className="flex w-20 h-20 flex-col items-center justify-center border border-border rounded-md text-muted-foreground">
            <span className="text-[11px]">เปิดรูปไม่ได้</span>
            <Button variant="ghost" size="icon" aria-label={`ลองเปิด ${items[i]?.name || `รูปที่ ${i + 1}`} อีกครั้ง`} title="ลองเปิดอีกครั้ง" onClick={() => setAttempt(value => value + 1)}><RotateCw className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskAttachmentViewer;
