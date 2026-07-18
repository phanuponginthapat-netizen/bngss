export type PdfFieldType = "text" | "date" | "number" | "currency" | "checkbox" | "image" | "signature" | "qr";

export interface PdfFieldStyle {
  fontSize?: number;          // pt
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: string;             // #rrggbb
}

export interface PdfField {
  id: string;
  page: number;               // 1-based
  x: number;                  // pt, from page left
  y: number;                  // pt, from page TOP (UI coord) — converted on render
  w: number;                  // pt
  h: number;                  // pt
  type: PdfFieldType;
  /** binding like "{student.full_name}" or static text. checkbox: "true"/"false" via binding. */
  binding: string;
  label?: string;
  style?: PdfFieldStyle;
  multiline?: boolean;
  maxLength?: number;
}

export interface PdfTemplateRecord {
  id: string;
  name: string;
  category: PdfTemplateCategory;
  description: string | null;
  source_pdf_url: string;
  source_pdf_path: string | null;
  page_count: number;
  page_width: number | null;
  page_height: number | null;
  fields: PdfField[];
  data_schema: any;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PdfTemplateCategory = "eform" | "pp" | "scholarship" | "home_visit" | "leave" | "other";

export const CATEGORY_LABEL: Record<PdfTemplateCategory, string> = {
  eform: "E-Form",
  pp: "ปพ. / รายงานการเรียน",
  scholarship: "ทุนการศึกษา",
  home_visit: "เยี่ยมบ้าน",
  leave: "ใบลา",
  other: "อื่นๆ",
};
