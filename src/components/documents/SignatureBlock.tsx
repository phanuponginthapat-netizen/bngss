import { useDefaultSignature, useSignatureById, type DirectorSignature } from "@/hooks/useSignatures";

interface SignatureBlockProps {
  /** ถ้าระบุจะใช้ลายเซ็นนี้ ไม่งั้นใช้ default */
  signatureId?: string | null;
  /** override ชื่อ (ใช้เมื่อต้องการบังคับชื่อแม้ไม่มีลายเซ็นใน DB) */
  fallbackName?: string;
  /** override ตำแหน่ง */
  fallbackPosition?: string;
  /** แสดงวันที่ใต้ลายเซ็น */
  showDate?: boolean;
  /** ขนาดลายเซ็น */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { sig: "h-10", line: "w-32" },
  md: { sig: "h-14", line: "w-44" },
  lg: { sig: "h-20", line: "w-56" },
};

/**
 * บล็อกลายเซ็นมาตรฐาน — ใช้ใน e-form, ใบลา, certificate, ปพ.5/6/7/8 ฯลฯ
 * รองรับลายเซ็นภาพ (data URL) ที่อยู่บนเส้นบรรทัด พร้อมชื่อ+ตำแหน่งใต้เส้น
 */
export const SignatureBlock = ({
  signatureId,
  fallbackName,
  fallbackPosition,
  showDate = false,
  size = "md",
  className = "",
}: SignatureBlockProps) => {
  const defaultSig = useDefaultSignature();
  const explicitSig = useSignatureById(signatureId);
  const sig: DirectorSignature | null = signatureId ? explicitSig : defaultSig;

  const name = sig?.name || fallbackName || "";
  const position = sig?.position || fallbackPosition || "ผู้อำนวยการโรงเรียน";
  const s = sizeMap[size];

  return (
    <div className={`text-center ${className}`}>
      <div className={`${s.sig} flex items-end justify-center mb-1`}>
        {sig?.signature_url ? (
          <img
            src={sig.signature_url}
            alt={`ลายเซ็น ${name}`}
            className="max-h-full max-w-full object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <span className="text-xs text-muted-foreground italic print:hidden">(ยังไม่ตั้งลายเซ็น)</span>
        )}
      </div>
      <div className={`${s.line} border-b border-foreground/60 print:border-black/70 mx-auto`} />
      <p className="text-sm font-medium text-foreground print:text-black mt-2">
        {name ? `(${name})` : "(ลงชื่อ)"}
      </p>
      <p className="text-xs text-muted-foreground print:text-neutral">{position}</p>
      {showDate && (
        <p className="text-xs text-muted-foreground print:text-neutral mt-2">
          วันที่ ......./......../.........
        </p>
      )}
    </div>
  );
};

export default SignatureBlock;
