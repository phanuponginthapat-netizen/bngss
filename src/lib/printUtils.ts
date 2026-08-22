import { swal } from "@/lib/swal";
/**
 * OBEC-Standard Print Utility
 * สไตล์เอกสารมาตรฐาน สพฐ. สำหรับพิมพ์และ PDF
 * ฟอนต์: Sarabun / TH Sarabun New ขนาด 21px ตามมาตรฐานหนังสือราชการ
 */

const OBEC_PRINT_CSS = `
  @font-face {
    font-family: 'Sarabun';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew-webfont.woff') format('woff');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: 'Sarabun';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_bold-webfont.woff') format('woff');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: 'Sarabun';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_italic-webfont.woff') format('woff');
    font-weight: 400;
    font-style: italic;
    font-display: block;
  }

  @font-face {
    font-family: 'Sarabun';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_bolditalic-webfont.woff') format('woff');
    font-weight: 700;
    font-style: italic;
    font-display: block;
  }

  /* ค่าเริ่มต้นของระบบพิมพ์เดิม: ให้แต่ละ template คุมระยะเอง */
  @page {
    size: A4;
    margin: 0;
  }

  @page landscape {
    size: A4 landscape;
    margin: 0;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    margin: 0;
    font-family: 'Sarabun', 'Sarabun', 'Sarabun', 'Sarabun', sans-serif;
    color: #000;
    font-size: 21px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ค่าตั้งต้น (ใช้กรณี wrapper ไม่ได้ embed inline style) — สอดคล้องกับ EFORM_PAGE_STYLE */
  .eform-print-page {
    width: 210mm;
    min-height: 297mm;
    max-width: 210mm;
    padding: 25mm 20mm 20mm 30mm;
    box-sizing: border-box;
    margin: 0 auto;
    color: #000;
    font-family: 'Sarabun', sans-serif;
    font-size: 21px;
    line-height: 1.5;
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .eform-print-page * {
    max-width: 100%;
    box-sizing: border-box;
  }

  .eform-print-page img {
    max-width: 100% !important;
    height: auto !important;
    object-fit: contain;
  }

  .eform-print-page table {
    table-layout: fixed !important;
    width: 100% !important;
  }

  .eform-print-page p {
    max-width: 100%;
    margin: 0 0 8px 0;
    line-height: 1.4;
  }

  .eform-print-page h1,
  .eform-print-page h2,
  .eform-print-page h3 {
    margin: 0 0 16px 0;
    line-height: 1.35;
  }

  .eform-print-page div {
    max-width: 100%;
  }

  .eform-print-page table {
    border-collapse: collapse;
    max-width: 100%;
  }

  .eform-print-page td,
  .eform-print-page th {
    position: relative;
    box-sizing: border-box;
    min-width: 1em;
    vertical-align: top;
  }

  .eform-print-page td[style*="height"] > p,
  .eform-print-page th[style*="height"] > p,
  .eform-print-page tr[style*="height"] td > p,
  .eform-print-page tr[style*="height"] th > p {
    margin: 0 !important;
    line-height: 1.1;
  }

  .eform-print-page td[style*="height"],
  .eform-print-page th[style*="height"] {
    overflow: hidden;
  }

  .eform-print-page [data-eform-field]:not([data-eform-field-type="image"]) {
    display: inline-block;
    min-width: 28mm;
    max-width: 100%;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  /* === HEADER === */
  .obec-header {
    text-align: center;
    padding-bottom: 13px;
    margin-bottom: 19px;
    border-bottom: 1.5px solid #333;
    position: relative;
  }

  .obec-header .header-emblem {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 8px;
  }

  .obec-header .header-emblem img {
    width: 3cm;
    height: 3cm;
    object-fit: contain;
  }

  .obec-header .school-name {
    font-size: 24px;
    font-weight: 700;
  }

  .obec-header .school-address {
    font-size: 21px;
    color: #000;
    margin-top: 3px;
  }

  .obec-header .doc-title {
    font-size: 24px;
    font-weight: 700;
    margin-top: 11px;
  }

  .obec-header .doc-subtitle {
    font-size: 21px;
    color: #000;
    margin-top: 3px;
  }

  .obec-header .doc-ref {
    font-size: 21px;
    color: #000;
    margin-top: 5px;
  }

  /* === INFO BOX === */
  .obec-info-box {
    border: 1px solid #999;
    border-radius: 0;
    padding: 11px 16px;
    margin: 13px 0;
    background: #fafafa;
  }

  .obec-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 27px;
    font-size: 21px;
    line-height: 1.5;
  }

  .obec-info-grid .info-label {
    color: #000;
    min-width: 90px;
    display: inline;
  }

  .obec-info-grid .info-value {
    font-weight: 700;
  }

  .obec-info-single {
    font-size: 21px;
    line-height: 1.5;
  }

  /* === TABLE === */
  .obec-table {
    width: 100%;
    border-collapse: collapse;
    margin: 13px 0;
    font-size: 21px;
  }

  .obec-table th,
  .obec-table td {
    border: 1px solid #555;
    padding: 4px 8px;
    text-align: left;
    vertical-align: middle;
  }

  .obec-table th {
    background: #f0f0f0;
    font-weight: 700;
    font-size: 21px;
    text-align: center;
    white-space: nowrap;
  }

  .obec-table td.center,
  .obec-table th.center {
    text-align: center;
  }

  .obec-table td.right {
    text-align: right;
  }

  .obec-table td.bold {
    font-weight: 700;
  }

  .obec-table td.mono {
    font-family: 'Courier New', monospace;
    font-size: 19px;
  }

  .obec-table tr:nth-child(even) {
    background: #fafafa;
  }

  .obec-table tfoot td {
    font-weight: 700;
    background: #f5f5f5;
    border-top: 2px solid #333;
  }

  /* === SECTION === */
  .obec-section-title {
    font-size: 21px;
    font-weight: 700;
    margin: 21px 0 11px;
    padding-bottom: 4px;
    border-bottom: 1px solid #999;
  }

  .obec-subsection-title {
    font-size: 21px;
    font-weight: 700;
    margin: 16px 0 8px;
  }

  /* === GPA BOX === */
  .obec-summary-box {
    border: 2px solid #333;
    padding: 11px 19px;
    margin: 19px 0;
    display: flex;
    gap: 37px;
    align-items: center;
    background: #f9f9f9;
  }

  .obec-summary-box .summary-label {
    font-size: 21px;
  }

  .obec-summary-box .summary-value {
    font-size: 24px;
    font-weight: 700;
  }

  /* === SIGNATURE === */
  .obec-signatures {
    margin-top: 53px;
    page-break-inside: avoid;
  }

  .obec-sig-row {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 27px;
  }

  .obec-sig-item {
    text-align: center;
    min-width: 160px;
  }

  .obec-sig-line {
    width: 180px;
    border-bottom: 1px dotted #333;
    margin: 48px auto 5px;
  }

  .obec-sig-name {
    font-size: 21px;
    font-weight: 700;
  }

  .obec-sig-title {
    font-size: 21px;
    color: #000;
  }

  .obec-sig-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px 19px;
    margin-top: 11px;
  }

  .obec-sig-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 27px;
    margin-top: 11px;
  }

  /* === DATE === */
  .obec-date {
    text-align: center;
    margin-top: 21px;
    font-size: 21px;
  }

  .obec-date-right {
    text-align: right;
    margin-top: 11px;
    font-size: 21px;
  }

  /* === GRADE BADGE === */
  .obec-grade {
    display: inline-block;
    padding: 1px 11px;
    border: 1px solid #666;
    border-radius: 2px;
    font-size: 21px;
    font-weight: 700;
    min-width: 28px;
    text-align: center;
  }

  /* === BODY TEXT === */
  .obec-body {
    font-size: 21px;
    line-height: 1.5;
    text-align: justify;
  }

  .obec-indent {
    text-indent: 2.5cm;
  }

  /* === SEAL === */
  .obec-seal {
    width: 70px;
    height: 70px;
    border: 2px solid #999;
    border-radius: 50%;
    margin: 19px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .obec-seal img {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }

  /* === COMMENT BOX === */
  .obec-comment-box {
    border: 1px solid #999;
    padding: 13px;
    min-height: 80px;
    margin: 8px 0;
    font-size: 21px;
  }

  /* === SCORE CRITERIA BOX === */
  .obec-criteria-box {
    border: 1px solid #999;
    padding: 11px 16px;
    margin: 13px 0;
  }

  .obec-criteria-box .criteria-title {
    font-size: 21px;
    font-weight: 700;
    margin-bottom: 5px;
  }

  /* === ATTENDANCE BOX === */
  .obec-att-box {
    border: 1px solid #999;
    padding: 8px 16px;
    margin: 11px 0;
    font-size: 21px;
  }

  /* === PHOTO GRID === */
  .obec-photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 13px 0;
  }

  .obec-photo-grid img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    border: 1px solid #999;
  }

  /* === PAGE BREAK === */
  .obec-page-break {
    page-break-before: always;
  }

  .obec-no-break {
    page-break-inside: avoid;
  }

  /* === A4 PAGE CONTAINER === */
  .obec-a4-page {
    width: 100%;
    max-width: 16cm;
    margin: 0 auto;
    font-size: 21px;
    line-height: 1.4;
    color: #000;
  }

  .obec-a4-page p {
    margin: 0;
  }

  .obec-a4-page .page-break {
    page-break-before: always;
  }

  .obec-a4-page .no-break,
  .obec-a4-page .obec-sig-block {
    page-break-inside: avoid;
  }

  @media print {
    .obec-a4-page {
      max-width: none;
    }
  }

  /* === LANDSCAPE === */
  .obec-landscape {
    /* Handled by @page landscape */
  }

  /* === WATERMARK === */
  .obec-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 96px;
    color: rgba(0, 0, 0, 0.03);
    font-weight: 700;
    z-index: -1;
    pointer-events: none;
  }

  /* === FOOTER === */
  .obec-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 19px;
    color: #999;
    padding: 5px;
    border-top: 1px solid #ddd;
  }
`;

export interface PrintOptions {
  title?: string;
  landscape?: boolean;
  showWatermark?: boolean;
  watermarkText?: string;
}

export const openPrintWindow = (htmlContent: string, options: PrintOptions = {}) => {
  const { title = "เอกสาร", landscape = false } = options;
  const isEFormDocument = htmlContent.includes("eform-print-page");

  const w = window.open("", "_blank");
  if (!w) {
    swal.info("กรุณาอนุญาตให้เปิด Popup เพื่อพิมพ์เอกสาร");
    return;
  }

  const landscapeCss = landscape
    ? `@page { size: A4 landscape; margin: 15mm 15mm; }`
    : "";
  const eFormPrintCss = isEFormDocument
    ? `
      /* E-Form ต้องใช้ @page margin ตอนพิมพ์ เพื่อให้หัว/ท้ายกระดาษถูกกันไว้ซ้ำทุกหน้า
         ไม่ใช่ padding บน wrapper ซึ่งมีผลแค่หน้าแรกและทำให้เนื้อหาล้นเข้า footer/header ในหน้าถัดไป */
      @page { size: ${landscape ? "A4 landscape" : "A4"}; margin: 25mm 20mm 20mm 30mm; }
      @media print {
        html, body { width: auto; min-height: auto; background: #fff; }
        .eform-print-page {
          width: auto !important;
          min-height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          break-inside: auto;
          page-break-inside: auto;
        }
        .eform-print-page h1,
        .eform-print-page h2,
        .eform-print-page h3,
        .eform-print-page tr,
        .eform-print-page td,
        .eform-print-page th,
        .eform-print-page img {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    `
    : "";
  const printCss = `${OBEC_PRINT_CSS}${landscapeCss}${eFormPrintCss}`.replace(/__LOVABLE_ORIGIN__/g, window.location.origin);

  const waitForPrintAssets = async () => {
    const fontPromise = w.document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
    const imagePromises = Array.from(w.document.images)
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      );

    await Promise.all([fontPromise, ...imagePromises]);
  };

  w.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <base href="${window.location.origin}/">
  <style>${printCss}</style>
</head>
<body>
${htmlContent}
</body>
</html>`);
  w.document.close();
  w.onload = () => {
    waitForPrintAssets().finally(() => {
      w.setTimeout(() => {
        w.focus();
        w.print();
      }, 150);
    });
  };
};

export const printElementById = (elementId: string, options: PrintOptions = {}) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  openPrintWindow(el.innerHTML, options);
};

export const printRef = (ref: React.RefObject<HTMLDivElement>, options: PrintOptions = {}) => {
  if (!ref.current) return;
  openPrintWindow(ref.current.innerHTML, options);
};

import { formatThaiLong } from "@/lib/dateBE";

export const formatThaiDate = (dateStr?: string): string => {
  if (!dateStr) return "........./.................../...........";
  // ใช้ Asia/Bangkok + ปฏิทินพุทธ เพื่อให้พิมพ์เอกสาร/PDF ได้วันไทย พ.ศ. ตรงกันทุกอุปกรณ์
  return formatThaiLong(dateStr) || "........./.................../...........";
};

export const currentThaiDate = (): string => {
  return formatThaiLong(new Date());
};


/** แปลงเลขอารบิกเป็นเลขไทย ตามมาตรฐานหนังสือราชการ/สพฐ. */
export const toThaiDigits = (input: string | number | null | undefined): string => {
  if (input === null || input === undefined) return "";
  const map = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  return String(input).replace(/[0-9]/g, (d) => map[Number(d)]);
};
