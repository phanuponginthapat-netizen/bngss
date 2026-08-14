// ตัวเรนเดอร์เกียรติบัตร — ใช้ทั้งในหน้าออกแบบ (แก้ไข/ลากวาง) และหน้าพิมพ์
import { forwardRef } from "react";

export type CertField = {
  id: string;
  label: string;
  text: string;            // รองรับตัวแปร {{name}} {{activity}} ฯลฯ
  x: number;               // % จากซ้าย (จุดอ้างอิงกึ่งกลางกล่อง)
  y: number;               // % จากบน
  width: number;           // % ความกว้างกล่อง
  fontSize: number;        // pt (อิงความสูงกระดาษ)
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;   // px
  lineHeight: number;
};

export type CertTemplate = {
  id?: string;
  name: string;
  background_url?: string | null;
  paper: string;                 // A4
  orientation: "landscape" | "portrait";
  font_family: string;
  fields: CertField[];
};

export type CertData = Record<string, string>;

export const CERT_TOKENS: { key: string; label: string }[] = [
  { key: "name", label: "ชื่อผู้รับ" },
  { key: "award", label: "ข้อความรางวัล" },
  { key: "rank", label: "อันดับ/ระดับรางวัล" },
  { key: "activity", label: "ชื่อกิจกรรม/รายการแข่งขัน" },
  { key: "class", label: "ชั้นเรียน" },
  { key: "date", label: "วันที่ออกให้" },
  { key: "cert_no", label: "เลขที่เกียรติบัตร" },
  { key: "school", label: "ชื่อโรงเรียน" },
  { key: "signer_name", label: "ชื่อผู้ลงนาม" },
  { key: "signer_position", label: "ตำแหน่งผู้ลงนาม" },
];

export const CERT_FONTS = [
  { value: "Sarabun, sans-serif", label: "Sarabun" },
  { value: "'TH Sarabun New', Sarabun, sans-serif", label: "TH Sarabun New" },
  { value: "'Noto Serif Thai', serif", label: "Noto Serif Thai" },
  { value: "'Kanit', sans-serif", label: "Kanit" },
  { value: "'Prompt', sans-serif", label: "Prompt" },
  { value: "'Mitr', sans-serif", label: "Mitr" },
  { value: "'Charm', cursive", label: "Charm (ลายมือไทย)" },
];

export const applyTokens = (text: string, data: CertData) =>
  (text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => data[k] ?? "");

/** ขนาดกระดาษ (มม.) */
export const paperSize = (t: Pick<CertTemplate, "orientation">) =>
  t.orientation === "portrait" ? { w: 210, h: 297 } : { w: 297, h: 210 };

export const defaultFields = (): CertField[] => [
  {
    id: "f_title", label: "หัวเรื่อง", text: "เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า",
    x: 50, y: 34, width: 80, fontSize: 20, fontFamily: "Sarabun, sans-serif",
    color: "#1f2937", bold: false, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.4,
  },
  {
    id: "f_name", label: "ชื่อผู้รับ", text: "{{name}}",
    x: 50, y: 45, width: 80, fontSize: 40, fontFamily: "'Charm', cursive",
    color: "#1e3a8a", bold: true, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.3,
  },
  {
    id: "f_award", label: "ข้อความรางวัล", text: "{{award}} {{activity}}",
    x: 50, y: 58, width: 80, fontSize: 22, fontFamily: "Sarabun, sans-serif",
    color: "#1f2937", bold: false, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.5,
  },
  {
    id: "f_date", label: "วันที่", text: "ให้ไว้ ณ วันที่ {{date}}",
    x: 50, y: 70, width: 60, fontSize: 18, fontFamily: "Sarabun, sans-serif",
    color: "#374151", bold: false, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.4,
  },
  {
    id: "f_signer", label: "ผู้ลงนาม", text: "{{signer_name}}\n{{signer_position}}",
    x: 50, y: 84, width: 50, fontSize: 18, fontFamily: "Sarabun, sans-serif",
    color: "#111827", bold: false, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.5,
  },
];

type Props = {
  template: CertTemplate;
  data: CertData;
  /** ความกว้างที่จะเรนเดอร์จริง (px) — ส่วนสูงคำนวณตามสัดส่วนกระดาษ */
  widthPx: number;
  selectedFieldId?: string | null;
  onFieldPointerDown?: (id: string, e: React.PointerEvent) => void;
};

export const CertificateRenderer = forwardRef<HTMLDivElement, Props>(
  ({ template, data, widthPx, selectedFieldId, onFieldPointerDown }, ref) => {
    const size = paperSize(template);
    const heightPx = (widthPx * size.h) / size.w;
    // 1pt ของฟอนต์ = สัดส่วนต่อความสูงกระดาษ (A4 สูง 297mm ≈ 842pt)
    const ptToPx = heightPx / (size.h * 2.8346);

    return (
      <div
        ref={ref}
        style={{
          position: "relative",
          width: widthPx,
          height: heightPx,
          backgroundColor: "#ffffff",
          backgroundImage: template.background_url ? `url(${template.background_url})` : undefined,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          overflow: "hidden",
          fontFamily: template.font_family || "Sarabun, sans-serif",
        }}
      >
        {(template.fields || []).map((f) => (
          <div
            key={f.id}
            onPointerDown={onFieldPointerDown ? (e) => onFieldPointerDown(f.id, e) : undefined}
            style={{
              position: "absolute",
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: `${f.width}%`,
              transform: "translate(-50%, -50%)",
              textAlign: f.align,
              fontSize: f.fontSize * ptToPx,
              fontFamily: f.fontFamily || template.font_family,
              color: f.color,
              fontWeight: f.bold ? 700 : 400,
              fontStyle: f.italic ? "italic" : "normal",
              letterSpacing: f.letterSpacing,
              lineHeight: f.lineHeight,
              whiteSpace: "pre-line",
              cursor: onFieldPointerDown ? "move" : undefined,
              outline:
                selectedFieldId === f.id ? "2px dashed hsl(var(--primary))" : undefined,
              outlineOffset: 4,
              userSelect: "none",
            }}
          >
            {applyTokens(f.text, data)}
          </div>
        ))}
      </div>
    );
  },
);
CertificateRenderer.displayName = "CertificateRenderer";
