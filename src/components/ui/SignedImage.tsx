import { useEffect, useState } from "react";
import { resolveStorageUrl } from "@/lib/storageUrl";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path?: string | null;
  fallback?: string;
}

/**
 * แสดงรูปจาก private bucket โดยสร้าง signed URL อัตโนมัติ
 * รองรับทั้ง path (ใหม่) และ legacy public URL (เก่า)
 */
export function SignedImage({ bucket, path, fallback = "", alt = "", ...rest }: Props) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    if (!path) {
      setUrl(fallback);
      return;
    }
    resolveStorageUrl(bucket, path).then((u) => {
      if (mounted) setUrl(u || fallback);
    });
    return () => {
      mounted = false;
    };
  }, [bucket, path, fallback]);

  if (!url) return null;
  return <img src={url} alt={alt} loading="lazy" decoding="async" {...rest} />;
}