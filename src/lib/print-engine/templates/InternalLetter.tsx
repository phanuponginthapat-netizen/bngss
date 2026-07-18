import { OfficialDocSpec } from "../types";
import { PAGE, FONT, SPACING } from "../constants";
import { SignerBlock } from "../SignerBlock";

const mm = (n: number) => `${n}mm`;
const pt = (n: number) => `${n}px`; // was pt — FONT constants already in px

/**
 * บันทึกข้อความ (หนังสือภายใน) — ตามคู่มือสำนักนายกฯ
 * หัวเรื่อง "บันทึกข้อความ" กึ่งกลาง, มี "ส่วนราชการ / ที่ / วันที่ / เรื่อง" เป็นแถว
 */
export const InternalLetter = ({ spec }: { spec: OfficialDocSpec }) => {
  const L = PAGE.marginLeft;
  const R = PAGE.marginRight;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* หัว "บันทึกข้อความ" */}
      <div
        style={{
          position: "absolute",
          top: mm(15),
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: pt(29),
          fontWeight: "bold",
          letterSpacing: "0.5mm",
        }}
      >
        บันทึกข้อความ
      </div>

      {/* ส่วนหัวเอกสาร */}
      <div
        style={{
          position: "absolute",
          top: mm(33),
          left: mm(L),
          right: mm(R),
          fontSize: pt(FONT.body),
          lineHeight: 1.5,
        }}
      >
        <HeadRow label="ส่วนราชการ" value={spec.school.name} />
        <HeadRow label="ที่" value={spec.refNo} extra={<><span style={{ marginLeft: "30mm" }}>วันที่ {spec.date}</span></>} />
        <HeadRow label="เรื่อง" value={spec.subject} />
      </div>

      {/* เส้นใต้หัว */}
      <div
        style={{
          position: "absolute",
          left: mm(L),
          right: mm(R),
          top: mm(60),
          borderTop: "1px solid #000",
        }}
      />

      {/* เนื้อความ */}
      <div
        style={{
          position: "absolute",
          left: mm(L),
          right: mm(R),
          top: mm(65),
          fontSize: pt(FONT.body),
          lineHeight: 1.4,
        }}
      >
        {spec.to && (
          <div style={{ marginBottom: mm(3) }}>เรียน {spec.to}</div>
        )}
        {spec.body.split("\n\n").map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              marginBottom: mm(2),
              textIndent: mm(SPACING.paragraphIndent),
              textAlign: "justify",
            }}
          >
            {p}
          </p>
        ))}
        {spec.closing && (
          <p
            style={{
              margin: 0,
              marginTop: mm(2),
              textIndent: mm(SPACING.paragraphIndent),
            }}
          >
            {spec.closing}
          </p>
        )}

        {/* ลงนาม — ครึ่งขวา */}
        <SignerBlock signer={spec.signer} marginTopMm={10} />

      </div>
    </div>
  );
};

const HeadRow = ({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
}) => (
  <div style={{ display: "flex", marginBottom: "1mm" }}>
    <div style={{ width: "30mm", fontWeight: "bold" }}>{label}</div>
    <div style={{ flex: 1 }}>
      {value}
      {extra}
    </div>
  </div>
);
