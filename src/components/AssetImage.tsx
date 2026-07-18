import { useAssetPhotoUrl } from "@/lib/assetPhotoUrl";
import type { ImgHTMLAttributes } from "react";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  fallback?: string;
}

/** <img> wrapper that resolves asset-photos private bucket URLs to a signed URL on render. */
export function AssetImage({ src, fallback, alt, ...rest }: Props) {
  const resolved = useAssetPhotoUrl(src);
  return <img src={resolved || fallback || ""} alt={alt || ""} {...rest} />;
}
