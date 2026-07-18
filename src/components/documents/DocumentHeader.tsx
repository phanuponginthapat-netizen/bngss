import { useMemo } from "react";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";

interface DocumentHeaderProps {
  showGaruda?: boolean;
  showSchoolSeal?: boolean;
  subtitle?: string;
  documentTitle: string;
}

interface SchoolInfo {
  school_name: string;
  school_address: string;
  school_logo: string;
  school_seal: string;
  garuda_emblem: string;
  director_name: string;
  director_title: string;
  director_signature: string;
}

export const useSchoolInfo = (): SchoolInfo => {
  const { data: map } = useCmsSettingsBulk();
  return useMemo<SchoolInfo>(() => ({
    school_name: map?.school_name || "",
    school_address: map?.school_address || "",
    school_logo: map?.school_logo || "",
    school_seal: map?.school_seal || "",
    garuda_emblem: map?.garuda_emblem || "",
    director_name: map?.director_name || "",
    director_title: map?.director_title || "",
    director_signature: map?.director_signature || "",
  }), [map]);
};


const DocumentHeader = ({ showGaruda, showSchoolSeal, subtitle, documentTitle }: DocumentHeaderProps) => {
  const info = useSchoolInfo();

  return (
    <div className="text-center space-y-3 pb-4 border-b-2 border-foreground/20 print:border-black/40">
      <div className="flex items-center justify-center gap-6">
        {showGaruda && info.garuda_emblem && (
          <img loading="lazy" decoding="async" src={info.garuda_emblem} alt="ตราครุฑ" className="w-16 h-16 object-contain" />
        )}
        {showSchoolSeal && info.school_seal && (
          <img loading="lazy" decoding="async" src={info.school_seal} alt="ตราโรงเรียน" className="w-16 h-16 object-contain" />
        )}
        {info.school_logo && !showGaruda && !showSchoolSeal && (
          <img loading="lazy" decoding="async" src={info.school_logo} alt="Logo" className="w-14 h-14 object-contain" />
        )}
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground print:text-black">{info.school_name}</h1>
        {info.school_address && <p className="text-xs text-muted-foreground print:text-gray-600">{info.school_address}</p>}
      </div>
      <div className="pt-2">
        <h2 className="text-lg font-bold text-foreground print:text-black">{documentTitle}</h2>
        {subtitle && <p className="text-sm text-muted-foreground print:text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
};

export const DocumentSignature = ({ showDirector = true, additionalSigners = [] }: { showDirector?: boolean; additionalSigners?: { label: string }[] }) => {
  const info = useSchoolInfo();

  return (
    <div className="mt-12 pt-8">
      <div className="flex justify-around flex-wrap gap-8">
        {additionalSigners.map((signer, i) => (
          <div key={i} className="text-center">
            <div className="w-36 border-b border-foreground/60 mb-2 print:border-black/60 mx-auto" />
            <p className="text-xs text-muted-foreground print:text-gray-600">({signer.label})</p>
          </div>
        ))}
        {showDirector && (
          <div className="text-center">
            {info.director_signature ? (
              <img loading="lazy" decoding="async"
                src={info.director_signature}
                alt="ลายเซ็นผู้อำนวยการ"
                className="h-12 mx-auto object-contain mb-1"
              />
            ) : (
              <div className="h-12" />
            )}
            <div className="w-40 border-b border-foreground/60 mb-2 print:border-black/60 mx-auto" />
            <p className="text-sm font-medium text-foreground print:text-black">
              {info.director_name ? `(${info.director_name})` : "(ลงชื่อ)"}
            </p>
            <p className="text-xs text-muted-foreground print:text-gray-600">{info.director_title}</p>
          </div>
        )}
      </div>
      <div className="text-center mt-6">
        <p className="text-sm text-muted-foreground print:text-gray-600">
          วันที่ ........./.................../...........
        </p>
      </div>
    </div>
  );
};

export default DocumentHeader;
