import { useArUrl } from "@/lib/arMedia";

interface ArImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

/** แสดงรูปจากคลังสื่อ AR (รองรับทั้งลิงก์ภายนอกและไฟล์ในระบบ) */
export const ArImage = ({ src, alt, className }: ArImageProps) => {
  const url = useArUrl(src);
  if (!url) return null;
  return <img src={url} alt={alt} loading="lazy" className={className} />;
};

export default ArImage;
