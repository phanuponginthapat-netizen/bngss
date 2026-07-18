/**
 * OBEC Report HTML Builder
 * สร้าง HTML สำหรับพิมพ์รายงานตามแบบฟอร์ม สพฐ.
 * ใช้ร่วมกับ openPrintWindow จาก printUtils.ts
 */

export interface ReportHeader {
  schoolName: string;
  schoolAddress?: string;
  logoUrl?: string;
  sealUrl?: string;
  garudaUrl?: string;
  documentTitle: string;
  subtitle?: string;
  docRef?: string;
}

export interface ReportTableColumn {
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface ReportSignature {
  name?: string;
  title: string;
  /** URL ของลายเซ็นดิจิทัล (ถ้ามี) แสดงเหนือเส้นลงชื่อ */
  signatureUrl?: string;
}

/** Build OBEC-standard header HTML */
export const buildHeader = (h: ReportHeader): string => {
  const emblems: string[] = [];
  if (h.garudaUrl) emblems.push(`<img src="${h.garudaUrl}" alt="ตราครุฑ">`);
  if (h.sealUrl) emblems.push(`<img src="${h.sealUrl}" alt="ตราโรงเรียน">`);
  if (!h.garudaUrl && !h.sealUrl && h.logoUrl) emblems.push(`<img src="${h.logoUrl}" alt="Logo">`);

  return `
    <div class="obec-header">
      ${emblems.length ? `<div class="header-emblem">${emblems.join("")}</div>` : ""}
      <div class="school-name">${h.schoolName}</div>
      ${h.schoolAddress ? `<div class="school-address">${h.schoolAddress}</div>` : ""}
      <div class="doc-title">${h.documentTitle}</div>
      ${h.subtitle ? `<div class="doc-subtitle">${h.subtitle}</div>` : ""}
      ${h.docRef ? `<div class="doc-ref">${h.docRef}</div>` : ""}
    </div>`;
};

/** Build info grid (2-column key-value pairs) */
export const buildInfoGrid = (items: { label: string; value: string }[]): string => {
  const rows = items.map(i => `<span class="info-label">${i.label}</span> <span class="info-value">${i.value}</span>`).join("");
  return `<div class="obec-info-box"><div class="obec-info-grid">${rows}</div></div>`;
};

/** Build OBEC table */
export const buildTable = (columns: ReportTableColumn[], rows: string[][], footer?: string[]): string => {
  const nl2br = (s: string) => String(s ?? "").replace(/\n/g, "<br>");
  const ths = columns.map(c => `<th style="${c.width ? `width:${c.width};` : ""}text-align:${c.align || "center"};white-space:normal;line-height:1.2">${nl2br(c.label)}</th>`).join("");
  const trs = rows.map(row => {
    const tds = row.map((cell, i) => `<td style="text-align:${columns[i]?.align || "left"};vertical-align:middle">${nl2br(cell)}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  const tfoot = footer ? `<tfoot><tr>${footer.map((f, i) => `<td style="text-align:${columns[i]?.align || "left"}">${nl2br(f)}</td>`).join("")}</tr></tfoot>` : "";
  return `<table class="obec-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>${tfoot}</table>`;
};

/** Build signature block */
export const buildSignatures = (signers: ReportSignature[], date?: string): string => {
  const items = signers.map(s => `
    <div class="obec-sig-item">
      ${s.signatureUrl ? `<img src="${s.signatureUrl}" alt="ลายเซ็น" style="height:48px;object-fit:contain;margin:0 auto 4px;display:block;">` : `<div style="height:48px"></div>`}
      <div class="obec-sig-line"></div>
      <div class="obec-sig-name">${s.name ? `(${s.name})` : "(ลงชื่อ)"}</div>
      <div class="obec-sig-title">${s.title}</div>
    </div>`).join("");
  return `
    <div class="obec-signatures">
      <div class="obec-sig-row">${items}</div>
      <div class="obec-date">${date || "วันที่ ........./.................../..........."}</div>
    </div>`;
};

/** Build summary box */
export const buildSummaryBox = (items: { label: string; value: string }[]): string => {
  const content = items.map(i => `<span class="summary-label">${i.label}: </span><span class="summary-value">${i.value}</span>`).join("&nbsp;&nbsp;&nbsp;&nbsp;");
  return `<div class="obec-summary-box">${content}</div>`;
};

/** Build section title */
export const buildSectionTitle = (title: string): string => `<div class="obec-section-title">${title}</div>`;

/** Build body text with Thai indent */
export const buildBodyText = (text: string): string => `<div class="obec-body obec-indent">${text}</div>`;

/** Compose full A4 page */
export const wrapA4Page = (content: string): string => `<div class="obec-a4-page">${content}</div>`;
