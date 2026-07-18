import type { CSSProperties } from "react";
import { replaceSchoolAssetTokens, type SchoolAssetUrls } from "./eformSchoolAssets";

export const EFORM_PAGE_MM = {
  width: 210,
  height: 297,
  marginTop: 25,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 30,
};

export const EFORM_CONTENT_WIDTH_MM = EFORM_PAGE_MM.width - EFORM_PAGE_MM.marginLeft - EFORM_PAGE_MM.marginRight;

export const EFORM_PAGE_STYLE: CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  padding: "25mm 20mm 20mm 30mm",
  boxSizing: "border-box",
  background: "#fff",
  color: "#000",
  fontFamily: "'Sarabun', sans-serif",
  fontSize: "21px",
  lineHeight: 1.5,
};

export const EFORM_PRINT_PAGE_CLASS = "eform-print-page";

export const isEFormPrintWrapped = (html: string | null | undefined) =>
  !!html?.includes(EFORM_PRINT_PAGE_CLASS);

export const wrapEFormPrintHtml = (html: string, style = "", assets?: SchoolAssetUrls | null) => {
  // แทน placeholder ตราครุฑ/ตราโรงเรียน/โลโก้ ด้วย <img> จาก CMS ก่อนเสมอ
  // เพื่อให้ inbox / print / preview เห็นรูปจริงเหมือนตอนออกแบบ
  const replaced = assets ? replaceSchoolAssetTokens(html, assets) : html;
  if (isEFormPrintWrapped(replaced)) return replaced;
  const baseStyle = `width:210mm;min-height:297mm;padding:25mm 20mm 20mm 30mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#000;font-family:'Sarabun', sans-serif;font-size:21px;line-height:1.5;`;
  const merged = `${baseStyle}${style ? `;${style}` : ""}`;
  return `<div class="${EFORM_PRINT_PAGE_CLASS}" style="${merged}">${replaced}</div>`;
};

