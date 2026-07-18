import * as XLSX from "xlsx";

export interface ExportSchoolInfo {
  school_name: string;
  school_address?: string;
  school_phone?: string;
  obec_code?: string;
  affiliation?: string;
  academic_year?: string;
  garuda_emblem?: string;
  school_logo?: string;
  school_seal?: string;
  director_name?: string;
  director_title?: string;
  director_signature_url?: string;
}

export const beYear = (ce?: number | string) => {
  const n = Number(ce ?? new Date().getFullYear());
  return n + (n < 2500 ? 543 : 0);
};

/** Open a print window with TH Sarabun typography + auto print */
export const openPrintWindow = (innerHtml: string, title: string) => {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @font-face { font-family: 'TH Sarabun New'; src: url('/fonts/thsarabunnew-webfont.woff') format('woff'); font-weight: 400; }
  @font-face { font-family: 'TH Sarabun New'; src: url('/fonts/thsarabunnew_bold-webfont.woff') format('woff'); font-weight: 700; }
  * { box-sizing: border-box; }
  body { font-family: 'TH Sarabun New', 'Sarabun', serif; font-size: 16pt; color: #000; margin: 0; padding: 18mm; }
  h1,h2,h3 { margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 4px 6px; vertical-align: middle; }
  thead th { background: #f0f0f0; text-align: center; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .small { font-size: 13pt; }
  .doc-header { text-align: center; margin-bottom: 14px; }
  .doc-header img { height: 70px; object-fit: contain; }
  .doc-header h1 { font-size: 22pt; }
  .doc-header .sub { font-size: 14pt; color: #333; }
  .sig-row { display: flex; justify-content: space-around; margin-top: 24px; gap: 24px; page-break-inside: avoid; break-inside: avoid; }
  .sig { text-align: center; min-width: 220px; page-break-inside: avoid; break-inside: avoid; }
  .sig .img { height: 40px; }
  .sig .img img { max-height: 40px; object-fit: contain; }
  .sig .line { border-bottom: 1px solid #000; margin: 4px 0; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  @page { size: A4; margin: 12mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
${innerHtml}
<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},400));</script>
</body></html>`);
  w.document.close();
};

export const docHeaderHtml = (info: ExportSchoolInfo, title: string, subtitle?: string) => `
  <div class="doc-header">
    ${info.garuda_emblem ? `<img src="${info.garuda_emblem}" alt="ครุฑ" />` : ""}
    <h1>${info.school_name || ""}</h1>
    ${info.affiliation ? `<div class="sub">${info.affiliation}${info.obec_code ? ` รหัส ${info.obec_code}` : ""}</div>` : ""}
    ${info.school_address ? `<div class="small">${info.school_address}${info.school_phone ? ` โทร. ${info.school_phone}` : ""}</div>` : ""}
    <h2 style="margin-top:10px;">${title}</h2>
    ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
  </div>
`;

export const signatureRowHtml = (info: ExportSchoolInfo) => `
  <div class="sig-row">
    <div class="sig">
      <div class="img">${info.director_signature_url ? `<img src="${info.director_signature_url}" />` : ""}</div>
      <div class="line"></div>
      <div>(${info.director_name || ".............................."})</div>
      <div class="small">${info.director_title || "ผู้อำนวยการโรงเรียน"}</div>
    </div>
  </div>
`;

/** Build XLSX with optional header rows (school info) prepended */
export const buildXlsxWithHeader = (
  info: ExportSchoolInfo,
  sheetName: string,
  title: string,
  rows: (string | number | null)[][],
  filename: string,
) => {
  const headerRows: any[][] = [
    [info.school_name || ""],
    [info.affiliation || "", info.obec_code ? `รหัส ${info.obec_code}` : ""],
    [`ปีการศึกษา ${beYear(info.academic_year as any)}`],
    [title],
    [],
  ];
  const aoa = [...headerRows, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
};

export const sanitizeFn = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80);
