import { ImgHTMLAttributes } from "react";

/**
 * Lazy-loaded image with native browser API.
 * ใช้แทน <img> ปกติเพื่อไม่โหลดรูปจนกว่าจะเลื่อนเห็น
 */
export function LazyImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}
