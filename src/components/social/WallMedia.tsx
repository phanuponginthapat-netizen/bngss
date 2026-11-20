import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resolveSocialMedia } from "@/lib/socialMedia";
import { detectMediaTypeFromUrl } from "@/lib/media";
import MediaRenderer from "./MediaRenderer";

/** Keep each original reference independent: one failed file must not hide posts. */
export default function WallMedia({ reference }: { reference: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const version = ++request.current;
    setUrl("");
    setError(false);
    resolveSocialMedia(reference, "wall-media", revision > 0).then(value => {
      if (version === request.current) setUrl(value);
    }).catch(() => {
      if (version === request.current) setError(true);
    });
    return () => { request.current++; };
  }, [reference, revision]);
  if (error) return <div role="alert" className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
    <span>โหลดไฟล์แนบไม่สำเร็จ</span>
    <Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>ลองโหลดรูป/วิดีโอใหม่</Button>
  </div>;
  if (!url) return <div className="rounded-lg border p-4 text-sm text-muted-foreground">กำลังโหลดไฟล์แนบ...</div>;
  return <MediaRenderer key={revision} mediaType={detectMediaTypeFromUrl(reference)} mediaUrl={url} onMediaError={() => setError(true)} />;
}