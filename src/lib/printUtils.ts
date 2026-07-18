import { swal } from "@/lib/swal";
/**
 * OBEC-Standard Print Utility
 * สไตล์เอกสารมาตรฐาน สพฐ. สำหรับพิมพ์และ PDF
 * ฟอนต์: TH SarabunIT๙ / TH Sarabun New ขนาด 16pt ตามมาตรฐานหนังสือราชการ
 */

export const OBEC_PRINT_CSS = `
  @font-face {
    font-family: 'TH Sarabun New';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew-webfont.woff') format('woff');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: 'TH Sarabun New';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_bold-webfont.woff') format('woff');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: 'TH Sarabun New';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_italic-webfont.woff') format('woff');
    font-weight: 400;
    font-style: italic;
    font-display: block;
  }

  @font-face {
    font-family: 'TH Sarabun New';
    src: url('__LOVABLE_ORIGIN__/fonts/thsarabunnew_bolditalic-webfont.woff') format('woff');
    font-weight: 700;
    font-style: italic;
    font-display: block;
  }

  /* ระเบียบสำนักนายกฯ: บน 2.5cm, ล่าง ≥2cm, ซ้าย 3cm, ขวา ≥2cm */
  @page {
    size: A4;
    margin: 1.5cm 2cm 1.5cm 3cm;
  }

  @page landscape {
    size: A4 landscape;
    margin: 1.5cm 1.5cm;
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
    font-family: 'TH Sarabun New', 'TH SarabunIT๙', 'Sarabun', 'TH SarabunPSK', sans-serif;
    color: #000;
    font-size: 16pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* === HEADER === */
  .obec-header {
    text-align: center;
    padding-bottom: 10pt;
    margin-bottom: 14pt;
    border-bottom: 1.5px solid #333;
    position: relative;
  }

  .obec-header .header-emblem {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 6pt;
  }

  .obec-header .header-emblem img {
    width: 3cm;
    height: 3cm;
    object-fit: contain;
  }

  .obec-header .school-name {
    font-size: 18pt;
    font-weight: 700;
  }

  .obec-header .school-address {
    font-size: 16pt;
    color: #000;
    margin-top: 2pt;
  }

  .obec-header .doc-title {
    font-size: 18pt;
    font-weight: 700;
    margin-top: 8pt;
  }

  .obec-header .doc-subtitle {
    font-size: 16pt;
    color: #000;
    margin-top: 2pt;
  }

  .obec-header .doc-ref {
    font-size: 16pt;
    color: #000;
    margin-top: 4pt;
  }

  /* === INFO BOX === */
  .obec-info-box {
    border: 1px solid #999;
    border-radius: 0;
    padding: 8pt 12pt;
    margin: 10pt 0;
    background: #fafafa;
  }

  .obec-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2pt 20pt;
    font-size: 16pt;
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
    font-size: 16pt;
    line-height: 1.5;
  }

  /* === TABLE === */
  .obec-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 16pt;
  }

  .obec-table th,
  .obec-table td {
    border: 1px solid #555;
    padding: 3pt 6pt;
    text-align: left;
    vertical-align: middle;
  }

  .obec-table th {
    background: #f0f0f0;
    font-weight: 700;
    font-size: 16pt;
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
    font-size: 14pt;
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
    font-size: 16pt;
    font-weight: 700;
    margin: 16pt 0 8pt;
    padding-bottom: 3pt;
    border-bottom: 1px solid #999;
  }

  .obec-subsection-title {
    font-size: 16pt;
    font-weight: 700;
    margin: 12pt 0 6pt;
  }

  /* === GPA BOX === */
  .obec-summary-box {
    border: 2px solid #333;
    padding: 8pt 14pt;
    margin: 14pt 0;
    display: flex;
    gap: 28pt;
    align-items: center;
    background: #f9f9f9;
  }

  .obec-summary-box .summary-label {
    font-size: 16pt;
  }

  .obec-summary-box .summary-value {
    font-size: 18pt;
    font-weight: 700;
  }

  /* === SIGNATURE === */
  .obec-signatures {
    margin-top: 40pt;
    page-break-inside: avoid;
  }

  .obec-sig-row {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 20pt;
  }

  .obec-sig-item {
    text-align: center;
    min-width: 160px;
  }

  .obec-sig-line {
    width: 180px;
    border-bottom: 1px dotted #333;
    margin: 36pt auto 4pt;
  }

  .obec-sig-name {
    font-size: 16pt;
    font-weight: 700;
  }

  .obec-sig-title {
    font-size: 16pt;
    color: #000;
  }

  .obec-sig-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24pt 14pt;
    margin-top: 8pt;
  }

  .obec-sig-grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20pt;
    margin-top: 8pt;
  }

  /* === DATE === */
  .obec-date {
    text-align: center;
    margin-top: 16pt;
    font-size: 16pt;
  }

  .obec-date-right {
    text-align: right;
    margin-top: 8pt;
    font-size: 16pt;
  }

  /* === GRADE BADGE === */
  .obec-grade {
    display: inline-block;
    padding: 1pt 8pt;
    border: 1px solid #666;
    border-radius: 2px;
    font-size: 16pt;
    font-weight: 700;
    min-width: 28px;
    text-align: center;
  }

  /* === BODY TEXT === */
  .obec-body {
    font-size: 16pt;
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
    margin: 14pt auto;
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
    padding: 10pt;
    min-height: 60pt;
    margin: 6pt 0;
    font-size: 16pt;
  }

  /* === SCORE CRITERIA BOX === */
  .obec-criteria-box {
    border: 1px solid #999;
    padding: 8pt 12pt;
    margin: 10pt 0;
  }

  .obec-criteria-box .criteria-title {
    font-size: 16pt;
    font-weight: 700;
    margin-bottom: 4pt;
  }

  /* === ATTENDANCE BOX === */
  .obec-att-box {
    border: 1px solid #999;
    padding: 6pt 12pt;
    margin: 8pt 0;
    font-size: 16pt;
  }

  /* === PHOTO GRID === */
  .obec-photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 10pt 0;
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
    font-size: 16pt;
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
    font-size: 72pt;
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
    font-size: 14pt;
    color: #999;
    padding: 4pt;
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

  const w = window.open("", "_blank");
  if (!w) {
    swal.info("กรุณาอนุญาตให้เปิด Popup เพื่อพิมพ์เอกสาร");
    return;
  }

  const landscapeCss = landscape
    ? `@page { size: A4 landscape; margin: 15mm 15mm; }`
    : "";
  const printCss = `${OBEC_PRINT_CSS}${landscapeCss}`.replace(/__LOVABLE_ORIGIN__/g, window.location.origin);

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

export const formatThaiDate = (dateStr?: string): string => {
  if (!dateStr) return "........./.................../...........";
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
};

export const currentThaiDate = (): string => {
  return new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
};
