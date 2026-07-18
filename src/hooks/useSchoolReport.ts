import { useMemo } from "react";
import { useCmsSettingsBulk } from "./useCmsSettings";
import { openPrintWindow, currentThaiDate, type PrintOptions } from "@/lib/printUtils";
import { buildHeader, buildSignatures, wrapA4Page, type ReportSignature } from "@/lib/obecReportBuilder";

interface SchoolInfo {
  school_name: string;
  school_address: string;
  school_logo: string;
  school_seal: string;
  garuda_emblem: string;
  director_name: string;
  director_title: string;
}

export const useSchoolReport = () => {
  const { data: map } = useCmsSettingsBulk();
  const info = useMemo<SchoolInfo>(() => ({
    school_name: map?.school_name || "โรงเรียน",
    school_address: map?.school_address || "",
    school_logo: map?.school_logo || "",
    school_seal: map?.school_seal || "",
    garuda_emblem: map?.garuda_emblem || "",
    director_name: map?.director_name || "",
    director_title: map?.director_title || "ผู้อำนวยการโรงเรียน",
  }), [map]);

  const getHeader = (documentTitle: string, subtitle?: string): string => {
    return buildHeader({
      schoolName: info.school_name,
      schoolAddress: info.school_address,
      logoUrl: info.school_logo,
      sealUrl: info.school_seal,
      garudaUrl: info.garuda_emblem,
      documentTitle,
      subtitle,
    });
  };

  const getDirectorSignature = (additionalSigners?: ReportSignature[]): string => {
    const signers: ReportSignature[] = [
      ...(additionalSigners || []),
      { name: info.director_name, title: info.director_title },
    ];
    return buildSignatures(signers, `วันที่ ${currentThaiDate()}`);
  };

  const printReport = (bodyHtml: string, options?: PrintOptions & { documentTitle: string; subtitle?: string; additionalSigners?: ReportSignature[] }) => {
    const header = getHeader(options?.documentTitle || "รายงาน", options?.subtitle);
    const signatures = getDirectorSignature(options?.additionalSigners);
    const content = wrapA4Page(`${header}${bodyHtml}${signatures}`);
    openPrintWindow(content, {
      title: options?.documentTitle || "รายงาน",
      landscape: options?.landscape,
    });
  };

  return { info, getHeader, getDirectorSignature, printReport };
};
