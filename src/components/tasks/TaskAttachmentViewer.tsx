import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip } from "lucide-react";

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
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    if (items.length === 0) {
      setUrls([]);
      return;
    }
    (async () => {
      const { data } = await supabase.storage
        .from("task-attachments")
        .createSignedUrls(items.map((i) => i.path), 3600);
      if (!alive) return;
      setUrls((data || []).map((d: any) => d?.signedUrl).filter(Boolean));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)]);

  if (items.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Paperclip className="w-3 h-3" />
        รูปแนบ {items.length} รูป
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer" className="block">
            <img
              src={u}
              alt={items[i]?.name || `รูปแนบงานที่ ${i + 1}`}
              loading="lazy"
              className="w-20 h-20 object-cover rounded-lg border border-border/60 hover:opacity-90 transition"
            />
          </a>
        ))}
      </div>
    </div>
  );
};

export default TaskAttachmentViewer;
