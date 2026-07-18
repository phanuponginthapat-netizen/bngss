// Media helpers for portfolio & wall posts

export type MediaType = "pdf" | "image" | "video" | "youtube" | "drive" | "link";

export function detectMediaTypeFromUrl(url: string): MediaType {
  const u = url.toLowerCase();
  if (/(youtube\.com|youtu\.be)/.test(u)) return "youtube";
  if (/drive\.google\.com/.test(u)) return "drive";
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(u)) return "video";
  if (/\.pdf(\?|$)/.test(u)) return "pdf";
  return "link";
}

export function youtubeEmbed(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function driveEmbed(url: string): string | null {
  const m =
    url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    url.match(/drive\.google\.com\/.*[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function detectTypeFromFile(file: File): MediaType {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t === "application/pdf" || fileExt(file.name) === "pdf") return "pdf";
  return "link";
}
