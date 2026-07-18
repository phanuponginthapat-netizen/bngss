import { useCmsValues } from "@/hooks/useCmsSettings";
import { useDefaultSignature, useSignatureById } from "@/hooks/useSignatures";

interface DocumentHeaderProps {
  showGaruda?: boolean;
  showSchoolSeal?: boolean;
  subtitle?: string;
  documentTitle: string;
}

interface SchoolInfo {
  school_name: string;
  school_name_en: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_website: string;
  school_logo: string;
  school_seal: string;
  garuda_emblem: string;
  obec_code: string;
  affiliation: string;
  academic_year: string;
  director_name: string;
  director_title: string;
  /** default signature image (data URL / storage URL). ใช้ฝัง <img> ใน HTML พิมพ์ได้เลย */
  director_signature_url: string;
}

/**
 * รวม CMS settings + default signature เป็น object เดียว — ใช้ทั่วระบบ
 * (header, footer, ID card, official docs, e-form, ใบลา, ใบอนุญาตออกนอก)
 * อ่านผ่าน bulk cache เดียวกัน → ไม่ยิง query ซ้ำ
 */
export const useSchoolInfo = (): SchoolInfo => {
  const m = useCmsValues([
    "school_name", "school_name_en", "school_address", "school_phone",
    "school_email", "school_website",
    "school_logo", "school_seal", "garuda_emblem",
    "obec_code", "affiliation", "academic_year",
    "director_name", "director_title",
  ]);
  const sig = useDefaultSignature();
  return {
    school_name: m.school_name || "โรงเรียน",
    school_name_en: m.school_name_en || "",
    school_address: m.school_address || "",
    school_phone: m.school_phone || "",
    school_email: m.school_email || "",
    school_website: m.school_website || "",
    school_logo: m.school_logo || "",
    school_seal: m.school_seal || "",
    garuda_emblem: m.garuda_emblem || "",
    obec_code: m.obec_code || "",
    affiliation: m.affiliation || "",
    academic_year: m.academic_year || "",
    director_name: sig?.name || m.director_name || "",
    director_title: sig?.position || m.director_title || "ผู้อำนวยการโรงเรียน",
    director_signature_url: sig?.signature_url || "",
  };
};

/** ใช้ใน print HTML — แทรกรูปลายเซ็นไว้บนเส้นบรรทัด ถ้ายังไม่ตั้งจะคืนสตริงว่าง */
export const signatureImgHtml = (url?: string, maxH = 48): string =>
  url
    ? `<img src="${url}" crossorigin="anonymous" style="max-height:${maxH}px;max-width:180px;object-fit:contain;display:block;margin:0 auto -6px;" />`
    : "";

const DocumentHeader = ({ showGaruda, showSchoolSeal, subtitle, documentTitle }: DocumentHeaderProps) => {
  const info = useSchoolInfo();

  return (
    <div className="text-center space-y-3 pb-4 border-b-2 border-foreground/20 print:border-black/40">
      <div className="flex items-center justify-center gap-6">
        {showGaruda && info.garuda_emblem && (
          <img src={info.garuda_emblem} alt="ตราครุฑ" className="w-16 h-16 object-contain" />
        )}
        {showSchoolSeal && info.school_seal && (
          <img src={info.school_seal} alt="ตราโรงเรียน" className="w-16 h-16 object-contain" />
        )}
        {info.school_logo && !showGaruda && !showSchoolSeal && (
          <img src={info.school_logo} alt="Logo" className="w-14 h-14 object-contain" />
        )}
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground print:text-black">{info.school_name}</h1>
        {info.school_address && <p className="text-xs text-muted-foreground print:text-neutral">{info.school_address}</p>}
        {(info.school_phone || info.school_email) && (
          <p className="text-[11px] text-muted-foreground print:text-neutral">
            {info.school_phone && `โทร. ${info.school_phone}`}
            {info.school_phone && info.school_email && " • "}
            {info.school_email && `อีเมล: ${info.school_email}`}
          </p>
        )}
      </div>
      <div className="pt-2">
        <h2 className="text-lg font-bold text-foreground print:text-black">{documentTitle}</h2>
        {subtitle && <p className="text-sm text-muted-foreground print:text-neutral">{subtitle}</p>}
      </div>
    </div>
  );
};

interface DocumentSignatureProps {
  showDirector?: boolean;
  additionalSigners?: { label: string; signatureId?: string | null }[];
  /** เลือกใช้ลายเซ็นเฉพาะ (เช่นผู้บริหารคนอื่น) — ถ้าไม่ระบุใช้ default */
  directorSignatureId?: string | null;
}

export const DocumentSignature = ({
  showDirector = true,
  additionalSigners = [],
  directorSignatureId,
}: DocumentSignatureProps) => {
  const info = useSchoolInfo();
  const defaultSig = useDefaultSignature();
  const overrideSig = useSignatureById(directorSignatureId);
  const sig = directorSignatureId ? overrideSig : defaultSig;

  const directorName = sig?.name || info.director_name || "";
  const directorTitle = sig?.position || info.director_title;

  return (
    <div className="mt-12 pt-8">
      <div className="flex justify-around flex-wrap gap-8">
        {additionalSigners.map((signer, i) => (
          <SignerSlot key={i} label={signer.label} signatureId={signer.signatureId} />
        ))}
        {showDirector && (
          <div className="text-center">
            <div className="h-14 flex items-end justify-center mb-1">
              {sig?.signature_url && (
                <img
                  src={sig.signature_url}
                  alt={`ลายเซ็น ${directorName}`}
                  className="max-h-full max-w-44 object-contain"
                  crossOrigin="anonymous"
                />
              )}
            </div>
            <div className="w-44 border-b border-foreground/60 mb-2 print:border-black/60 mx-auto" />
            <p className="text-sm font-medium text-foreground print:text-black">
              {directorName ? `(${directorName})` : "(ลงชื่อ)"}
            </p>
            <p className="text-xs text-muted-foreground print:text-neutral">{directorTitle}</p>
          </div>
        )}
      </div>
      <div className="text-center mt-6">
        <p className="text-sm text-muted-foreground print:text-neutral">
          วันที่ ........./.................../...........
        </p>
      </div>
    </div>
  );
};

const SignerSlot = ({ label, signatureId }: { label: string; signatureId?: string | null }) => {
  const sig = useSignatureById(signatureId);
  return (
    <div className="text-center">
      <div className="h-12 flex items-end justify-center mb-1">
        {sig?.signature_url && (
          <img src={sig.signature_url} alt={`ลายเซ็น ${sig.name}`} className="max-h-full max-w-36 object-contain" />
        )}
      </div>
      <div className="w-36 border-b border-foreground/60 mb-2 print:border-black/60 mx-auto" />
      {sig?.name ? (
        <>
          <p className="text-sm font-medium text-foreground print:text-black">({sig.name})</p>
          <p className="text-xs text-muted-foreground print:text-neutral">{sig.position || label}</p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground print:text-neutral">({label})</p>
      )}
    </div>
  );
};

export default DocumentHeader;
