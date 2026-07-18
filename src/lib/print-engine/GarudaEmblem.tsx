/**
 * ครุฑครึ่งตัว (Half-Garuda) สำหรับหัวเอกสารราชการ
 * SVG แบบ simplified — แทนรูปจริงได้ภายหลัง
 */
interface Props {
  sizeMm: number;
}

export const GarudaEmblem = ({ sizeMm }: Props) => (
  <svg
    width={`${sizeMm}mm`}
    height={`${sizeMm}mm`}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
  >
    {/* placeholder geometric garuda — ควรเปลี่ยนเป็น path ครุฑจริงเมื่อมีไฟล์ */}
    <g fill="#000">
      <ellipse cx="50" cy="30" rx="8" ry="10" />
      <path d="M50 38 Q35 50 20 80 L80 80 Q65 50 50 38 Z" />
      <path d="M20 55 Q5 60 8 80 L20 78 Z" />
      <path d="M80 55 Q95 60 92 80 L80 78 Z" />
      <circle cx="46" cy="28" r="1.5" fill="#fff" />
      <circle cx="54" cy="28" r="1.5" fill="#fff" />
    </g>
  </svg>
);
